import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
import { AppUser, Book, PaymentMethod, Transaction } from '../constants/types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage as Parameters<typeof createClient>[2]['auth']['storage'],
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<void> {
  const redirectUrl = makeRedirectUri({ scheme: 'spendbook', path: 'auth/callback' });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned');

  WebBrowser.maybeCompleteAuthSession();
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

  if (result.type === 'success' && result.url) {
    await handleOAuthCallback(result.url);
  }
}

async function handleOAuthCallback(url: string): Promise<void> {
  // Try PKCE code exchange first
  const parsed = Linking.parse(url);
  const code = parsed.queryParams?.code as string | undefined;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }
  // Fallback: hash-based implicit tokens
  const hash = url.split('#')[1] ?? '';
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken ?? '',
    });
    if (error) throw error;
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function getCurrentSession() {
  return supabase.auth.getSession();
}

// ─── USERS ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: Omit<AppUser, 'created_at'>): Promise<void> {
  const { error } = await supabase.from('users').upsert(
    {
      id: user.id,
      display_name: user.display_name,
      email: user.email,
      photo_url: user.photo_url,
    },
    { onConflict: 'id' }
  );
  if (error) throw error;
}

export async function getUser(id: string): Promise<AppUser | null> {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
  if (error) return null;
  return data as AppUser;
}

// ─── PAYMENT METHODS ─────────────────────────────────────────────────────────

export async function getPaymentMethods(ownerId: string): Promise<PaymentMethod[]> {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PaymentMethod[];
}

export async function addPaymentMethod(
  method: Omit<PaymentMethod, 'id' | 'created_at'>
): Promise<PaymentMethod> {
  const { data, error } = await supabase
    .from('payment_methods')
    .insert(method)
    .select()
    .single();
  if (error) throw error;
  return data as PaymentMethod;
}

export async function deletePaymentMethod(id: string): Promise<void> {
  const { error } = await supabase.from('payment_methods').delete().eq('id', id);
  if (error) throw error;
}

export function subscribeToPaymentMethods(
  ownerId: string,
  callback: (methods: PaymentMethod[]) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`payment_methods:${ownerId}:${Date.now()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'payment_methods', filter: `owner_id=eq.${ownerId}` },
      async () => {
        const methods = await getPaymentMethods(ownerId);
        callback(methods);
      }
    )
    .subscribe();
  return channel;
}

// ─── BOOKS ────────────────────────────────────────────────────────────────────

export async function getBooks(ownerId: string): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Book[];
}

export async function getBook(id: string): Promise<Book | null> {
  const { data, error } = await supabase.from('books').select('*').eq('id', id).single();
  if (error) return null;
  return data as Book;
}

export async function getBookByShareId(shareId: string): Promise<Book | null> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('share_id', shareId)
    .eq('is_shared', true)
    .single();
  if (error) return null;
  return data as Book;
}

export async function createBook(book: Omit<Book, 'id' | 'created_at'>): Promise<Book> {
  const { data, error } = await supabase.from('books').insert(book).select().single();
  if (error) throw error;
  return data as Book;
}

export async function updateBook(id: string, updates: Partial<Book>): Promise<void> {
  const { error } = await supabase.from('books').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteBook(id: string): Promise<void> {
  // Delete all transactions first
  await supabase.from('transactions').delete().eq('book_id', id);
  const { error } = await supabase.from('books').delete().eq('id', id);
  if (error) throw error;
}

export async function enableSharing(bookId: string, shareId: string): Promise<void> {
  const { error } = await supabase
    .from('books')
    .update({ is_shared: true, share_id: shareId })
    .eq('id', bookId);
  if (error) throw error;
}

export async function disableSharing(bookId: string): Promise<void> {
  const { error } = await supabase
    .from('books')
    .update({ is_shared: false, share_id: null })
    .eq('id', bookId);
  if (error) throw error;
}

export async function resetShareLink(bookId: string, newShareId: string): Promise<void> {
  const { error } = await supabase
    .from('books')
    .update({ share_id: newShareId })
    .eq('id', bookId);
  if (error) throw error;
}

export function subscribeToBooks(
  ownerId: string,
  callback: (books: Book[]) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`books:${ownerId}:${Date.now()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'books', filter: `owner_id=eq.${ownerId}` },
      async () => {
        const books = await getBooks(ownerId);
        callback(books);
      }
    )
    .subscribe();
  return channel;
}

export function subscribeToSharedBook(
  shareId: string,
  callback: (book: Book | null) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`shared_book:${shareId}:${Date.now()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'books' },
      async () => {
        const book = await getBookByShareId(shareId);
        callback(book);
      }
    )
    .subscribe();
  return channel;
}

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

export async function getTransactions(bookId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('book_id', bookId)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Transaction[];
}

export async function addTransaction(
  transaction: Omit<Transaction, 'id' | 'created_at'>
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert(transaction)
    .select()
    .single();
  if (error) throw error;
  return data as Transaction;
}

export async function updateTransaction(
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'created_at'>>
): Promise<void> {
  const { error } = await supabase.from('transactions').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
}

export function subscribeToTransactions(
  bookId: string,
  callback: (transactions: Transaction[]) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`transactions:${bookId}:${Date.now()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions', filter: `book_id=eq.${bookId}` },
      async () => {
        const txns = await getTransactions(bookId);
        callback(txns);
      }
    )
    .subscribe();
  return channel;
}
