import type { Customer, Order, Vendor } from '../types/payment';
import { getOrder, saveOrder } from '../utils/storage';

export const sessionMinutes = parseFloat(
  import.meta.env.VITE_PAYMENT_SESSION_MINUTES || '10'
);

export const demoVendors: Vendor[] = [
  { id: 'VENDOR001', name: 'OORUNII Store' },
];

export const demoCustomers: Customer[] = [
  { id: 'CUST001', name: 'Ravi Kumar' },
  { id: 'CUST002', name: 'Priya Sharma' },
];

const minutes = (n: number) => n * 60 * 1000;

export const demoOrders: Order[] = [
  {
    orderId: 'ORDER1001',
    vendorId: 'VENDOR001',
    vendorName: 'OORUNII Store',
    customerId: 'CUST001',
    customerName: 'Ravi Kumar',
    amount: 500,
    currency: 'INR',
    description: 'Premium Subscription - Annual Plan',
    createdAt: Date.now(),
    expiresAt: Date.now() + sessionMinutes * minutes(1),
    paymentStatus: 'PENDING',
    paymentMethod: 'UPI',
  },
  {
    orderId: 'ORDER1002',
    vendorId: 'VENDOR001',
    vendorName: 'OORUNII Store',
    customerId: 'CUST002',
    customerName: 'Priya Sharma',
    amount: 250,
    currency: 'INR',
    description: 'Weekly Grocery Basket',
    createdAt: Date.now() - minutes(5),
    expiresAt: Date.now() + sessionMinutes * minutes(1) - minutes(5),
    paymentStatus: 'PENDING',
    paymentMethod: 'UPI',
  },
  {
    orderId: 'ORDER1003',
    vendorId: 'VENDOR001',
    vendorName: 'OORUNII Store',
    customerId: 'CUST001',
    customerName: 'Ravi Kumar',
    amount: 120,
    currency: 'INR',
    description: 'Gift Card - Birthday',
    createdAt: Date.now() - minutes(10),
    expiresAt: Date.now() + sessionMinutes * minutes(1) - minutes(10),
    paymentStatus: 'PENDING',
    paymentMethod: 'UPI',
  },
];

export function startFreshPayment(orderId?: string): Order {
  const existing = orderId ? getOrder(orderId) : null;
  const base =
    existing ||
    demoOrders.find((o) => o.orderId === orderId) ||
    demoOrders[0];
  const refreshed: Order = {
    ...base,
    paymentStatus: 'PENDING',
    expiresAt: Date.now() + sessionMinutes * 60 * 1000,
    paymentSubmittedAt: undefined,
    paymentVerifiedAt: undefined,
    orderPlacedAt: undefined,
    codPlacedAt: undefined,
    transactionId: undefined,
  };
  saveOrder(refreshed);
  return refreshed;
}

export function getCustomerOrderId(customerId?: string): string | undefined {
  const order = demoOrders.find((o) => o.customerId === customerId);
  return order?.orderId;
}

export function getDemoOrder(orderId?: string): Order {
  const base = demoOrders.find((o) => o.orderId === orderId) || demoOrders[0];
  return {
    ...base,
    createdAt: Date.now(),
    expiresAt: Date.now() + sessionMinutes * 60 * 1000,
  };
}
