// 텍스트 → 슬랙 이모지(정사각 PNG) 렌더링. 캔버스에 글자를 칸에 꽉 차게 그려준다.
// 슬랙 권장 규격은 128×128 PNG, 128KB 이하 — 글자 이모지는 용량이 작아 한도에 걸리지 않는다.
// UI 와 분리해 두어(브라우저 전용) 미리보기와 다운로드가 같은 로직을 공유한다.
//
// 크기 계산·정렬은 폰트의 advance/line-height 가 아니라 실제 글리프 잉크 박스
// (measureText 의 actualBoundingBox*)를 기준으로 한다. 그래야 (1) 좌우 사이드
// 베어링 비대칭으로 한쪽에 치우치지 않고, (2) 글자가 칸을 최대한 꽉 채운다.

export interface EmojiOptions {
  /** 표시할 텍스트. 줄바꿈(\n)으로 여러 줄 가능. */
  text: string;
  /** 글자 색 (CSS 색상). */
  textColor: string;
  /** 배경 색 (CSS 색상). transparent 가 true 면 무시. */
  bgColor: string;
  /** 배경 투명 여부. */
  transparent: boolean;
  /** CSS font-family 값. */
  fontFamily: string;
  /** 굵게 여부. */
  bold: boolean;
  /** 캔버스 한 변 길이(px). 다운로드는 128, 미리보기는 더 크게 쓴다. */
  size: number;
}

// 글자가 차지할 안쪽 여백 비율(한 변 기준). 작을수록 더 꽉 찬다.
const PADDING_RATIO = 0.04;
// 여러 줄일 때 baseline 사이 간격(폰트 크기 배수).
const LINE_PITCH = 1.0;

interface LineMetric {
  line: string;
  /** 펜 위치에서 잉크 왼쪽/오른쪽 끝까지 거리. */
  left: number;
  right: number;
  /** baseline 에서 잉크 위/아래 끝까지 거리. */
  ascent: number;
  descent: number;
}

function measureLines(ctx: CanvasRenderingContext2D, lines: string[]): LineMetric[] {
  return lines.map((line) => {
    const m = ctx.measureText(line);
    return {
      line,
      left: m.actualBoundingBoxLeft,
      right: m.actualBoundingBoxRight,
      ascent: m.actualBoundingBoxAscent,
      descent: m.actualBoundingBoxDescent,
    };
  });
}

// 잉크 박스 전체의 가로/세로 크기.
function blockSize(metrics: LineMetric[], pitch: number): { w: number; h: number } {
  const w = Math.max(...metrics.map((m) => m.left + m.right));
  const n = metrics.length;
  const h = metrics[0].ascent + (n - 1) * pitch + metrics[n - 1].descent;
  return { w, h };
}

/** 옵션대로 정사각 캔버스에 텍스트를 그려 반환한다. */
export function renderTextEmoji(opts: EmojiOptions): HTMLCanvasElement {
  const { size } = opts;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  if (!opts.transparent) {
    ctx.fillStyle = opts.bgColor;
    ctx.fillRect(0, 0, size, size);
  }

  const lines = opts.text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return canvas;

  const weight = opts.bold ? '800' : '500';
  const inner = size * (1 - PADDING_RATIO * 2);
  const setFont = (px: number) => {
    ctx.font = `${weight} ${px}px ${opts.fontFamily}`;
  };

  // 잉크 박스가 안쪽 영역을 가로·세로 모두 넘지 않는 최대 폰트 크기를 이분 탐색.
  let lo = 4;
  let hi = size * 2; // 잉크 기준이라 폰트 px 가 size 보다 커질 수 있다.
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    setFont(mid);
    const { w, h } = blockSize(measureLines(ctx, lines), mid * LINE_PITCH);
    if (w <= inner && h <= inner) lo = mid;
    else hi = mid - 1;
  }

  const fontPx = lo;
  setFont(fontPx);
  ctx.fillStyle = opts.textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const metrics = measureLines(ctx, lines);
  const pitch = fontPx * LINE_PITCH;
  const n = metrics.length;

  // 블록(잉크 박스)이 캔버스 정중앙에 오도록 첫 줄 baseline 을 잡는다.
  const blockH = metrics[0].ascent + (n - 1) * pitch + metrics[n - 1].descent;
  let baseline = size / 2 - blockH / 2 + metrics[0].ascent;

  for (const m of metrics) {
    // 잉크 가로 중심이 정중앙에 오도록 펜 위치 보정(사이드 베어링 비대칭 해소).
    const x = size / 2 - (m.right - m.left) / 2;
    ctx.fillText(m.line, x, baseline);
    baseline += pitch;
  }
  return canvas;
}

/** 캔버스를 PNG Blob 으로 인코딩한다. */
export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG encode failed'))),
      'image/png',
    );
  });
}
