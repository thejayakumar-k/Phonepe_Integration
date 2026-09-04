import type { ItemOrder, ItemOrderStatus, Order, PaymentStatus, BankAccount } from '../types/payment';

const STORAGE_KEY = 'oorunii_orders';
const MARGIN_STORAGE_KEY = 'oorunii_margin';
const ITEM_ORDERS_KEY = 'oorunii_item_orders';
const ITEM_LINKS_KEY = 'oorunii_item_order_links';
const UPI_IDS_KEY = 'oorunii_upi_ids';
const BANK_ACCOUNTS_KEY = 'oorunii_bank_accounts';

/**
 * List of managed UPI IDs. The first entry is the active one.
 */
export function getUpiIds(): string[] {
  try {
    const data = localStorage.getItem(UPI_IDS_KEY);
    const list: unknown = data ? JSON.parse(data) : [];
    if (!Array.isArray(list)) return [];
    return list.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  } catch {
    return [];
  }
}

/**
 * Add a UPI ID to the managed list (ignores duplicates).
 */
export function saveUpiId(id: string): void {
  const trimmed = id.trim();
  if (!trimmed) return;
  const list = getUpiIds();
  if (list.includes(trimmed)) return;
  list.push(trimmed);
  localStorage.setItem(UPI_IDS_KEY, JSON.stringify(list));
}

/**
 * Remove a UPI ID from the managed list.
 */
export function removeUpiId(id: string): void {
  const list = getUpiIds().filter((x) => x !== id);
  localStorage.setItem(UPI_IDS_KEY, JSON.stringify(list));
}

/**
 * Mark a UPI ID as active by moving it to the front of the list.
 */
export function setActiveUpiId(id: string): void {
  const list = getUpiIds();
  const idx = list.indexOf(id);
  if (idx <= 0) return;
  const [active] = list.splice(idx, 1);
  list.unshift(active);
  localStorage.setItem(UPI_IDS_KEY, JSON.stringify(list));
}

/**
 * Active UPI ID used for payment deep links and QR codes.
 * Falls back to the configured VITE_MERCHANT_UPI_ID.
 */
export function getActiveUpiId(): string {
  const list = getUpiIds();
  if (list.length > 0) return list[0];
  return import.meta.env.VITE_MERCHANT_UPI_ID || 'merchant@phonepe';
}

/* ========================================
   Bank Accounts (Customer Bank Mapping)
   ======================================== */

/**
 * Mask an account number: show only last 4 digits.
 * e.g., '50100123456703' → '••••6703'
 */
function maskAccountNumber(accountNumber: string): string {
  const last4 = accountNumber.slice(-4);
  return `••••${last4}`;
}

/**
 * Get all bank accounts for a customer.
 */
export function getBankAccounts(customerId: string): BankAccount[] {
  if (!customerId) return [];
  try {
    const data = localStorage.getItem(BANK_ACCOUNTS_KEY);
    const allAccounts: BankAccount[] = data ? JSON.parse(data) : [];
    return allAccounts.filter((acc) => acc.customerId === customerId);
  } catch {
    return [];
  }
}

/**
 * Get the preferred bank account for a customer.
 * Falls back to the first account if no preferred is set.
 */
export function getPreferredBankAccount(customerId: string): BankAccount | null {
  const accounts = getBankAccounts(customerId);
  if (accounts.length === 0) return null;
  return accounts.find((a) => a.isPreferred) || accounts[0];
}

/**
 * Save a new bank account for a customer.
 */
export function saveBankAccount(
  account: Omit<BankAccount, 'id' | 'maskedAccountNumber' | 'createdAt'>
): BankAccount {
  const newAccount: BankAccount = {
    ...account,
    id: `BANK${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    maskedAccountNumber: maskAccountNumber(account.accountNumber),
    createdAt: Date.now(),
  };

  try {
    const data = localStorage.getItem(BANK_ACCOUNTS_KEY);
    const allAccounts: BankAccount[] = data ? JSON.parse(data) : [];
    allAccounts.push(newAccount);
    localStorage.setItem(BANK_ACCOUNTS_KEY, JSON.stringify(allAccounts));
  } catch {
    // ignore storage errors
  }

  return newAccount;
}

/**
 * Remove a bank account by ID.
 */
export function removeBankAccount(customerId: string, accountId: string): void {
  try {
    const data = localStorage.getItem(BANK_ACCOUNTS_KEY);
    const allAccounts: BankAccount[] = data ? JSON.parse(data) : [];
    const filtered = allAccounts.filter(
      (acc) => !(acc.customerId === customerId && acc.id === accountId)
    );
    localStorage.setItem(BANK_ACCOUNTS_KEY, JSON.stringify(filtered));
  } catch {
    // ignore
  }
}

/**
 * Set a bank account as preferred. Unsets any previously preferred account.
 */
export function setPreferredBankAccount(
  customerId: string,
  accountId: string
): void {
  try {
    const data = localStorage.getItem(BANK_ACCOUNTS_KEY);
    const allAccounts: BankAccount[] = data ? JSON.parse(data) : [];
    const updated = allAccounts.map((acc) => {
      if (acc.customerId === customerId) {
        return { ...acc, isPreferred: acc.id === accountId };
      }
      return acc;
    });
    localStorage.setItem(BANK_ACCOUNTS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
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
 * Get all bank accounts (for admin/debug use). Do NOT expose account numbers to frontend.
 */
export function getAllBankAccounts(): BankAccount[] {
  try {
    const data = localStorage.getItem(BANK_ACCOUNTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
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
