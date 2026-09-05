import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatIdentity } from './context';
import type { Env } from './env';
import { PRODUCTS, findProduct } from './products';

export type ChatIntent =
  | { intent: 'place_order'; product?: string; qty?: number }
  | { intent: 'list_products' }
  | { intent: 'cancel_orders'; orderId?: string }
  | { intent: 'ask' };

const inr = (n: number) => `₹${Number(n).toFixed(2)}`;

const LIST_KEYWORDS = [
  'what do you sell',
  'what do you have',
  'list products',
  'available products',
  'available to order',
  'product catalog',
  'product list',
  'catalog',
  'menu',
  'what products',
  'show products',
  'your products',
  'what can i order',
  'what to order',
  'can i order',
  'order today',
  'what can i buy',
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

  // Cancel intent: "cancel all orders" / "cancel my orders" / "cancel order #12345"
  // / "cancel order 99901" (last digits). Checked first so phrases like
  // "cancel the bisleri order" don't re-order.
  if (/cancel/.test(lower) && /order/.test(lower)) {
    const fullMatch = lower.match(/(?:io|#)\d+/i);
    let orderId: string | undefined = fullMatch
      ? fullMatch[0].toUpperCase()
      : undefined;
    if (!orderId) {
      // No prefix — treat a 3+ digit number as the last digits of the
      // order number (e.g. "cancel order 99901" → #99901).
      const digitsMatch = lower.match(/\b\d{3,}\b/);
      if (digitsMatch) orderId = digitsMatch[0];
    }
    return { intent: 'cancel_orders', orderId };
  }

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

const CATALOG_LINE = 'Products: Aquafina (₹20), Bisleri (₹40), Kinley (₹25)';

const INTENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'place_order',
      description:
        'Place an order for a product. Call ONLY when the user clearly wants to buy/order a product (e.g. "buy bisleri", "order 2 aquafina", "one kinley please"). ' + CATALOG_LINE + '. If the product is not clear, do NOT call this function.',
      parameters: {
        type: 'object',
        properties: {
          product: { type: 'string', description: 'Exact product name (Aquafina, Bisleri, or Kinley).' },
          qty: { type: 'integer', description: 'Quantity, default 1.' },
        },
        required: ['product'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_products',
      description: 'List the available products when the user asks what is available to order.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_orders',
      description:
        'Cancel orders. Call when the user asks to cancel their order(s), e.g. "cancel all orders", "cancel my orders", "cancel order #12345", or "cancel order 99901" (last digits of the order number). Only unpaid orders can be cancelled.',
      parameters: {
        type: 'object',
        properties: {
          order_id: { type: 'string', description: 'Optional specific order id (e.g. #12345, or just 12345). Omit to cancel all unpaid orders.' },
        },
      },
    },
  },
];

/**
 * Natural-language intent detection via LLM function calling. Handles
 * paraphrases and typos that the deterministic matcher misses (e.g.
 * "I would like two bottles", "one bislery please"). Returns null when
 * the model decides not to act (plain question).
 */
export async function detectIntentWithLLM(
  env: Env,
  message: string
): Promise<ChatIntent | null> {
  const model = env.AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  const ai = env.AI as {
    run: (model: string, inputs: unknown) => Promise<unknown>;
  };

  try {
    const out = await ai.run(model, {
      messages: [
        {
          role: 'system',
          content:
            'You help the OORUNII assistant decide what the user wants. ' +
            'Use place_order when the user clearly asks to order/buy/purchase a specific product; ' +
            'use list_products when they ask what they can order or what products are available ' +
            '(e.g. "what can i order", "what do you sell"). ' +
            'Otherwise call no function. ' + CATALOG_LINE,
        },
        { role: 'user', content: message },
      ],
      tools: INTENT_TOOLS as never,
      max_tokens: 200,
    });

    const result = out as {
      tool_calls?: Array<{
        function?: { name?: string; arguments?: string | Record<string, unknown> };
      }>;
    };
    const call = result.tool_calls?.[0]?.function;
    if (!call?.name) return null;

    if (call.name === 'list_products') return { intent: 'list_products' };

    if (call.name === 'cancel_orders') {
      let args: Record<string, unknown> = {};
      if (typeof call.arguments === 'string') {
        try {
          args = JSON.parse(call.arguments) as Record<string, unknown>;
        } catch {
          args = {};
        }
      } else if (call.arguments && typeof call.arguments === 'object') {
        args = call.arguments as Record<string, unknown>;
      }
      const orderId = typeof args.order_id === 'string' ? args.order_id : undefined;
      return { intent: 'cancel_orders', orderId };
    }

    if (call.name === 'place_order') {
      let args: Record<string, unknown> = {};
      if (typeof call.arguments === 'string') {
        try {
          args = JSON.parse(call.arguments) as Record<string, unknown>;
        } catch {
          args = {};
        }
      } else if (call.arguments && typeof call.arguments === 'object') {
        args = call.arguments as Record<string, unknown>;
      }
      const product = typeof args.product === 'string' ? args.product : undefined;
      const qty =
        typeof args.qty === 'number' && Number.isFinite(args.qty)
          ? Math.min(99, Math.max(1, Math.round(args.qty)))
          : 1;
      return { intent: 'place_order', product, qty };
    }
    return null;
  } catch {
    return null;
  }
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
  // 5-digit order number (e.g. "#28471"), avoiding collisions with
  // existing item orders.
  const { data: existingRows } = await supabase.from('item_orders').select('id');
  const existing = new Set((existingRows ?? []).map((r) => (r as { id: string }).id));
  let id = '';
  for (let i = 0; i < 20 && !id; i++) {
    const candidate = `#${10000 + Math.floor(Math.random() * 90000)}`;
    if (!existing.has(candidate)) id = candidate;
  }
  if (!id) id = `#${Date.now() % 100000}`;

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

/**
 * Cancel unpaid orders for the customer. With orderId, cancels just that
 * order; without it, cancels ALL unpaid (PENDING / NOT_PAID) orders.
 */
export async function cancelOrders(
  supabase: SupabaseClient,
  identity: ChatIdentity,
  orderId?: string
): Promise<ActionResult> {
  if (!identity.customerId) {
    return { ok: false, message: 'You must be logged in as a customer to cancel orders.' };
  }

  let query = supabase
    .from('item_orders')
    .update({ status: 'CANCELLED' })
    .eq('customer_id', identity.customerId)
    .in('status', ['PENDING', 'NOT_PAID'])
    .select('id');
  if (orderId) {
    // Full id ("#12345" or legacy "IO12345") matches exactly; bare digits
    // ("99901") match orders whose number ends with those digits.
    query = /^(?:IO|#)/i.test(orderId)
      ? query.eq('id', orderId)
      : query.ilike('id', `%${orderId}`);
  }

  const { data, error } = await query;
  if (error) {
    return { ok: false, message: `Could not cancel orders (${error.message}). Please try again.` };
  }

  const ids = (data ?? []).map((r) => (r as { id: string }).id);
  if (ids.length === 0) {
    return {
      ok: false,
      message: orderId
        ? `Order ${orderId} was not found or is already paid/cancelled, so it cannot be cancelled.`
        : 'You have no unpaid orders to cancel.',
    };
  }

  return {
    ok: true,
    message: `Cancelled ${ids.length} order(s): ${ids.join(', ')}.`,
  };
}