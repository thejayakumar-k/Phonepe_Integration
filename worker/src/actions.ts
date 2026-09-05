import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatIdentity } from './context';
import { PRODUCTS, findProduct } from './products';

export type ChatIntent =
  | { intent: 'place_order'; product?: string; qty?: number }
  | { intent: 'list_products' }
  | { intent: 'ask' };

const inr = (n: number) => `₹${Number(n).toFixed(2)}`;

const LIST_KEYWORDS = [
  'what do you sell',
  'what do you have',
  'list products',
  'available products',
  'product catalog',
  'product list',
  'catalog',
  'menu',
  'what products',
  'show products',
  'your products',
];

/**
 * Classify the user's message deterministically.
 * Product names (Aquafina/Bisleri/Kinley) trigger order placement;
 * catalog-style questions trigger a product list; everything else is a
 * plain question.
 */
export function detectIntent(message: string): ChatIntent {
  const lower = message.toLowerCase().trim();
  if (!lower) return { intent: 'ask' };

  // Order intent: message mentions a known product.
  const product = findProduct(lower);
  if (product) {
    // Price questions ("how much is aquafina?") are not orders.
    const priceQuestion =
      /how much|price|cost|rate|whats the price|what is the price/.test(lower);
    const wantsToOrder = /order|buy|place|purchase|get|want|qty|quantity|piece|bottle|can|pack|need/.test(lower);
    if (!priceQuestion || wantsToOrder) {
      // Quantity: first number in the message (e.g. "2", "2 qty", "3 bottles").
      const qtyMatch = lower.match(/(\d+)/);
      let qty = 1;
      if (qtyMatch) {
        const parsed = parseInt(qtyMatch[1], 10);
        if (Number.isFinite(parsed)) qty = Math.min(99, Math.max(1, parsed));
      }
      return { intent: 'place_order', product: product.name, qty };
    }
  }

  // Catalog intent.
  if (LIST_KEYWORDS.some((k) => lower.includes(k))) {
    return { intent: 'list_products' };
  }

  return { intent: 'ask' };
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * Place a product order for the customer. Creates a PENDING item order
 * (payment happens through the app). Returns the order number.
 */
export async function placeOrder(
  supabase: SupabaseClient,
  identity: ChatIdentity,
  productName: string | undefined,
  qty: number
): Promise<ActionResult> {
  if (!identity.customerId) {
    return { ok: false, message: 'You must be logged in as a customer to place an order.' };
  }

  const product = findProduct(productName || '');
  if (!product) {
    const catalog = PRODUCTS.map((p) => `${p.name} (${inr(p.price)} ${p.unit})`).join(', ');
    return { ok: false, message: `I could not find that product. Available: ${catalog}.` };
  }

  const total = Math.round(product.price * qty * 100) / 100;
  const id = `IO${Date.now()}`;
  const order = {
    id,
    customer_id: identity.customerId,
    customer_name: identity.customerName ?? null,
    vendor_id: 'VENDOR001',
    vendor_name: 'OORUNII Store',
    items: [{ name: product.name, qty, price: product.price, unit: product.unit, image: product.image }],
    total,
    status: 'PENDING',
    payment_method: 'PHONEPE',
    created_at: Date.now(),
  };

  const { error } = await supabase.from('item_orders').insert(order);
  if (error) {
    return { ok: false, message: `Order could not be placed (${error.message}). Please try again.` };
  }

  return {
    ok: true,
    message: `Order placed successfully. Order number: ${id}. Item: ${product.name} x ${qty} (${inr(total)}). Status: payment pending.`,
  };
}