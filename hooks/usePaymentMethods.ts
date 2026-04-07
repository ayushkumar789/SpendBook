import { useState, useEffect } from 'react';
import { PaymentMethod } from '../constants/types';
import { getPaymentMethods, subscribeToPaymentMethods } from '../lib/supabase';

export function usePaymentMethods(ownerId: string | null) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId) {
      setMethods([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    getPaymentMethods(ownerId)
      .then((data) => {
        setMethods(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });

    const channel = subscribeToPaymentMethods(ownerId, (data) => {
      setMethods(data);
    });

    return () => {
      channel.unsubscribe();
    };
  }, [ownerId]);

  const grouped = {
    UPI: methods.filter((m) => m.payment_type === 'UPI'),
    Debit: methods.filter((m) => m.payment_type === 'Debit'),
    Credit: methods.filter((m) => m.payment_type === 'Credit'),
    'Net Banking': methods.filter((m) => m.payment_type === 'Net Banking'),
  };

  return { methods, grouped, loading, error };
}
