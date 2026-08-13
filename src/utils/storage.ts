import type { Order, PaymentStatus } from '../types/payment';

const STORAGE_KEY = 'oorunii_orders';

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
  return updatedOrder;
}

/**
 * Check if order status has been updated since last check
 */
export function hasStatusChanged(orderId: string, lastStatus: PaymentStatus): boolean {
  const order = getOrder(orderId);
  return order ? order.paymentStatus !== lastStatus : false;
}
