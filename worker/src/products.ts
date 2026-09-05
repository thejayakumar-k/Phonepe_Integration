export interface Product {
  name: string;
  price: number;
  unit: string;
  image: string;
}

/** Mirrors the catalog in src/components/CustomerCart.tsx. */
export const PRODUCTS: Product[] = [
  { name: 'Aquafina', price: 20.0, unit: 'PACK (LITER)', image: '💧' },
  { name: 'Bisleri', price: 40.0, unit: 'CAN (LITER)', image: '🧊' },
  { name: 'Kinley', price: 25.0, unit: 'PACK (LITER)', image: '💧' },
];

const normalize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Common synonyms / typos / Tamil names mapped to catalog names. */
const ALIASES: Record<string, string[]> = {
  Aquafina: ['aqua', 'அக்வாஃபைனா', 'அக்வாபைனா', 'அக்வாஃபினா'],
  Bisleri: ['bislery', 'பிஸ்லரி', 'பிஸ்லேரி'],
  Kinley: ['kinly', 'கின்லி', 'கிண்லி'],
};

/**
 * Find a product by name, case-insensitively, wherever it appears in the
 * sentence (e.g. "order one bisleri", "i want a kinly please",
 * "ஒரு பிஸ்லரி ஆர்டர் போடு").
 */
export function findProduct(input: string): Product | null {
  const needle = normalize(input);
  // Only bail on an empty message. normalize() strips Tamil script, so a
  // Tamil-only message yields "" and must still reach the alias matching.
  if (!input.trim()) return null;

  // 1) Exact match ("bisleri", "aquafina").
  if (needle) {
    const exact = PRODUCTS.find((p) => normalize(p.name) === needle);
    if (exact) return exact;
  }

  // 2) Match on the original text (spaces intact): word-boundary regex
  //    for Latin names (\b is ASCII-only), plain substring for Tamil
  //    names (Tamil script has no ASCII word boundaries).
  const lower = input.toLowerCase();
  for (const p of PRODUCTS) {
    const names = [p.name, ...(ALIASES[p.name] || [])];
    for (const n of names) {
      const nonAscii = /[^\x00-\x7F]/.test(n);
      const hit = nonAscii
        ? lower.includes(n)
        : new RegExp(`\\b${escapeRegExp(n)}\\b`, 'i').test(lower);
      if (hit) return p;
    }
  }
  return null;
}