import type { SupabaseClient } from '@supabase/supabase-js';

export interface StoreSettings {
  vendorId: string;
  storeName: string;
  currency: string;
  supportContact: string;
}

/** Used only when the store_settings table is unreachable or empty. */
export const FALLBACK_STORE: StoreSettings = {
  vendorId: 'VENDOR001',
  storeName: 'OORUNII Store',
  currency: 'INR',
  supportContact: '',
};

/**
 * Load the active store settings (first row) from the store_settings
 * table. Changing the store name / vendor id / support contact there
 * takes effect on the next message — no code changes or redeploys.
 */
export async function fetchStoreSettings(
  supabase: SupabaseClient
): Promise<StoreSettings> {
  try {
    const { data, error } = await supabase
      .from('store_settings')
      .select('vendor_id, store_name, currency, support_contact')
      .order('id')
      .limit(1);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : undefined;
    if (row) {
      return {
        vendorId: String((row as { vendor_id?: string }).vendor_id || FALLBACK_STORE.vendorId),
        storeName: String((row as { store_name?: string }).store_name || FALLBACK_STORE.storeName),
        currency: String((row as { currency?: string }).currency || FALLBACK_STORE.currency),
        supportContact: String((row as { support_contact?: string }).support_contact || ''),
      };
    }
  } catch {
    // Fall through to defaults.
  }
  return FALLBACK_STORE;
}

export interface Faq {
  question: string;
  answer: string;
  keywords: string[];
}

/**
 * Load the knowledge base from the faqs table. Every FAQ added there is
 * answered by the bot on the next message — no code changes.
 */
export async function fetchFaqs(supabase: SupabaseClient): Promise<Faq[]> {
  try {
    const { data, error } = await supabase
      .from('faqs')
      .select('question, answer, keywords')
      .order('sort_order')
      .order('id');
    if (error) throw error;
    if (Array.isArray(data) && data.length > 0) {
      return data.map((r) => ({
        question: String((r as { question: string }).question),
        answer: String((r as { answer: string }).answer),
        keywords: Array.isArray((r as { keywords: unknown }).keywords)
          ? ((r as { keywords: string[] }).keywords as string[]).map(String)
          : [],
      }));
    }
  } catch {
    // Fall through to empty list.
  }
  return [];
}