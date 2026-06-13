import type { Params } from '../../../core/engines/types';

export interface EditorProps {
  url: string;
  formatId: string;
  name: string;
  file?: File;
  op?: string;
  params: Params;
  /** Merge a partial set of params into the tool's param state. */
  patch: (p: Params) => void;
}
