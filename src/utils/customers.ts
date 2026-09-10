import { supabase } from '../lib/supabase';
import type { Customer } from '../types/payment';

/* ========================================
   Customers (real-time, shared table)
   ======================================== */

/**
 * Customers used by the customer login, vendor tools and the web-login
 * pricing configuration. Falls back to the built-in demo accounts when the
 * table is unreachable or empty, so the app never breaks before the schema
 * is applied.
 */
const FALLBACK_CUSTOMERS: Customer[] = [
  { id: 'CUST001', name: 'Ravi Kumar' },
  { id: 'CUST002', name: 'Priya Sharma' },
];

/** Fetch all customers (id order). Returns the demo fallback on failure. */
export async function getCustomers(): Promise<Customer[]> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, address, phone, status, location_type')
      .order('id', { ascending: true });
    if (error) throw error;
    const list: Customer[] = (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      address: String(row.address ?? ''),
      phone: String(row.phone ?? ''),
      status: (row.status as Customer['status']) || 'Active',
      locationType: (row.location_type as Customer['locationType']) || 'Residential',
    }));
    return list.length > 0 ? list : FALLBACK_CUSTOMERS;
  } catch {
    return FALLBACK_CUSTOMERS;
  }
}

/** Fetch a single customer by id (null when missing/unreachable). */
export async function getCustomerById(id: string): Promise<Customer | null> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, address, phone, status, location_type')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: String(data.id),
      name: String(data.name ?? ''),
      address: String(data.address ?? ''),
      phone: String(data.phone ?? ''),
      status: (data.status as Customer['status']) || 'Active',
      locationType: (data.location_type as Customer['locationType']) || 'Residential',
    };
  } catch {
    return null;
  }
}

/** Upsert a customer (insert or update by id). */
export async function saveCustomer(
  customer: Omit<Customer, 'status' | 'locationType'> &
    Partial<Pick<Customer, 'status' | 'locationType'>>
): Promise<void> {
  const { error } = await supabase.from('customers').upsert({
    id: customer.id,
    name: customer.name,
    address: customer.address ?? '',
    phone: customer.phone ?? '',
    status: customer.status ?? 'Active',
    location_type: customer.locationType ?? 'Residential',
  });
  if (error) console.error('saveCustomer failed:', error.message);
}

/**
 * Subscribe to real-time changes on the customers table.
 * Returns an unsubscribe function. Any INSERT/UPDATE/DELETE made anywhere
 * (Supabase dashboard, another tab, another device) reaches every logged
 * in session within milliseconds — no polling, no redeploy.
 */
export type CustomerChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

function rowToCustomer(row: Record<string, unknown>): Customer {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    address: String(row.address ?? ''),
    phone: String(row.phone ?? ''),
    status: (row.status as Customer['status']) || 'Active',
    locationType: (row.location_type as Customer['locationType']) || 'Residential',
  };
}

export function subscribeToCustomers(
  onChange: (event: CustomerChangeEvent, customer: Customer) => void
): () => void {
  const channel = supabase
    .channel('customers-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'customers' },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          // With default REPLICA IDENTITY only the primary key is present.
          const oldRow = payload.old as Record<string, unknown> | null;
          if (oldRow?.id) {
            onChange('DELETE', { id: String(oldRow.id), name: '' });
          }
          return;
        }
        const row = payload.new as Record<string, unknown> | null;
        if (row && row.id) {
          onChange(payload.eventType as CustomerChangeEvent, rowToCustomer(row));
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
