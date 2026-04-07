import { useState, useEffect } from 'react';
import { Transaction } from '../constants/types';
import { supabase, getTransactions, subscribeToTransactions } from '../lib/supabase';

export function useTransactions(bookId: string | null) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    getTransactions(bookId)
      .then((data) => {
        setTransactions(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });

    const channel = subscribeToTransactions(bookId, (data) => {
      setTransactions(data);
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookId]);

  const cashIn = transactions
    .filter((t) => t.type === 'in')
    .reduce((sum, t) => sum + t.amount, 0);
  const cashOut = transactions
    .filter((t) => t.type === 'out')
    .reduce((sum, t) => sum + t.amount, 0);
  const balance = cashIn - cashOut;

  return { transactions, loading, error, cashIn, cashOut, balance };
}
