// SEO 핵심 텍스트(페이지 title/description/tagline)를 로케일 × 포맷별로 정의한다.
// 검색결과·링크 미리보기에 노출되므로 각 언어의 자연스러운 표현을 직접 작성했다.
import type { Locale } from './config';
import type { TargetFormat } from '../lib/formats';

export interface ToolCopy {
  /** <title> */
  title: string;
  /** meta description / OG description */
  description: string;
  /** 페이지 본문 한 줄 설명 */
  tagline: string;
}

export interface HomeCopy {
  title: string;
  description: string;
}

export const HOME_COPY: Record<Locale, HomeCopy> = {
  en: {
    title: 'WebTools — Image Converters That Run in Your Browser',
    description:
      'Free tools to convert images to WebP and AVIF entirely in your browser. No uploads, safe, fast, and nothing to install.',
  },
  ko: {
    title: 'WebTools — 브라우저에서 바로 쓰는 이미지 변환 도구',
    description:
      '업로드 없이 브라우저 안에서 이미지를 WebP·AVIF 로 변환하는 무료 도구 모음. 안전하고 빠르며 설치가 필요 없습니다.',
  },
  zh: {
    title: 'WebTools — 在浏览器中运行的图片转换工具',
    description:
      '无需上传，在浏览器中将图片转换为 WebP 和 AVIF 的免费工具。安全、快速、无需安装。',
  },
  ja: {
    title: 'WebTools — ブラウザで動く画像変換ツール',
    description:
      'アップロード不要、ブラウザ内で画像を WebP・AVIF に変換する無料ツール。安全・高速・インストール不要。',
  },
};

export const TOOL_COPY: Record<Locale, Record<TargetFormat, ToolCopy>> = {
  en: {
    webp: {
      title: 'Convert Images to WebP — Free Online Converter | WebTools',
      description:
        'Convert JPG, PNG, GIF, AVIF and more to WebP right in your browser. Processed on your device with no uploads — safe and fast.',
      tagline: 'Any image to WebP, right in your browser. No uploads, completely free.',
    },
    avif: {
      title: 'Convert Images to AVIF — Free Online Converter | WebTools',
      description:
        'Convert JPG, PNG, WebP and more to AVIF right in your browser. Processed on your device with no uploads — safe and highly compressed.',
      tagline: 'Any image to AVIF, right in your browser. No uploads, high compression.',
    },
  },
  ko: {
    webp: {
      title: '이미지를 WebP로 변환 — 무료 온라인 변환기 | WebTools',
      description:
        'JPG·PNG·GIF·AVIF 등 어떤 이미지든 브라우저에서 바로 WebP로 변환합니다. 서버 업로드 없이 기기 안에서 처리해 안전하고 빠릅니다.',
      tagline: '어떤 이미지든 브라우저에서 바로 WebP로. 업로드 없음, 완전 무료.',
    },
    avif: {
      title: '이미지를 AVIF로 변환 — 무료 온라인 변환기 | WebTools',
      description:
        'JPG·PNG·WebP 등 어떤 이미지든 브라우저에서 바로 AVIF로 변환합니다. 서버 업로드 없이 기기 안에서 처리해 안전하고 고압축입니다.',
      tagline: '어떤 이미지든 브라우저에서 바로 AVIF로. 업로드 없음, 고압축.',
    },
  },
  zh: {
    webp: {
      title: '将图片转换为 WebP — 免费在线转换器 | WebTools',
      description:
        '在浏览器中直接将 JPG、PNG、GIF、AVIF 等图片转换为 WebP。在本地设备处理，无需上传，安全又快速。',
      tagline: '任意图片即刻转为 WebP，全程在浏览器中。无需上传，完全免费。',
    },
    avif: {
      title: '将图片转换为 AVIF — 免费在线转换器 | WebTools',
      description:
        '在浏览器中直接将 JPG、PNG、WebP 等图片转换为 AVIF。在本地设备处理，无需上传，安全且高压缩。',
      tagline: '任意图片即刻转为 AVIF，全程在浏览器中。无需上传，高压缩率。',
    },
  },
  ja: {
    webp: {
      title: '画像を WebP に変換 — 無料オンライン変換ツール | WebTools',
      description:
        'JPG・PNG・GIF・AVIF などあらゆる画像をブラウザですぐ WebP に変換。端末内で処理しアップロード不要、安全で高速です。',
      tagline: 'あらゆる画像をブラウザですぐ WebP に。アップロード不要、完全無料。',
    },
    avif: {
      title: '画像を AVIF に変換 — 無料オンライン変換ツール | WebTools',
      description:
        'JPG・PNG・WebP などあらゆる画像をブラウザですぐ AVIF に変換。端末内で処理しアップロード不要、安全で高圧縮です。',
      tagline: 'あらゆる画像をブラウザですぐ AVIF に。アップロード不要、高圧縮。',
    },
  },
};
