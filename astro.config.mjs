import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// GitHub Pages 프로젝트 페이지 배포 기준.
// username.github.io/webtools/  형태이므로 base 를 저장소 이름으로 맞춘다.
// 사용자 계정 확정되면 site 의 username 부분만 수정하면 됨.
export default defineConfig({
  site: 'https://david02324.github.io',
  base: '/webtools/',
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
