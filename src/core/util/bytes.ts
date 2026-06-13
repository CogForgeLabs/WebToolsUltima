/** Human-readable byte size. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Percentage size delta, e.g. "−64%". Positive output means smaller. */
export function sizeDelta(from: number, to: number): string {
  if (from === 0) return '';
  const pct = Math.round((1 - to / from) * 100);
  if (pct === 0) return '±0%';
  return pct > 0 ? `−${pct}%` : `+${-pct}%`;
}

/** Swap (or append) a file extension. */
export function withExtension(name: string, ext: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot >= 0 ? name.slice(0, dot) : name;
  return ext ? `${base}.${ext}` : base;
}

export function baseName(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(0, dot) : name;
}
