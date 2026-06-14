# WebTools

Browser-based image tools that run entirely on your device. **No uploads, no install, no server** — every image is analyzed and converted locally in your browser, so your files never leave your machine.

🔗 **Live:** https://fastwebtools.app/

## Tools

| Tool | Route | What it does |
| --- | --- | --- |
| **Image Analyzer** | `/analyze-image` | Inspect any image — filename, real format (detected from magic bytes), size, dimensions, megapixels, aspect ratio, PNG color/bit-depth, and full EXIF metadata (camera, lens, exposure, aperture, ISO, focal length, orientation, GPS). One click converts it. |
| **Convert to WebP** | `/to-webp` | Convert JPG · PNG · GIF · AVIF and more to WebP, with a quality slider and batch support. |
| **Convert to AVIF** | `/to-avif` | Same, targeting AVIF for high compression. |

From the analyzer, the **Convert to WebP / AVIF** buttons hand the image straight to the matching converter and convert it on arrival — no re-upload.

## Features

- **100% client-side** — conversion runs in a Web Worker using the [`@jsquash`](https://github.com/jamsinclair/jSquash) WASM codecs; nothing is sent to a server.
- **Self-contained EXIF parser** — TIFF/EXIF/GPS read directly from bytes, no extra dependencies.
- **Batch convert + ZIP download** — drop many files, download them all at once.
- **Persistent history** — converted results are kept in IndexedDB and restored on return.
- **Multilingual & SEO-ready** — English (default), Korean, Chinese, Japanese, each a real static page with `hreflang`, Open Graph, and JSON-LD.

## Tech stack

- [Astro](https://astro.build/) — static site generation, one prerendered HTML page per tool × locale.
- TypeScript, Web Workers, IndexedDB, OffscreenCanvas / `createImageBitmap`.
- `@jsquash/webp` and `@jsquash/avif` (WebAssembly codecs).
- Deployed to GitHub Pages.

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # static build to dist/
npm run preview  # serve the production build
```

## Project structure

```
src/
├─ pages/                  # routes (en at root, /[lang]/ for ko·zh·ja)
│  ├─ index.astro          # home
│  ├─ analyze-image.astro  # image analyzer
│  └─ [tool].astro         # converters (to-webp, to-avif)
├─ components/
│  ├─ HomeView · AnalyzerView · ToolView   # page bodies (locale-reused)
│  ├─ ImageAnalyzer.astro  # analyzer UI + client island
│  └─ ImageConverter.astro # converter UI + client island
├─ lib/
│  ├─ analyze.ts           # format detection + EXIF/TIFF parser
│  ├─ convert.ts / .worker # Web Worker conversion wrapper
│  ├─ handoff.ts           # one-shot image handoff between pages
│  ├─ store.ts             # IndexedDB history
│  ├─ zip.ts · formats.ts  # ZIP packer · tool config
└─ i18n/                   # config · UI strings · SEO copy (en·ko·zh·ja)
```

To add a new converter, add one entry to `src/lib/formats.ts` — the route, home card, and localized pages are generated from it.

## Privacy

There is no backend. Images are processed in memory and (for conversion history) stored only in your browser's IndexedDB. Clearing site data removes everything.
