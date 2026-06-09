// 의존성 없이 여러 장의 "정적 WebP" 를 하나의 "애니메이션 WebP" 로 묶는다.
// zip.ts 와 같은 손수-바이너리 스타일. RIFF 컨테이너에 VP8X(확장 헤더) + ANIM(루프) +
// 프레임마다 ANMF 청크를 쌓는다. 각 프레임의 실제 이미지 데이터(VP8/VP8L/ALPH 청크)는
// @jsquash/webp 가 만든 단일 WebP 에서 그대로 떼어다 붙인다(재인코딩 없음).
//
// 참고: WebP Container Spec(확장 포맷)
//   https://developers.google.com/speed/webp/docs/riff_container

export interface AnimFrame {
  /** @jsquash/webp encode 가 돌려준 단일(정적) WebP 바이트열 */
  webp: Uint8Array;
  /** 이 프레임의 표시 시간(ms) */
  durationMs: number;
}

// RIFF 청크 하나를 만든다: fourcc(4) + size(4, LE) + payload + (홀수면 패딩 1바이트).
function chunk(fourcc: string, payload: Uint8Array): Uint8Array {
  const size = payload.length;
  const padded = size + (size & 1);
  const out = new Uint8Array(8 + padded);
  out[0] = fourcc.charCodeAt(0);
  out[1] = fourcc.charCodeAt(1);
  out[2] = fourcc.charCodeAt(2);
  out[3] = fourcc.charCodeAt(3);
  new DataView(out.buffer).setUint32(4, size, true); // 패딩은 size 에 포함하지 않는다
  out.set(payload, 8);
  return out;
}

// 24비트 정수를 little-endian 으로 기록한다.
function setU24(dv: DataView, off: number, val: number): void {
  dv.setUint8(off, val & 0xff);
  dv.setUint8(off + 1, (val >> 8) & 0xff);
  dv.setUint8(off + 2, (val >> 16) & 0xff);
}

// 단일 WebP 에서 프레임 이미지 데이터(ALPH·VP8·VP8L 청크)만 뽑아낸다.
// VP8X(확장 헤더)는 ANMF 가 그 역할을 대신하므로 제외한다.
function extractFrameData(webp: Uint8Array): { data: Uint8Array; hasAlpha: boolean } {
  const dv = new DataView(webp.buffer, webp.byteOffset, webp.byteLength);
  // "RIFF"...."WEBP" 검증
  if (dv.getUint32(0, false) !== 0x52494646 /* 'RIFF' */ || dv.getUint32(8, false) !== 0x57454250 /* 'WEBP' */) {
    throw new Error('프레임이 올바른 WebP 가 아닙니다.');
  }
  const parts: Uint8Array[] = [];
  let hasAlpha = false;
  let off = 12;
  while (off + 8 <= webp.length) {
    const fourcc = String.fromCharCode(webp[off], webp[off + 1], webp[off + 2], webp[off + 3]);
    const size = dv.getUint32(off + 4, true);
    const total = 8 + size + (size & 1); // 헤더 + payload + 패딩
    if (fourcc === 'VP8 ' || fourcc === 'VP8L' || fourcc === 'ALPH') {
      parts.push(webp.subarray(off, off + total));
      if (fourcc === 'ALPH' || fourcc === 'VP8L') hasAlpha = true;
    }
    // VP8X 등 나머지는 건너뛴다.
    off += total;
  }
  if (parts.length === 0) throw new Error('프레임에서 이미지 데이터를 찾지 못했습니다.');
  return { data: concat(parts), hasAlpha };
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

/**
 * 정적 WebP 프레임들을 애니메이션 WebP 한 장으로 묶는다.
 * @param frames 프레임별 WebP 바이트열 + 표시 시간(ms)
 * @param width  캔버스 가로(모든 프레임 동일)
 * @param height 캔버스 세로(모든 프레임 동일)
 * @param loop   반복 횟수(0 = 무한)
 */
export function buildAnimatedWebp(
  frames: AnimFrame[],
  width: number,
  height: number,
  loop: number,
): Blob {
  if (frames.length === 0) throw new Error('프레임이 없습니다.');

  // 각 프레임의 이미지 데이터를 떼어내고, 알파 사용 여부를 모은다.
  const frameDatas = frames.map((f) => extractFrameData(f.webp));
  const anyAlpha = frameDatas.some((d) => d.hasAlpha);

  // VP8X (10바이트): 플래그 + 24비트 캔버스 크기(각 -1).
  const vp8x = new Uint8Array(10);
  const vp8xDv = new DataView(vp8x.buffer);
  // 플래그 바이트: Animation = 0x02, Alpha = 0x10
  vp8x[0] = 0x02 | (anyAlpha ? 0x10 : 0x00);
  // [1..3] 예약(0)
  setU24(vp8xDv, 4, width - 1);
  setU24(vp8xDv, 7, height - 1);

  // ANIM (6바이트): 배경색 BGRA + 루프 횟수(2바이트 LE).
  const anim = new Uint8Array(6);
  // 배경색 0,0,0,0 (전체 프레임·디스포즈 none 이라 영향 없음)
  new DataView(anim.buffer).setUint16(4, loop & 0xffff, true);

  const parts: Uint8Array[] = [chunk('VP8X', vp8x), chunk('ANIM', anim)];

  // 프레임마다 ANMF: 16바이트 고정 헤더 + 이미지 데이터.
  for (let i = 0; i < frames.length; i++) {
    const data = frameDatas[i].data;
    const payload = new Uint8Array(16 + data.length);
    const dv = new DataView(payload.buffer);
    setU24(dv, 0, 0); // Frame X (x/2)
    setU24(dv, 3, 0); // Frame Y (y/2)
    setU24(dv, 6, width - 1);
    setU24(dv, 9, height - 1);
    setU24(dv, 12, Math.max(0, Math.round(frames[i].durationMs)));
    payload[15] = 0x00; // 블렌딩=알파, 디스포즈=none
    payload.set(data, 16);
    parts.push(chunk('ANMF', payload));
  }

  // RIFF 헤더: 'RIFF' + (4 + body) + 'WEBP' + body
  const body = concat(parts);
  const header = new Uint8Array(12);
  header[0] = 0x52; header[1] = 0x49; header[2] = 0x46; header[3] = 0x46; // RIFF
  new DataView(header.buffer).setUint32(4, 4 + body.length, true);
  header[8] = 0x57; header[9] = 0x45; header[10] = 0x42; header[11] = 0x50; // WEBP

  return new Blob([header, body], { type: 'image/webp' });
}
