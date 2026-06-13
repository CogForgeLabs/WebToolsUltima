import { zipSync, type Zippable } from 'fflate';
import type { ResultAsset } from '../jobs/store';

/** Trigger a browser download of a blob/URL. */
export function downloadUrl(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadData(data: Uint8Array, filename: string, mime = 'application/octet-stream'): void {
  const url = URL.createObjectURL(new Blob([data.slice()], { type: mime }));
  downloadUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Bundle several result assets into a single .zip and download it. */
export function downloadAllAsZip(assets: ResultAsset[], zipName = 'webtoolsultima.zip'): void {
  const files: Zippable = {};
  const used = new Set<string>();
  for (const a of assets) {
    let name = a.name;
    let i = 1;
    while (used.has(name)) {
      const dot = a.name.lastIndexOf('.');
      name = dot >= 0 ? `${a.name.slice(0, dot)} (${i})${a.name.slice(dot)}` : `${a.name} (${i})`;
      i++;
    }
    used.add(name);
    files[name] = a.data;
  }
  const zipped = zipSync(files, { level: 6 });
  downloadData(zipped, zipName, 'application/zip');
}
