import type { Asset, EngineRuntime, Pipeline, PipelineStep, RunContext } from '../engines/types';
import { getEngine } from '../engines/registry';
import { workerPool } from './worker-pool';

export interface RunOptions {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/** Cache of main-thread engine runtimes (ffmpeg, pdf, vector, docs, data). */
const mainRuntimes = new Map<string, Promise<EngineRuntime>>();

function loadMainRuntime(engineId: string): Promise<EngineRuntime> {
  let r = mainRuntimes.get(engineId);
  if (!r) {
    const engine = getEngine(engineId);
    if (!engine) return Promise.reject(new Error(`Unknown engine "${engineId}"`));
    r = engine.load();
    mainRuntimes.set(engineId, r);
  }
  return r;
}

function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}

async function runStep(
  step: PipelineStep,
  inputs: Asset[],
  onStepProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<Asset[]> {
  const engine = getEngine(step.engineId);
  if (!engine) throw new Error(`Unknown engine "${step.engineId}"`);

  const buildCtx = (assets: Asset[]): Omit<RunContext, 'onProgress'> => ({
    kind: step.kind,
    target: step.target,
    op: step.op,
    params: step.params,
    inputFormat: assets[0]?.formatId ?? 'any',
  });

  const exec = async (assets: Asset[], onProgress: (f: number) => void): Promise<Asset[]> => {
    if (engine.execution === 'worker') {
      return workerPool().run(step.engineId, buildCtx(assets), assets, onProgress, signal);
    }
    const runtime = await loadMainRuntime(step.engineId);
    return runtime.run(assets, { ...buildCtx(assets), onProgress });
  };

  // n-1 operations (merge/zip/gif-maker) consume all inputs in a single run.
  if (step.arity === 'n-1') {
    checkAborted(signal);
    return exec(inputs, onStepProgress);
  }

  // 1-1 and 1-n: map over each input, flatten outputs, aggregate progress.
  const out: Asset[] = [];
  const k = inputs.length || 1;
  for (let i = 0; i < inputs.length; i++) {
    checkAborted(signal);
    const produced = await exec([inputs[i]], (f) => onStepProgress((i + f) / k));
    out.push(...produced);
  }
  return out;
}

/**
 * Run a full pipeline over the input assets. Steps execute sequentially, each consuming the
 * previous step's outputs. Progress is aggregated across steps; `signal` cancels at boundaries.
 */
export async function runPipeline(pipeline: Pipeline, inputs: Asset[], opts: RunOptions = {}): Promise<Asset[]> {
  const { onProgress, signal } = opts;
  const total = pipeline.length || 1;
  let assets = inputs;

  for (let i = 0; i < pipeline.length; i++) {
    checkAborted(signal);
    assets = await runStep(pipeline[i], assets, (f) => onProgress?.((i + f) / total), signal);
  }
  onProgress?.(1);
  return assets;
}
