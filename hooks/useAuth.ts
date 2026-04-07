import { useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, upsertUser } from '../lib/supabase';
import { AppUser } from '../constants/types';

interface AuthState {
  session: Session | null;
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 8-second timeout fallback
    const timeout = setTimeout(() => setLoading(false), 8000);

    // Get initial session
    supabase.auth.getSession().then(async ({ data }) => {
      clearTimeout(timeout);
      const s = data.session;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await syncUser(s.user);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await syncUser(s.user);
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  async function syncUser(user: User): Promise<void> {
    const meta = user.user_metadata;
    const profile: Omit<AppUser, 'created_at'> = {
      id: user.id,
      display_name: meta?.full_name ?? meta?.name ?? user.email?.split('@')[0] ?? 'User',
      email: user.email ?? '',
      photo_url: meta?.avatar_url ?? meta?.picture ?? '',
    };
    await upsertUser(profile).catch(() => {});
    setAppUser({ ...profile, created_at: user.created_at });
  }

  return { session, user, appUser, loading };
}
