// 메인 스레드에서 동영상 워커를 감싸는 얇은 래퍼. 진행률 콜백과 함께 Promise 로 노출한다.
import type { VideoRequest, VideoResponse } from './video.worker';

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

export type VideoErrorCode = 'unsupported-codec' | 'no-video' | 'read-failed';

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
        blob: new Blob([msg.buffer], { type: 'image/webp' }),
        width: msg.width,
        height: msg.height,
        frames: msg.frames,
        durationMs: msg.durationMs,
      });
    };
  }
  return worker;
}

/** 동영상 구간을 애니메이션 WebP 로 변환한다. */
export function generateAnimatedWebp(
  opts: VideoOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<VideoResult> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const { file, ...rest } = opts;
    // 파일 읽기는 메인 스레드에서 처리한다. 워커로 File 을 넘겨 거기서 읽으면
    // 일부 브라우저(Safari 등)에서 NotReadableError 가 나므로, ArrayBuffer 로
    // 읽어 전송(transfer)한다. 진짜 못 읽는 파일이면 여기서 즉시 분기한다.
    file
      .arrayBuffer()
      .then((buffer) => {
        pending.set(id, { resolve, reject, onProgress });
        const req: VideoRequest = { id, buffer, ...rest };
        getWorker().postMessage(req, [buffer]);
      })
      .catch((err) => {
        reject(new VideoError(err instanceof Error ? err.message : String(err), 'read-failed'));
      });
  });
}
