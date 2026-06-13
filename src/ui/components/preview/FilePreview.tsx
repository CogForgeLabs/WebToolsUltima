import { useEffect, useRef, useState } from 'react';
import { getFormat, formatLabel } from '../../../core/formats/registry';
import { renderPdfPage, bytesFrom } from './pdfRender';

export interface PreviewSource {
  url: string;
  formatId: string;
  name: string;
  /** Provided for inputs (lets us read bytes/text without re-fetching the blob URL). */
  file?: File;
}

const TEXT_FORMATS = new Set(['txt', 'html', 'md', 'json', 'csv']);

/** Passive preview of a file, chosen by format kind. */
export function FilePreview({ url, formatId, name, file }: PreviewSource) {
  const fmt = getFormat(formatId);
  const kind = fmt?.kind;

  if (kind === 'image') {
    return (
      <div className="preview-stage">
        <img className="prev-img" src={url} alt={name} />
      </div>
    );
  }
  if (kind === 'audio') {
    return (
      <div className="preview-stage audio">
        <div className="prev-glyph">♪</div>
        <audio controls src={url} />
      </div>
    );
  }
  if (kind === 'video') {
    return (
      <div className="preview-stage">
        <video className="prev-video" controls src={url} />
      </div>
    );
  }
  if (formatId === 'pdf') {
    return <PdfThumb file={file} url={url} />;
  }
  if (TEXT_FORMATS.has(formatId)) {
    return <TextThumb file={file} url={url} />;
  }
  return <FileChip name={name} label={formatLabel(formatId)} />;
}

export function PdfThumb({ file, url, page = 1 }: { file?: File; url: string; page?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [meta, setMeta] = useState<{ pages: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const bytes = await bytesFrom(file, url);
        const r = await renderPdfPage(bytes, page, 560);
        if (!alive) return;
        const el = host.current;
        if (el) {
          el.replaceChildren(r.canvas);
          r.canvas.className = 'prev-canvas';
        }
        setMeta({ pages: r.pageCount });
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Could not render PDF');
      }
    })();
    return () => {
      alive = false;
    };
  }, [file, url, page]);

  return (
    <div className="preview-stage pdf">
      {error ? <p className="job-error">{error}</p> : <div ref={host} className="pdf-host" />}
      {meta && <span className="prev-caption">{meta.pages} page{meta.pages === 1 ? '' : 's'}</span>}
    </div>
  );
}

function TextThumb({ file, url }: { file?: File; url: string }) {
  const [text, setText] = useState<string>('');
  useEffect(() => {
    let alive = true;
    (async () => {
      const raw = file ? await file.text() : await (await fetch(url)).text();
      if (alive) setText(raw.slice(0, 4000));
    })();
    return () => {
      alive = false;
    };
  }, [file, url]);
  return (
    <div className="preview-stage text">
      <pre className="prev-text">{text}</pre>
    </div>
  );
}

function FileChip({ name, label }: { name: string; label: string }) {
  return (
    <div className="preview-stage chip">
      <div className="prev-glyph">🗎</div>
      <div className="chip-name">{name}</div>
      <div className="chip-label">{label}</div>
    </div>
  );
}
