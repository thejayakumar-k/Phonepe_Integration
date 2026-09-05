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

/** Find a product by name (case/space/punctuation insensitive). */
export function findProduct(input: string): Product | null {
  const needle = normalize(input);
  if (!needle) return null;
  return (
    PRODUCTS.find((p) => normalize(p.name) === needle) ||
    PRODUCTS.find((p) => normalize(p.name).startsWith(needle) || needle.startsWith(normalize(p.name))) ||
    null
  );
}