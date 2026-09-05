import { useState, useEffect, useCallback, useRef } from 'react';
import type { Order, PaymentStatus } from '../types/payment';
import { getOrder } from '../utils/storage';

interface UseOrderStatusReturn {
  order: Order | null;
  isLoading: boolean;
  refresh: () => void;
}

export function useOrderStatus(orderId: string, pollIntervalMs = 3000): UseOrderStatusReturn {
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastStatusRef = useRef<PaymentStatus | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchOrder = useCallback(async () => {
    const fetchedOrder = await getOrder(orderId);
    if (!mountedRef.current) return fetchedOrder;

    setOrder(fetchedOrder);
    setIsLoading(false);

    if (fetchedOrder) {
      lastStatusRef.current = fetchedOrder.paymentStatus;
    }

    return fetchedOrder;
  }, [orderId]);

  // Initial fetch
  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Polling for status changes
  useEffect(() => {
    const interval = setInterval(async () => {
      const currentOrder = await getOrder(orderId);

      if (currentOrder && lastStatusRef.current !== currentOrder.paymentStatus) {
        // Status changed! Update state
        setOrder(currentOrder);
        lastStatusRef.current = currentOrder.paymentStatus;
      }
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [orderId, pollIntervalMs]);

  const refresh = useCallback(() => {
    fetchOrder();
  }, [fetchOrder]);

  return { order, isLoading, refresh };
}