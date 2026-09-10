import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import type { CustomerAddress } from '../types/customer';

const STORAGE_KEY = 'customer_addresses';
const FALLBACK_ADDRESS: CustomerAddress[] = [];

function loadCached(): CustomerAddress[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomerAddress[]) : FALLBACK_ADDRESS;
  } catch {
    return FALLBACK_ADDRESS;
  }
}

function saveCached(addresses: CustomerAddress[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
  } catch {
    /* ignore quota errors */
  }
}

export function useCustomerAddresses() {
  const { session } = useAuth();
  const [addresses, setAddresses] = useState<CustomerAddress[]>(loadCached);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Refresh from Supabase when the session changes (login/logout).
  useEffect(() => {
    const fetchAddresses = async () => {
      if (!session?.customerId) {
        setAddresses(loadCached);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('customer_addresses')
          .select('*')
          .eq('customer_id', session.customerId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const mapped: CustomerAddress[] = data.map((row) => ({
            id: row.id,
            customerId: row.customer_id,
            address: row.address,
            houseNo: row.house_no,
            street: row.street,
            apartment: row.apartment,
            area: row.area,
            city: row.city,
            pincode: row.pincode,
            landmark: row.landmark,
            addressType: (row.address_type as CustomerAddress['addressType']) || 'Apt',
            lat: row.lat ? parseFloat(row.lat as string) : undefined,
            lng: row.lng ? parseFloat(row.lng as string) : undefined,
            createdAt: row.created_at,
          }));
          setAddresses(mapped);
          saveCached(mapped);
        } else {
          // Supabase not reachable / not configured — keep cached list.
          const cached = loadCached().filter((a) => a.customerId === session.customerId);
          if (cached.length === 0) {
            // Seed a demo address so the picker isn't empty while developing.
            setAddresses([
              {
                id: 'demo-1',
                customerId: session.customerId,
                address: '14, Pillayar Koil St, Bhakyalakshmi Nagar, Kannaiamman Nagar',
                houseNo: '14',
                street: 'Pillayar Koil St',
                apartment: '',
                area: 'Bhakyalakshmi Nagar',
                city: '',
                pincode: '',
                landmark: 'Kannaiamman Nagar',
                addressType: 'Apt',
                lat: 13.0550,
                lng: 80.1633,
                createdAt: Date.now(),
              },
            ]);
          }
        }
      } catch {
        setAddresses(loadCached);
      } finally {
        setLoading(false);
      }
    };

    fetchAddresses();
  }, [session?.customerId]);

  const addAddress = useCallback(
    async (address: Omit<CustomerAddress, 'id' | 'customerId' | 'createdAt'>) => {
      if (!session?.customerId) return null;

      const payload: CustomerAddress = {
        ...address,
        id: `addr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        customerId: session.customerId,
        createdAt: Date.now(),
      };

      setSaving(true);
      try {
        const { error } = await supabase.from('customer_addresses').insert({
          id: payload.id,
          customer_id: payload.customerId,
          address: payload.address,
          house_no: payload.houseNo,
          street: payload.street,
          apartment: payload.apartment,
          area: payload.area,
          city: payload.city,
          pincode: payload.pincode,
          landmark: payload.landmark,
          address_type: payload.addressType,
          lat: payload.lat ?? null,
          lng: payload.lng ?? null,
          created_at: payload.createdAt,
        });

        if (!error) {
          setAddresses((prev) => [payload, ...prev]);
          saveCached([payload, ...loadCached().filter((a) => a.id !== payload.id)]);
        }
        return !error ? payload : null;
      } finally {
        setSaving(false);
      }
    },
    [session?.customerId],
  );

  const deleteAddress = useCallback(
    async (id: string) => {
      setSaving(true);
      try {
        const { error } = await supabase
          .from('customer_addresses')
          .delete()
          .eq('id', id);

        if (!error) {
          setAddresses((prev) => {
            const next = prev.filter((a) => a.id !== id);
            saveCached(next);
            return next;
          });
        }
        return !error;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  return { addresses, loading, saving, addAddress, deleteAddress };
}
