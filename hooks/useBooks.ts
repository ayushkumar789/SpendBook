import { useState, useEffect } from 'react';
import { Book } from '../constants/types';
import { supabase, getBooks, subscribeToBooks } from '../lib/supabase';

export function useBooks(ownerId: string | null) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId) {
      setBooks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    getBooks(ownerId)
      .then((data) => {
        setBooks(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });

    const channel = subscribeToBooks(ownerId, (data) => {
      setBooks(data);
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ownerId]);

  return { books, loading, error };
}
