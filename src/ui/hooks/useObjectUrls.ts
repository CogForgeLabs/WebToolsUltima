import { useEffect, useState } from 'react';

/**
 * Create object URLs for a list of files and revoke them when the list changes or the
 * component unmounts. Returns an array aligned with `files` (empty until the effect runs).
 */
export function useObjectUrls(files: File[]): string[] {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const next = files.map((f) => URL.createObjectURL(f));
    setUrls(next);
    return () => next.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);
  return urls;
}
