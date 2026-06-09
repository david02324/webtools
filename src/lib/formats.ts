// 변환 도구의 구조 정의(언어 무관) — index 목록과 각 페이지/워커가 공유한다.
// 노출 텍스트(title/description/tagline)는 로케일별로 src/i18n/content.ts 에서 관리한다.
// 도구를 추가하려면 여기에 항목 하나만 추가하면 된다.

export type TargetFormat = 'webp' | 'avif';

export interface ToolConfig {
  /** URL 슬러그. /webtools/<slug> 로 매핑된다. */
  slug: string;
  /** 출력 포맷 */
  format: TargetFormat;
  /** 출력 MIME */
  mime: string;
  /** 출력 확장자 */
  ext: string;
  /** 기본 품질 (0–100) */
  defaultQuality: number;
}

export const TOOLS: Record<TargetFormat, ToolConfig> = {
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
};

export const TOOL_LIST: ToolConfig[] = Object.values(TOOLS);
