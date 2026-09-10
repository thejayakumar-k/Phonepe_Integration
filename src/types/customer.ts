export type AddressType = 'Apt' | 'House' | 'Commercial' | 'Others';

export interface CustomerAddress {
  id: string;
  customerId: string;
  address: string;
  houseNo: string;
  street: string;
  apartment: string;
  area: string;
  city: string;
  pincode: string;
  landmark: string;
  addressType: AddressType;
  /** Delivery floor, chosen from the web-login floor list (e.g. "1st Floor"). */
  floor?: string;
  lat?: number | null;
  lng?: number | null;
  createdAt: number;
}
