import { useEffect, useRef, useState } from 'react';
import { CropBox, type NormRect } from './CropBox';
import { renderPdfPage, bytesFrom } from './pdfRender';
import type { EditorProps } from './types';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * PDF crop editor — renders the first page and overlays a draggable rectangle whose edges map
 * to the top/right/bottom/left crop margins (in PDF points) used by the pdf engine.
 */
export function PdfEditor({ file, url, params, patch }: EditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const [pt, setPt] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const bytes = await bytesFrom(file, url);
        const r = await renderPdfPage(bytes, 1, 560);
        if (!alive) return;
        const el = host.current;
        if (el) {
          r.canvas.className = 'prev-canvas';
          el.replaceChildren(r.canvas);
        }
        setPt({ w: r.widthPt, h: r.heightPt });
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Could not render PDF');
      }
    })();
    return () => {
      alive = false;
    };
  }, [file, url]);

  const top = Number(params.top) || 0;
  const right = Number(params.right) || 0;
  const bottom = Number(params.bottom) || 0;
  const left = Number(params.left) || 0;

  const rect: NormRect | null = pt
    ? {
        x: clamp(left / pt.w, 0, 1),
        y: clamp(top / pt.h, 0, 1),
        w: clamp((pt.w - left - right) / pt.w, 0, 1),
        h: clamp((pt.h - top - bottom) / pt.h, 0, 1),
      }
    : null;

  const onRect = (r: NormRect) => {
    if (!pt) return;
    patch({
      left: Math.round(r.x * pt.w),
      top: Math.round(r.y * pt.h),
      right: Math.round((1 - (r.x + r.w)) * pt.w),
      bottom: Math.round((1 - (r.y + r.h)) * pt.h),
    });
  };

  return (
    <div className="editor">
      <div className="preview-stage pdf">
        {error ? <p className="job-error">{error}</p> : <div ref={host} className="pdf-host crop" />}
        {rect && <CropBox value={rect} onChange={onRect} />}
      </div>
      {pt && <p className="editor-readout">Drag the box to set crop margins · page {Math.round(pt.w)}×{Math.round(pt.h)}pt</p>}
    </div>
  );
}
