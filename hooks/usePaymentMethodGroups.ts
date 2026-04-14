import { useState, useEffect } from 'react';
import { PaymentMethodGroupWithMembers } from '../constants/types';
import { supabase, getGroups } from '../lib/supabase';

export function usePaymentMethodGroups(ownerId: string | null) {
  const [groups, setGroups] = useState<PaymentMethodGroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) {
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    getGroups(ownerId)
      .then((data) => { setGroups(data); setLoading(false); })
      .catch(() => setLoading(false));

    // Re-fetch whenever a group or its members change
    const channel = supabase
      .channel(`payment_method_groups:${ownerId}:${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_method_groups', filter: `owner_id=eq.${ownerId}` },
        async () => {
          const data = await getGroups(ownerId).catch(() => null);
          if (data) setGroups(data);
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_method_group_members' },
        async () => {
          const data = await getGroups(ownerId).catch(() => null);
          if (data) setGroups(data);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ownerId]);

  return { groups, loading };
}
