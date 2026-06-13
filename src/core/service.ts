import type { Asset, Task } from './engines/types';
import { plan } from './planner/plan';
import { runPipeline } from './pipeline/executor';
import { useJobs, type ResultAsset } from './jobs/store';
import { assetToBlob } from './util/blob';

export interface RunJobInput {
  toolId: string;
  label: string;
  task: Task;
  inputs: Asset[];
  /** Optional override for the format the planner should treat the inputs as. */
  inputFormat?: string;
  note?: string;
}

function toResult(asset: Asset): ResultAsset {
  const blob = assetToBlob(asset);
  return {
    name: asset.name,
    formatId: asset.formatId,
    size: asset.data.length,
    url: URL.createObjectURL(blob),
    data: asset.data,
  };
}

/**
 * Plan + execute a task as a tracked job. Returns the job id immediately; progress and results
 * flow into the jobs store. Errors (including "no client-side path") surface as a failed job.
 */
export function runJob(input: RunJobInput): string {
  const { toolId, label, task, inputs, note } = input;
  const jobs = useJobs.getState();
  const { id, signal } = jobs.create({
    toolId,
    label,
    inputs: inputs.map((a) => ({ name: a.name, size: a.data.length })),
    note,
  });

  const inputFormat = input.inputFormat ?? inputs[0]?.formatId ?? 'any';
  const planned = plan(inputFormat, task);
  if (!planned.ok) {
    jobs.fail(id, planned.reason);
    return id;
  }

  jobs.start(id);
  runPipeline(planned.pipeline, inputs, {
    signal,
    onProgress: (f) => useJobs.getState().setProgress(id, f),
  })
    .then((outputs) => {
      if (outputs.length === 0) {
        useJobs.getState().fail(id, 'No output was produced.');
        return;
      }
      useJobs.getState().complete(id, outputs.map(toResult));
    })
    .catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return; // already marked cancelled
      useJobs.getState().fail(id, err instanceof Error ? err.message : String(err));
    });

  return id;
}
