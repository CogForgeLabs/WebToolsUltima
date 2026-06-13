import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { CropBox, type NormRect } from './CropBox';
import type { EditorProps } from './types';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const round2 = (n: number) => Math.round(n * 10) / 10;

/** Video editor — `crop-video` shows a draggable frame box; `trim` shows an in/out timeline. */
export function VideoEditor({ url, op, params, patch }: EditorProps) {
  const video = useRef<HTMLVideoElement>(null);
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null);
  const [duration, setDuration] = useState(0);
  const seeded = useRef(false);

  const onMeta = () => {
    const v = video.current;
    if (!v) return;
    setDim({ w: v.videoWidth, h: v.videoHeight });
    setDuration(v.duration || 0);
    if (op === 'crop-video' && !seeded.current && !Number(params.width)) {
      seeded.current = true;
      patch({ x: 0, y: 0, width: v.videoWidth, height: v.videoHeight });
    }
  };

  const rect: NormRect | null =
    op === 'crop-video' && dim
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

  const start = Number(params.start) || 0;
  const durParam = Number(params.duration) || 0;
  const end = durParam > 0 ? Math.min(start + durParam, duration || start + durParam) : duration;

  return (
    <div className="editor">
      <div className="preview-stage">
        <video ref={video} className="prev-video" src={url} controls onLoadedMetadata={onMeta} />
        {rect && <CropBox value={rect} onChange={onRect} />}
      </div>

      {op === 'trim' && duration > 0 && (
        <TrimBar
          duration={duration}
          start={start}
          end={end}
          onChange={(s, e) => patch({ start: round2(s), duration: round2(e - s) })}
          onSeek={(t) => {
            if (video.current) video.current.currentTime = t;
          }}
        />
      )}
      {op === 'trim' && (
        <p className="editor-readout">
          Clip {fmtTime(start)} → {fmtTime(end)} · {fmtTime(Math.max(0, end - start))} long
        </p>
      )}
      {op === 'crop-video' && dim && <p className="editor-readout">Drag the box to crop · source {dim.w}×{dim.h}px</p>}
    </div>
  );
}

function TrimBar({
  duration,
  start,
  end,
  onChange,
  onSeek,
}: {
  duration: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  onSeek: (t: number) => void;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const drag = useRef<'start' | 'end' | null>(null);

  const begin = (which: 'start' | 'end') => (e: ReactPointerEvent) => {
    e.preventDefault();
    drag.current = which;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const move = (e: PointerEvent) => {
    const el = bar.current;
    if (!el || !drag.current) return;
    const box = el.getBoundingClientRect();
    const t = clamp((e.clientX - box.left) / box.width, 0, 1) * duration;
    if (drag.current === 'start') onChange(clamp(t, 0, end - 0.1), end);
    else onChange(start, clamp(t, start + 0.1, duration));
    onSeek(t);
  };
  const up = () => {
    drag.current = null;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };

  const pct = (t: number) => `${(t / duration) * 100}%`;
  return (
    <div className="trimbar" ref={bar}>
      <div className="trim-region" style={{ left: pct(start), width: `${((end - start) / duration) * 100}%` }} />
      <span className="trim-handle" style={{ left: pct(start) }} onPointerDown={begin('start')} />
      <span className="trim-handle" style={{ left: pct(end) }} onPointerDown={begin('end')} />
    </div>
  );
}

function fmtTime(s: number): string {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
