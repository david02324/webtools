// 지원 로케일과 로케일 관련 메타데이터를 한 곳에서 정의한다.
// 노출 기본 언어는 영어(en). 나머지는 URL 에 /<locale>/ 접두사가 붙는다.

export const LOCALES = ['en', 'ko', 'zh', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** 언어 스위처에 표시할 각 언어의 자기 명칭. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
  zh: '中文',
  ja: '日本語',
};

/** <html lang> 및 hreflang 에 쓰는 BCP-47 태그. */
export const HTML_LANG: Record<Locale, string> = {
  en: 'en',
  ko: 'ko',
  zh: 'zh-Hans',
  ja: 'ja',
};

/** og:locale 에 쓰는 값. */
export const OG_LOCALE: Record<Locale, string> = {
  en: 'en_US',
  ko: 'ko_KR',
  zh: 'zh_CN',
  ja: 'ja_JP',
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * 사이트 루트 기준 경로를 만든다. base(/webtools/) 와 로케일 접두사를 합친다.
 * 기본 로케일(en)은 접두사 없이 루트에 노출한다.
 *  - localizedPath('en')           → /webtools/
 *  - localizedPath('ko')           → /webtools/ko/
 *  - localizedPath('ja', 'to-webp')→ /webtools/ja/to-webp
 */
export function localizedPath(base: string, locale: Locale, slug = ''): string {
  const prefix = locale === DEFAULT_LOCALE ? '' : `${locale}/`;
  return `${base}${prefix}${slug}`;
}
