import type { ItemOrder, ItemOrderStatus, Order, PaymentStatus } from '../types/payment';

const STORAGE_KEY = 'oorunii_orders';
const MARGIN_STORAGE_KEY = 'oorunii_margin';
const ITEM_ORDERS_KEY = 'oorunii_item_orders';
const ITEM_LINKS_KEY = 'oorunii_item_order_links';

/**
 * Get the available margin for a customer (defaults to 0).
 */
export function getMargin(customerId?: string): number {
  if (!customerId) return 0;
  try {
    const data = localStorage.getItem(MARGIN_STORAGE_KEY);
    const margins: Record<string, number> = data ? JSON.parse(data) : {};
    return typeof margins[customerId] === 'number' ? margins[customerId] : 0;
  } catch {
    return 0;
  }
}

/**
 * Credit `amount` to the customer's available margin. Returns the new balance.
 */
export function addMargin(customerId: string | undefined, amount: number): number {
  if (!customerId || !Number.isFinite(amount) || amount <= 0) {
    return getMargin(customerId);
  }
  const next = Math.round((getMargin(customerId) + amount) * 100) / 100;
  try {
    const data = localStorage.getItem(MARGIN_STORAGE_KEY);
    const margins: Record<string, number> = data ? JSON.parse(data) : {};
    margins[customerId] = next;
    localStorage.setItem(MARGIN_STORAGE_KEY, JSON.stringify(margins));
  } catch {
    // ignore storage errors
  }
  return next;
}

/**
 * Deduct `amount` from the customer's available margin. Returns the new balance.
 */
export function subtractMargin(customerId: string | undefined, amount: number): number {
  if (!customerId || !Number.isFinite(amount) || amount <= 0) {
    return getMargin(customerId);
  }
  const next = Math.max(0, Math.round((getMargin(customerId) - amount) * 100) / 100);
  try {
    const data = localStorage.getItem(MARGIN_STORAGE_KEY);
    const margins: Record<string, number> = data ? JSON.parse(data) : {};
    margins[customerId] = next;
    localStorage.setItem(MARGIN_STORAGE_KEY, JSON.stringify(margins));
  } catch {
    // ignore storage errors
  }
  return next;
}

/**
 * Remove previously seeded demo payment orders (if any) so only real
 * payments remain.
 */
export function clearDemoOrders(): void {
  const orders = getOrders();
  let changed = false;
  for (const id of ['ORDER1001', 'ORDER1002', 'ORDER1003', 'ORDER1004']) {
    if (orders[id]) {
      delete orders[id];
      changed = true;
    }
  }
  if (changed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  }
}

/* ========================================
   Item Orders (product-level orders)
   ======================================== */

export function getItemOrders(): Record<string, ItemOrder> {
  try {
    const data = localStorage.getItem(ITEM_ORDERS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveItemOrder(order: ItemOrder): void {
  const orders = getItemOrders();
  orders[order.id] = order;
  localStorage.setItem(ITEM_ORDERS_KEY, JSON.stringify(orders));
}

export function updateItemOrderStatus(
  id: string,
  status: ItemOrderStatus
): ItemOrder | null {
  const orders = getItemOrders();
  const order = orders[id];
  if (!order) return null;
  orders[id] = { ...order, status };
  localStorage.setItem(ITEM_ORDERS_KEY, JSON.stringify(orders));
  return orders[id];
}

function readItemLinks(): Record<string, string> {
  try {
    const data = localStorage.getItem(ITEM_LINKS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function linkItemOrderToPayment(
  itemOrderId: string,
  paymentOrderId: string
): void {
  const links = readItemLinks();
  links[paymentOrderId] = itemOrderId;
  localStorage.setItem(ITEM_LINKS_KEY, JSON.stringify(links));
}

function getLinkedItemOrder(paymentOrderId: string): string | undefined {
  return readItemLinks()[paymentOrderId];
}

/**
 * Remove previously seeded demo item orders (if any) so the Orders page
 * only shows real orders placed by the customer.
 */
export function clearDemoItemOrders(): void {
  const orders = getItemOrders();
  let changed = false;
  for (const id of ['IO1001', 'IO1002']) {
    if (orders[id]) {
      delete orders[id];
      changed = true;
    }
  }
  if (changed) {
    localStorage.setItem(ITEM_ORDERS_KEY, JSON.stringify(orders));
  }
}

/**
 * Get all orders from localStorage
 */
export function getOrders(): Record<string, Order> {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

/**
 * Get a specific order by ID
 */
export function getOrder(orderId: string): Order | null {
  const orders = getOrders();
  return orders[orderId] || null;
}

/**
 * Save an order to localStorage
 */
export function saveOrder(order: Order): void {
  const orders = getOrders();
  orders[order.orderId] = order;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

/**
 * Update order payment status
 */
export function updateOrderStatus(
  orderId: string,
  status: PaymentStatus,
  transactionId?: string
): Order | null {
  const order = getOrder(orderId);
  if (!order) return null;

  const updatedOrder: Order = {
    ...order,
    paymentStatus: status,
    ...(status === 'PAID' && { paymentVerifiedAt: Date.now(), transactionId }),
    ...(status === 'FAILED' && { paymentVerifiedAt: Date.now() }),
  };

  saveOrder(updatedOrder);

  // Mark the linked product-level item order as paid too.
  const itemOrderId = getLinkedItemOrder(orderId);

  // Credit the paid amount to the customer's available margin ONLY for
  // pure "add funds" orders. Orders linked to a product purchase already
  // deducted the wallet balance at checkout, so crediting again would
  // double-count.
  if (status === 'PAID' && order.paymentStatus !== 'PAID' && !itemOrderId) {
    addMargin(updatedOrder.customerId, updatedOrder.amount);
  }

  if (status === 'PAID' && itemOrderId) {
    updateItemOrderStatus(itemOrderId, 'PAID');
  }

  return updatedOrder;
}

/**
 * Check if order status has been updated since last check
 */
export function hasStatusChanged(orderId: string, lastStatus: PaymentStatus): boolean {
  const order = getOrder(orderId);
  return order ? order.paymentStatus !== lastStatus : false;
}
