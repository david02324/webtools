/// <reference lib="webworker" />
import encodeWebp from '@jsquash/webp/encode';
import encodeAvif from '@jsquash/avif/encode';
import encodeJpeg from '@jsquash/jpeg/encode';
import optimisePng from '@jsquash/oxipng/optimise';
import type { WorkerFormat } from './formats';

export interface ConvertRequest {
  id: number;
  file: File;
  format: WorkerFormat;
  quality: number;
}

export interface ConvertResponse {
  id: number;
  buffer?: ArrayBuffer;
  width?: number;
  height?: number;
  error?: string;
}

// 어떤 입력 포맷이든 브라우저 내장 디코더로 ImageData 까지 끌어온다.
// (createImageBitmap 은 JPEG/PNG/GIF/WebP/AVIF/BMP 등을 모두 처리)
// 주의: 애니메이션 입력은 첫 프레임만 살아남는다.
async function toImageData(file: File): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D 컨텍스트를 만들 수 없습니다.');
  ctx.drawImage(bitmap, 0, 0);
  const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();
  return data;
}

// PNG(oxipng)는 무손실이라 원본 바이트를 그대로 최적화한다.
// 크기 표시용 치수만 따로 디코드한다.
async function optimisePngFile(file: File): Promise<{ buffer: ArrayBuffer; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  bitmap.close();
  const buffer = await optimisePng(await file.arrayBuffer(), { level: 2 });
  return { buffer, width, height };
}

async function encode(
  file: File,
  format: WorkerFormat,
  quality: number,
): Promise<{ buffer: ArrayBuffer; width: number; height: number }> {
  if (format === 'oxipng') return optimisePngFile(file);
  const imageData = await toImageData(file);
  const buffer =
    format === 'webp'
      ? await encodeWebp(imageData, { quality })
      : format === 'avif'
        ? await encodeAvif(imageData, { quality })
        : await encodeJpeg(imageData, { quality });
  return { buffer, width: imageData.width, height: imageData.height };
}

self.onmessage = async (e: MessageEvent<ConvertRequest>) => {
  const { id, file, format, quality } = e.data;
  try {
    const { buffer, width, height } = await encode(file, format, quality);
    const res: ConvertResponse = { id, buffer, width, height };
    self.postMessage(res, [buffer]);
  } catch (err) {
    const res: ConvertResponse = { id, error: err instanceof Error ? err.message : String(err) };
    self.postMessage(res);
  }
};
