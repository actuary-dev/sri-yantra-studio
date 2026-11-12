import * as SanscriptModule from '@indic-transliteration/sanscript';

type SanscriptLike = { t(data: string, from: string, to: string): string };
const mod = SanscriptModule as unknown as { default?: SanscriptLike; Sanscript?: SanscriptLike } & Partial<SanscriptLike>;
const S: SanscriptLike = mod.default?.t ? mod.default : mod.Sanscript?.t ? mod.Sanscript : (mod as SanscriptLike);

const DEVA = /([ऀ-ॿ]+)/;

/** Latin-keyboard Sanskrit → Devanagari. Existing Devanagari parts are kept as they are. */
export function transliterate(input: string, scheme: 'itrans' | 'hk' | 'iast' = 'itrans'): string {
  return input
    .split(DEVA)
    .map((part, i) => (i % 2 === 1 || part === '' ? part : S.t(part, scheme, 'devanagari')))
    .join('');
}

export function toDevanagariNumber(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => '०१२३४५६७८९'[Number(d)]);
}

export const QUICK_INSERTS: { label: string; text: string }[] = [
  { label: 'ॐ', text: 'ॐ' },
  { label: 'श्रीं', text: 'श्रीं' },
  { label: 'ह्रीं', text: 'ह्रीं' },
  { label: 'क्लीं', text: 'क्लीं' },
  { label: 'ऐं', text: 'ऐं' },
  { label: 'सौः', text: 'सौः' },
  { label: 'नमः', text: 'नमः' },
  { label: '॥', text: '॥' },
  { label: '।', text: '।' },
  ...[...'०१२३४५६७८९'].map((d) => ({ label: d, text: d })),
];
