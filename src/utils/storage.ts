import type { Order, PaymentStatus } from '../types/payment';

const STORAGE_KEY = 'oorunii_orders';
const MARGIN_STORAGE_KEY = 'oorunii_margin';

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
 * Seed demo orders into localStorage if no orders exist yet.
 */
export function seedDemoOrders(demoOrders: Order[]): void {
  const orders = getOrders();
  if (Object.keys(orders).length === 0) {
    demoOrders.forEach((order) => saveOrder(order));
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

  // Credit the paid amount to the customer's available margin (only once per order).
  if (status === 'PAID' && order.paymentStatus !== 'PAID') {
    addMargin(updatedOrder.customerId, updatedOrder.amount);
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
