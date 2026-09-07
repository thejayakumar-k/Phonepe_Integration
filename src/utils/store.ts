import { supabase } from '../lib/supabase';

export interface StoreInfo {
  vendorId: string;
  vendorName: string;
}

const FALLBACK: StoreInfo = { vendorId: 'VENDOR001', vendorName: 'OORUNII Store' };

let cache: StoreInfo | null = null;

/**
 * Store identity from the store_settings table (first row). Cached after
 * the first load; falls back to the default when the table is
 * unreachable, so nothing breaks before the schema is applied.
 */
export async function getStoreInfo(): Promise<StoreInfo> {
  if (cache) return cache;
  try {
    const { data, error } = await supabase
      .from('store_settings')
      .select('vendor_id, store_name')
      .order('id')
      .limit(1);
    if (!error && Array.isArray(data) && data.length > 0) {
      cache = {
        vendorId: String(data[0].vendor_id || FALLBACK.vendorId),
        vendorName: String(data[0].store_name || FALLBACK.vendorName),
      };
      return cache;
    }
  } catch {
    // Fall through to the default.
  }
  cache = FALLBACK;
  return cache;
}