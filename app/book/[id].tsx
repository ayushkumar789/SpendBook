import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { getBook, deleteTransaction, enableSharing, disableSharing, resetShareLink, resetShareLinkFull, updateTransactionOrders } from '../../lib/supabase';
import { useTransactions } from '../../hooks/useTransactions';
import { usePaymentMethods } from '../../hooks/usePaymentMethods';
import { useTheme } from '../../hooks/useTheme';
import { Transaction, Book, PaymentMethod } from '../../constants/types';
import { AppColors } from '../../constants/colors';
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
import { DraggableList } from '../../components/ui/DraggableList';
import uuid from 'react-native-uuid';

type FilterType = 'All' | 'Cash In' | 'Cash Out';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function monthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}
function dayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

const CONTACT_COLORS = ['#5c2d91', '#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899'];
function getContactColor(name: string): string {
  return CONTACT_COLORS[name.charCodeAt(0) % CONTACT_COLORS.length];
}

function paymentMethodLabel(method: { payment_type: string; bank_name: string; upi_app: string | null; upi_app_name: string | null; upi_app_is_custom: boolean; last_four_digits: string | null } | null): string {
  if (!method) return 'Cash';
  if (method.payment_type === 'UPI') {
    const appName = method.upi_app_is_custom ? method.upi_app_name : getUpiAppByKey(method.upi_app ?? '')?.name;
    const suffix = method.last_four_digits ? ` ••${method.last_four_digits}` : '';
    return `${appName ?? 'UPI'} • ${method.bank_name}${suffix}`;
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
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const cat = getCategoryByKey(txn.category);
  const isIn = txn.type === 'in';

  return (
    <TouchableOpacity style={styles.txnRow} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.75}>
      <View style={[styles.txnIcon, { backgroundColor: isIn ? colors.cashInBg : colors.cashOutBg }]}>
        <Ionicons
          name={isIn ? 'arrow-down-outline' : 'arrow-up-outline'}
          size={18}
          color={isIn ? colors.cashIn : colors.cashOut}
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
          <View style={[styles.catChip, { backgroundColor: colors.pageBg }]}>
            <Text style={styles.catEmoji}>{cat?.emoji ?? '💰'}</Text>
            <Text style={styles.catLabel}>{cat?.label ?? txn.category}</Text>
          </View>
          {txn.note ? <Text style={styles.txnNote} numberOfLines={1}>{txn.note}</Text> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function BookDetailScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [book, setBook] = useState<Book | null>(null);
  const [bookLoading, setBookLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('All');
  /** null = show all methods; '__cash__' = cash only; otherwise a payment_method_id */
  const [methodFilter, setMethodFilter] = useState<string | null>(null);
  const [methodSheetVisible, setMethodSheetVisible] = useState(false);
  const [tab, setTab] = useState<'transactions' | 'charts'>('transactions');
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [txnActionSheet, setTxnActionSheet] = useState<Transaction | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  /** Maps date string "YYYY-MM-DD" → reordered transactions for that day (not yet persisted) */
  const [pendingReorders, setPendingReorders] = useState<Record<string, Transaction[]>>({});

  const { transactions, loading, cashIn, cashOut, balance } = useTransactions(id ?? null);
  const { methods: allMethods } = usePaymentMethods(book?.owner_id ?? null);
  const styles = makeStyles(colors);

  // Unique payment methods actually referenced by this book's transactions
  const usedMethodIds = useMemo(() => {
    const ids = new Set<string>();
    transactions.forEach((t) => {
      if (t.payment_method_id) ids.add(t.payment_method_id);
      if (t.to_payment_method_id) ids.add(t.to_payment_method_id);
    });
    return ids;
  }, [transactions]);

  const usedMethods = useMemo(
    () => allMethods.filter((m) => usedMethodIds.has(m.id)),
    [allMethods, usedMethodIds],
  );

  /** True if any transaction in this book used Cash (no payment method) */
  const hasCashTxns = useMemo(
    () => transactions.some((t) => !t.payment_method_id),
    [transactions],
  );

  /** Human-readable label for the currently active method filter chip */
  const methodFilterLabel = useMemo(() => {
    if (!methodFilter) return 'All Methods';
    if (methodFilter === '__cash__') return 'Cash';
    const m = allMethods.find((x) => x.id === methodFilter);
    return m ? paymentMethodLabel(m) : 'Method';
  }, [methodFilter, allMethods]);

  const loadBook = useCallback(async () => {
    if (!id) return;
    const b = await getBook(id);
    setBook(b);
    setBookLoading(false);
    if (b) navigation.setOptions({ title: b.name });
  }, [id]);

  useEffect(() => { loadBook(); }, [loadBook]);

  const filteredTxns = transactions.filter((t) => {
    const typeOk =
      filter === 'Cash In' ? t.type === 'in' :
      filter === 'Cash Out' ? t.type === 'out' : true;
    const methodOk =
      methodFilter === null ? true :
      methodFilter === '__cash__' ? (!t.payment_method_id && !t.to_payment_method_id) :
      t.payment_method_id === methodFilter || t.to_payment_method_id === methodFilter;
    return typeOk && methodOk;
  });

  // Group filtered transactions into monthly sections, each with date sub-groups
  const monthGroupMap: Record<string, { txns: Transaction[]; monthIn: number; monthOut: number }> = {};
  filteredTxns.forEach((t) => {
    const key = t.date.slice(0, 7); // "2026-04"
    if (!monthGroupMap[key]) monthGroupMap[key] = { txns: [], monthIn: 0, monthOut: 0 };
    monthGroupMap[key].txns.push(t);
    if (t.type === 'in') monthGroupMap[key].monthIn += t.amount;
    else monthGroupMap[key].monthOut += t.amount;
  });
  const monthGroups = Object.entries(monthGroupMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, { txns, monthIn, monthOut }]) => {
      const sorted = [...txns].sort((a, b) => {
        const d = b.date.localeCompare(a.date);
        return d !== 0 ? d : a.order - b.order;
      });
      // Sub-group by date for reorder mode
      const dateMap: Record<string, Transaction[]> = {};
      sorted.forEach((t) => {
        if (!dateMap[t.date]) dateMap[t.date] = [];
        dateMap[t.date].push(t);
      });
      const dateGroups = Object.entries(dateMap)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([date, dateTxns]) => ({ date, txns: dateTxns }));
      return { key, label: monthLabel(key), sorted, dateGroups, monthIn, monthOut };
    });

  async function exitReorderMode() {
    setReorderMode(false);
    const updates: { id: string; order: number }[] = [];
    Object.values(pendingReorders).forEach((reordered) => {
      reordered.forEach((t, i) => updates.push({ id: t.id, order: i }));
    });
    setPendingReorders({});
    if (updates.length > 0) {
      try {
        await updateTransactionOrders(updates);
      } catch {
        Alert.alert('Error', 'Failed to save new order.');
      }
    }
  }

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
      // Use pre-generated codes if present (new books), otherwise generate now (old books)
      const shareId = book.share_id ?? (uuid.v4() as string);
      const shareIdFull = book.share_id_full ?? (uuid.v4() as string);
      try {
        await enableSharing(id, shareId, shareIdFull);
        await loadBook();
        setShareSheetVisible(true);
      } catch {
        Alert.alert('Error', 'Failed to enable sharing.');
      }
    }
  }

  async function handleStopSharing() {
    if (!id) return;
    Alert.alert('Stop Sharing', 'Both share codes will stop working. Continue?', [
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
    Alert.alert('Reset View Only Code', 'The current View Only code will stop working.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          try {
            await resetShareLink(id, uuid.v4() as string);
            await loadBook();
          } catch {
            Alert.alert('Error', 'Failed to reset code.');
          }
        },
      },
    ]);
  }

  async function handleResetLinkFull() {
    if (!id) return;
    Alert.alert('Reset Full Access Code', 'The current Full Access code will stop working.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          try {
            await resetShareLinkFull(id, uuid.v4() as string);
            await loadBook();
          } catch {
            Alert.alert('Error', 'Failed to reset code.');
          }
        },
      },
    ]);
  }

  function copyShareCode() {
    if (!book?.share_id) return;
    Clipboard.setString(book.share_id);
    Alert.alert('Copied!', 'View Only code copied to clipboard.');
  }

  function copyShareCodeFull() {
    if (!book?.share_id_full) return;
    Clipboard.setString(book.share_id_full);
    Alert.alert('Copied!', 'Full Access code copied to clipboard.');
  }

  async function shareCode() {
    if (!book?.share_id) return;
    await Share.share({
      message: `View my SpendBook "${book.name}" (read-only) with code: ${book.share_id}\n\nOpen SpendBook → Enter Share Code`,
    });
  }

  async function shareCodeFull() {
    if (!book?.share_id_full) return;
    await Share.share({
      message: `View my SpendBook "${book.name}" with full detail access.\nCode: ${book.share_id_full}\n\nOpen SpendBook → Enter Share Code`,
    });
  }

  // Top contacts — computed from existing transactions, no extra API call
  const paidToMap: Record<string, number> = {};
  const receivedFromMap: Record<string, number> = {};
  transactions.forEach((t) => {
    const name = t.person.trim();
    if (!name) return;
    if (t.type === 'out' || t.type === 'transfer') {
      paidToMap[name] = (paidToMap[name] ?? 0) + t.amount;
    } else if (t.type === 'in') {
      receivedFromMap[name] = (receivedFromMap[name] ?? 0) + t.amount;
    }
  });
  const topPaidTo = Object.entries(paidToMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topReceivedFrom = Object.entries(receivedFromMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const hasContactData = topPaidTo.length > 0 || topReceivedFrom.length > 0;

  if (bookLoading) return <LoadingSpinner fullScreen />;
  if (!book) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pageBg }}>
      <Text style={{ color: colors.muted }}>Book not found.</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header stats */}
        <View style={[styles.headerCard, { borderTopColor: book.color_tag }]}>
          <View style={styles.headerTop}>
            <Text style={{ fontSize: 32 }}>{book.icon_emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.bookName}>{book.name}</Text>
              {book.description ? <Text style={styles.bookDesc}>{book.description}</Text> : null}
            </View>
            {tab === 'transactions' && (
              <TouchableOpacity
                onPress={reorderMode ? exitReorderMode : () => setReorderMode(true)}
                style={{ padding: 4, marginRight: 4 }}
              >
                <Ionicons
                  name={reorderMode ? 'checkmark-done-outline' : 'swap-vertical-outline'}
                  size={20}
                  color={reorderMode ? colors.cashIn : colors.muted}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => router.push(`/book/edit/${id}`)} style={{ padding: 4 }}>
              <Ionicons name="pencil-outline" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: colors.cashInBg }]}>
              <Text style={[styles.statLabel, { color: colors.cashInDark }]}>Cash In</Text>
              <Text style={[styles.statVal, { color: colors.cashIn }]} numberOfLines={1}>{formatCurrency(cashIn)}</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.cashOutBg }]}>
              <Text style={[styles.statLabel, { color: colors.cashOutDark }]}>Cash Out</Text>
              <Text style={[styles.statVal, { color: colors.cashOut }]} numberOfLines={1}>{formatCurrency(cashOut)}</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.balanceBg }]}>
              <Text style={[styles.statLabel, { color: colors.balanceDark }]}>Balance</Text>
              <Text style={[styles.statVal, { color: colors.balance }]} numberOfLines={1}>{formatCurrency(balance)}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShareToggle} activeOpacity={0.8}>
            <Ionicons name={book.is_shared ? 'people' : 'people-outline'} size={16} color={book.is_shared ? colors.primary : colors.muted} />
            <Text style={[styles.shareBtnText, { color: book.is_shared ? colors.primary : colors.muted }]}>
              {book.is_shared ? 'Shared — Tap to manage' : 'Share this book'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, tab === 'transactions' && styles.tabActive]} onPress={() => setTab('transactions')}>
            <Text style={[styles.tabText, tab === 'transactions' && styles.tabTextActive]}>Transactions</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'charts' && styles.tabActive]} onPress={() => { if (reorderMode) exitReorderMode(); setTab('charts'); }}>
            <Text style={[styles.tabText, tab === 'charts' && styles.tabTextActive]}>Charts</Text>
          </TouchableOpacity>
        </View>

        {tab === 'transactions' ? (
          <>
            {reorderMode ? (
              <View style={styles.reorderBanner}>
                <Ionicons name="swap-vertical-outline" size={14} color={colors.primary} />
                <Text style={styles.reorderBannerText}>
                  Drag the handle to reorder within a day. Tap ✓ to save.
                </Text>
              </View>
            ) : (
              <>
                {/* Type filter */}
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

                {/* Method filter chip — only when this book has named payment methods */}
                {(usedMethods.length > 0 || hasCashTxns) && (
                  <View style={styles.methodFilterRow}>
                    <TouchableOpacity
                      style={[styles.methodChip, methodFilter !== null && styles.methodChipActive]}
                      onPress={() => setMethodSheetVisible(true)}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name="card-outline"
                        size={13}
                        color={methodFilter !== null ? colors.primary : colors.muted}
                      />
                      <Text
                        style={[styles.methodChipText, methodFilter !== null && styles.methodChipTextActive]}
                        numberOfLines={1}
                      >
                        {methodFilterLabel}
                      </Text>
                      {methodFilter !== null ? (
                        <TouchableOpacity
                          onPress={() => setMethodFilter(null)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="close-circle" size={15} color={colors.primary} />
                        </TouchableOpacity>
                      ) : (
                        <Ionicons name="chevron-down" size={13} color={colors.muted} />
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
            <View style={{ paddingHorizontal: 16 }}>
              {loading ? (
                <LoadingSpinner />
              ) : monthGroups.length === 0 ? (
                <EmptyState emoji="📋" title="No transactions" subtitle="Tap + to add your first transaction" />
              ) : (
                monthGroups.map(({ key, label, sorted, dateGroups, monthIn, monthOut }) => (
                  <View key={key}>
                    <View style={styles.monthHeader}>
                      <Text style={styles.monthLabel}>{label}</Text>
                      <View style={styles.monthSummary}>
                        {filter !== 'Cash Out' && (
                          <Text style={styles.monthIn}>+{formatCurrency(monthIn)}</Text>
                        )}
                        {filter !== 'Cash In' && (
                          <Text style={styles.monthOut}>-{formatCurrency(monthOut)}</Text>
                        )}
                      </View>
                    </View>

                    {reorderMode ? (
                      // Reorder mode: day sub-groups with drag handles
                      dateGroups.map(({ date, txns: dateTxns }) => (
                        <View key={date}>
                          <View style={styles.dayHeader}>
                            <Text style={styles.dayLabel}>{dayLabel(date)}</Text>
                          </View>
                          <DraggableList
                            items={pendingReorders[date] ?? dateTxns}
                            keyExtractor={(t) => t.id}
                            renderItem={(t) => (
                              <TransactionRow
                                txn={t}
                                onPress={() => {}}
                                onLongPress={() => {}}
                              />
                            )}
                            onReorder={(reordered) =>
                              setPendingReorders((prev) => ({ ...prev, [date]: reordered }))
                            }
                            enabled={dateTxns.length > 1}
                            itemGap={8}
                          />
                        </View>
                      ))
                    ) : (
                      // Normal mode: flat list within month
                      sorted.map((t) => (
                        <TransactionRow
                          key={t.id}
                          txn={t}
                          onPress={() => router.push(`/transaction/${t.id}`)}
                          onLongPress={() => setTxnActionSheet(t)}
                        />
                      ))
                    )}
                  </View>
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
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Top Contacts</Text>
              {!hasContactData ? (
                <Text style={styles.contactEmpty}>No contact data yet</Text>
              ) : (
                <>
                  {topPaidTo.length > 0 && (
                    <>
                      <Text style={styles.contactSectionLabel}>Paid To</Text>
                      {topPaidTo.map(([name, amount]) => (
                        <View key={name} style={styles.contactRow}>
                          <View style={[styles.contactCircle, { backgroundColor: getContactColor(name) }]}>
                            <Text style={styles.contactInitial}>{name[0].toUpperCase()}</Text>
                          </View>
                          <Text style={styles.contactName} numberOfLines={1}>{name}</Text>
                          <Text style={styles.contactAmount}>- {formatCurrency(amount)}</Text>
                        </View>
                      ))}
                    </>
                  )}
                  {topReceivedFrom.length > 0 && (
                    <>
                      <Text style={[styles.contactSectionLabel, topPaidTo.length > 0 && { marginTop: 14 }]}>Received From</Text>
                      {topReceivedFrom.map(([name, amount]) => (
                        <View key={name} style={styles.contactRow}>
                          <View style={[styles.contactCircle, { backgroundColor: getContactColor(name) }]}>
                            <Text style={styles.contactInitial}>{name[0].toUpperCase()}</Text>
                          </View>
                          <Text style={styles.contactName} numberOfLines={1}>{name}</Text>
                          <Text style={[styles.contactAmount, { color: colors.cashIn }]}>+ {formatCurrency(amount)}</Text>
                        </View>
                      ))}
                    </>
                  )}
                </>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <FAB onPress={() => router.push({ pathname: '/transaction/add', params: { bookId: id } })} />

      {/* ── Method filter picker ─────────────────────────────── */}
      <BottomSheet visible={methodSheetVisible} onClose={() => setMethodSheetVisible(false)} title="Filter by Payment Method">
        {/* Clear row */}
        {methodFilter !== null && (
          <TouchableOpacity
            style={[styles.pmRow, { borderTopWidth: 0 }]}
            onPress={() => { setMethodFilter(null); setMethodSheetVisible(false); }}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle-outline" size={20} color={colors.cashOut} />
            <Text style={[styles.pmRowLabel, { color: colors.cashOut, flex: 1 }]}>Clear filter — show all methods</Text>
          </TouchableOpacity>
        )}

        {/* Cash option */}
        {hasCashTxns && (
          <TouchableOpacity
            style={[styles.pmRow, methodFilter !== null && { borderTopWidth: 0.5, borderTopColor: colors.border }]}
            onPress={() => { setMethodFilter('__cash__'); setMethodSheetVisible(false); }}
            activeOpacity={0.8}
          >
            <Ionicons name="cash-outline" size={20} color={colors.muted} />
            <Text style={[styles.pmRowLabel, { flex: 1 }]}>Cash</Text>
            {methodFilter === '__cash__' && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
          </TouchableOpacity>
        )}

        {/* Named payment methods */}
        {usedMethods.map((m, idx) => (
          <TouchableOpacity
            key={m.id}
            style={[
              styles.pmRow,
              (hasCashTxns || idx > 0 || methodFilter !== null) && { borderTopWidth: 0.5, borderTopColor: colors.border },
            ]}
            onPress={() => { setMethodFilter(m.id); setMethodSheetVisible(false); }}
            activeOpacity={0.8}
          >
            <View style={styles.pmMethodIcon}>
              <Ionicons
                name={m.payment_type === 'UPI' ? 'phone-portrait-outline' : 'card-outline'}
                size={16}
                color={colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pmRowLabel} numberOfLines={1}>{paymentMethodLabel(m)}</Text>
              <Text style={styles.pmRowSub}>{m.payment_type}</Text>
            </View>
            {methodFilter === m.id && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
          </TouchableOpacity>
        ))}
      </BottomSheet>

      {/* ── Transaction action sheet ──────────────────────────── */}
      <BottomSheet visible={txnActionSheet !== null} onClose={() => setTxnActionSheet(null)} title="Transaction Options">
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => {
            const txn = txnActionSheet;
            setTxnActionSheet(null);
            if (txn) router.push(`/transaction/edit/${txn.id}`);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="pencil-outline" size={20} color={colors.body} />
          <Text style={styles.actionText}>Edit Transaction</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => {
            const txn = txnActionSheet;
            setTxnActionSheet(null);
            if (txn) handleDeleteTxn(txn);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="trash-outline" size={20} color={colors.cashOut} />
          <Text style={[styles.actionText, { color: colors.cashOut }]}>Delete Transaction</Text>
        </TouchableOpacity>
      </BottomSheet>

      <BottomSheet visible={shareSheetVisible} onClose={() => setShareSheetVisible(false)} title="Share This Book">
        {book.is_shared && book.share_id && book.share_id_full ? (
          <View style={{ paddingBottom: 8 }}>

            {/* ── View Only section ──────────────────────────── */}
            <View style={styles.shareSection}>
              <View style={styles.shareSectionHeader}>
                <View style={[styles.shareLevelBadge, { backgroundColor: colors.balanceBg }]}>
                  <Ionicons name="eye-outline" size={12} color={colors.balance} />
                  <Text style={[styles.shareLevelBadgeText, { color: colors.balance }]}>VIEW ONLY</Text>
                </View>
                <Text style={styles.shareSectionDesc}>Transaction list &amp; charts · no detail tap</Text>
              </View>
              <View style={styles.shareCodeBox}>
                <Text style={styles.shareCode} numberOfLines={1}>{book.share_id}</Text>
              </View>
              <View style={styles.shareActionsRow}>
                <TouchableOpacity style={styles.shareActionBtn} onPress={copyShareCode} activeOpacity={0.8}>
                  <Ionicons name="copy-outline" size={16} color={colors.primary} />
                  <Text style={styles.shareActionBtnText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareActionBtn} onPress={shareCode} activeOpacity={0.8}>
                  <Ionicons name="share-social-outline" size={16} color={colors.primary} />
                  <Text style={styles.shareActionBtnText}>Share via…</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareActionBtn} onPress={handleResetLink} activeOpacity={0.8}>
                  <Ionicons name="refresh-outline" size={16} color={colors.cashOut} />
                  <Text style={[styles.shareActionBtnText, { color: colors.cashOut }]}>Reset</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Full Access section ────────────────────────── */}
            <View style={[styles.shareSection, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <View style={styles.shareSectionHeader}>
                <View style={[styles.shareLevelBadge, { backgroundColor: '#ede9fe' }]}>
                  <Ionicons name="layers-outline" size={12} color={colors.primary} />
                  <Text style={[styles.shareLevelBadgeText, { color: colors.primary }]}>FULL ACCESS</Text>
                </View>
                <Text style={styles.shareSectionDesc}>Transaction list, charts &amp; full detail tap</Text>
              </View>
              <View style={styles.shareCodeBox}>
                <Text style={styles.shareCode} numberOfLines={1}>{book.share_id_full}</Text>
              </View>
              <View style={styles.shareActionsRow}>
                <TouchableOpacity style={styles.shareActionBtn} onPress={copyShareCodeFull} activeOpacity={0.8}>
                  <Ionicons name="copy-outline" size={16} color={colors.primary} />
                  <Text style={styles.shareActionBtnText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareActionBtn} onPress={shareCodeFull} activeOpacity={0.8}>
                  <Ionicons name="share-social-outline" size={16} color={colors.primary} />
                  <Text style={styles.shareActionBtnText}>Share via…</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareActionBtn} onPress={handleResetLinkFull} activeOpacity={0.8}>
                  <Ionicons name="refresh-outline" size={16} color={colors.cashOut} />
                  <Text style={[styles.shareActionBtnText, { color: colors.cashOut }]}>Reset</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Stop Sharing ───────────────────────────────── */}
            <TouchableOpacity
              style={[styles.shareAction, { marginHorizontal: 20, borderTopWidth: 1, borderTopColor: colors.border }]}
              onPress={handleStopSharing}
              activeOpacity={0.8}
            >
              <Ionicons name="stop-circle-outline" size={20} color={colors.cashOut} />
              <Text style={[styles.shareActionText, { color: colors.cashOut }]}>Stop Sharing</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const makeStyles = (C: AppColors) => StyleSheet.create({
  headerCard: { backgroundColor: C.card, borderTopWidth: 4, padding: 16, marginBottom: 0 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  bookName: { fontSize: 20, fontWeight: '700', color: C.body },
  bookDesc: { fontSize: 13, color: C.muted, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statBox: { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  statLabel: { fontSize: 11, fontWeight: '600', marginBottom: 3 },
  statVal: { fontSize: 13, fontWeight: '700' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: C.border },
  shareBtnText: { fontSize: 13, fontWeight: '500' },
  tabRow: { flexDirection: 'row', backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2.5, borderBottomColor: C.primary },
  tabText: { fontSize: 14, fontWeight: '500', color: C.muted },
  tabTextActive: { color: C.primary, fontWeight: '700' },
  filterRow: { flexDirection: 'row', padding: 12, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  filterBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  filterText: { fontSize: 13, color: C.muted, fontWeight: '500' },
  filterTextActive: { color: C.white },
  txnRow: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  txnIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txnTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  txnAmount: { fontSize: 15, fontWeight: '700', color: C.body },
  txnDate: { fontSize: 12, color: C.muted },
  txnMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  catEmoji: { fontSize: 11 },
  catLabel: { fontSize: 11, color: C.muted, fontWeight: '500' },
  txnNote: { fontSize: 12, color: C.muted, flex: 1 },
  chartCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: C.border },
  chartTitle: { fontSize: 14, fontWeight: '700', color: C.body, marginBottom: 14 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, marginTop: 6 },
  monthLabel: { fontSize: 13, fontWeight: '700', color: C.body },
  monthSummary: { flexDirection: 'row', gap: 8 },
  monthIn: { fontSize: 12, fontWeight: '600', color: C.cashIn },
  monthOut: { fontSize: 12, fontWeight: '600', color: C.cashOut },
  reorderBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#ede9fe' },
  reorderBannerText: { fontSize: 12, color: C.primary, fontWeight: '500', flex: 1 },
  dayHeader: { paddingVertical: 6, paddingHorizontal: 2, marginTop: 4 },
  dayLabel: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  contactEmpty: { fontSize: 13, color: C.muted, textAlign: 'center', paddingVertical: 12 },
  contactSectionLabel: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  contactCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  contactInitial: { fontSize: 14, fontWeight: '700', color: '#fff' },
  contactName: { flex: 1, fontSize: 14, fontWeight: '500', color: C.body },
  contactAmount: { fontSize: 14, fontWeight: '700', color: C.cashOut },
  // Method filter chip
  methodFilterRow: { paddingHorizontal: 12, paddingBottom: 10, flexDirection: 'row' },
  methodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    maxWidth: 260,
  },
  methodChipActive: { backgroundColor: C.primary + '12', borderColor: C.primary },
  methodChipText: { fontSize: 13, color: C.muted, fontWeight: '500', flexShrink: 1 },
  methodChipTextActive: { color: C.primary, fontWeight: '600' },
  // Method picker sheet rows
  pmRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 20 },
  pmRowLabel: { fontSize: 14, color: C.body, fontWeight: '500' },
  pmRowSub: { fontSize: 11, color: C.muted, marginTop: 1 },
  pmMethodIcon: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: C.primary + '12',
    alignItems: 'center', justifyContent: 'center',
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20, borderTopWidth: 0.5, borderTopColor: C.border },
  actionText: { fontSize: 16, fontWeight: '500', color: C.body },
  // Share sheet — two-section layout
  shareSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  shareSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  shareLevelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  shareLevelBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  shareSectionDesc: { fontSize: 12, color: C.muted, flex: 1 },
  shareCodeBox: { backgroundColor: C.pageBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  shareCode: { fontSize: 12, color: C.body, fontFamily: 'monospace', textAlign: 'center' },
  shareActionsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  shareActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10, backgroundColor: C.pageBg, borderWidth: 1, borderColor: C.border },
  shareActionBtnText: { fontSize: 12, fontWeight: '600', color: C.primary },
  shareAction: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 0.5, borderTopColor: C.border },
  shareActionText: { fontSize: 15, fontWeight: '500', color: C.body },
});
