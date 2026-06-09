// 메인 스레드에서 워커를 감싸는 얇은 래퍼. Promise 로 변환을 노출한다.
import type { ConvertRequest, ConvertResponse } from './convert.worker';
import type { TargetFormat } from './formats';

export interface ConvertResult {
  blob: Blob;
  width: number;
  height: number;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (r: ConvertResponse) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./convert.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<ConvertResponse>) => {
      const resolve = pending.get(e.data.id);
      if (resolve) {
        pending.delete(e.data.id);
        resolve(e.data);
      }
    };
  }
  return worker;
}

export function convertImage(
  file: File,
  format: TargetFormat,
  quality: number,
  mime: string,
): Promise<ConvertResult> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, (res) => {
      if (res.error || !res.buffer) {
        reject(new Error(res.error ?? 'Unknown conversion error'));
        return;
      }
      resolve({
        blob: new Blob([res.buffer], { type: mime }),
        width: res.width ?? 0,
        height: res.height ?? 0,
      });
    });
    const req: ConvertRequest = { id, file, format, quality };
    getWorker().postMessage(req);
  });
}
