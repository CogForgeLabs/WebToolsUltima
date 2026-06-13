import { create } from 'zustand';

export type JobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';

export interface JobInput {
  name: string;
  size: number;
}

export interface ResultAsset {
  name: string;
  formatId: string;
  size: number;
  /** Object URL for download/preview; revoked when the job is removed. */
  url: string;
  data: Uint8Array;
}

export interface Job {
  id: string;
  toolId: string;
  label: string;
  status: JobStatus;
  /** 0..1 */
  progress: number;
  inputs: JobInput[];
  outputs: ResultAsset[];
  note?: string;
  error?: string;
  startedAt: number;
  endedAt?: number;
}

/** AbortControllers live outside the store (not serialisable state). */
const controllers = new Map<string, AbortController>();

interface JobsState {
  jobs: Job[];
  create(init: { toolId: string; label: string; inputs: JobInput[]; note?: string }): { id: string; signal: AbortSignal };
  setProgress(id: string, progress: number): void;
  start(id: string): void;
  complete(id: string, outputs: ResultAsset[]): void;
  fail(id: string, error: string): void;
  cancel(id: string): void;
  remove(id: string): void;
  clearFinished(): void;
}

function patch(jobs: Job[], id: string, fn: (j: Job) => Job): Job[] {
  return jobs.map((j) => (j.id === id ? fn(j) : j));
}

export const useJobs = create<JobsState>((set, get) => ({
  jobs: [],

  create({ toolId, label, inputs, note }) {
    const id = crypto.randomUUID();
    const controller = new AbortController();
    controllers.set(id, controller);
    const job: Job = {
      id,
      toolId,
      label,
      status: 'queued',
      progress: 0,
      inputs,
      outputs: [],
      note,
      startedAt: Date.now(),
    };
    set((s) => ({ jobs: [job, ...s.jobs] }));
    return { id, signal: controller.signal };
  },

  start(id) {
    set((s) => ({ jobs: patch(s.jobs, id, (j) => ({ ...j, status: 'running' })) }));
  },

  setProgress(id, progress) {
    set((s) => ({ jobs: patch(s.jobs, id, (j) => ({ ...j, progress: Math.max(0, Math.min(1, progress)) })) }));
  },

  complete(id, outputs) {
    controllers.delete(id);
    set((s) => ({
      jobs: patch(s.jobs, id, (j) => ({ ...j, status: 'done', progress: 1, outputs, endedAt: Date.now() })),
    }));
  },

  fail(id, error) {
    controllers.delete(id);
    set((s) => ({ jobs: patch(s.jobs, id, (j) => ({ ...j, status: 'error', error, endedAt: Date.now() })) }));
  },

  cancel(id) {
    controllers.get(id)?.abort();
    controllers.delete(id);
    set((s) => ({ jobs: patch(s.jobs, id, (j) => (j.status === 'done' ? j : { ...j, status: 'cancelled', endedAt: Date.now() })) }));
  },

  remove(id) {
    const job = get().jobs.find((j) => j.id === id);
    job?.outputs.forEach((o) => URL.revokeObjectURL(o.url));
    controllers.get(id)?.abort();
    controllers.delete(id);
    set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }));
  },

  clearFinished() {
    const finished = new Set<JobStatus>(['done', 'error', 'cancelled']);
    get().jobs.forEach((j) => {
      if (finished.has(j.status)) j.outputs.forEach((o) => URL.revokeObjectURL(o.url));
    });
    set((s) => ({ jobs: s.jobs.filter((j) => !finished.has(j.status)) }));
  },
}));

export function isActive(status: JobStatus): boolean {
  return status === 'queued' || status === 'running';
}
