import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 커스텀 도메인(fastwebtools.app) 루트 배포 기준.
// GitHub Pages 에 CNAME(public/CNAME) 으로 도메인을 붙이면 루트에서 서빙되므로
// base 는 '/' 로 둔다.
export default defineConfig({
  site: 'https://fastwebtools.app',
  base: '/',
  trailingSlash: 'ignore',
  // 노출 기본 언어는 영어. 라우트는 src/pages 디렉터리 구조로 직접 만든다
  //  (en=루트, 그 외=/<locale>/ 접두사). 이 설정은 Astro 의 로케일 인식용.
  i18n: {
    locales: ['en', 'ko', 'zh', 'ja'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [
    sitemap({
      // sitemap 에 언어별 hreflang 대체 링크를 자동 생성한다.
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en',
          ko: 'ko',
          zh: 'zh-Hans',
          ja: 'ja',
        },
      },
    }),
  ],
  vite: {
    // @jsquash 코덱은 동적으로 .wasm 을 로드하므로 Vite 사전번들에서 제외해야
    // 워커/브라우저에서 정상 동작한다.
    optimizeDeps: {
      exclude: ['@jsquash/webp', '@jsquash/avif'],
    },
    worker: {
      format: 'es',
    },
  },
});
