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

/** Common synonyms / typos mapped to catalog names. */
const ALIASES: Record<string, string> = {
  Aquafina: 'aqua',
  Bisleri: 'bislery',
  Kinley: 'kinly',
};

/**
 * Find a product by name, case-insensitively, wherever it appears in the
 * sentence (e.g. "order one bisleri", "i want a kinly please").
 */
export function findProduct(input: string): Product | null {
  const needle = normalize(input);
  if (!needle) return null;

  // 1) Exact match ("bisleri", "aquafina").
  const exact = PRODUCTS.find((p) => normalize(p.name) === needle);
  if (exact) return exact;

  // 2) Word-boundary match on the original text (spaces intact):
  //    "order one bisleri" → \bbisleri\b matches. Also checks aliases
  //    so typos like "bislery" or "kinly" still resolve.
  const lower = input.toLowerCase();
  for (const p of PRODUCTS) {
    const names = [p.name, ALIASES[p.name]].filter(Boolean) as string[];
    if (names.some((n) => new RegExp(`\\b${escapeRegExp(n)}\\b`, 'i').test(lower))) {
      return p;
    }
  }
  return null;
}