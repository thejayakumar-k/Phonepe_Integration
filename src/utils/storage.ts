import { supabase } from '../lib/supabase';
import type {
  ItemOrder,
  ItemOrderStatus,
  Order,
  PaymentStatus,
  BankAccount,
  Refund,
} from '../types/payment';

/* ========================================
   UPI IDs (managed list; first = active)
   ======================================== */

export async function getUpiIds(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('upi_ids')
      .select('id')
      .order('position', { ascending: true });
    if (error) throw error;
    return (data ?? [])
      .map((r) => r.id as string)
      .filter((id) => typeof id === 'string' && id.trim().length > 0);
  } catch {
    return [];
  }
}

/** Add a UPI ID to the managed list (ignores duplicates). */
export async function saveUpiId(id: string): Promise<void> {
  const trimmed = id.trim();
  if (!trimmed) return;
  const list = await getUpiIds();
  if (list.includes(trimmed)) return;
  const { error } = await supabase
    .from('upi_ids')
    .insert({ id: trimmed, position: list.length });
  if (error) console.error('saveUpiId failed:', error.message);
}

/** Remove a UPI ID from the managed list. */
export async function removeUpiId(id: string): Promise<void> {
  const { error } = await supabase.from('upi_ids').delete().eq('id', id);
  if (error) console.error('removeUpiId failed:', error.message);
}

/** Mark a UPI ID as active by moving it to the front of the list. */
export async function setActiveUpiId(id: string): Promise<void> {
  const list = await getUpiIds();
  const idx = list.indexOf(id);
  if (idx <= 0) return;
  const reordered = [id, ...list.filter((x) => x !== id)];
  for (const [i, uid] of reordered.entries()) {
    const { error } = await supabase
      .from('upi_ids')
      .update({ position: i })
      .eq('id', uid);
    if (error) console.error('setActiveUpiId failed:', error.message);
  }
}

/**
 * Active UPI ID used for payment deep links and QR codes.
 * Falls back to the configured VITE_MERCHANT_UPI_ID.
 */
export async function getActiveUpiId(): Promise<string> {
  const list = await getUpiIds();
  if (list.length > 0) return list[0];
  return import.meta.env.VITE_MERCHANT_UPI_ID || 'merchant@phonepe';
}

/* ========================================
   Bank Accounts (Customer Bank Mapping)
   ======================================== */

/** Mask an account number: show only last 4 digits. */
function maskAccountNumber(accountNumber: string): string {
  const last4 = accountNumber.slice(-4);
  return `••••${last4}`;
}

interface BankAccountRow {
  id: string;
  customer_id: string;
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  masked_account_number: string;
  is_preferred: boolean;
  created_at: number;
}

function rowToBankAccount(r: BankAccountRow): BankAccount {
  return {
    id: r.id,
    customerId: r.customer_id,
    bankName: r.bank_name,
    accountHolderName: r.account_holder_name,
    accountNumber: r.account_number,
    ifscCode: r.ifsc_code,
    maskedAccountNumber: r.masked_account_number,
    isPreferred: r.is_preferred,
    createdAt: r.created_at,
  };
}

function bankAccountToRow(a: BankAccount): BankAccountRow {
  return {
    id: a.id,
    customer_id: a.customerId,
    bank_name: a.bankName,
    account_holder_name: a.accountHolderName,
    account_number: a.accountNumber,
    ifsc_code: a.ifscCode,
    masked_account_number: a.maskedAccountNumber,
    is_preferred: a.isPreferred,
    created_at: a.createdAt,
  };
}

/** Get all bank accounts for a customer. */
export async function getBankAccounts(customerId: string): Promise<BankAccount[]> {
  if (!customerId) return [];
  try {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => rowToBankAccount(r as unknown as BankAccountRow));
  } catch {
    return [];
  }
}

/** Get all bank accounts (for admin/debug use). */
export async function getAllBankAccounts(): Promise<BankAccount[]> {
  try {
    const { data, error } = await supabase.from('bank_accounts').select('*');
    if (error) throw error;
    return (data ?? []).map((r) => rowToBankAccount(r as unknown as BankAccountRow));
  } catch {
    return [];
  }
}

/**
 * Get the preferred bank account for a customer.
 * Falls back to the first account if no preferred is set.
 */
export async function getPreferredBankAccount(
  customerId: string
): Promise<BankAccount | null> {
  const accounts = await getBankAccounts(customerId);
  if (accounts.length === 0) return null;
  return accounts.find((a) => a.isPreferred) || accounts[0];
}

/** Save a new bank account for a customer. */
export async function saveBankAccount(
  account: Omit<BankAccount, 'id' | 'maskedAccountNumber' | 'createdAt'>
): Promise<BankAccount> {
  const newAccount: BankAccount = {
    ...account,
    id: `BANK${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    maskedAccountNumber: maskAccountNumber(account.accountNumber),
    createdAt: Date.now(),
  };

  const { error } = await supabase
    .from('bank_accounts')
    .insert(bankAccountToRow(newAccount));
  if (error) console.error('saveBankAccount failed:', error.message);

  return newAccount;
}

/** Remove a bank account by ID. */
export async function removeBankAccount(
  customerId: string,
  accountId: string
): Promise<void> {
  const { error } = await supabase
    .from('bank_accounts')
    .delete()
    .eq('id', accountId)
    .eq('customer_id', customerId);
  if (error) console.error('removeBankAccount failed:', error.message);
}

/**
 * Set a bank account as preferred. Unsets any previously preferred account.
 */
export async function setPreferredBankAccount(
  customerId: string,
  accountId: string
): Promise<void> {
  const { error: unsetError } = await supabase
    .from('bank_accounts')
    .update({ is_preferred: false })
    .eq('customer_id', customerId);
  if (unsetError) console.error('setPreferredBankAccount failed:', unsetError.message);

  const { error: setError } = await supabase
    .from('bank_accounts')
    .update({ is_preferred: true })
    .eq('id', accountId);
  if (setError) console.error('setPreferredBankAccount failed:', setError.message);
}

/**
 * Validate bank account fields. Returns null if valid, or an error message.
 */
export function validateBankAccount(fields: {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
}): string | null {
  const { bankName, accountHolderName, accountNumber, confirmAccountNumber, ifscCode } = fields;

  if (!bankName.trim()) return 'Bank name is required.';
  if (!accountHolderName.trim()) return 'Account holder name is required.';
  if (!accountNumber.trim()) return 'Account number is required.';
  if (accountNumber.length < 8 || accountNumber.length > 20) {
    return 'Account number must be between 8 and 20 digits.';
  }
  if (!/^\d+$/.test(accountNumber)) return 'Account number must contain only digits.';
  if (accountNumber !== confirmAccountNumber) return 'Account numbers do not match.';
  if (!ifscCode.trim()) return 'IFSC code is required.';
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
    return 'Enter a valid IFSC code (e.g., HDFC0001234).';
  }

  return null; // valid
}

/* ========================================
   Wallet Margins
   ======================================== */

/** Get the available margin for a customer (defaults to 0). */
export async function getMargin(customerId?: string): Promise<number> {
  if (!customerId) return 0;
  try {
    const { data, error } = await supabase
      .from('margins')
      .select('balance')
      .eq('customer_id', customerId)
      .maybeSingle();
    if (error) throw error;
    return data ? Number(data.balance) : 0;
  } catch {
    return 0;
  }
}

/** Credit `amount` to the customer's available margin. Returns the new balance. */
export async function addMargin(
  customerId: string | undefined,
  amount: number
): Promise<number> {
  if (!customerId || !Number.isFinite(amount) || amount <= 0) {
    return getMargin(customerId);
  }
  const current = await getMargin(customerId);
  const next = Math.round((current + amount) * 100) / 100;
  const { error } = await supabase
    .from('margins')
    .upsert({ customer_id: customerId, balance: next });
  if (error) console.error('addMargin failed:', error.message);
  return next;
}

/** Deduct `amount` from the customer's available margin. Returns the new balance. */
export async function subtractMargin(
  customerId: string | undefined,
  amount: number
): Promise<number> {
  if (!customerId || !Number.isFinite(amount) || amount <= 0) {
    return getMargin(customerId);
  }
  const current = await getMargin(customerId);
  const next = Math.max(0, Math.round((current - amount) * 100) / 100);
  const { error } = await supabase
    .from('margins')
    .upsert({ customer_id: customerId, balance: next });
  if (error) console.error('subtractMargin failed:', error.message);
  return next;
}

/* ========================================
   Orders
   ======================================== */

interface OrderRow {
  order_id: string;
  vendor_id: string | null;
  vendor_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  amount: number;
  currency: string;
  description: string;
  created_at: number;
  expires_at: number;
  payment_status: PaymentStatus;
  payment_method: string | null;
  payment_submitted_at: number | null;
  payment_verified_at: number | null;
  transaction_id: string | null;
  order_placed_at: number | null;
  cod_placed_at: number | null;
}

function orderToRow(o: Order): OrderRow {
  return {
    order_id: o.orderId,
    vendor_id: o.vendorId ?? null,
    vendor_name: o.vendorName ?? null,
    customer_id: o.customerId ?? null,
    customer_name: o.customerName ?? null,
    amount: o.amount,
    currency: o.currency,
    description: o.description,
    created_at: o.createdAt,
    expires_at: o.expiresAt,
    payment_status: o.paymentStatus,
    payment_method: o.paymentMethod ?? null,
    payment_submitted_at: o.paymentSubmittedAt ?? null,
    payment_verified_at: o.paymentVerifiedAt ?? null,
    transaction_id: o.transactionId ?? null,
    order_placed_at: o.orderPlacedAt ?? null,
    cod_placed_at: o.codPlacedAt ?? null,
  };
}

function rowToOrder(r: OrderRow): Order {
  return {
    orderId: r.order_id,
    vendorId: r.vendor_id ?? undefined,
    vendorName: r.vendor_name ?? undefined,
    customerId: r.customer_id ?? undefined,
    customerName: r.customer_name ?? undefined,
    amount: Number(r.amount),
    currency: r.currency,
    description: r.description,
    createdAt: Number(r.created_at),
    expiresAt: Number(r.expires_at),
    paymentStatus: r.payment_status,
    paymentMethod: (r.payment_method as Order['paymentMethod']) ?? undefined,
    paymentSubmittedAt: r.payment_submitted_at ?? undefined,
    paymentVerifiedAt: r.payment_verified_at ?? undefined,
    transactionId: r.transaction_id ?? undefined,
    orderPlacedAt: r.order_placed_at ?? undefined,
    codPlacedAt: r.cod_placed_at ?? undefined,
  };
}

/** Get all orders from Supabase (newest first). */
export async function getOrders(): Promise<Order[]> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => rowToOrder(r as unknown as OrderRow));
  } catch {
    return [];
  }
}

/** Get a specific order by ID. */
export async function getOrder(orderId: string): Promise<Order | null> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToOrder(data as unknown as OrderRow) : null;
  } catch {
    return null;
  }
}

/** Save an order (insert or update). */
export async function saveOrder(order: Order): Promise<void> {
  const { error } = await supabase.from('orders').upsert(orderToRow(order));
  if (error) console.error('saveOrder failed:', error.message);
}

/**
 * Update order payment status.
 * Credits margin for "add funds" orders and syncs linked item orders.
 */
export async function updateOrderStatus(
  orderId: string,
  status: PaymentStatus,
  transactionId?: string
): Promise<Order | null> {
  const order = await getOrder(orderId);
  if (!order) return null;

  const updatedOrder: Order = {
    ...order,
    paymentStatus: status,
    ...(status === 'PAID' && { paymentVerifiedAt: Date.now(), transactionId }),
    ...(status === 'FAILED' && { paymentVerifiedAt: Date.now() }),
  };

  await saveOrder(updatedOrder);

  // Mark the linked product-level item order as paid too.
  const itemOrderId = await getLinkedItemOrder(orderId);

  // Credit the paid amount to the customer's available margin ONLY for
  // pure "add funds" orders. Orders linked to a product purchase already
  // deducted the wallet balance at checkout, so crediting again would
  // double-count.
  if (status === 'PAID' && order.paymentStatus !== 'PAID' && !itemOrderId) {
    await addMargin(updatedOrder.customerId, updatedOrder.amount);
  }

  if (status === 'PAID' && itemOrderId) {
    await updateItemOrderStatus(itemOrderId, 'PAID');
  }

  return updatedOrder;
}

/** Check if order status has been updated since last check. */
export async function hasStatusChanged(
  orderId: string,
  lastStatus: PaymentStatus
): Promise<boolean> {
  const order = await getOrder(orderId);
  return order ? order.paymentStatus !== lastStatus : false;
}

/** Remove previously seeded demo payment orders (if any). */
export async function clearDemoOrders(): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .delete()
    .in('order_id', ['ORDER1001', 'ORDER1002', 'ORDER1003', 'ORDER1004']);
  if (error) console.error('clearDemoOrders failed:', error.message);
}

/* ========================================
   Item Orders (product-level orders)
   ======================================== */

/**
 * Generate a short 5-digit item order number (e.g. "#28471"), avoiding
 * collisions with existing orders. Falls back to a timestamp-derived id
 * if collisions keep occurring (extremely unlikely).
 */
export async function generateItemOrderId(): Promise<string> {
  let existing = new Set<string>();
  try {
    existing = new Set((await getItemOrders()).map((o) => o.id));
  } catch {
    // ignore — fall back to empty set
  }
  for (let i = 0; i < 20; i++) {
    const id = `#${10000 + Math.floor(Math.random() * 90000)}`;
    if (!existing.has(id)) return id;
  }
  return `#${Date.now() % 100000}`;
}

interface ItemOrderRow {
  id: string;
  customer_id: string;
  customer_name: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  items: unknown;
  total: number;
  status: ItemOrderStatus;
  payment_method: string | null;
  payment_order_id: string | null;
  created_at: number;
}

function itemOrderToRow(o: ItemOrder): ItemOrderRow {
  return {
    id: o.id,
    customer_id: o.customerId,
    customer_name: o.customerName ?? null,
    vendor_id: o.vendorId ?? null,
    vendor_name: o.vendorName ?? null,
    items: o.items,
    total: o.total,
    status: o.status,
    payment_method: o.paymentMethod ?? null,
    payment_order_id: o.paymentOrderId ?? null,
    created_at: o.createdAt,
  };
}

function rowToItemOrder(r: ItemOrderRow): ItemOrder {
  return {
    id: r.id,
    customerId: r.customer_id,
    customerName: r.customer_name ?? undefined,
    vendorId: r.vendor_id ?? undefined,
    vendorName: r.vendor_name ?? undefined,
    items: Array.isArray(r.items) ? (r.items as ItemOrder['items']) : [],
    total: Number(r.total),
    status: r.status,
    paymentMethod: (r.payment_method as ItemOrder['paymentMethod']) ?? undefined,
    paymentOrderId: r.payment_order_id ?? undefined,
    createdAt: Number(r.created_at),
  };
}

/** Get all item orders (newest first). */
export async function getItemOrders(): Promise<ItemOrder[]> {
  try {
    const { data, error } = await supabase
      .from('item_orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => rowToItemOrder(r as unknown as ItemOrderRow));
  } catch {
    return [];
  }
}

/** Save an item order (insert or update). */
export async function saveItemOrder(order: ItemOrder): Promise<void> {
  const { error } = await supabase.from('item_orders').upsert(itemOrderToRow(order));
  if (error) console.error('saveItemOrder failed:', error.message);
}

/** Update an item order's status. */
export async function updateItemOrderStatus(
  id: string,
  status: ItemOrderStatus
): Promise<ItemOrder | null> {
  const { data, error } = await supabase
    .from('item_orders')
    .update({ status })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) {
    console.error('updateItemOrderStatus failed:', error.message);
    return null;
  }
  return data ? rowToItemOrder(data as unknown as ItemOrderRow) : null;
}

/** Remove previously seeded demo item orders (if any). */
export async function clearDemoItemOrders(): Promise<void> {
  const { error } = await supabase
    .from('item_orders')
    .delete()
    .in('id', ['IO1001', 'IO1002']);
  if (error) console.error('clearDemoItemOrders failed:', error.message);
}

/* ========================================
   Item order ↔ payment order links
   ======================================== */

export async function linkItemOrderToPayment(
  itemOrderId: string,
  paymentOrderId: string
): Promise<void> {
  const { error } = await supabase
    .from('item_order_links')
    .upsert({ payment_order_id: paymentOrderId, item_order_id: itemOrderId });
  if (error) console.error('linkItemOrderToPayment failed:', error.message);
}

export async function getLinkedItemOrder(
  paymentOrderId: string
): Promise<string | undefined> {
  try {
    const { data, error } = await supabase
      .from('item_order_links')
      .select('item_order_id')
      .eq('payment_order_id', paymentOrderId)
      .maybeSingle();
    if (error) throw error;
    return data ? (data.item_order_id as string) : undefined;
  } catch {
    return undefined;
  }
}

/* ========================================
   Refunds
   ======================================== */

interface RefundRow {
  id: string;
  order_id: string;
  amount: number;
  reason: string;
  status: string;
  initiated_at: number;
  completed_at: number | null;
  payu_refund_id: string | null;
  customer_name: string | null;
  vendor_id: string | null;
}

function refundToRow(r: Refund): RefundRow {
  return {
    id: r.id,
    order_id: r.orderId,
    amount: r.amount,
    reason: r.reason,
    status: r.status,
    initiated_at: r.initiatedAt,
    completed_at: r.completedAt ?? null,
    payu_refund_id: r.payuRefundId ?? null,
    customer_name: r.customerName ?? null,
    vendor_id: r.vendorId ?? null,
  };
}

function rowToRefund(r: RefundRow): Refund {
  return {
    id: r.id,
    orderId: r.order_id,
    amount: Number(r.amount),
    reason: r.reason,
    status: r.status as Refund['status'],
    initiatedAt: Number(r.initiated_at),
    completedAt: r.completed_at ?? undefined,
    payuRefundId: r.payu_refund_id ?? undefined,
    customerName: r.customer_name ?? undefined,
    vendorId: r.vendor_id ?? undefined,
  };
}

/** Get all refunds (newest first). */
export async function getRefunds(): Promise<Refund[]> {
  try {
    const { data, error } = await supabase
      .from('refunds')
      .select('*')
      .order('initiated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => rowToRefund(r as unknown as RefundRow));
  } catch {
    return [];
  }
}

/** Save a refund (insert or update). */
export async function saveRefund(refund: Refund): Promise<void> {
  const { error } = await supabase.from('refunds').upsert(refundToRow(refund));
  if (error) console.error('saveRefund failed:', error.message);
}