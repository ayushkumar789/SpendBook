import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Share,
  Clipboard,
} from 'react-native';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getBook, deleteTransaction, enableSharing, disableSharing, resetShareLink } from '../../lib/supabase';
import { useTransactions } from '../../hooks/useTransactions';
import { Transaction, Book } from '../../constants/types';
import { Colors } from '../../constants/colors';
import { formatCurrency, formatDate, formatDateShort } from '../../lib/format';
import { getCategoryByKey } from '../../constants/categories';
import { getUpiAppByKey } from '../../constants/upiApps';
import { getBankByKey } from '../../constants/banks';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { FAB } from '../../components/ui/FAB';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { SpendingBarChart } from '../../components/charts/SpendingBarChart';
import { CategoryPieChart } from '../../components/charts/CategoryPieChart';
import uuid from 'react-native-uuid';

type FilterType = 'All' | 'Cash In' | 'Cash Out';

function paymentMethodLabel(method: { payment_type: string; bank_name: string; upi_app: string | null; upi_app_name: string | null; upi_app_is_custom: boolean; last_four_digits: string | null } | null): string {
  if (!method) return 'Cash';
  if (method.payment_type === 'UPI') {
    const appName = method.upi_app_is_custom
      ? method.upi_app_name
      : getUpiAppByKey(method.upi_app ?? '')?.name;
    return `${appName ?? 'UPI'} • ${method.bank_name}`;
  }
  return `${method.bank_name}${method.last_four_digits ? ` ••${method.last_four_digits}` : ''}`;
}

function TransactionRow({
  txn,
  onPress,
  onLongPress,
}: {
  txn: Transaction;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const cat = getCategoryByKey(txn.category);
  const isIn = txn.type === 'in';

  return (
    <TouchableOpacity
      style={styles.txnRow}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}
    >
      <View style={[styles.txnIcon, { backgroundColor: isIn ? Colors.cashInBg : Colors.cashOutBg }]}>
        <Ionicons
          name={isIn ? 'arrow-down-outline' : 'arrow-up-outline'}
          size={18}
          color={isIn ? Colors.cashIn : Colors.cashOut}
        />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.txnTopRow}>
          <Text style={styles.txnAmount} numberOfLines={1}>
            {isIn ? '+' : '-'} {formatCurrency(txn.amount)}
          </Text>
          <Text style={styles.txnDate}>{formatDateShort(txn.date)}</Text>
        </View>
        <View style={styles.txnMeta}>
          <View style={styles.catChip}>
            <Text style={styles.catEmoji}>{cat?.emoji ?? '💰'}</Text>
            <Text style={styles.catLabel}>{cat?.label ?? txn.category}</Text>
          </View>
          {txn.note ? (
            <Text style={styles.txnNote} numberOfLines={1}>{txn.note}</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function BookDetailScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [bookLoading, setBookLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('All');
  const [tab, setTab] = useState<'transactions' | 'charts'>('transactions');
  const [shareSheetVisible, setShareSheetVisible] = useState(false);

  const { transactions, loading, cashIn, cashOut, balance } = useTransactions(id ?? null);

  const loadBook = useCallback(async () => {
    if (!id) return;
    const b = await getBook(id);
    setBook(b);
    setBookLoading(false);
    if (b) navigation.setOptions({ title: b.name });
  }, [id]);

  useEffect(() => { loadBook(); }, [loadBook]);

  const filteredTxns = transactions.filter((t) => {
    if (filter === 'Cash In') return t.type === 'in';
    if (filter === 'Cash Out') return t.type === 'out';
    return true;
  });

  async function handleDeleteTxn(txn: Transaction) {
    Alert.alert('Delete Transaction', 'Delete this transaction permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try { await deleteTransaction(txn.id); } catch {
            Alert.alert('Error', 'Failed to delete transaction.');
          }
        },
      },
    ]);
  }

  async function handleShareToggle() {
    if (!book || !id) return;
    if (book.is_shared) {
      setShareSheetVisible(true);
    } else {
      const shareId = uuid.v4() as string;
      try {
        await enableSharing(id, shareId);
        await loadBook();
        setShareSheetVisible(true);
      } catch {
        Alert.alert('Error', 'Failed to enable sharing.');
      }
    }
  }

  async function handleStopSharing() {
    if (!id) return;
    Alert.alert('Stop Sharing', 'The current share link will stop working. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop Sharing',
        style: 'destructive',
        onPress: async () => {
          try {
            await disableSharing(id);
            await loadBook();
            setShareSheetVisible(false);
          } catch {
            Alert.alert('Error', 'Failed to stop sharing.');
          }
        },
      },
    ]);
  }

  async function handleResetLink() {
    if (!id) return;
    Alert.alert('Reset Link', 'The current link will stop working and a new one will be generated.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          const newShareId = uuid.v4() as string;
          try {
            await resetShareLink(id, newShareId);
            await loadBook();
          } catch {
            Alert.alert('Error', 'Failed to reset link.');
          }
        },
      },
    ]);
  }

  function copyShareCode() {
    if (!book?.share_id) return;
    Clipboard.setString(book.share_id);
    Alert.alert('Copied!', 'Share code copied to clipboard.');
  }

  async function shareCode() {
    if (!book?.share_id) return;
    await Share.share({
      message: `Join my SpendBook "${book.name}" with code: ${book.share_id}\n\nOpen SpendBook → Enter Share Code`,
    });
  }

  if (bookLoading) return <LoadingSpinner fullScreen />;
  if (!book) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: Colors.muted }}>Book not found.</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.pageBg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header stats */}
        <View style={[styles.headerCard, { borderTopColor: book.color_tag }]}>
          <View style={styles.headerTop}>
            <Text style={{ fontSize: 32 }}>{book.icon_emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.bookName}>{book.name}</Text>
              {book.description ? <Text style={styles.bookDesc}>{book.description}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => router.push(`/book/edit/${id}`)} style={{ padding: 4 }}>
              <Ionicons name="pencil-outline" size={20} color={Colors.muted} />
            </TouchableOpacity>
          </View>
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: Colors.cashInBg }]}>
              <Text style={[styles.statLabel, { color: Colors.cashInDark }]}>Cash In</Text>
              <Text style={[styles.statVal, { color: Colors.cashIn }]} numberOfLines={1}>{formatCurrency(cashIn)}</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: Colors.cashOutBg }]}>
              <Text style={[styles.statLabel, { color: Colors.cashOutDark }]}>Cash Out</Text>
              <Text style={[styles.statVal, { color: Colors.cashOut }]} numberOfLines={1}>{formatCurrency(cashOut)}</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: Colors.balanceBg }]}>
              <Text style={[styles.statLabel, { color: Colors.balanceDark }]}>Balance</Text>
              <Text style={[styles.statVal, { color: Colors.balance }]} numberOfLines={1}>{formatCurrency(balance)}</Text>
            </View>
          </View>
          {/* Share button */}
          <TouchableOpacity style={styles.shareBtn} onPress={handleShareToggle} activeOpacity={0.8}>
            <Ionicons name={book.is_shared ? 'people' : 'people-outline'} size={16} color={book.is_shared ? Colors.primary : Colors.muted} />
            <Text style={[styles.shareBtnText, { color: book.is_shared ? Colors.primary : Colors.muted }]}>
              {book.is_shared ? 'Shared — Tap to manage' : 'Share this book'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === 'transactions' && styles.tabActive]}
            onPress={() => setTab('transactions')}
          >
            <Text style={[styles.tabText, tab === 'transactions' && styles.tabTextActive]}>Transactions</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'charts' && styles.tabActive]}
            onPress={() => setTab('charts')}
          >
            <Text style={[styles.tabText, tab === 'charts' && styles.tabTextActive]}>Charts</Text>
          </TouchableOpacity>
        </View>

        {tab === 'transactions' ? (
          <>
            {/* Filter */}
            <View style={styles.filterRow}>
              {(['All', 'Cash In', 'Cash Out'] as FilterType[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                  onPress={() => setFilter(f)}
                >
                  <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ paddingHorizontal: 16 }}>
              {loading ? (
                <LoadingSpinner />
              ) : filteredTxns.length === 0 ? (
                <EmptyState
                  emoji="📋"
                  title="No transactions"
                  subtitle="Tap + to add your first transaction"
                />
              ) : (
                filteredTxns.map((t) => (
                  <TransactionRow
                    key={t.id}
                    txn={t}
                    onPress={() => router.push(`/transaction/edit/${t.id}`)}
                    onLongPress={() => handleDeleteTxn(t)}
                  />
                ))
              )}
            </View>
          </>
        ) : (
          <View style={{ padding: 16 }}>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Spending — Last 6 Months</Text>
              <SpendingBarChart transactions={transactions} />
            </View>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Expenses by Category</Text>
              <CategoryPieChart transactions={transactions} />
            </View>
          </View>
        )}
      </ScrollView>

      <FAB onPress={() => router.push({ pathname: '/transaction/add', params: { bookId: id } })} />

      {/* Share Bottom Sheet */}
      <BottomSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        title="Share This Book"
      >
        <View style={{ padding: 20 }}>
          {book.is_shared && book.share_id ? (
            <>
              <Text style={styles.shareCodeLabel}>Share Code</Text>
              <View style={styles.shareCodeBox}>
                <Text style={styles.shareCode}>{book.share_id}</Text>
              </View>
              <TouchableOpacity style={styles.shareAction} onPress={copyShareCode} activeOpacity={0.8}>
                <Ionicons name="copy-outline" size={20} color={Colors.primary} />
                <Text style={styles.shareActionText}>Copy Code</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareAction} onPress={shareCode} activeOpacity={0.8}>
                <Ionicons name="share-social-outline" size={20} color={Colors.primary} />
                <Text style={styles.shareActionText}>Share via…</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareAction} onPress={handleResetLink} activeOpacity={0.8}>
                <Ionicons name="refresh-outline" size={20} color={Colors.cashOut} />
                <Text style={[styles.shareActionText, { color: Colors.cashOut }]}>Reset Link</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.shareAction, { borderTopWidth: 1, borderTopColor: Colors.border }]} onPress={handleStopSharing} activeOpacity={0.8}>
                <Ionicons name="stop-circle-outline" size={20} color={Colors.cashOut} />
                <Text style={[styles.shareActionText, { color: Colors.cashOut }]}>Stop Sharing</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: Colors.card,
    borderTopWidth: 4,
    padding: 16,
    marginBottom: 0,
  },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  bookName: { fontSize: 20, fontWeight: '700', color: Colors.body },
  bookDesc: { fontSize: 13, color: Colors.muted, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statBox: { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  statLabel: { fontSize: 11, fontWeight: '600', marginBottom: 3 },
  statVal: { fontSize: 13, fontWeight: '700' },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  shareBtnText: { fontSize: 13, fontWeight: '500' },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2.5,
    borderBottomColor: Colors.primary,
  },
  tabText: { fontSize: 14, fontWeight: '500', color: Colors.muted },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },
  filterRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: { fontSize: 13, color: Colors.muted, fontWeight: '500' },
  filterTextActive: { color: Colors.white },
  txnRow: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  txnIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  txnAmount: { fontSize: 15, fontWeight: '700', color: Colors.body },
  txnDate: { fontSize: 12, color: Colors.muted },
  txnMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.pageBg,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  catEmoji: { fontSize: 11 },
  catLabel: { fontSize: 11, color: Colors.muted, fontWeight: '500' },
  txnNote: { fontSize: 12, color: Colors.muted, flex: 1 },
  chartCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  chartTitle: { fontSize: 14, fontWeight: '700', color: Colors.body, marginBottom: 14 },
  shareCodeLabel: { fontSize: 12, fontWeight: '600', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  shareCodeBox: {
    backgroundColor: Colors.pageBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  shareCode: { fontSize: 13, color: Colors.body, fontFamily: 'monospace', textAlign: 'center' },
  shareAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  shareActionText: { fontSize: 15, fontWeight: '500', color: Colors.body },
});
