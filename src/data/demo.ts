import type { Customer, Order, Vendor } from '../types/payment';
import { getOrder, saveOrder } from '../utils/storage';

export const sessionMinutes = parseFloat(
  import.meta.env.VITE_PAYMENT_SESSION_MINUTES || '10'
);

export const demoVendors: Vendor[] = [
  { id: 'VENDOR001', name: 'OORUNII Store' },
  { id: 'VENDOR002', name: 'GreenMart Fresh' },
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
    amount: 1,
    currency: 'INR',
    description: 'Premium Subscription - Annual Plan',
    createdAt: Date.now(),
    expiresAt: Date.now() + sessionMinutes * minutes(1),
    paymentStatus: 'PENDING',
    paymentMethod: 'PHONEPE',
  },
  {
    orderId: 'ORDER1002',
    vendorId: 'VENDOR001',
    vendorName: 'OORUNII Store',
    customerId: 'CUST002',
    customerName: 'Priya Sharma',
    amount: 1,
    currency: 'INR',
    description: 'Weekly Grocery Basket',
    createdAt: Date.now() - minutes(5),
    expiresAt: Date.now() + sessionMinutes * minutes(1) - minutes(5),
    paymentStatus: 'PENDING',
    paymentMethod: 'PHONEPE',
  },
  {
    orderId: 'ORDER1003',
    vendorId: 'VENDOR001',
    vendorName: 'OORUNII Store',
    customerId: 'CUST001',
    customerName: 'Ravi Kumar',
    amount: 1,
    currency: 'INR',
    description: 'Gift Card - Birthday',
    createdAt: Date.now() - minutes(10),
    expiresAt: Date.now() + sessionMinutes * minutes(1) - minutes(10),
    paymentStatus: 'PENDING',
    paymentMethod: 'PHONEPE',
  },
  {
    orderId: 'ORDER1004',
    vendorId: 'VENDOR002',
    vendorName: 'GreenMart Fresh',
    customerId: 'CUST002',
    customerName: 'Priya Sharma',
    amount: 1,
    currency: 'INR',
    description: 'Fresh Vegetables Combo',
    createdAt: Date.now() - minutes(2),
    expiresAt: Date.now() + sessionMinutes * minutes(1) - minutes(2),
    paymentStatus: 'PENDING',
    paymentMethod: 'PHONEPE',
  },
];

export function startFreshPayment(orderId?: string): Order {
  const existing = orderId ? getOrder(orderId) : null;
  const base =
    existing ||
    demoOrders.find((o) => o.orderId === orderId) ||
    demoOrders[0];
  const demo = demoOrders.find((o) => o.orderId === base.orderId);
  const refreshed: Order = {
    ...base,
    amount: demo?.amount ?? base.amount,
    currency: demo?.currency ?? base.currency,
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

/**
 * Create a fresh "Add Funds" order for the given customer and amount.
 */
export function getAddFundsOrder(customer?: Customer, amount = 0): Order {
  return {
    orderId: `FUND${Date.now()}`,
    vendorId: 'VENDOR001',
    vendorName: 'OORUNII Store',
    customerId: customer?.id,
    customerName: customer?.name,
    amount,
    currency: 'INR',
    description: 'Wallet Add Funds',
    createdAt: Date.now(),
    expiresAt: Date.now() + sessionMinutes * 60 * 1000,
    paymentStatus: 'PENDING',
    paymentMethod: 'PHONEPE',
  };
}

export function getDemoOrder(orderId?: string): Order {
  const base = demoOrders.find((o) => o.orderId === orderId) || demoOrders[0];
  return {
    ...base,
    createdAt: Date.now(),
    expiresAt: Date.now() + sessionMinutes * 60 * 1000,
  };
}
