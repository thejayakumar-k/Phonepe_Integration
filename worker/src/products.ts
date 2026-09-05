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

/**
 * Find a product by name, case-insensitively, wherever it appears in the
 * sentence (e.g. "order one bisleri" or "aquafina 1 qty").
 */
export function findProduct(input: string): Product | null {
  const needle = normalize(input);
  if (!needle) return null;

  // 1) Exact match ("bisleri", "aquafina").
  const exact = PRODUCTS.find((p) => normalize(p.name) === needle);
  if (exact) return exact;

  // 2) Word-boundary match anywhere in the message, on the original text
  //    so spaces stay intact: "order one bisleri" → \bbisleri\b matches.
  const lower = input.toLowerCase();
  return (
    PRODUCTS.find((p) => new RegExp(`\\b${escapeRegExp(p.name)}\\b`, 'i').test(lower)) ||
    null
  );
}