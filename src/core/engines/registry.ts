import type { Capability, ConvertCapability, Engine, TransformCapability } from './types';

import { canvasImageEngine } from '../../engines/canvas-image';
import { pdfEngine } from '../../engines/pdf';
import { archiveEngine } from '../../engines/archive';
import { heicEngine } from '../../engines/heic';
import { vectorEngine } from '../../engines/vector';
import { gifEngine } from '../../engines/gif';
import { ffmpegEngine } from '../../engines/ffmpeg';
import { docsEngine } from '../../engines/docs';
import { dataEngine } from '../../engines/data';

/**
 * The master list of engines. Each entry is a *descriptor* — importing this module is cheap
 * because engines lazy-import their heavy runtimes inside `load()`. Both the main thread (for
 * planning) and the transform worker (for execution) import this.
 */
export const ENGINES: Engine[] = [
  canvasImageEngine,
  pdfEngine,
  archiveEngine,
  heicEngine,
  vectorEngine,
  gifEngine,
  ffmpegEngine,
  docsEngine,
  dataEngine,
];

const BY_ID = new Map(ENGINES.map((e) => [e.id, e]));

export function getEngine(id: string): Engine | undefined {
  return BY_ID.get(id);
}

export interface ConvertEdge {
  engineId: string;
  capability: ConvertCapability;
  from: string;
  to: string;
}

/** Flatten every convert capability into individual from→to edges. */
export function convertEdges(): ConvertEdge[] {
  const edges: ConvertEdge[] = [];
  for (const engine of ENGINES) {
    for (const cap of engine.capabilities) {
      if (cap.type !== 'convert') continue;
      for (const from of cap.from) {
        for (const to of cap.to) {
          edges.push({ engineId: engine.id, capability: cap, from, to });
        }
      }
    }
  }
  return edges;
}

export interface CompressOption {
  engineId: string;
  capability: Extract<Capability, { type: 'compress' }>;
}

export function compressorsFor(formatId: string): CompressOption[] {
  const out: CompressOption[] = [];
  for (const engine of ENGINES) {
    for (const cap of engine.capabilities) {
      if (cap.type === 'compress' && cap.formats.includes(formatId)) {
        out.push({ engineId: engine.id, capability: cap });
      }
    }
  }
  return out;
}

export interface TransformOption {
  engineId: string;
  capability: TransformCapability;
}

export function findTransform(op: string): TransformOption | undefined {
  for (const engine of ENGINES) {
    for (const cap of engine.capabilities) {
      if (cap.type === 'transform' && cap.op === op) {
        return { engineId: engine.id, capability: cap };
      }
    }
  }
  return undefined;
}

export function transformsFor(formatId: string): TransformOption[] {
  const out: TransformOption[] = [];
  for (const engine of ENGINES) {
    for (const cap of engine.capabilities) {
      if (cap.type === 'transform' && cap.formats.includes(formatId)) {
        out.push({ engineId: engine.id, capability: cap });
      }
    }
  }
  return out;
}

/** All format ids reachable as a conversion target from a given source (1+ hops). */
export function reachableTargets(from: string): Set<string> {
  const edges = convertEdges();
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const node = stack.pop()!;
    for (const next of adj.get(node) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  seen.delete(from);
  return seen;
}
