import type { Params, Pipeline, PipelineStep, Task } from '../engines/types';
import { compressorsFor, convertEdges, findTransform, type ConvertEdge } from '../engines/registry';

export type PlanResult =
  | { ok: true; pipeline: Pipeline }
  | { ok: false; reason: string };

/**
 * Turn a {@link Task} (what the user wants) plus the detected input format into a concrete
 * {@link Pipeline}. Conversions run a weighted shortest-path search over the convert graph so
 * an indirect route (e.g. HEIC → PNG → JPG) is found automatically when no direct edge exists.
 */
export function plan(inputFormat: string, task: Task): PlanResult {
  switch (task.kind) {
    case 'convert':
      return planConvert(inputFormat, task.target, task.params ?? {});
    case 'compress':
      return planCompress(inputFormat, task.params ?? {});
    case 'transform':
      return planTransform(inputFormat, task.op, task.params ?? {});
  }
}

function planConvert(from: string, to: string, params: Params): PlanResult {
  if (from === to) return { ok: false, reason: `Input is already ${to.toUpperCase()}.` };
  const path = shortestPath(from, to);
  if (!path) {
    return { ok: false, reason: `No client-side path from ${from.toUpperCase()} to ${to.toUpperCase()}.` };
  }
  const pipeline: Pipeline = path.map((edge, i) => ({
    engineId: edge.engineId,
    kind: 'convert',
    target: edge.to,
    // User params (quality, scale, ...) apply to the final encode step.
    params: i === path.length - 1 ? params : {},
  }));
  return { ok: true, pipeline };
}

function planCompress(from: string, params: Params): PlanResult {
  const options = compressorsFor(from);
  if (options.length === 0) {
    return { ok: false, reason: `No compressor available for ${from.toUpperCase()}.` };
  }
  const best = options[0];
  const step: PipelineStep = { engineId: best.engineId, kind: 'compress', target: from, params };
  return { ok: true, pipeline: [step] };
}

function planTransform(from: string, op: string, params: Params): PlanResult {
  const found = findTransform(op);
  if (!found) return { ok: false, reason: `Unknown operation "${op}".` };
  if (!found.capability.formats.includes(from) && !found.capability.formats.includes('any')) {
    return { ok: false, reason: `"${found.capability.label}" doesn't support ${from.toUpperCase()}.` };
  }
  const out = found.capability.outputFormat;
  const step: PipelineStep = {
    engineId: found.engineId,
    kind: 'transform',
    op,
    arity: found.capability.arity ?? '1-1',
    target: !out || out === 'same' ? from : out,
    params,
  };
  return { ok: true, pipeline: [step] };
}

/** Dijkstra over convert edges. Weight = cost, lightly biased toward higher quality. */
function shortestPath(from: string, to: string): ConvertEdge[] | null {
  const edges = convertEdges();
  const adj = new Map<string, ConvertEdge[]>();
  const nodes = new Set<string>([from, to]);
  for (const e of edges) {
    nodes.add(e.from);
    nodes.add(e.to);
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e);
  }
  if (!nodes.has(from)) return null;

  const dist = new Map<string, number>();
  const prev = new Map<string, ConvertEdge>();
  const visited = new Set<string>();
  for (const n of nodes) dist.set(n, Infinity);
  dist.set(from, 0);

  while (visited.size < nodes.size) {
    // Pick the unvisited node with the smallest tentative distance.
    let u: string | null = null;
    let best = Infinity;
    for (const n of nodes) {
      if (visited.has(n)) continue;
      const d = dist.get(n)!;
      if (d < best) {
        best = d;
        u = n;
      }
    }
    if (u === null || best === Infinity) break;
    if (u === to) break;
    visited.add(u);

    for (const edge of adj.get(u) ?? []) {
      const w = edge.capability.cost + (1 - edge.capability.quality) * 0.01;
      const nd = dist.get(u)! + w;
      if (nd < dist.get(edge.to)!) {
        dist.set(edge.to, nd);
        prev.set(edge.to, edge);
      }
    }
  }

  if (!prev.has(to) && from !== to) return null;

  // Reconstruct.
  const path: ConvertEdge[] = [];
  let cur = to;
  const guard = new Set<string>();
  while (cur !== from) {
    const edge = prev.get(cur);
    if (!edge || guard.has(cur)) return null;
    guard.add(cur);
    path.unshift(edge);
    cur = edge.from;
  }
  return path;
}
