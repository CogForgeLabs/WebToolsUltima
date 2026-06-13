import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

/** A rectangle in normalised [0..1] coordinates relative to its container. */
export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CropBoxProps {
  value: NormRect;
  onChange: (r: NormRect) => void;
}

type DragMode = { type: 'move' } | { type: 'resize'; handle: string };

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const MIN = 0.02;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * An interactive crop rectangle overlay. Operates entirely in normalised coordinates so it can
 * sit over any media (image, PDF page, video frame); the parent converts to the right units.
 * Fills its positioned parent (which must be `position: relative`).
 */
export function CropBox({ value, onChange }: CropBoxProps) {
  const layer = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: DragMode; startX: number; startY: number; rect: NormRect } | null>(null);

  const begin = (e: ReactPointerEvent, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    drag.current = { mode, startX: e.clientX, startY: e.clientY, rect: value };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onMove = (e: PointerEvent) => {
    const el = layer.current;
    const d = drag.current;
    if (!el || !d) return;
    const box = el.getBoundingClientRect();
    const dx = (e.clientX - d.startX) / box.width;
    const dy = (e.clientY - d.startY) / box.height;
    let { x, y, w, h } = d.rect;

    if (d.mode.type === 'move') {
      x = clamp(x + dx, 0, 1 - w);
      y = clamp(y + dy, 0, 1 - h);
    } else {
      const hh = d.mode.handle;
      if (hh.includes('e')) w = clamp(w + dx, MIN, 1 - x);
      if (hh.includes('s')) h = clamp(h + dy, MIN, 1 - y);
      if (hh.includes('w')) {
        const nx = clamp(x + dx, 0, x + w - MIN);
        w += x - nx;
        x = nx;
      }
      if (hh.includes('n')) {
        const ny = clamp(y + dy, 0, y + h - MIN);
        h += y - ny;
        y = ny;
      }
    }
    onChange({ x, y, w, h });
  };

  const onUp = () => {
    drag.current = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };

  const pct = (n: number) => `${n * 100}%`;

  return (
    <div className="cropbox-layer" ref={layer}>
      <div
        className="cropbox"
        style={{ left: pct(value.x), top: pct(value.y), width: pct(value.w), height: pct(value.h) }}
        onPointerDown={(e) => begin(e, { type: 'move' })}
      >
        <div className="crop-rule v" />
        <div className="crop-rule h" />
        {HANDLES.map((handle) => (
          <span
            key={handle}
            className={`crop-handle h-${handle}`}
            onPointerDown={(e) => begin(e, { type: 'resize', handle })}
          />
        ))}
      </div>
    </div>
  );
}
