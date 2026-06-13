# WebToolsUltima

**Every tool you need, running in your browser.** A local-first, server-free **tool platform**:
a growing library of fast, private utilities that run entirely on your device. Convert &
compress files, encode & hash text, generate data, crunch numbers — with **no uploads, no
accounts, and no servers**. Your data never leaves your machine.

> Powered by or derived from software by [Cognitive Industries](https://cognitive-industries.org).

See [`CLAUDE.md`](./CLAUDE.md) for the standing rules and [`TOOL_LOG.md`](./TOOL_LOG.md) for the
engine/tool registry.

## Why it's different

WebToolsUltima isn't a wall of one-off pages backed by a server farm — it's a single
client-side **tool engine** that everything plugs into:

- **An any → any file engine.** Formats are graph **nodes**; converters are **edges**. A planner
  runs a shortest-path search to get from your input to whatever you want, chaining steps when
  there's no direct route (e.g. `HEIC → PNG → JPG` happens automatically). Tools like
  "WEBP → PNG", "MP4 → MP3" or "PDF Merge" are thin **presets over the graph** — add a capability
  to an engine and new tools appear for free.
- **Instant utilities, too.** Beyond files, WebToolsUltima hosts standalone widgets — Base64 /
  URL encoders, JSON formatter, SHA hashes, case converter, UUID / password / lorem generators,
  unit & time converters — all running locally.
- **Everything is private and off the main thread.** Heavy work runs in Web Workers; large
  engines (`ffmpeg.wasm`) lazy-load only when a tool needs them. No file bytes are ever sent
  anywhere — verify it yourself in the Network tab.

## Tool families

| Group | Categories | Examples |
|-------|-----------|----------|
| **Files** | Convert · Compress · Modify | Image/Audio/Video/PDF/Doc convert, image & PDF & media compress, crop/rotate/resize, PDF merge/split, GIF maker, video trim |
| **Utilities** | Text & Code · Generate · Calculate | Base64, URL encode, JSON formatter, hashes, case convert, counters · UUID / password / lorem · unit & time converters |

## Architecture

```
src/
  core/
    formats/      Format registry + content-sniffing detector
    engines/      Engine/Capability contracts + engine registry (capability index)
    planner/      Graph search → a Pipeline of steps
    pipeline/     Executor (batch, fan-in/out, progress, cancel) + worker pool
    jobs/         Job/activity store (live progress, cancel)
    util/         bytes, blob, zip, download helpers
  engines/        Self-contained capability providers (canvas-image, pdf, archive, heic,
                  vector, gif, ffmpeg, docs, data). Each lazy-loads its own deps.
  tools/          Tool presets derived from capabilities + curated named tools; categories
  ui/
    components/preview/   FilePreview + interactive editors (crop/trim) bound to params
    widgets/              Instant non-file tools (encoders, hashes, generators, calculators)
    ...                   Launcher (search grid) + tool view (dropzone → options → run → results)
  workers/        Shared transform worker hosting the light engines
```

### Two extension points

```ts
// 1. A file Engine — adds capabilities (edges/operations) to the graph
interface Engine {
  id: string;
  capabilities: Capability[];      // convert | compress | transform
  load(): Promise<EngineRuntime>;  // lazy: import libs / init wasm
}

// 2. A widget — a standalone client-side tool, registered in ui/widgets/registry.tsx
```

Adding a file tool = adding a capability (or engine) + a preset entry; the planner and UI pick
it up automatically. Adding an instant tool = a component + a registry entry. A startup
assertion guarantees the catalog never advertises something the engines can't actually do.

## Develop

```sh
npm install
npm run dev         # http://localhost:5173 (sets COOP/COEP headers for ffmpeg threads)
npm run typecheck   # strict type-check
npm run build       # production build → dist/
npm run test        # vitest unit tests (planner, detection, engines, catalog)
```

> **Hosting note.** The threaded `ffmpeg.wasm` build needs cross-origin isolation. Serve the
> production build with `Cross-Origin-Opener-Policy: same-origin` and
> `Cross-Origin-Embedder-Policy: require-corp` headers (the dev/preview servers set these
> automatically via a Vite plugin).

## Privacy

WebToolsUltima makes **no network requests with your data**. The only fetches are the app's own
static assets and lazy engine payloads (e.g. `ffmpeg.wasm`). You can confirm this in your
browser's DevTools Network tab during any operation.

## Roadmap

- Higher-fidelity document conversions (PDF↔Word reflow, rich EPUB/DOCX layout).
- Password-protect / unlock PDF (needs a PDF crypto layer, e.g. qpdf-wasm).
- More image codecs via WASM (mozjpeg, oxipng, AVIF encode).
- More instant tools (QR codes, colour tools, regex tester, diff, cron, …).
- Saveable pipeline recipes + PWA offline install.

## License & attribution

Licensed under **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
(CC BY-NC-SA 4.0)** — see [`LICENSE`](./LICENSE). You may use, study, modify and share this
software **non-commercially**, provided you give credit and license derivatives under the same
terms; commercial use requires separate written permission. Any use, fork, deployment or public
availability must keep the attribution:

> Powered by or derived from software by Cognitive Industries (https://cognitive-industries.org)
