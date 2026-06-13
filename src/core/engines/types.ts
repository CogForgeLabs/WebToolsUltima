/**
 * Core contracts for WebToolsUltima.
 *
 * The whole suite is built on a tiny set of ideas:
 *  - A {@link Format} is a node (png, mp4, pdf, ...).
 *  - An {@link Engine} declares {@link Capability}s: the edges (convert) and operations
 *    (compress / transform) it can perform. Engines are lazy — heavy libs load in `load()`.
 *  - The planner turns a {@link Task} into a {@link Pipeline} of {@link PipelineStep}s.
 *  - The executor runs the pipeline, feeding {@link Asset}s from step to step.
 *
 * Everything here is plain serialisable data (no functions on Capability/Step/Asset) so it can
 * cross the Worker boundary. The only thing with methods is {@link Engine} (`load`) and
 * {@link EngineRuntime} (`run`), which live on whichever thread actually executes the engine.
 */

export type FormatKind = 'image' | 'audio' | 'video' | 'document' | 'ebook' | 'archive' | 'data';

/** A magic-byte signature for content sniffing. `bytes` matched at `offset`; -1 = wildcard. */
export interface MagicSignature {
  offset: number;
  bytes: number[];
}

export interface Format {
  id: string;
  label: string;
  kind: FormatKind;
  /** MIME types; first is canonical. */
  mime: string[];
  /** File extensions without the dot; first is canonical. */
  ext: string[];
  magic?: MagicSignature[];
}

/** A unit of data flowing through a pipeline. `data` is a transferable byte buffer. */
export interface Asset {
  name: string;
  formatId: string;
  data: Uint8Array;
  meta?: Record<string, unknown>;
}

export type ParamValue = string | number | boolean;
export type Params = Record<string, ParamValue>;

export interface ParamOption {
  value: string;
  label: string;
}

export interface ParamSpec {
  key: string;
  label: string;
  type: 'number' | 'range' | 'select' | 'bool' | 'text';
  default?: ParamValue;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: ParamOption[];
  help?: string;
}

/** Convert edge(s): any format in `from` → any format in `to`. */
export interface ConvertCapability {
  type: 'convert';
  from: string[];
  to: string[];
  /** Lower is preferred by the planner. */
  cost: number;
  /** 0..1, higher is better; tie-breaks equal-cost paths. */
  quality: number;
  params?: ParamSpec[];
}

/** Reduce file size while preserving the format. */
export interface CompressCapability {
  type: 'compress';
  formats: string[];
  params?: ParamSpec[];
}

export type TransformArity = '1-1' | 'n-1' | '1-n';

/** A named operation (crop, rotate, merge, split, ...). */
export interface TransformCapability {
  type: 'transform';
  op: string;
  label: string;
  formats: string[];
  /** Output format id, or 'same' to preserve input format. Default 'same'. */
  outputFormat?: string;
  /** How inputs map to outputs. Default '1-1'. */
  arity?: TransformArity;
  params?: ParamSpec[];
}

export type Capability = ConvertCapability | CompressCapability | TransformCapability;

/** Where an engine executes. 'worker' = shared transform worker; 'main' = main thread
 *  (for engines that manage their own workers, e.g. ffmpeg/pdfjs, or trivial pure-JS ones). */
export type EngineExecution = 'worker' | 'main';

export interface RunContext {
  kind: 'convert' | 'compress' | 'transform';
  /** Target format id (convert). */
  target?: string;
  /** Operation name (transform). */
  op?: string;
  params: Params;
  /** Format id of the first input. */
  inputFormat: string;
  onProgress: (fraction: number) => void;
}

export interface EngineRuntime {
  run(inputs: Asset[], ctx: RunContext): Promise<Asset[]>;
}

export interface Engine {
  id: string;
  label: string;
  execution: EngineExecution;
  capabilities: Capability[];
  /** Lazily import heavy deps / init wasm and return the runtime. Called once, cached. */
  load(): Promise<EngineRuntime>;
}

export interface PipelineStep {
  engineId: string;
  kind: 'convert' | 'compress' | 'transform';
  /** Resulting format id for convert steps. */
  target?: string;
  /** Operation for transform steps. */
  op?: string;
  arity?: TransformArity;
  params: Params;
}

export type Pipeline = PipelineStep[];

/** What the user asked for, resolved against a detected input format by the planner. */
export type Task =
  | { kind: 'convert'; target: string; params?: Params }
  | { kind: 'compress'; params?: Params }
  | { kind: 'transform'; op: string; params?: Params };
