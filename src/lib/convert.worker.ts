/// <reference lib="webworker" />
import encodeWebp from '@jsquash/webp/encode';
import encodeAvif from '@jsquash/avif/encode';
import type { TargetFormat } from './formats';

export interface ConvertRequest {
  id: number;
  file: File;
  format: TargetFormat;
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

self.onmessage = async (e: MessageEvent<ConvertRequest>) => {
  const { id, file, format, quality } = e.data;
  try {
    const imageData = await toImageData(file);
    const buffer =
      format === 'webp'
        ? await encodeWebp(imageData, { quality })
        : await encodeAvif(imageData, { quality });
    const res: ConvertResponse = {
      id,
      buffer,
      width: imageData.width,
      height: imageData.height,
    };
    self.postMessage(res, [buffer]);
  } catch (err) {
    const res: ConvertResponse = { id, error: err instanceof Error ? err.message : String(err) };
    self.postMessage(res);
  }
};
