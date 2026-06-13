import type { Asset, RunContext } from '../engines/types';

type Ctx = Omit<RunContext, 'onProgress'>;

interface Task {
  engineId: string;
  ctx: Ctx;
  inputs: Asset[];
  onProgress: (fraction: number) => void;
  resolve: (assets: Asset[]) => void;
  reject: (err: Error) => void;
  signal?: AbortSignal;
}

interface Slot {
  worker: Worker;
  active: { requestId: string; task: Task } | null;
}

/**
 * A small pool of {@link Worker}s that run `execution: 'worker'` engine steps. Workers are
 * spawned lazily up to `maxWorkers`; tasks queue when all are busy. Each worker handles one
 * task at a time, keyed by a request id.
 */
export class WorkerPool {
  private slots: Slot[] = [];
  private queue: Task[] = [];
  private readonly maxWorkers: number;
  private seq = 0;

  constructor(maxWorkers?: number) {
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    this.maxWorkers = maxWorkers ?? Math.max(1, Math.min(4, cores - 1));
  }

  run(engineId: string, ctx: Ctx, inputs: Asset[], onProgress: (f: number) => void, signal?: AbortSignal): Promise<Asset[]> {
    return new Promise<Asset[]>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const task: Task = { engineId, ctx, inputs, onProgress, resolve, reject, signal };
      this.queue.push(task);
      this.pump();
    });
  }

  private spawn(): Slot {
    const worker = new Worker(new URL('../../workers/transform.worker.ts', import.meta.url), {
      type: 'module',
    });
    const slot: Slot = { worker, active: null };
    worker.onmessage = (e: MessageEvent) => this.onMessage(slot, e);
    worker.onerror = (e) => {
      if (slot.active) {
        slot.active.task.reject(new Error(e.message || 'Worker crashed'));
        slot.active = null;
        // Replace the dead worker.
        worker.terminate();
        this.slots = this.slots.filter((s) => s !== slot);
        this.pump();
      }
    };
    this.slots.push(slot);
    return slot;
  }

  private onMessage(slot: Slot, e: MessageEvent): void {
    const msg = e.data as
      | { type: 'progress'; requestId: string; fraction: number }
      | { type: 'result'; requestId: string; assets: Asset[] }
      | { type: 'error'; requestId: string; message: string };
    if (!slot.active || msg.requestId !== slot.active.requestId) return;
    const { task } = slot.active;
    if (msg.type === 'progress') {
      task.onProgress(msg.fraction);
    } else if (msg.type === 'result') {
      slot.active = null;
      task.resolve(msg.assets);
      this.pump();
    } else if (msg.type === 'error') {
      slot.active = null;
      task.reject(new Error(msg.message));
      this.pump();
    }
  }

  private pump(): void {
    if (this.queue.length === 0) return;

    // Drop aborted tasks up front.
    this.queue = this.queue.filter((t) => {
      if (t.signal?.aborted) {
        t.reject(new DOMException('Aborted', 'AbortError'));
        return false;
      }
      return true;
    });

    let free = this.slots.find((s) => s.active === null);
    if (!free && this.slots.length < this.maxWorkers) free = this.spawn();
    if (!free) return;

    const task = this.queue.shift();
    if (!task) return;

    const requestId = `r${this.seq++}`;
    free.active = { requestId, task };

    const onAbort = () => {
      // The worker can't be interrupted mid-task; terminate and replace it.
      if (free!.active?.requestId === requestId) {
        free!.worker.terminate();
        this.slots = this.slots.filter((s) => s !== free);
        task.reject(new DOMException('Aborted', 'AbortError'));
        free!.active = null;
        this.pump();
      }
    };
    task.signal?.addEventListener('abort', onAbort, { once: true });

    free.worker.postMessage({ type: 'run', requestId, engineId: task.engineId, ctx: task.ctx, inputs: task.inputs });

    // Try to fill any other free slots with remaining queued tasks.
    if (this.queue.length > 0) this.pump();
  }

  dispose(): void {
    this.slots.forEach((s) => s.worker.terminate());
    this.slots = [];
    this.queue = [];
  }
}

let shared: WorkerPool | null = null;
export function workerPool(): WorkerPool {
  if (!shared) shared = new WorkerPool();
  return shared;
}
