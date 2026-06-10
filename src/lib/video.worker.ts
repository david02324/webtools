/// <reference lib="webworker" />
// 동영상의 한 구간을 애니메이션 WebP 로 만드는 워커.
//   mp4box(스트리밍 디뮤서) → WebCodecs VideoDecoder(디코드) → 구간/ fps 샘플링 →
//   OffscreenCanvas 리사이즈 → @jsquash/webp(프레임별 정적 WebP) → webp-anim(묶기)
//
// 파일 전체를 메모리에 올리지 않는다(대용량 OOM 방지):
//   - 메인 스레드에 read 메시지로 필요한 구간만 청크 단위로 요청한다.
//   - moov 를 찾으면(파일 끝에 있어도 mdat 은 건너뛰며 점프) 시작 지점 직전
//     키프레임으로 시크해 그 뒤만 읽고, 구간이 끝나면 읽기를 멈춘다.
//   - 디코더에 넣은 샘플은 releaseUsedSamples 로 즉시 해제한다.
import encodeWebp from '@jsquash/webp/encode';
import { createFile, DataStream, Endianness, MP4BoxBuffer } from 'mp4box';
import type { ISOFile, Sample } from 'mp4box';
import { buildAnimatedWebp, type AnimFrame } from './webp-anim';

export interface VideoRequest {
  type: 'start';
  id: number;
  /** 파일 전체 크기(byte). 바이트는 read/chunk 메시지로 청크 단위 전송된다. */
  fileSize: number;
  startSec: number;
  endSec: number;
  fps: number;
  /** 출력 가로(px). 세로는 원본 비율로 맞춘다. */
  width: number;
  quality: number;
  /** 반복 횟수(0 = 무한) */
  loop: number;
}

/** 메인 스레드가 read 요청에 응답해 보내는 파일 조각. */
export interface VideoChunkMessage {
  type: 'chunk';
  id: number;
  buffer?: ArrayBuffer;
  /** 읽기 실패 시 에러 메시지(클라우드 미다운로드 등) */
  error?: string;
}

export type VideoErrorCode = 'unsupported-codec' | 'no-video' | 'read-failed';

export type VideoResponse =
  | { id: number; type: 'read'; offset: number; size: number }
  | { id: number; type: 'progress'; done: number; total: number }
  | { id: number; type: 'done'; blob: Blob; width: number; height: number; frames: number; durationMs: number }
  | { id: number; type: 'error'; error: string; code?: VideoErrorCode };

/** 한 번에 메인 스레드에 요청하는 파일 조각 크기. */
const CHUNK_SIZE = 8 * 1024 * 1024;

// avcC/hvcC/av1C/vpcC 박스를 VideoDecoder 의 description 으로 직렬화한다(8바이트 박스 헤더 제거).
// 코덱 설정 박스가 들어있는 sample description 엔트리에서 coded 크기도 함께 꺼낸다.
function getCodecConfig(mp4: ISOFile, trackId: number): {
  description?: Uint8Array;
  codedWidth?: number;
  codedHeight?: number;
} {
  const trak = mp4.getTrackById(trackId);
  const entries = trak?.mdia?.minf?.stbl?.stsd?.entries ?? [];
  for (const entry of entries) {
    const e = entry as { avcC?: unknown; hvcC?: unknown; av1C?: unknown; vpcC?: unknown; width?: number; height?: number };
    const box = (e.avcC ?? e.hvcC ?? e.av1C ?? e.vpcC) as { write(s: DataStream): void } | undefined;
    if (box) {
      const stream = new DataStream(undefined, 0, Endianness.BIG_ENDIAN);
      box.write(stream);
      return {
        description: new Uint8Array(stream.buffer, 8),
        codedWidth: e.width,
        codedHeight: e.height,
      };
    }
  }
  return {};
}

// 짝수로 반올림(코덱·캔버스가 짝수 치수를 선호).
function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

// 워커 → 메인 read 요청에 대한 chunk 응답 대기열.
const pendingReads = new Map<number, (msg: VideoChunkMessage) => void>();

function readChunk(id: number, offset: number, size: number): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    pendingReads.set(id, (msg) => {
      pendingReads.delete(id);
      if (!msg.buffer) {
        reject(Object.assign(new Error(msg.error ?? '파일을 읽지 못했습니다.'), { code: 'read-failed' as const }));
      } else {
        resolve(msg.buffer);
      }
    });
    post({ id, type: 'read', offset, size });
  });
}

async function run(req: VideoRequest): Promise<void> {
  const { id, fileSize, startSec, endSec, fps, width, quality, loop } = req;

  const mp4 = createFile();
  let movie: import('mp4box').Movie | null = null;
  let mp4Error: Error | null = null;
  mp4.onError = (_mod: string, msg: string) => {
    mp4Error = new Error(`mp4box: ${msg}`);
  };
  mp4.onReady = (info) => {
    movie = info;
  };

  const sampleQueue: Sample[] = [];
  let videoTrackId = -1;
  mp4.onSamples = (tid: number, _user: unknown, samps: Sample[]) => {
    if (tid === videoTrackId) {
      for (const s of samps) sampleQueue.push(s);
    } else if (samps.length > 0) {
      // 비디오 외 트랙(오디오 등)도 추출해 즉시 해제한다. 그래야 같은 버퍼에 섞여
      // 있는 바이트가 '사용됨' 처리되어 mp4box 내부 버퍼가 메모리에서 풀려난다.
      mp4.releaseUsedSamples(tid, samps[samps.length - 1].number + 1);
    }
  };

  // 다음 청크를 읽어 mp4box 에 붙인다. appendBuffer 가 다음으로 읽을 파일 위치를
  // 알려주므로(불완전한 mdat 은 건너뛴다) 그 위치를 따라간다.
  let offset = 0;
  let eof = false;
  const appendNext = async (): Promise<void> => {
    const size = Math.min(CHUNK_SIZE, fileSize - offset);
    if (size <= 0) {
      eof = true;
      return;
    }
    const ab = await readChunk(id, offset, size);
    const last = offset + ab.byteLength >= fileSize;
    const next = mp4.appendBuffer(MP4BoxBuffer.fromArrayBuffer(ab, offset), last);
    offset = typeof next === 'number' && Number.isFinite(next) ? next : offset + ab.byteLength;
    if (offset >= fileSize) eof = true;
  };

  // 1) 메타데이터(moov)를 찾을 때까지 파싱한다.
  while (!movie && !mp4Error && !eof) await appendNext();
  if (mp4Error) throw mp4Error;
  const info = movie as import('mp4box').Movie | null;
  if (!info) throw new Error('동영상 메타데이터(moov)를 찾지 못했습니다.');

  const track = info.videoTracks?.[0];
  if (!track) throw Object.assign(new Error('no-video'), { code: 'no-video' });
  videoTrackId = track.id;
  const config = getCodecConfig(mp4, track.id);
  const timescale = track.timescale;
  const cts2us = (cts: number) => Math.round((cts / timescale) * 1e6);
  const startUs = startSec * 1e6;
  const endUs = endSec * 1e6;

  // 코덱 지원 사전 확인 → 미지원이면 친절한 에러.
  const decoderConfig: VideoDecoderConfig = {
    codec: track.codec,
    codedWidth: config.codedWidth ?? track.track_width,
    codedHeight: config.codedHeight ?? track.track_height,
    description: config.description,
  };
  let supported = false;
  try {
    supported = (await VideoDecoder.isConfigSupported(decoderConfig)).supported === true;
  } catch {
    supported = false;
  }
  if (!supported) {
    throw Object.assign(new Error(`unsupported-codec: ${track.codec}`), { code: 'unsupported-codec' });
  }

  // 출력 캔버스(목표 가로, 원본 비율, 짝수 치수).
  const srcW = track.track_width || config.codedWidth || width;
  const srcH = track.track_height || config.codedHeight || width;
  const tw = even(Math.min(width, srcW));
  const th = even(tw * (srcH / srcW));
  const canvas = new OffscreenCanvas(tw, th);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D 컨텍스트를 만들 수 없습니다.');

  const fpsInterval = 1 / fps;
  const totalTicks = Math.max(1, Math.round((endSec - startSec) * fps));
  const frameDurationMs = Math.round(1000 / fps);

  const animFrames: AnimFrame[] = [];
  let captured = 0;
  let nextTick = startSec;
  let encodeChain: Promise<void> = Promise.resolve();
  let decoderError: Error | null = null;
  let pendingEncode = 0; // 캡처됐지만 아직 인코딩 안 끝난 ImageData 수(메모리 백프레셔용)

  const decoder = new VideoDecoder({
    output: (frame) => {
      try {
        const tSec = frame.timestamp / 1e6;
        // 구간 시작 전 프레임(키프레임부터 디코드하느라 나온 것)과 끝 이후는 버린다.
        if (tSec + 1e-6 < startSec || tSec > endSec + fpsInterval) return;
        // 다음 tick(=start + n/fps)에 도달한 첫 프레임만 캡처.
        if (captured < totalTicks && tSec + 1e-9 >= nextTick) {
          ctx.drawImage(frame, 0, 0, tw, th);
          const imageData = ctx.getImageData(0, 0, tw, th);
          captured++;
          pendingEncode++;
          nextTick = startSec + captured * fpsInterval;
          encodeChain = encodeChain.then(async () => {
            const webp = await encodeWebp(imageData, { quality });
            animFrames.push({ webp: new Uint8Array(webp), durationMs: frameDurationMs });
            pendingEncode--;
            post({ id, type: 'progress', done: animFrames.length, total: totalTicks });
          });
        }
      } finally {
        frame.close();
      }
    },
    error: (e) => {
      decoderError = e instanceof Error ? e : new Error(String(e));
    },
  });
  decoder.configure(decoderConfig);

  // 백프레셔: 디코더 입력 큐(decodeQueueSize)와 인코딩 대기 중인 ImageData(pendingEncode)
  // 둘 다 일정 수준 이하로 유지해, 디코드된 프레임/캡처 버퍼가 메모리에 쌓여 OOM 나는 걸 막는다.
  // 'dequeue' 이벤트는 구버전 크롬에 없을 수 있어 큐 크기를 폴링한다.
  const MAX_QUEUE = 6;
  const MAX_PENDING = 8;
  const backpressure = async () => {
    while (!decoderError && (decoder.decodeQueueSize > MAX_QUEUE || pendingEncode > MAX_PENDING)) {
      await new Promise((res) => setTimeout(res, 4));
    }
  };

  const feed = async (s: Sample) => {
    await backpressure();
    decoder.decode(
      new EncodedVideoChunk({
        type: s.is_sync ? 'key' : 'delta',
        timestamp: cts2us(s.cts),
        duration: Math.round((s.duration / timescale) * 1e6),
        data: s.data as AllowSharedBufferSource,
      }),
    );
  };

  // 2) 모든 트랙에 추출 옵션을 걸고, 시작 지점 직전 키프레임으로 시크해 거기서부터 읽는다.
  //    (fMP4 등 샘플 테이블이 없어 시크가 안 되면 순차 읽기로 폴백)
  for (const t of info.tracks ?? []) {
    mp4.setExtractionOptions(t.id, undefined, { nbSamples: 64 });
  }
  try {
    const seekTo = mp4.seek(Math.max(0, startSec), true);
    if (Number.isFinite(seekTo.offset) && seekTo.offset >= 0 && seekTo.offset < fileSize) {
      offset = seekTo.offset;
      eof = false;
    }
  } catch {
    /* 순차 읽기 폴백 */
  }
  mp4.start();

  // 3) 샘플을 흘려보내며 디코드한다. 시작 직전 키프레임(RAP)이 확정될 때까지는
  //    GOP 후보만 모아 두고(더 가까운 RAP 가 나오면 버림), 시작 시점에 도달하면
  //    후보를 디코더에 밀어 넣고 직행 모드로 전환한다.
  let gop: Sample[] = [];
  let direct = false;
  let flushedTail = false;

  while (!decoderError && !mp4Error) {
    if (captured >= totalTicks) break; // 필요한 프레임을 모두 캡처했다
    const s = sampleQueue.shift();
    if (!s) {
      if (!eof) await appendNext();
      else if (!flushedTail) {
        mp4.flush(); // 64개 미만으로 남은 마지막 배치 강제 전달
        flushedTail = true;
      } else break;
      continue;
    }
    const sUs = cts2us(s.cts);
    if (direct) {
      if (s.is_sync && sUs > endUs) break; // 구간 이후의 새 GOP — 더 읽을 필요 없다
      await feed(s);
      mp4.releaseUsedSamples(track.id, s.number + 1);
    } else if (sUs + 1 >= startUs && (gop.length > 0 || s.is_sync)) {
      // 시작 시점 도달 — 모아둔 GOP(시작 직전 RAP부터) + 이 샘플부터 실제 디코드.
      for (const g of gop) await feed(g);
      gop = [];
      await feed(s);
      mp4.releaseUsedSamples(track.id, s.number + 1);
      direct = true;
    } else if (s.is_sync) {
      gop = [s]; // 더 가까운 RAP — 이전 후보는 버린다
      mp4.releaseUsedSamples(track.id, s.number);
    } else if (gop.length > 0) {
      gop.push(s);
    } else {
      mp4.releaseUsedSamples(track.id, s.number + 1); // 첫 RAP 이전 — 디코드 불가
    }
  }
  mp4.stop();

  try {
    if (!decoderError) await decoder.flush();
  } catch (e) {
    decoderError = decoderError ?? (e instanceof Error ? e : new Error(String(e)));
  }
  await encodeChain;
  decoder.close();
  if (decoderError) throw decoderError;
  if (mp4Error) throw mp4Error;

  if (animFrames.length === 0) throw new Error('구간에서 프레임을 추출하지 못했습니다.');

  const blob = buildAnimatedWebp(animFrames, tw, th, loop);
  const durationMs = animFrames.length * frameDurationMs;
  post({ id, type: 'done', blob, width: tw, height: th, frames: animFrames.length, durationMs });
}

function post(msg: VideoResponse): void {
  self.postMessage(msg);
}

self.onmessage = (e: MessageEvent<VideoRequest | VideoChunkMessage>) => {
  const msg = e.data;
  if (msg.type === 'chunk') {
    pendingReads.get(msg.id)?.(msg);
    return;
  }
  void (async () => {
    try {
      await run(msg);
    } catch (err) {
      const code = (err as { code?: VideoErrorCode })?.code;
      post({ id: msg.id, type: 'error', error: err instanceof Error ? err.message : String(err), code });
    }
  })();
};
