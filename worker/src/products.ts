import type { SupabaseClient } from '@supabase/supabase-js';

export interface Product {
  id: number;
  name: string;
  price: number;
  unit: string;
  image: string;
  /** English / Tamil / Thanglish spellings users might type. */
  aliases: string[];
}

/**
 * Seed catalog, used only when the `products` table is unreachable or
 * empty (e.g. before the schema is applied). Once the table exists, the
 * live catalog comes from the database — add products there, no code
 * changes or redeploys needed.
 */
export const FALLBACK_PRODUCTS: Product[] = [
  {
    id: 1,
    name: 'Aquafina',
    price: 20.0,
    unit: 'PACK (LITER)',
    image: '💧',
    aliases: ['aqua', 'அக்வாஃபைனா', 'அக்வாபைனா', 'அக்வாஃபினா', 'thanneer', 'thannir', 'tanneer', 'aquafina water'],
  },
  {
    id: 2,
    name: 'Bisleri',
    price: 40.0,
    unit: 'CAN (LITER)',
    image: '🧊',
    aliases: ['bislery', 'bisleri water', 'பிஸ்லரி', 'பிஸ்லேரி', 'pisleri', 'besleri', 'bisleri'],
  },
  {
    id: 3,
    name: 'Kinley',
    price: 25.0,
    unit: 'PACK (LITER)',
    image: '💧',
    aliases: ['kinly', 'kinli', 'கின்லி', 'கிண்லி', 'kinley water'],
  },
];

/**
 * Load the live product catalog from the `products` table. Falls back to
 * the seed catalog if the table is missing, empty, or the query fails, so
 * the bot keeps working before the schema is applied.
 */
export async function fetchProducts(supabase: SupabaseClient): Promise<Product[]> {
  try {
    const { data, error } = await supabase.from('products').select('*').order('id');
    if (error) throw error;
    if (Array.isArray(data) && data.length > 0) {
      return data.map((r) => ({
        id: Number((r as { id: number }).id),
        name: String((r as { name: string }).name),
        price: Number((r as { price: number }).price),
        unit: String((r as { unit: string }).unit || ''),
        image: String((r as { image: string }).image || ''),
        aliases: Array.isArray((r as { aliases: unknown }).aliases)
          ? ((r as { aliases: string[] }).aliases as string[]).map(String)
          : [],
      }));
    }
  } catch {
    // Fall through to the seed catalog.
  }
  return FALLBACK_PRODUCTS;
}

const normalize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Find a product by name, case-insensitively, wherever it appears in the
 * sentence (e.g. "order one bisleri", "i want a kinly please",
 * "ஒரு பிஸ்லரி ஆர்டர் போடு"). Matches the product's name and every
 * alias (English / Tamil / Thanglish spellings) from the database.
 */
export function findProduct(input: string, products: Product[]): Product | null {
  const needle = normalize(input);
  // Only bail on an empty message. normalize() strips Tamil script, so a
  // Tamil-only message yields "" and must still reach the alias matching.
  if (!input.trim()) return null;

  // 1) Exact match ("bisleri", "aquafina").
  if (needle) {
    const exact = products.find((p) => normalize(p.name) === needle);
    if (exact) return exact;
  }

  // 2) Match on the original text (spaces intact): word-boundary regex
  //    for Latin names (\b is ASCII-only), plain substring for Tamil
  //    names (Tamil script has no ASCII word boundaries).
  const lower = input.toLowerCase();
  for (const p of products) {
    const names = [p.name, ...p.aliases];
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