import { useEffect, useState } from 'react';
import { getCustomers, subscribeToCustomers } from '../utils/customers';
import type { Customer } from '../types/payment';

/**
 * Live customer list straight from the Supabase `customers` table.
 *
 * - Loads once on mount, then stays in sync in real time via Postgres
 *   change subscriptions — any change made in the dashboard, another tab
 *   or another device updates every session within milliseconds.
 * - Falls back to the built-in demo accounts until the table exists.
 */
export function useCustomers(): { customers: Customer[]; loading: boolean } {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Initial load.
    getCustomers().then((list) => {
      if (!cancelled) {
        setCustomers(list);
        setLoading(false);
      }
    });

    // Real-time updates: apply each event incrementally.
    const unsubscribe = subscribeToCustomers((event, customer) => {
      if (cancelled) return;
      setCustomers((prev) => {
        const without = prev.filter((c) => c.id !== customer.id);
        if (event === 'DELETE') {
          return without;
        }
        const next = [...without, customer].sort((a, b) => a.id.localeCompare(b.id));
        return next;
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { customers, loading };
}
