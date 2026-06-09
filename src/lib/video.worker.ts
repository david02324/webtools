/// <reference lib="webworker" />
// 동영상의 한 구간을 애니메이션 WebP 로 만드는 워커.
//   mp4box(디뮤서) → WebCodecs VideoDecoder(디코드) → 구간/ fps 샘플링 →
//   OffscreenCanvas 리사이즈 → @jsquash/webp(프레임별 정적 WebP) → webp-anim(묶기)
// 무거운 작업을 메인 스레드에서 떼어내고, 진행률을 중간중간 알린다.
import encodeWebp from '@jsquash/webp/encode';
import { createFile, DataStream, Endianness, MP4BoxBuffer } from 'mp4box';
import type { ISOFile, Movie, Sample, Track } from 'mp4box';
import { buildAnimatedWebp, type AnimFrame } from './webp-anim';

export interface VideoRequest {
  id: number;
  file: File;
  startSec: number;
  endSec: number;
  fps: number;
  /** 출력 가로(px). 세로는 원본 비율로 맞춘다. */
  width: number;
  quality: number;
  /** 반복 횟수(0 = 무한) */
  loop: number;
}

export type VideoResponse =
  | { id: number; type: 'progress'; done: number; total: number }
  | { id: number; type: 'done'; buffer: ArrayBuffer; width: number; height: number; frames: number; durationMs: number }
  | { id: number; type: 'error'; error: string; code?: 'unsupported-codec' | 'no-video' };

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

// mp4box 로 파일을 읽어 비디오 트랙 + 디코드 순서 샘플 전체를 모은다.
function demux(file: File): Promise<{ track: Track; samples: Sample[]; config: ReturnType<typeof getCodecConfig> }> {
  return new Promise(async (resolve, reject) => {
    try {
      const ab = await file.arrayBuffer();
      const mp4 = createFile();
      const samples: Sample[] = [];
      let track: Track | undefined;

      mp4.onError = (_mod: string, msg: string) => reject(new Error(`mp4box: ${msg}`));
      mp4.onReady = (info: Movie) => {
        track = info.videoTracks?.[0];
        if (!track) {
          reject(Object.assign(new Error('no-video'), { code: 'no-video' }));
          return;
        }
        mp4.setExtractionOptions(track.id, null, { nbSamples: Number.MAX_SAFE_INTEGER });
        mp4.start();
      };
      mp4.onSamples = (_id: number, _user: unknown, samps: Sample[]) => {
        for (const s of samps) samples.push(s);
        if (track && samples.length >= track.nb_samples) {
          resolve({ track, samples, config: getCodecConfig(mp4, track.id) });
        }
      };

      const buf = MP4BoxBuffer.fromArrayBuffer(ab, 0);
      mp4.appendBuffer(buf, true);
      mp4.flush();
    } catch (err) {
      reject(err);
    }
  });
}

async function run(req: VideoRequest): Promise<void> {
  const { id, file, startSec, endSec, fps, width, quality, loop } = req;

  const { track, samples, config } = await demux(file);
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
          nextTick = startSec + captured * fpsInterval;
          encodeChain = encodeChain.then(async () => {
            const webp = await encodeWebp(imageData, { quality });
            animFrames.push({ webp: new Uint8Array(webp), durationMs: frameDurationMs });
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

  // 디코드 순서(=배열 순서)에서, 시작 직전 키프레임 ~ 끝 구간을 덮는 샘플 범위를 고른다.
  let firstIdx = 0;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].is_sync && cts2us(samples[i].cts) <= startUs) firstIdx = i;
  }
  let lastIdx = firstIdx;
  for (let i = 0; i < samples.length; i++) {
    if (cts2us(samples[i].cts) <= endUs) lastIdx = i; // 재정렬(B-frame) 고려해 최대 인덱스
  }
  if (lastIdx < firstIdx) lastIdx = samples.length - 1;

  for (let i = firstIdx; i <= lastIdx; i++) {
    const s = samples[i];
    decoder.decode(
      new EncodedVideoChunk({
        type: s.is_sync ? 'key' : 'delta',
        timestamp: cts2us(s.cts),
        duration: Math.round((s.duration / timescale) * 1e6),
        data: s.data as AllowSharedBufferSource,
      }),
    );
  }

  try {
    await decoder.flush();
  } catch (e) {
    decoderError = decoderError ?? (e instanceof Error ? e : new Error(String(e)));
  }
  await encodeChain;
  decoder.close();
  if (decoderError) throw decoderError;

  if (animFrames.length === 0) throw new Error('구간에서 프레임을 추출하지 못했습니다.');

  const blob = buildAnimatedWebp(animFrames, tw, th, loop);
  const buffer = await blob.arrayBuffer();
  const durationMs = animFrames.length * frameDurationMs;
  post({ id, type: 'done', buffer, width: tw, height: th, frames: animFrames.length, durationMs }, [buffer]);
}

function post(msg: VideoResponse, transfer?: Transferable[]): void {
  if (transfer) self.postMessage(msg, transfer);
  else self.postMessage(msg);
}

self.onmessage = async (e: MessageEvent<VideoRequest>) => {
  const { id } = e.data;
  try {
    await run(e.data);
  } catch (err) {
    const code = (err as { code?: 'unsupported-codec' | 'no-video' })?.code;
    post({ id, type: 'error', error: err instanceof Error ? err.message : String(err), code });
  }
};
