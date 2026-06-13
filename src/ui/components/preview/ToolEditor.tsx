import type { ReactElement } from 'react';
import type { Params } from '../../../core/engines/types';
import { getFormat } from '../../../core/formats/registry';
import type { ToolDef } from '../../../tools/registry';
import { FilePreview } from './FilePreview';
import { ImageEditor } from './ImageEditor';
import { PdfEditor } from './PdfEditor';
import { VideoEditor } from './VideoEditor';
import type { EditorProps } from './types';

interface PickedFile {
  file: File;
  formatId: string;
}

interface ToolEditorProps {
  tool: ToolDef;
  files: PickedFile[];
  urls: string[];
  params: Params;
  patch: (p: Params) => void;
}

const IMAGE_OPS = new Set(['crop', 'rotate', 'flip', 'resize', 'enlarge']);
const VIDEO_OPS = new Set(['crop-video', 'trim']);

function interactiveFor(tool: ToolDef, formatId: string): ((p: EditorProps) => ReactElement) | null {
  if (tool.kind !== 'transform' || !tool.op) return null;
  const kind = getFormat(formatId)?.kind;
  if (kind === 'image' && IMAGE_OPS.has(tool.op)) return ImageEditor;
  if (formatId === 'pdf' && tool.op === 'crop') return PdfEditor;
  if (kind === 'video' && VIDEO_OPS.has(tool.op)) return VideoEditor;
  return null;
}

/** Renders the input preview and, where the op is spatial/temporal, an interactive editor. */
export function ToolEditor({ tool, files, urls, params, patch }: ToolEditorProps) {
  if (files.length === 0 || urls.length === 0) return null;

  const active = files[0];
  const Editor = interactiveFor(tool, active.formatId);

  if (Editor) {
    return (
      <div className="preview-block">
        <Editor
          url={urls[0]}
          file={active.file}
          formatId={active.formatId}
          name={active.file.name}
          op={tool.op}
          params={params}
          patch={patch}
        />
        {files.length > 1 && <p className="editor-readout muted">These settings apply to all {files.length} files.</p>}
      </div>
    );
  }

  // Passive previews (convert / compress / merge / etc.).
  const shown = files.slice(0, 6);
  return (
    <div className="preview-block">
      <div className={`preview-grid${shown.length > 1 ? ' multi' : ''}`}>
        {shown.map((f, i) =>
          urls[i] ? (
            <FilePreview key={`${f.file.name}-${i}`} url={urls[i]} formatId={f.formatId} name={f.file.name} file={f.file} />
          ) : null,
        )}
      </div>
      {files.length > shown.length && <p className="editor-readout muted">+{files.length - shown.length} more…</p>}
    </div>
  );
}
