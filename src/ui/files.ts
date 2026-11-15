/** Design files: save one design (or all of them) to a file, and read them back on any device. */
import type { Design } from '../core/types';

export const FILE_KIND = 'yantra-studio';
export const FILE_EXT = '.yantra.json';

export interface DesignFile {
  kind: typeof FILE_KIND;
  version: 1;
  savedAt: string;
  designs: Design[];
}

export function safeFileName(name: string): string {
  const clean = name.normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (clean || 'yantra').slice(0, 80);
}

export function designFileText(designs: Design[]): string {
  const file: DesignFile = { kind: FILE_KIND, version: 1, savedAt: new Date().toISOString(), designs };
  return JSON.stringify(file, null, 1);
}

/** Every design found in a file's text: a design file, a list of designs, a single design, or the app's own storage format. */
export function parseDesignFile(text: string): unknown[] {
  const data: unknown = JSON.parse(text.replace(/^﻿/, ''));
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const o = data as { designs?: unknown; schema?: unknown };
    if (Array.isArray(o.designs)) return o.designs;
    if (o.schema !== undefined) return [data];
  }
  return [];
}

/** Web Share on phones/tablets when it can take files, otherwise a download. */
export async function deliverText(text: string, filename: string): Promise<'shared' | 'downloaded'> {
  const blob = new Blob([text], { type: 'application/json' });
  try {
    const file = new File([blob], filename, { type: 'application/json' });
    const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    if (coarse && typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return 'shared';
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') return 'shared';
      }
    }
  } catch { /* fall through to a download */ }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}

export function saveDesignFile(design: Design): Promise<'shared' | 'downloaded'> {
  return deliverText(designFileText([design]), `${safeFileName(design.name)}${FILE_EXT}`);
}

export function saveBackupFile(designs: Design[]): Promise<'shared' | 'downloaded'> {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return deliverText(designFileText(designs), `yantras-${stamp}${FILE_EXT}`);
}

/** Ask for files and read every design in them. */
export function pickDesignFiles(): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json,.yantra';
    input.multiple = true;
    input.style.display = 'none';
    input.onchange = async () => {
      try {
        resolve(await readDesignFiles([...(input.files ?? [])]));
      } catch (e) {
        reject(e);
      } finally {
        input.remove();
      }
    };
    document.body.appendChild(input);
    input.click();
  });
}

export async function readDesignFiles(files: File[]): Promise<unknown[]> {
  const out: unknown[] = [];
  for (const f of files) out.push(...parseDesignFile(await f.text()));
  return out;
}
