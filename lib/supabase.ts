import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
import { AppUser, Book, PaymentMethod, PaymentMethodGroup, PaymentMethodGroupWithMembers, Transaction } from '../constants/types';

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

export async function updatePaymentMethod(
  id: string,
  updates: Partial<Omit<PaymentMethod, 'id' | 'created_at' | 'owner_id'>>
): Promise<void> {
  const { error } = await supabase.from('payment_methods').update(updates).eq('id', id);
  if (error) throw error;
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

// ─── PAYMENT METHOD GROUPS ────────────────────────────────────────────────────

export async function getGroups(ownerId: string): Promise<PaymentMethodGroupWithMembers[]> {
  const { data, error } = await supabase
    .from('payment_method_groups')
    .select('*, payment_method_group_members(payment_method_id)')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((g: any) => ({
    id: g.id,
    owner_id: g.owner_id,
    name: g.name,
    color: g.color,
    created_at: g.created_at,
    member_ids: (g.payment_method_group_members ?? []).map((m: any) => m.payment_method_id as string),
  }));
}

export async function createGroup(
  group: Omit<PaymentMethodGroup, 'id' | 'created_at'>,
  memberIds: string[],
): Promise<void> {
  const { data, error } = await supabase
    .from('payment_method_groups')
    .insert(group)
    .select('id')
    .single();
  if (error) throw error;
  if (memberIds.length > 0) {
    const members = memberIds.map((pmId) => ({ group_id: data.id, payment_method_id: pmId }));
    const { error: membersError } = await supabase
      .from('payment_method_group_members')
      .insert(members);
    if (membersError) throw membersError;
  }
}

export async function deleteGroup(id: string): Promise<void> {
  const { error } = await supabase.from('payment_method_groups').delete().eq('id', id);
  if (error) throw error;
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

/**
 * Looks up a book by either share code.
 * Returns the book plus which access level the code grants:
 *   'view'  — matched share_id       (transaction list + charts only)
 *   'full'  — matched share_id_full  (+ transaction detail tap)
 */
export async function getBookByAnyShareId(
  shareId: string,
): Promise<{ book: Book; accessLevel: 'view' | 'full' } | null> {
  // Try view-only code first
  const { data: viewData } = await supabase
    .from('books')
    .select('*')
    .eq('share_id', shareId)
    .eq('is_shared', true)
    .single();
  if (viewData) return { book: viewData as Book, accessLevel: 'view' };

  // Try full-access code
  const { data: fullData } = await supabase
    .from('books')
    .select('*')
    .eq('share_id_full', shareId)
    .eq('is_shared', true)
    .single();
  if (fullData) return { book: fullData as Book, accessLevel: 'full' };

  return null;
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

export async function enableSharing(
  bookId: string,
  shareId: string,
  shareIdFull: string,
): Promise<void> {
  const { error } = await supabase
    .from('books')
    .update({ is_shared: true, share_id: shareId, share_id_full: shareIdFull })
    .eq('id', bookId);
  if (error) throw error;
}

export async function disableSharing(bookId: string): Promise<void> {
  const { error } = await supabase
    .from('books')
    .update({ is_shared: false, share_id: null, share_id_full: null })
    .eq('id', bookId);
  if (error) throw error;
}

/** Reset the view-only share code only. */
export async function resetShareLink(bookId: string, newShareId: string): Promise<void> {
  const { error } = await supabase
    .from('books')
    .update({ share_id: newShareId })
    .eq('id', bookId);
  if (error) throw error;
}

/** Reset the full-access share code only. */
export async function resetShareLinkFull(bookId: string, newShareIdFull: string): Promise<void> {
  const { error } = await supabase
    .from('books')
    .update({ share_id_full: newShareIdFull })
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
        const result = await getBookByAnyShareId(shareId);
        callback(result?.book ?? null);
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
    .order('date', { ascending: false })
    .order('order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Transaction[];
}

export async function updateTransactionOrders(updates: { id: string; order: number }[]): Promise<void> {
  await Promise.all(
    updates.map(({ id, order }) =>
      supabase.from('transactions').update({ order }).eq('id', id)
    )
  );
}

export async function addTransaction(
  transaction: Omit<Transaction, 'id' | 'created_at'>
): Promise<Transaction> {
  const payload = {
    book_id:              transaction.book_id,
    owner_id:             transaction.owner_id,
    type:                 transaction.type,
    amount:               transaction.amount,
    category:             transaction.category,
    payment_method_id:    transaction.payment_method_id,
    to_payment_method_id: transaction.to_payment_method_id,
    person:               transaction.person,
    note:                 transaction.note,
    date:                 transaction.date,
  };
  const { data, error } = await supabase
    .from('transactions')
    .insert(payload)
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
