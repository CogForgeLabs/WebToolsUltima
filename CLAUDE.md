# WebToolsUltima — standing rules

A local-first, **server-free** in-browser **tool platform**. Its flagship is an any→any file
engine (convert / compress / modify); it also hosts standalone "instant" utilities (encoders,
hashes, generators, calculators). The user's data never leaves their device. This file holds
the rules every change must follow. See [`README.md`](./README.md) for architecture and
[`TOOL_LOG.md`](./TOOL_LOG.md) for the engine/tool registry.

> Licensed under CC BY-NC-SA 4.0 (non-commercial, attribution + share-alike) — see [`LICENSE`](./LICENSE).
> Keep the attribution to Cognitive Industries in the README and the app's footer/about.

## Core principles

1. **Local-first, always.** No file bytes may be sent to any network endpoint, ever. The only
   permitted network fetches are the app's own static assets and **lazy engine payloads**
   (e.g. `ffmpeg.wasm`) served from our own origin / a pinned CDN. If a feature cannot be done
   client-side, it does not ship — we find a client-side path or mark it roadmap, never a
   silent server call.
2. **Any → any, not N×N.** Never hand-write a `formatA→formatB` converter as a one-off. Add a
   **capability** to an engine and let the planner ([`src/core/planner/plan.ts`](./src/core/planner/plan.ts))
   chain it. Tools are *presets over the graph*, not bespoke code paths.
3. **Engines are self-contained & lazy.** Each engine lives in `src/engines/<id>/` and exposes
   an `Engine` (capabilities + `load()`). Heavy libraries/WASM load only inside `load()`, only
   when a tool that needs them runs. An engine never imports another engine.
4. **Off the main thread.** CPU/byte-heavy work runs in a Worker. The UI thread stays
   responsive; progress is reported through the jobs store
   ([`src/core/jobs/store.ts`](./src/core/jobs/store.ts)).
5. **The catalog cannot lie.** Every tool preset in [`src/tools/registry.ts`](./src/tools/registry.ts)
   must be reachable through the planner. A startup assertion (dev) fails loudly if a tool
   advertises something the engines can't perform.
6. **Honest fidelity.** When a conversion is best-effort (e.g. PDF→Word reflow), say so in the
   UI with a clear badge and frame it as a roadmap item to improve — never present degraded
   output as faithful, and never let a limitation read as a dead end.
7. **Type-safe & clean.** `npm run typecheck` and `npm run build` must pass with no errors.
   Strict TS, no `any` leaking across module boundaries.

## Adding an engine
1. Create `src/engines/<id>/index.ts` exporting an `Engine`. Declare `capabilities`
   (`convert` / `compress` / `transform`) and implement `load()` → `EngineRuntime.run(...)`.
2. Lazy-import heavy deps inside `load()`. Keep injected worker logic in the engine folder.
3. Register the engine in [`src/core/engines/registry.ts`](./src/core/engines/registry.ts).
4. Add any new `Format`s to [`src/core/formats/registry.ts`](./src/core/formats/registry.ts).
5. Add/curate presets in [`src/tools/registry.ts`](./src/tools/registry.ts) (generic + named).
6. Add a smoke test under `src/**/__tests__`.
7. Log it in [`TOOL_LOG.md`](./TOOL_LOG.md).

## Adding an instant tool (widget)
Non-file tools (encoders, generators, calculators) are standalone client-side widgets — they do
not go through the file pipeline.
1. Create a component under `src/ui/widgets/` (pure client; no network).
2. Register it in `src/ui/widgets/registry.tsx` under a stable `widget` id.
3. Add a `kind: 'widget'` entry in [`src/tools/registry.ts`](./src/tools/registry.ts) (use the
   `widgetTool(...)` helper) with its category.
4. Log it in [`TOOL_LOG.md`](./TOOL_LOG.md).

## Tone & framing (global)
- Never use "Honest"/"Honestly" or "Reality Check" as labels/headers — state substance directly.
- Never be defeatist. Lead with a solution or path forward; frame limits as problems to solve.
