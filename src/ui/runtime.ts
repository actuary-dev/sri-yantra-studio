/**
 * Small runtime stores that are not persisted: the text shaper (HarfBuzz),
 * transient editor UI state and toasts.
 */
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { Shaper } from '../text';
import { loadShaper } from '../text';

/* ------------------------------------------------------------- shaper */

type ShaperStatus = 'loading' | 'ready' | 'failed';
interface ShaperState {
  shaper: Shaper | null;
  status: ShaperStatus;
}
const shaperStore = createStore<ShaperState>()(() => ({ shaper: null, status: 'loading' }));
let shaperPromise: Promise<Shaper | null> | null = null;

/** Load HarfBuzz + fonts once. Resolves to null if loading failed (the app keeps working with native text). */
export function ensureShaper(): Promise<Shaper | null> {
  if (shaperPromise) return shaperPromise;
  shaperStore.setState({ status: 'loading' });
  shaperPromise = (async () => {
    try {
      const shaper = await loadShaper();
      shaperStore.setState({ shaper, status: 'ready' });
      return shaper;
    } catch (e) {
      console.warn('Text shaper unavailable:', e);
      shaperStore.setState({ shaper: null, status: 'failed' });
      shaperPromise = null; // allow a retry later (e.g. on export)
      return null;
    }
  })();
  return shaperPromise;
}

export function useShaper(): Shaper | null {
  return useStore(shaperStore, (s) => s.shaper);
}

/* ------------------------------------------------------------ editor UI */

export type PanelId = 'shape' | 'rings' | 'text' | 'style';

export interface PendingPlace {
  x: number;
  y: number;
  /** id of the anchor that was snapped to, if any */
  anchorId: string | null;
}

interface EditorUIState {
  panel: PanelId | null;
  /** canvas is waiting for a tap to place new text */
  placeMode: boolean;
  /** a place was chosen; the compact editor is open */
  pending: PendingPlace | null;
  selectedCustomId: string | null;
  exportOpen: boolean;
  helpOpen: boolean;
}

export const editorUI = createStore<EditorUIState>()(() => ({
  panel: null,
  placeMode: false,
  pending: null,
  selectedCustomId: null,
  exportOpen: false,
  helpOpen: false,
}));

export function useEditorUI<T>(sel: (s: EditorUIState) => T): T {
  return useStore(editorUI, sel);
}

export function setEditorUI(patch: Partial<EditorUIState>): void {
  editorUI.setState(patch);
}

/* --------------------------------------------------------------- toasts */

export interface ToastMsg {
  id: number;
  text: string;
  kind: 'success' | 'error' | 'info';
}
const toastStore = createStore<{ toasts: ToastMsg[] }>()(() => ({ toasts: [] }));
let toastSeq = 0;

export function showToast(text: string, kind: ToastMsg['kind'] = 'info', ms = 3800): void {
  const id = ++toastSeq;
  toastStore.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, kind }] }));
  setTimeout(() => dismissToast(id), ms);
}

export function dismissToast(id: number): void {
  toastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

export function useToasts(): ToastMsg[] {
  return useStore(toastStore, (s) => s.toasts);
}
