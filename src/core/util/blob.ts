import type { Asset } from '../engines/types';
import { getFormat } from '../formats/registry';

export function mimeOf(formatId: string): string {
  return getFormat(formatId)?.mime[0] ?? 'application/octet-stream';
}

export function extOf(formatId: string): string {
  return getFormat(formatId)?.ext[0] ?? '';
}

export function assetToBlob(asset: Asset): Blob {
  // Copy into a fresh ArrayBuffer so a possibly-detached/transferred buffer view is safe.
  return new Blob([asset.data.slice()], { type: mimeOf(asset.formatId) });
}

export function assetUrl(asset: Asset): string {
  return URL.createObjectURL(assetToBlob(asset));
}

export async function fileToAsset(file: File, formatId: string): Promise<Asset> {
  const data = new Uint8Array(await file.arrayBuffer());
  return { name: file.name, formatId, data };
}
