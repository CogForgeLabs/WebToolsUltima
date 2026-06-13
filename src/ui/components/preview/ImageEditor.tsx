import { useRef, useState, type CSSProperties } from 'react';
import { CropBox, type NormRect } from './CropBox';
import type { EditorProps } from './types';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Interactive image editor. `crop` gets a draggable rectangle two-way bound to the x/y/width/
 * height params; `rotate`/`flip`/`resize`/`enlarge` show a live preview driven by their params.
 */
export function ImageEditor({ url, name, op, params, patch }: EditorProps) {
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null);
  const seeded = useRef(false);

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const w = e.currentTarget.naturalWidth;
    const h = e.currentTarget.naturalHeight;
    setDim({ w, h });
    if (op === 'crop' && !seeded.current && !Number(params.width)) {
      seeded.current = true;
      patch({ x: Math.round(w * 0.1), y: Math.round(h * 0.1), width: Math.round(w * 0.8), height: Math.round(h * 0.8) });
    }
    if (op === 'resize' && !seeded.current && !Number(params.width)) {
      seeded.current = true;
      patch({ width: w, height: h });
    }
  };

  const imgStyle: CSSProperties = {};
  if (op === 'rotate') imgStyle.transform = `rotate(${Number(params.angle ?? 90)}deg)`;
  if (op === 'flip') imgStyle.transform = params.direction === 'vertical' ? 'scaleY(-1)' : 'scaleX(-1)';

  const rect: NormRect | null =
    op === 'crop' && dim
      ? {
          x: clamp((Number(params.x) || 0) / dim.w, 0, 1),
          y: clamp((Number(params.y) || 0) / dim.h, 0, 1),
          w: clamp((Number(params.width) || dim.w) / dim.w, 0, 1),
          h: clamp((Number(params.height) || dim.h) / dim.h, 0, 1),
        }
      : null;

  const onRect = (r: NormRect) => {
    if (!dim) return;
    patch({
      x: Math.round(r.x * dim.w),
      y: Math.round(r.y * dim.h),
      width: Math.round(r.w * dim.w),
      height: Math.round(r.h * dim.h),
    });
  };

  return (
    <div className="editor">
      <div className={`preview-stage${op === 'rotate' ? ' rotate-pad' : ''}`}>
        <img className="prev-img" src={url} alt={name} style={imgStyle} onLoad={onLoad} draggable={false} />
        {rect && <CropBox value={rect} onChange={onRect} />}
      </div>
      <Readout op={op} dim={dim} params={params} />
    </div>
  );
}

function Readout({ op, dim, params }: { op?: string; dim: { w: number; h: number } | null; params: EditorProps['params'] }) {
  if (!dim) return null;
  if (op === 'crop') {
    return (
      <p className="editor-readout">
        Crop {Number(params.width) || dim.w}×{Number(params.height) || dim.h}px at ({Number(params.x) || 0}, {Number(params.y) || 0}) · drag the box or edit values below
      </p>
    );
  }
  if (op === 'resize') {
    return (
      <p className="editor-readout">
        Original {dim.w}×{dim.h}px → {Number(params.width) || dim.w}×{Number(params.height) || dim.h}px
      </p>
    );
  }
  if (op === 'enlarge') {
    const s = Number(params.scale ?? 2);
    return (
      <p className="editor-readout">
        {dim.w}×{dim.h}px → {Math.round(dim.w * s)}×{Math.round(dim.h * s)}px ({s}×)
      </p>
    );
  }
  return <p className="editor-readout">Live preview · adjust the options below</p>;
}
