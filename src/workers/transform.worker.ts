/// <reference lib="webworker" />
import type { Asset, EngineRuntime, RunContext } from '../core/engines/types';
import { getEngine } from '../core/engines/registry';

/**
 * Shared transform worker. Hosts the `execution: 'worker'` engines (canvas-image, archive,
 * heic, gif) off the main thread. Each worker instance handles one request at a time; the
 * {@link WorkerPool} manages concurrency.
 */

interface RunMessage {
  type: 'run';
  requestId: string;
  engineId: string;
  ctx: Omit<RunContext, 'onProgress'>;
  inputs: Asset[];
}

type Outbound =
  | { type: 'progress'; requestId: string; fraction: number }
  | { type: 'result'; requestId: string; assets: Asset[] }
  | { type: 'error'; requestId: string; message: string };

const runtimeCache = new Map<string, Promise<EngineRuntime>>();

function loadRuntime(engineId: string): Promise<EngineRuntime> {
  let cached = runtimeCache.get(engineId);
  if (!cached) {
    const engine = getEngine(engineId);
    if (!engine) return Promise.reject(new Error(`Unknown engine "${engineId}"`));
    cached = engine.load();
    runtimeCache.set(engineId, cached);
  }
  return cached;
}

function post(msg: Outbound, transfer?: Transferable[]): void {
  (self as DedicatedWorkerGlobalScope).postMessage(msg, transfer ?? []);
}

self.onmessage = async (e: MessageEvent<RunMessage>) => {
  const msg = e.data;
  if (msg.type !== 'run') return;
  const { requestId, engineId, ctx, inputs } = msg;
  try {
    const runtime = await loadRuntime(engineId);
    const onProgress = (fraction: number) => post({ type: 'progress', requestId, fraction });
    const assets = await runtime.run(inputs, { ...ctx, onProgress });
    const transfer = assets.map((a) => a.data.buffer);
    post({ type: 'result', requestId, assets }, transfer);
  } catch (err) {
    post({ type: 'error', requestId, message: err instanceof Error ? err.message : String(err) });
  }
};
