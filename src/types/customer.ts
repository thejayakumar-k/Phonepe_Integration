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
  lat?: number | null;
  lng?: number | null;
  createdAt: number;
}
