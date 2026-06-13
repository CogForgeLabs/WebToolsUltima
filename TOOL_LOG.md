# WebToolsUltima — tool & engine log

Registry of engines (capability providers) and the tool presets derived from them, plus the
standalone instant-tool widgets. Add a row when you add an engine, a curated named tool, or a
widget. Generic file tools (e.g. "Image Converter") are derived automatically from engine
capabilities; named presets (e.g. "WEBP → PNG") are curated.

## Engines

| id | label | deps (lazy) | capabilities | worker | status |
|----|-------|-------------|--------------|--------|--------|
| `canvas-image` | Canvas Image | none (Canvas API) | convert png/jpeg/webp/bmp/gif·compress·transform resize/crop/rotate/flip/enlarge | yes | ✅ planned |
| `pdf` | PDF | pdf-lib, pdfjs-dist | convert pdf↔jpg/png·compress·transform merge/split/rotate/crop/organize/page-remove/extract-pages/flatten/resize/protect/unlock·extract-images | partial | ✅ planned |
| `archive` | Archive | fflate | convert zip/gzip/tar·compress (zip any)·transform extract | yes | ✅ planned |
| `heic` | HEIC | libheif-js | convert heic/heif→jpeg/png | yes | ✅ planned |
| `vector` | Vector / SVG | imagetracerjs | convert svg→raster, raster→svg·color-picker | yes | ✅ planned |
| `gif` | GIF | gifenc | transform gif-maker (images→gif) | yes | ✅ planned |
| `ffmpeg` | Media (FFmpeg) | @ffmpeg/ffmpeg (~30MB) | convert+compress video/audio·video↔gif·trim/crop video | own | ✅ planned |
| `docs` | Documents | mammoth, epubjs | convert docx→pdf, epub↔pdf (best-effort) | partial | 🟡 best-effort |
| `data` | Data | none | convert unit, time (non-file) | no | ✅ planned |

## Tool categories
- **Compress** — Image / JPEG / PNG / PDF / GIF / Video / MP3 / WAV / Archive / any-file.
- **Convert** — Image / Video / Audio / PDF / Document / Ebook / Archive + named pairs.
- **Modify** — Crop/Trim Video · Resize/Crop/Rotate/Flip/Enlarge Image · Color Picker · GIF Maker ·
  PDF Merge/Split/Organize/Rotate/Crop/Protect/Unlock/Flatten/Extract pages/Remove pages/Extract images.
- **Text & Code** — Base64 · URL encode · JSON formatter · Hash (SHA-1/256/384/512) · Case convert · Word/char counter.
- **Generate** — UUID · Password · Lorem Ipsum.
- **Calculate** — Unit · Time converters.

## Widgets (instant, non-file tools)
Registered in `src/ui/widgets/registry.tsx`; tool entries in `src/tools/registry.ts` use
`kind: 'widget'`. Current ids: `base64`, `url`, `json`, `hash`, `case`, `count`, `uuid`,
`password`, `lorem`, `unit`, `time`.

## Changelog
- _0.1.0_ — scaffolding + core framework + first engine batch shipped. All 9 engines implemented;
  typecheck + production build + 20 unit tests green. Catalog reachability assertion passes.
- _0.2.0_ — file previews + interactive editors (crop/trim). Renamed to **WebToolsUltima** and
  reframed as a general tool platform: added `widget` tool kind + Text & Code / Generate
  utility tools. Public-repo prep (README, LICENSE/CNCAL attribution, gitignore/gitattributes).
