// Payment status model: PENDING → CUSTOMER_SUBMITTED → VERIFIED / FAILED / EXPIRED
export type PaymentStatus =
  | 'PENDING'           // Order created, waiting for customer to scan QR
  | 'CUSTOMER_SUBMITTED' // Customer clicked "I Have Paid" - awaiting admin verification
  | 'PAID'              // Admin verified payment received
  | 'FAILED'            // Admin marked payment as failed
  | 'EXPIRED'          // Timer expired without payment
  | 'COD_PLACED'      // Order placed with Cash on Delivery
  | 'CANCELLED';      // Customer cancelled the payment

export type PaymentMethod = 'PHONEPE' | 'COD';

export type ItemOrderStatus = 'PENDING' | 'PAID' | 'NOT_PAID' | 'CANCELLED';

export interface ItemOrderItem {
  name: string;
  qty: number;
  price: number;
  unit?: string;
  image?: string;
}

export interface ItemOrder {
  id: string;
  customerId: string;
  customerName?: string;
  vendorId?: string;
  vendorName?: string;
  items: ItemOrderItem[];
  total: number;
  status: ItemOrderStatus;
  paymentMethod?: PaymentMethod;
  paymentOrderId?: string;
  createdAt: number;
}

export interface Vendor {
  id: string;
  name: string;
}

export interface Customer {
  id: string;
  name: string;
}

export interface Order {
  orderId: string;
  amount: number;          // Amount in INR (e.g., 500)
  currency: string;        // e.g., 'INR'
  description: string;     // e.g., 'Order #1001'
  createdAt: number;       // Timestamp
  expiresAt: number;       // Timestamp when payment session expires
  paymentStatus: PaymentStatus;
  vendorId?: string;       // Vendor this order belongs to
  vendorName?: string;     // Display name of the vendor
  customerId?: string;     // Customer who placed the order
  customerName?: string;   // Display name of the customer
  paymentMethod?: PaymentMethod;   // 'PHONEPE' or 'COD'
  paymentSubmittedAt?: number;  // When customer clicked "I Have Paid"
  paymentVerifiedAt?: number;   // When admin verified
  transactionId?: string;       // Payment transaction reference (manual entry by admin)
  orderPlacedAt?: number;       // When the order was placed by the customer
  codPlacedAt?: number;         // When COD order was placed
}

export interface MerchantConfig {
  upiId: string;           // e.g., 'merchant@phonepe'
  merchantName: string;    // Display name for merchant
}
