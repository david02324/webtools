// 브라우저 안에서 이미지의 상세 정보를 뽑아낸다(서버 전송 없음).
//  - 기본: 이름·용량·수정일
//  - 포맷: 매직바이트로 실제 포맷을 판별(확장자가 틀려도 진짜 포맷을 보여줌)
//  - 이미지: 크기·메가픽셀·가로세로비, PNG 는 비트심도/색상유형/알파/인터레이스
//  - EXIF: JPEG/TIFF 의 카메라·렌즈·촬영설정·촬영일·방향·GPS
//
// 값(예: "f/2.8")은 언어 중립이라 여기서 문자열로 만들어 두고,
// 라벨(이름/용량 등)만 컴포넌트에서 로케일별로 입힌다.

export interface AnalysisField {
  /** i18n 라벨 키. 컴포넌트가 로케일 라벨로 치환한다. */
  key: string;
  value: string;
}

export interface AnalysisGroup {
  id: 'file' | 'image' | 'exif' | 'gps';
  fields: AnalysisField[];
}

export interface ImageAnalysis {
  groups: AnalysisGroup[];
  /** EXIF GPS 가 있으면 위/경도(십진수). 컴포넌트가 지도 링크를 만든다. */
  gps?: { lat: number; lon: number };
  /** 매직바이트로 판별한 표시용 포맷 라벨(JPEG/PNG 등). 없으면 빈 문자열. */
  formatLabel: string;
}

// ── 포맷 판별(매직바이트) ────────────────────────────────────
interface DetectedFormat {
  label: string;
  mime: string;
}

function detectFormat(b: Uint8Array): DetectedFormat | null {
  const u32 = (o: number) => (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { label: 'JPEG', mime: 'image/jpeg' };
  if (b.length >= 8 && u32(0) === 0x89504e47) return { label: 'PNG', mime: 'image/png' };
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46)
    return { label: 'GIF', mime: 'image/gif' };
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d) return { label: 'BMP', mime: 'image/bmp' };
  if (
    b.length >= 12 &&
    u32(0) === 0x52494646 && // 'RIFF'
    u32(8) === 0x57454250 // 'WEBP'
  )
    return { label: 'WebP', mime: 'image/webp' };
  // ISO-BMFF: ....ftyp<brand>
  if (b.length >= 12 && u32(4) === 0x66747970) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (brand === 'avif' || brand === 'avis') return { label: 'AVIF', mime: 'image/avif' };
    if (brand.startsWith('hei') || brand === 'mif1' || brand === 'msf1')
      return { label: 'HEIC', mime: 'image/heic' };
  }
  // TIFF (II*\0 / MM\0*)
  if (b.length >= 4 && ((b[0] === 0x49 && b[1] === 0x49) || (b[0] === 0x4d && b[1] === 0x4d)))
    return { label: 'TIFF', mime: 'image/tiff' };
  if (b.length >= 4 && b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00)
    return { label: 'ICO', mime: 'image/x-icon' };
  // SVG(텍스트) — 앞부분에 <svg 또는 <?xml
  const head = String.fromCharCode(...b.slice(0, Math.min(b.length, 256))).toLowerCase();
  if (head.includes('<svg')) return { label: 'SVG', mime: 'image/svg+xml' };
  return null;
}

// ── 헤더에서 크기 직접 파싱(createImageBitmap 실패 시 폴백) ────
function dimsFromHeader(b: Uint8Array, label: string): { w: number; h: number } | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  try {
    if (label === 'PNG') return { w: dv.getUint32(16), h: dv.getUint32(20) };
    if (label === 'GIF') return { w: dv.getUint16(6, true), h: dv.getUint16(8, true) };
    if (label === 'BMP') return { w: dv.getInt32(18, true), h: Math.abs(dv.getInt32(22, true)) };
    if (label === 'JPEG') {
      let o = 2;
      while (o + 9 < b.length) {
        if (dv.getUint8(o) !== 0xff) break;
        const marker = dv.getUint8(o + 1);
        const size = dv.getUint16(o + 2);
        // SOF0..SOF15(C4/C8/CC 제외)에 크기가 들어 있다.
        if (
          marker >= 0xc0 &&
          marker <= 0xcf &&
          marker !== 0xc4 &&
          marker !== 0xc8 &&
          marker !== 0xcc
        ) {
          return { w: dv.getUint16(o + 7), h: dv.getUint16(o + 5) };
        }
        o += 2 + size;
      }
    }
  } catch {
    /* 무시 */
  }
  return null;
}

// ── PNG IHDR(비트심도·색상유형·인터레이스) ───────────────────
const PNG_COLOR_TYPE: Record<number, { label: string; alpha: boolean }> = {
  0: { label: 'Grayscale', alpha: false },
  2: { label: 'RGB', alpha: false },
  3: { label: 'Palette', alpha: false },
  4: { label: 'Grayscale + Alpha', alpha: true },
  6: { label: 'RGBA', alpha: true },
};

function parsePngIHDR(b: Uint8Array) {
  if (b.length < 29) return null;
  const bitDepth = b[24];
  const ct = PNG_COLOR_TYPE[b[25]];
  const interlaced = b[28] === 1;
  return { bitDepth, colorType: ct?.label ?? `Type ${b[25]}`, alpha: ct?.alpha ?? false, interlaced };
}

// ── EXIF/TIFF 파서 ───────────────────────────────────────────
type Ifd = Record<number, number | number[] | string>;

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function readValue(
  dv: DataView,
  tiff: number,
  fieldOffset: number,
  type: number,
  count: number,
  le: boolean,
): number | number[] | string {
  const size = TYPE_SIZE[type] ?? 1;
  const total = size * count;
  const at = total > 4 ? tiff + dv.getUint32(fieldOffset, le) : fieldOffset;

  if (type === 2) {
    let s = '';
    for (let i = 0; i < count; i++) {
      const c = dv.getUint8(at + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s.trim();
  }

  const one = (o: number): number => {
    switch (type) {
      case 1:
      case 7:
        return dv.getUint8(o);
      case 3:
        return dv.getUint16(o, le);
      case 4:
        return dv.getUint32(o, le);
      case 9:
        return dv.getInt32(o, le);
      case 5: {
        const den = dv.getUint32(o + 4, le);
        return den === 0 ? 0 : dv.getUint32(o, le) / den;
      }
      case 10: {
        const den = dv.getInt32(o + 4, le);
        return den === 0 ? 0 : dv.getInt32(o, le) / den;
      }
      default:
        return dv.getUint8(o);
    }
  };

  if (count === 1) return one(at);
  const arr: number[] = [];
  for (let i = 0; i < count; i++) arr.push(one(at + i * size));
  return arr;
}

function readIfd(dv: DataView, tiff: number, ifdOffset: number, le: boolean): Ifd {
  const out: Ifd = {};
  const count = dv.getUint16(ifdOffset, le);
  let entry = ifdOffset + 2;
  for (let i = 0; i < count; i++, entry += 12) {
    if (entry + 12 > dv.byteLength) break;
    const tag = dv.getUint16(entry, le);
    const type = dv.getUint16(entry + 2, le);
    const num = dv.getUint32(entry + 4, le);
    out[tag] = readValue(dv, tiff, entry + 8, type, num, le);
  }
  return out;
}

interface ExifTables {
  ifd0: Ifd;
  exif: Ifd;
  gps: Ifd;
}

/** JPEG 의 APP1(Exif) 세그먼트를 찾아 TIFF 헤더 위치를 돌려준다. */
function findExifTiff(dv: DataView): number | null {
  let o = 2; // FFD8 다음
  while (o + 4 <= dv.byteLength) {
    if (dv.getUint8(o) !== 0xff) break;
    const marker = dv.getUint8(o + 1);
    if (marker === 0xda) break; // SOS — 여기부터 이미지 데이터
    const size = dv.getUint16(o + 2);
    if (marker === 0xe1) {
      const sig = o + 4;
      // "Exif\0\0"
      if (dv.getUint32(sig) === 0x45786966 && dv.getUint16(sig + 4) === 0x0000) {
        return sig + 6;
      }
    }
    o += 2 + size;
  }
  return null;
}

function parseTiff(dv: DataView, tiff: number): ExifTables | null {
  const bo = dv.getUint16(tiff);
  if (bo !== 0x4949 && bo !== 0x4d4d) return null;
  const le = bo === 0x4949;
  const ifd0Off = dv.getUint32(tiff + 4, le);
  const ifd0 = readIfd(dv, tiff, tiff + ifd0Off, le);
  const exifPtr = ifd0[0x8769];
  const gpsPtr = ifd0[0x8825];
  const exif = typeof exifPtr === 'number' ? readIfd(dv, tiff, tiff + exifPtr, le) : {};
  const gps = typeof gpsPtr === 'number' ? readIfd(dv, tiff, tiff + gpsPtr, le) : {};
  return { ifd0, exif, gps };
}

function readExif(b: Uint8Array, label: string): ExifTables | null {
  try {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (label === 'JPEG') {
      const tiff = findExifTiff(dv);
      return tiff == null ? null : parseTiff(dv, tiff);
    }
    if (label === 'TIFF') return parseTiff(dv, 0);
    return null;
  } catch {
    return null;
  }
}

// ── 값 포맷터(언어 중립) ─────────────────────────────────────
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function fmtDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}`;
}

/** EXIF 날짜 "YYYY:MM:DD HH:MM:SS" → "YYYY-MM-DD HH:MM:SS" */
function fmtExifDate(s: string): string {
  return s.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
}

function fmtExposure(v: number): string {
  if (!v || v <= 0) return `${v}`;
  return v < 1 ? `1/${Math.round(1 / v)} s` : `${v} s`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function aspectRatio(w: number, h: number): string {
  if (!w || !h) return '—';
  const g = gcd(w, h);
  const rw = w / g;
  const rh = h / g;
  // 약분 결과가 지저분하면 소수비로 대체.
  if (rw > 99 || rh > 99) return `${(w / h).toFixed(2)} : 1`;
  return `${rw} : ${rh}`;
}

const ORIENTATION: Record<number, string> = {
  1: 'Normal',
  2: 'Mirror horizontal',
  3: 'Rotate 180°',
  4: 'Mirror vertical',
  5: 'Mirror + rotate 270°',
  6: 'Rotate 90° CW',
  7: 'Mirror + rotate 90°',
  8: 'Rotate 270° CW',
};

function gpsToDecimal(coord: unknown, ref: unknown): number | null {
  if (!Array.isArray(coord) || coord.length < 3) return null;
  const [d, m, s] = coord as number[];
  let dec = d + m / 60 + s / 3600;
  if (ref === 'S' || ref === 'W') dec = -dec;
  return dec;
}

function str(v: number | number[] | string | undefined): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (Array.isArray(v)) return v.length ? String(v[0]) : null;
  return String(v);
}

function num(v: number | number[] | string | undefined): number | null {
  if (typeof v === 'number') return v;
  if (Array.isArray(v) && typeof v[0] === 'number') return v[0];
  return null;
}

// ── 진입점 ───────────────────────────────────────────────────
export async function analyzeImage(file: File): Promise<ImageAnalysis> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const detected = detectFormat(bytes);
  const label = detected?.label ?? '';

  // 크기: 가능한 모든 포맷을 브라우저 디코더로 처리, 실패 시 헤더 폴백.
  let width = 0;
  let height = 0;
  try {
    const bmp = await createImageBitmap(file);
    width = bmp.width;
    height = bmp.height;
    bmp.close();
  } catch {
    const d = dimsFromHeader(bytes, label);
    if (d) {
      width = d.w;
      height = d.h;
    }
  }

  // ── 파일 그룹 ──
  const fileFields: AnalysisField[] = [{ key: 'name', value: file.name }];
  if (detected) {
    const declared = file.type && file.type !== detected.mime ? ` (${file.type})` : '';
    fileFields.push({ key: 'formatDetected', value: `${detected.label}${declared}` });
  } else if (file.type) {
    fileFields.push({ key: 'formatDetected', value: file.type });
  }
  fileFields.push({ key: 'size', value: `${fmtBytes(file.size)} (${file.size.toLocaleString()} B)` });
  if (file.lastModified) fileFields.push({ key: 'modified', value: fmtDate(file.lastModified) });

  // ── 이미지 그룹 ──
  const imageFields: AnalysisField[] = [];
  if (width && height) {
    imageFields.push({ key: 'dimensions', value: `${width} × ${height} px` });
    imageFields.push({ key: 'megapixels', value: `${(width * height) / 1e6 < 0.1 ? ((width * height) / 1e6).toFixed(2) : ((width * height) / 1e6).toFixed(1)} MP` });
    imageFields.push({ key: 'aspect', value: aspectRatio(width, height) });
  }
  if (label === 'PNG') {
    const ihdr = parsePngIHDR(bytes);
    if (ihdr) {
      imageFields.push({ key: 'colorType', value: ihdr.colorType });
      imageFields.push({ key: 'bitDepth', value: `${ihdr.bitDepth}-bit` });
      imageFields.push({ key: 'alpha', value: ihdr.alpha ? 'Yes' : 'No' });
      imageFields.push({ key: 'interlaced', value: ihdr.interlaced ? 'Adam7' : 'No' });
    }
  }

  // ── EXIF 그룹 ──
  const exifFields: AnalysisField[] = [];
  let gps: { lat: number; lon: number } | undefined;
  const tables = readExif(bytes, label);
  if (tables) {
    const { ifd0, exif } = tables;
    const make = str(ifd0[0x010f]);
    const model = str(ifd0[0x0110]);
    if (make || model) exifFields.push({ key: 'camera', value: [make, model].filter(Boolean).join(' ') });

    const lens = str(exif[0xa434]);
    if (lens) exifFields.push({ key: 'lens', value: lens });

    const date = str(exif[0x9003]) ?? str(ifd0[0x0132]);
    if (date) exifFields.push({ key: 'dateTaken', value: fmtExifDate(date) });

    const exposure = num(exif[0x829a]);
    if (exposure != null) exifFields.push({ key: 'exposure', value: fmtExposure(exposure) });

    const fnum = num(exif[0x829d]);
    if (fnum != null) exifFields.push({ key: 'aperture', value: `f/${fnum}` });

    const iso = num(exif[0x8827]);
    if (iso != null) exifFields.push({ key: 'iso', value: `ISO ${iso}` });

    const focal = num(exif[0x920a]);
    if (focal != null) exifFields.push({ key: 'focalLength', value: `${focal} mm` });

    const orient = num(ifd0[0x0112]);
    if (orient != null && ORIENTATION[orient])
      exifFields.push({ key: 'orientation', value: ORIENTATION[orient] });

    const software = str(ifd0[0x0131]);
    if (software) exifFields.push({ key: 'software', value: software });

    // GPS
    const lat = gpsToDecimal(tables.gps[0x0002], str(tables.gps[0x0001]));
    const lon = gpsToDecimal(tables.gps[0x0004], str(tables.gps[0x0003]));
    if (lat != null && lon != null) gps = { lat, lon };
  }

  const groups: AnalysisGroup[] = [
    { id: 'file', fields: fileFields },
    { id: 'image', fields: imageFields },
  ];
  if (exifFields.length) groups.push({ id: 'exif', fields: exifFields });
  if (gps) {
    groups.push({
      id: 'gps',
      fields: [{ key: 'coordinates', value: `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}` }],
    });
  }

  return { groups, gps, formatLabel: label };
}
