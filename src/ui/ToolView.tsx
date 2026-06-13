import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dropzone } from './components/Dropzone';
import { OptionsPanel } from './components/OptionsPanel';
import { JobResults } from './components/ResultList';
import { WIDGETS } from './widgets/registry';
import { ToolEditor } from './components/preview/ToolEditor';
import { useObjectUrls } from './hooks/useObjectUrls';
import {
  acceptedFormats,
  buildTask,
  resolveParams,
  resolveTargets,
  toolAccepts,
  toolById,
} from '../tools/registry';
import { formatLabel, getFormat } from '../core/formats/registry';
import { detectFile } from '../core/formats/detect';
import { fileToAsset } from '../core/util/blob';
import { formatBytes } from '../core/util/bytes';
import type { Params, ParamValue } from '../core/engines/types';
import { runJob } from '../core/service';

interface ToolViewProps {
  toolId: string;
  onBack: () => void;
}

interface PickedFile {
  file: File;
  formatId: string;
}

export function ToolView({ toolId, onBack }: ToolViewProps) {
  const tool = toolById(toolId);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [target, setTarget] = useState<string | undefined>(tool?.target);
  const [params, setParams] = useState<Params>({});
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const inputFormat = files[0]?.formatId;
  const fileList = useMemo(() => files.map((f) => f.file), [files]);
  const urls = useObjectUrls(fileList);
  const patch = useCallback((p: Params) => setParams((prev) => ({ ...prev, ...p })), []);

  const targets = useMemo(() => {
    if (!tool || tool.kind !== 'convert') return [];
    if (tool.target) return [tool.target];
    return inputFormat ? resolveTargets(tool, inputFormat) : (tool.targetChoices ?? []);
  }, [tool, inputFormat]);

  // Keep the chosen target valid as inputs change.
  useEffect(() => {
    if (!tool || tool.kind !== 'convert' || tool.target) return;
    if (targets.length && (!target || !targets.includes(target))) setTarget(targets[0]);
  }, [tool, targets, target]);

  const specs = useMemo(() => {
    if (!tool || !inputFormat) return [];
    return resolveParams(tool, inputFormat, target);
  }, [tool, inputFormat, target]);

  // Seed defaults for any newly-relevant params without clobbering user edits.
  useEffect(() => {
    setParams((prev) => {
      const next = { ...prev };
      for (const s of specs) if (!(s.key in next) && s.default !== undefined) next[s.key] = s.default;
      return next;
    });
  }, [specs]);

  if (!tool) return <div className="toolview"><button className="back" onClick={onBack}>← Back</button><p>Unknown tool.</p></div>;

  if (tool.kind === 'widget' && tool.widget) {
    const Widget = WIDGETS[tool.widget];
    return (
      <div className="toolview">
        <Header name={tool.name} description={tool.description} badge={tool.badge} onBack={onBack} />
        {Widget ? <Widget /> : <p>Unknown widget.</p>}
      </div>
    );
  }

  const isMerge = tool.arity === 'n-1';

  const addFiles = async (incoming: File[]) => {
    setNotice(null);
    const picked: PickedFile[] = [];
    const rejected: string[] = [];
    for (const file of incoming) {
      const formatId = await detectFile(file);
      if (toolAccepts(tool, formatId)) picked.push({ file, formatId });
      else rejected.push(`${file.name} (${formatLabel(formatId)})`);
    }
    if (rejected.length) setNotice(`Skipped unsupported: ${rejected.join(', ')}`);
    setFiles((prev) => (tool.multiple ? [...prev, ...picked] : picked.slice(-1)));
  };

  const run = async () => {
    if (files.length === 0) return;
    setNotice(null);
    const task = buildTask(tool, params, target);
    const newIds: string[] = [];

    if (isMerge) {
      const assets = await Promise.all(files.map((f) => fileToAsset(f.file, f.formatId)));
      newIds.push(runJob({ toolId: tool.id, label: tool.name, task, inputs: assets, inputFormat: files[0].formatId }));
    } else {
      for (const f of files) {
        const asset = await fileToAsset(f.file, f.formatId);
        newIds.push(
          runJob({
            toolId: tool.id,
            label: `${tool.name} · ${f.file.name}`,
            task: buildTask(tool, params, target),
            inputs: [asset],
            inputFormat: f.formatId,
          }),
        );
      }
    }
    setJobIds((prev) => [...newIds, ...prev]);
  };

  const acceptHint = describeAccept(tool.acceptKind, acceptedFormats(tool));
  const canConvert = tool.kind !== 'convert' || tool.target || !inputFormat || targets.length > 0;
  const canRun = files.length > 0 && (!isMerge || files.length >= 2) && Boolean(canConvert);

  return (
    <div className="toolview">
      <Header name={tool.name} description={tool.description} badge={tool.badge} onBack={onBack} />

      <Dropzone multiple={tool.multiple} hint={acceptHint} onFiles={addFiles} />

      {notice && <p className="notice">{notice}</p>}

      {files.length > 0 && (
        <div className="filelist">
          {files.map((f, i) => (
            <div className="filerow" key={`${f.file.name}-${i}`}>
              <span className="file-fmt">{formatLabel(f.formatId)}</span>
              <span className="file-name">{f.file.name}</span>
              <span className="file-size">{formatBytes(f.file.size)}</span>
              <button className="file-remove" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} aria-label="Remove">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && <ToolEditor tool={tool} files={files} urls={urls} params={params} patch={patch} />}

      {files.length > 0 && (
        <div className="run-panel">
          {tool.kind === 'convert' && !tool.target && (
            <label className="option">
              <span className="option-label">Convert to</span>
              {targets.length > 0 ? (
                <select value={target ?? ''} onChange={(e) => setTarget(e.target.value)}>
                  {targets.map((t) => (
                    <option key={t} value={t}>
                      {getFormat(t)?.label ?? t.toUpperCase()}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="muted">No client-side target available from {formatLabel(inputFormat!)}.</span>
              )}
            </label>
          )}

          <OptionsPanel specs={specs} values={params} onChange={(k: string, v: ParamValue) => setParams((p) => ({ ...p, [k]: v }))} />

          {isMerge && files.length < 2 && <p className="notice">Add at least two files to combine.</p>}

          <button className="run" onClick={run} disabled={!canRun}>
            {labelForRun(tool.kind, isMerge)}
          </button>
        </div>
      )}

      <JobResults jobIds={jobIds} />
    </div>
  );
}

function Header({ name, description, badge, onBack }: { name: string; description: string; badge?: string; onBack: () => void }) {
  return (
    <div className="toolhead">
      <button className="back" onClick={onBack}>
        ← All tools
      </button>
      <h1>
        {name} {badge && <span className="tool-badge">{badge}</span>}
      </h1>
      <p className="muted">{description}</p>
    </div>
  );
}

function describeAccept(kind: string | undefined, formats: string[]): string {
  if (kind === 'data' || (kind === undefined && formats.length === 0)) return 'Any file type';
  const labels = formats.map((f) => getFormat(f)?.ext[0]?.toUpperCase() ?? f.toUpperCase());
  const unique = [...new Set(labels)];
  if (unique.length > 8) return `${kind ?? 'Supported'} files`;
  return unique.join(' · ');
}

function labelForRun(kind: string, isMerge: boolean): string {
  if (isMerge) return 'Combine';
  if (kind === 'compress') return 'Compress';
  if (kind === 'convert') return 'Convert';
  return 'Run';
}
