import type { SupabaseClient } from '@supabase/supabase-js';

export interface ChatIdentity {
  role: 'customer' | 'vendor';
  customerId?: string;
  customerName?: string;
  vendorId?: string;
  vendorName?: string;
}

const inr = (n: number) => `₹${Number(n).toFixed(2)}`;
const date = (ts: number | string) => new Date(Number(ts)).toLocaleString('en-IN');

interface Row {
  [key: string]: unknown;
}

/** Fetch the data relevant to the requester and render it as compact text. */
export async function buildContext(
  supabase: SupabaseClient,
  id: ChatIdentity
): Promise<string> {
  const lines: string[] = [];

  if (id.role === 'customer') {
    const customerId = id.customerId || '';
    lines.push(`User: ${id.customerName || 'Customer'} (ID: ${customerId || 'unknown'})`);

    // Wallet balance
    let balance = 0;
    if (customerId) {
      const { data: margin } = await supabase
        .from('margins')
        .select('balance')
        .eq('customer_id', customerId)
        .maybeSingle();
      if (margin) balance = Number(margin.balance);
    }
    lines.push(`Wallet balance: ${inr(balance)}`);

    // Payment orders
    let orders: Row[] = [];
    if (customerId) {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(20);
      orders = (data ?? []) as Row[];
    }
    lines.push(`Orders (${orders.length} total, latest first):`);
    for (const o of orders) {
      lines.push(
        `- #${o.order_id} | ${o.description} | ${inr(Number(o.amount))} | status=${o.payment_status} | created ${date(Number(o.created_at))}${o.transaction_id ? ` | txn ${o.transaction_id}` : ''}`
      );
    }

    // Item orders (product purchases)
    let itemOrders: Row[] = [];
    if (customerId) {
      const { data } = await supabase
        .from('item_orders')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(10);
      itemOrders = (data ?? []) as Row[];
    }
    lines.push(`Product orders (${itemOrders.length}):`);
    for (const o of itemOrders) {
      lines.push(
        `- ${o.id} | total ${inr(Number(o.total))} | status=${o.status} | ${date(Number(o.created_at))}`
      );
    }

    // Refunds for this customer (matched via their orders)
    if (customerId && orders.length > 0) {
      const orderIds = orders.map((o) => o.order_id as string).slice(0, 50);
      const { data } = await supabase
        .from('refunds')
        .select('*')
        .in('order_id', orderIds)
        .order('initiated_at', { ascending: false })
        .limit(10);
      const refunds = (data ?? []) as Row[];
      lines.push(`Refunds (${refunds.length}):`);
      for (const r of refunds) {
        lines.push(
          `- ${r.id} | order #${r.order_id} | ${inr(Number(r.amount))} | status=${r.status} | ${r.reason || 'no reason'}`
        );
      }
    }
  } else {
    // Vendor
    const vendorId = id.vendorId || '';
    lines.push(`Store: ${id.vendorName || 'Vendor'} (ID: ${vendorId || 'unknown'})`);

    let allOrders: Row[] = [];
    if (vendorId) {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(50);
      allOrders = (data ?? []) as Row[];
    }
    const paid = allOrders.filter((o) => o.payment_status === 'PAID');
    const revenue = paid.reduce((s, o) => s + Number(o.amount), 0);
    lines.push(
      `Orders: ${allOrders.length} total, ${paid.length} paid, revenue ${inr(revenue)}`
    );
    for (const o of allOrders.slice(0, 20)) {
      lines.push(
        `- #${o.order_id} | ${o.description} | ${inr(Number(o.amount))} | ${o.customer_name || o.customer_id || 'customer'} | status=${o.payment_status} | ${date(Number(o.created_at))}`
      );
    }

    let refunds: Row[] = [];
    if (vendorId) {
      const { data } = await supabase
        .from('refunds')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('initiated_at', { ascending: false })
        .limit(20);
      refunds = (data ?? []) as Row[];
    }
    lines.push(`Refunds (${refunds.length}):`);
    for (const r of refunds) {
      lines.push(
        `- ${r.id} | order #${r.order_id} | ${inr(Number(r.amount))} | status=${r.status} | ${r.reason || 'no reason'}`
      );
    }
  }

  return lines.join('\n');
}