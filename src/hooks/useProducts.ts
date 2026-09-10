import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type Product = {
  id: string | number;
  name: string;
  price: number;
  unit: string;
  image: string;
  description?: string;
  status?: string;
};

export const DEFAULT_PRODUCTS: Product[] = [
  { id: 1, name: 'Aquafina', price: 20.00, unit: 'PACK (LITER)', image: '💧', description: 'Standard packaged mineral water bottle (1L)', status: 'Active' },
  { id: 2, name: 'Bisleri', price: 40.00, unit: 'CAN (LITER)', image: '🧊', description: 'Compact 20 litre drinking water can', status: 'Active' },
  { id: 3, name: 'Kinley', price: 25.00, unit: 'PACK (LITER)', image: '💧', description: 'Purified packaged drinking water', status: 'Active' },
];

export function useProducts() {
  const [products, setProducts] = useState<Product[]>(DEFAULT_PRODUCTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('products')
      .select('*')
      .order('id')
      .then(({ data, error }) => {
        if (!cancelled) {
          if (!error && data && data.length > 0) {
            setProducts(data.map(p => ({
              id: p.id,
              name: p.name,
              price: p.price ?? 20,
              unit: p.unit || 'PACK (LITER)',
              image: p.image || '💧',
              description: p.description || `${p.unit || 'PACK'} - ₹${p.price ?? 20}`,
              status: p.status || 'Active',
            })));
          }
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { products, loading };
}
