// 변환 도구의 구조 정의(언어 무관) — index 목록과 각 페이지/워커가 공유한다.
// 노출 텍스트(title/description/tagline)는 로케일별로 src/i18n/content.ts 에서 관리한다.
// 도구를 추가하려면 여기에 항목 하나만 추가하면 된다.

export type TargetFormat = 'webp' | 'avif';

/**
 * 도구 식별자 — 페이지·저장소 구분과 TOOL_COPY 키로 쓴다.
 * 'compress' 는 입력 포맷을 유지한 채 압축만 하는 도구(출력 포맷이 파일마다 다름).
 */
export type ToolFormat = TargetFormat | 'compress';

/**
 * 워커가 처리할 수 있는 코덱. 변환기는 대상 포맷과 같고,
 * 압축기는 입력 포맷에 따라 mozjpeg(JPEG)·oxipng(PNG)를 추가로 쓴다.
 * 모두 Squoosh(jSquash)에서 가져온 WASM 코덱이다.
 */
export type WorkerFormat = TargetFormat | 'mozjpeg' | 'oxipng';

export interface ToolConfig {
  /** URL 슬러그. /webtools/<slug> 로 매핑된다. */
  slug: string;
  /** 도구 식별자 */
  format: ToolFormat;
  /** 출력 MIME (compress 는 파일마다 달라 미사용) */
  mime: string;
  /** 출력 확장자 (compress 는 파일마다 달라 미사용) */
  ext: string;
  /** 기본 품질 (0–100) */
  defaultQuality: number;
}

export const TOOLS: Record<ToolFormat, ToolConfig> = {
  webp: {
    slug: 'to-webp',
    format: 'webp',
    mime: 'image/webp',
    ext: 'webp',
    defaultQuality: 80,
  },
  avif: {
    slug: 'to-avif',
    format: 'avif',
    mime: 'image/avif',
    ext: 'avif',
    defaultQuality: 50,
  },
  compress: {
    slug: 'compress-image',
    format: 'compress',
    mime: '',
    ext: '',
    defaultQuality: 75,
  },
};

export const TOOL_LIST: ToolConfig[] = Object.values(TOOLS);

/** 이미지 분석기 페이지의 URL 슬러그. 변환기와 별개의 단독 페이지. */
export const ANALYZE_SLUG = 'analyze-image';

/** 동영상 구간 → 애니메이션 WebP 도구의 URL 슬러그. 단독 페이지. */
export const VIDEO_TO_WEBP_SLUG = 'video-to-webp';

/** 텍스트 → 슬랙 이모지(128×128 PNG) 도구의 URL 슬러그. 단독 페이지. */
export const SLACK_EMOJI_SLUG = 'slack-emoji';
