// 메인 스레드에서 동영상 워커를 감싸는 얇은 래퍼. 진행률 콜백과 함께 Promise 로 노출한다.
// 파일 전체를 메모리에 올리지 않는다 — 워커가 read 메시지로 요청한 구간만
// slice 해서 보낸다(대용량 파일 OOM 방지).
import type { VideoRequest, VideoChunkMessage, VideoResponse, VideoErrorCode } from './video.worker';

export type { VideoErrorCode };

export interface VideoOptions {
  file: File;
  startSec: number;
  endSec: number;
  fps: number;
  width: number;
  quality: number;
  loop: number;
}

export interface VideoResult {
  blob: Blob;
  width: number;
  height: number;
  frames: number;
  durationMs: number;
}

/** 미지원 코덱·파일 읽기 실패 등, UI 에서 분기하기 위한 식별 코드를 실어 나르는 에러. */
export class VideoError extends Error {
  code?: VideoErrorCode;
  constructor(message: string, code?: VideoErrorCode) {
    super(message);
    this.name = 'VideoError';
    this.code = code;
  }
}

interface Pending {
  file: File;
  resolve: (r: VideoResult) => void;
  reject: (e: Error) => void;
  onProgress?: (done: number, total: number) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./video.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<VideoResponse>) => {
      const msg = e.data;
      const p = pending.get(msg.id);
      if (!p) return;
      if (msg.type === 'read') {
        void serveRead(msg.id, p.file, msg.offset, msg.size);
        return;
      }
      if (msg.type === 'progress') {
        p.onProgress?.(msg.done, msg.total);
        return;
      }
      pending.delete(msg.id);
      if (msg.type === 'error') {
        p.reject(new VideoError(msg.error, msg.code));
        return;
      }
      p.resolve({
        blob: msg.blob,
        width: msg.width,
        height: msg.height,
        frames: msg.frames,
        durationMs: msg.durationMs,
      });
    };
  }
  return worker;
}

// 워커가 요청한 구간을 읽어 보낸다. 읽기 실패는 메시지로 전달해
// 워커가 'read-failed' 에러로 분류하게 한다(클라우드 미다운로드 등).
async function serveRead(id: number, file: File, offset: number, size: number): Promise<void> {
  try {
    const buffer = await readSlice(file, offset, size);
    getWorker().postMessage({ type: 'chunk', id, buffer } satisfies VideoChunkMessage, [buffer]);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    getWorker().postMessage({ type: 'chunk', id, error } satisfies VideoChunkMessage);
  }
}

// 파일 조각을 읽는다. 워커로 File 을 넘겨 거기서 읽으면 일부 브라우저에서
// NotReadableError 가 나므로 메인 스레드에서 읽는다. 한 번에 읽기가 실패하면
// 스트림 방식으로 재시도한다 — 미리보기가 떴다면 바이트 접근은 가능하므로
// 스트림 읽기는 성공할 여지가 크고, 클라우드 온디맨드에도 더 견고하다.
async function readSlice(file: File, offset: number, size: number): Promise<ArrayBuffer> {
  const slice = file.slice(offset, offset + size);
  try {
    return await slice.arrayBuffer();
  } catch (firstErr) {
    if (typeof slice.stream !== 'function') throw firstErr;
    const reader = slice.stream().getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
    const out = new Uint8Array(total);
    let pos = 0;
    for (const c of chunks) {
      out.set(c, pos);
      pos += c.byteLength;
    }
    return out.buffer;
  }
}

/** 동영상 구간을 애니메이션 WebP 로 변환한다. */
export function generateAnimatedWebp(
  opts: VideoOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<VideoResult> {
  const { file, ...rest } = opts;
  return new Promise<VideoResult>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { file, resolve, reject, onProgress });
    try {
      const req: VideoRequest = { type: 'start', id, fileSize: file.size, ...rest };
      getWorker().postMessage(req);
    } catch (err) {
      pending.delete(id);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
