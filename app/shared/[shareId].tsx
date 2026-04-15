import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getBookByAnyShareId,
  getTransactions,
  getUser,
  getPaymentMethodsByOwner,
  getGroupsByOwner,
  subscribeToSharedBook,
  subscribeToTransactions,
} from '../../lib/supabase';
import { Book, Transaction, AppUser, PaymentMethod, PaymentMethodGroupWithMembers } from '../../constants/types';
import { AppColors } from '../../constants/colors';
import { useTheme } from '../../hooks/useTheme';
import { formatCurrency, formatDateShort } from '../../lib/format';
import { getCategoryByKey } from '../../constants/categories';
import { getUpiAppByKey } from '../../constants/upiApps';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { SpendingBarChart } from '../../components/charts/SpendingBarChart';
import { CategoryPieChart } from '../../components/charts/CategoryPieChart';
import { ReportModal } from '../../components/ReportModal';

type FilterType = 'All' | 'Cash In' | 'Cash Out';

function paymentMethodLabel(method: {
  payment_type: string;
  bank_name: string;
  upi_app: string | null;
  upi_app_name: string | null;
  upi_app_is_custom: boolean;
  last_four_digits: string | null;
} | null): string {
  if (!method) return 'Cash';
  if (method.payment_type === 'UPI') {
    const appName = method.upi_app_is_custom
      ? method.upi_app_name
      : getUpiAppByKey(method.upi_app ?? '')?.name;
    const suffix = method.last_four_digits ? ` ••${method.last_four_digits}` : '';
    return `${appName ?? 'UPI'} • ${method.bank_name}${suffix}`;
  }
  return `${method.bank_name}${method.last_four_digits ? ` ••${method.last_four_digits}` : ''}`;
}

export default function SharedBookScreen() {
  const { shareId } = useLocalSearchParams<{ shareId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [book, setBook] = useState<Book | null>(null);
  const [accessLevel, setAccessLevel] = useState<'view' | 'full'>('view');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [owner, setOwner] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  // Filters — same logic as book/[id].tsx
  const [filter, setFilter] = useState<FilterType>('All');
  /** null = all; '__cash__' = cash only; '__grp__:UUID' = group; otherwise = payment_method_id */
  const [methodFilter, setMethodFilter] = useState<string | null>(null);
  const [methodSheetVisible, setMethodSheetVisible] = useState(false);

  // Owner's payment methods + groups, fetched after the book loads
  const [allMethods, setAllMethods] = useState<PaymentMethod[]>([]);
  const [groups, setGroups] = useState<PaymentMethodGroupWithMembers[]>([]);

  async function loadAll(sid: string) {
    const result = await getBookByAnyShareId(sid);
    if (result) {
      setBook(result.book);
      setAccessLevel(result.accessLevel);
      const ownerId = result.book.owner_id;
      const [txns, ownerData, methods, grps] = await Promise.all([
        getTransactions(result.book.id),
        getUser(ownerId),
        getPaymentMethodsByOwner(ownerId).catch(() => [] as PaymentMethod[]),
        getGroupsByOwner(ownerId).catch(() => [] as PaymentMethodGroupWithMembers[]),
      ]);
      setTransactions(txns);
      setOwner(ownerData);
      setAllMethods(methods);
      setGroups(grps);
    } else {
      setBook(null);
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    if (!shareId) return;
    loadAll(shareId);

    const bookChannel = subscribeToSharedBook(shareId, (b) => {
      setBook(b);
    });

    return () => { bookChannel.unsubscribe(); };
  }, [shareId]);

  useEffect(() => {
    if (!book?.id) return;
    const txnChannel = subscribeToTransactions(book.id, (txns) => {
      setTransactions(txns);
    });
    return () => { txnChannel.unsubscribe(); };
  }, [book?.id]);

  const cashIn  = transactions.filter((t) => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const cashOut = transactions.filter((t) => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const balance = cashIn - cashOut;

  const hasCashTxns = useMemo(
    () => transactions.some((t) => !t.payment_method_id),
    [transactions],
  );

  const methodFilterLabel = useMemo(() => {
    if (!methodFilter) return 'All Methods';
    if (methodFilter === '__cash__') return 'Cash';
    if (methodFilter.startsWith('__grp__:')) {
      const grp = groups.find((g) => g.id === methodFilter.slice(8));
      return grp ? grp.name : 'Group';
    }
    const m = allMethods.find((x) => x.id === methodFilter);
    return m ? paymentMethodLabel(m) : 'Method';
  }, [methodFilter, allMethods, groups]);

  const filteredTxns = useMemo(() => {
    return transactions.filter((t) => {
      const typeOk =
        filter === 'Cash In'  ? t.type === 'in'  :
        filter === 'Cash Out' ? t.type === 'out' : true;

      let methodOk: boolean;
      if (!methodFilter) {
        methodOk = true;
      } else if (methodFilter === '__cash__') {
        methodOk = !t.payment_method_id && !t.to_payment_method_id;
      } else if (methodFilter.startsWith('__grp__:')) {
        const grp = groups.find((g) => g.id === methodFilter.slice(8));
        methodOk = grp
          ? (t.payment_method_id != null && grp.member_ids.includes(t.payment_method_id)) ||
            (t.to_payment_method_id != null && grp.member_ids.includes(t.to_payment_method_id))
          : true;
      } else {
        methodOk = t.payment_method_id === methodFilter || t.to_payment_method_id === methodFilter;
      }

      return typeOk && methodOk;
    });
  }, [transactions, filter, methodFilter, groups]);

  const showMethodChip = allMethods.length > 0 || hasCashTxns || groups.length > 0;

  if (loading) return <LoadingSpinner fullScreen />;

  if (!book) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.pageBg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Ionicons name="lock-closed-outline" size={56} color={colors.muted} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.body, marginTop: 16, textAlign: 'center' }}>
          This book is no longer shared or the code is invalid.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); if (shareId) loadAll(shareId); }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Book Header */}
        <View style={[styles.headerCard, { borderTopColor: book.color_tag }]}>
          {/* Live Badge */}
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>
              {accessLevel === 'full' ? 'LIVE · Full Access' : 'LIVE · View Only'}
            </Text>
          </View>

          <View style={styles.headerTop}>
            <Text style={{ fontSize: 36 }}>{book.icon_emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.bookName}>{book.name}</Text>
              {book.description ? <Text style={styles.bookDesc}>{book.description}</Text> : null}
              {owner ? (
                <Text style={styles.ownerText}>by {owner.display_name}</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => setReportModalVisible(true)} style={{ padding: 4 }}>
              <Ionicons name="document-text-outline" size={20} color={colors.muted} />
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
        </View>

        {/* Charts */}
        <View style={{ padding: 16 }}>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Spending — Last 6 Months</Text>
            <SpendingBarChart transactions={transactions} />
          </View>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Expenses by Category</Text>
            <CategoryPieChart transactions={transactions} />
          </View>

          {/* ── Type filter chips ─────────────────────────────── */}
          <View style={styles.filterRow}>
            {(['All', 'Cash In', 'Cash Out'] as FilterType[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                onPress={() => setFilter(f)}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Method filter chip ────────────────────────────── */}
          {showMethodChip && (
            <View style={styles.methodFilterRow}>
              <TouchableOpacity
                style={[styles.methodChip, methodFilter !== null && styles.methodChipActive]}
                onPress={() => setMethodSheetVisible(true)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={methodFilter?.startsWith('__grp__:') ? 'folder-outline' : 'card-outline'}
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

          {/* Transactions */}
          <Text style={styles.sectionTitle}>All Transactions</Text>
          {filteredTxns.length === 0 ? (
            <EmptyState emoji="📋" title="No transactions yet" />
          ) : (
            filteredTxns.map((t) => {
              const cat = getCategoryByKey(t.category);
              const isIn = t.type === 'in';
              const isTransfer = t.type === 'transfer';
              const canTap = accessLevel === 'full';
              return (
                <TouchableOpacity
                  key={t.id}
                  style={styles.txnRow}
                  onPress={canTap ? () => router.push(`/transaction/${t.id}`) : undefined}
                  activeOpacity={canTap ? 0.75 : 1}
                >
                  <View style={[styles.txnIcon, {
                    backgroundColor: isIn ? colors.cashInBg : isTransfer ? colors.balanceBg : colors.cashOutBg,
                  }]}>
                    <Ionicons
                      name={isIn ? 'arrow-down-outline' : isTransfer ? 'swap-horizontal-outline' : 'arrow-up-outline'}
                      size={16}
                      color={isIn ? colors.cashIn : isTransfer ? colors.balance : colors.cashOut}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.txnTopRow}>
                      <Text style={styles.txnAmount}>
                        {isIn ? '+' : isTransfer ? '' : '-'} {formatCurrency(t.amount)}
                      </Text>
                      <Text style={styles.txnDate}>{formatDateShort(t.date)}</Text>
                    </View>
                    <View style={styles.txnMeta}>
                      <View style={styles.catChip}>
                        <Text style={{ fontSize: 11 }}>{cat?.emoji ?? '💰'}</Text>
                        <Text style={styles.catLabel}>{cat?.label ?? t.category}</Text>
                      </View>
                      {t.note ? <Text style={styles.txnNote} numberOfLines={1}>{t.note}</Text> : null}
                    </View>
                  </View>
                  {canTap && <Ionicons name="chevron-forward" size={14} color={colors.muted} />}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {book && (
        <ReportModal
          visible={reportModalVisible}
          onClose={() => setReportModalVisible(false)}
          book={book}
          transactions={transactions}
          methods={allMethods}
          groups={groups}
        />
      )}

      {/* ── Method filter picker sheet ────────────────────────── */}
      <BottomSheet
        visible={methodSheetVisible}
        onClose={() => setMethodSheetVisible(false)}
        title="Filter by Payment Method"
      >
        {/* Clear */}
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

        {/* Groups */}
        {groups.length > 0 && (
          <>
            {groups.map((g, idx) => {
              const isActive = methodFilter === `__grp__:${g.id}`;
              return (
                <TouchableOpacity
                  key={g.id}
                  style={[
                    styles.pmRow,
                    (methodFilter !== null || idx > 0) && { borderTopWidth: 0.5, borderTopColor: colors.border },
                  ]}
                  onPress={() => { setMethodFilter(`__grp__:${g.id}`); setMethodSheetVisible(false); }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.pmMethodIcon, { backgroundColor: g.color + '22' }]}>
                    <Ionicons name="folder-outline" size={16} color={g.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pmRowLabel} numberOfLines={1}>{g.name}</Text>
                    <Text style={styles.pmRowSub}>{g.member_ids.length} method{g.member_ids.length !== 1 ? 's' : ''}</Text>
                  </View>
                  {isActive && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
            <View style={{ borderTopWidth: 0.5, borderTopColor: colors.border, marginTop: 4, marginBottom: 4 }} />
          </>
        )}

        {/* Cash */}
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
        {allMethods.map((m, idx) => (
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
    </View>
  );
}

const makeStyles = (C: AppColors) => StyleSheet.create({
  headerCard: {
    backgroundColor: C.card,
    borderTopWidth: 4,
    padding: 16,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: C.cashInBg,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.cashIn },
  liveText: { fontSize: 11, fontWeight: '700', color: C.cashInDark, letterSpacing: 0.5 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  bookName: { fontSize: 20, fontWeight: '700', color: C.body },
  bookDesc: { fontSize: 13, color: C.muted, marginTop: 2 },
  ownerText: { fontSize: 12, color: C.secondary, marginTop: 4, fontWeight: '500' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  statLabel: { fontSize: 11, fontWeight: '600', marginBottom: 3 },
  statVal: { fontSize: 13, fontWeight: '700' },
  chartCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: C.border,
  },
  chartTitle: { fontSize: 14, fontWeight: '700', color: C.body, marginBottom: 14 },
  // Type filter chips
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  filterText: { fontSize: 13, color: C.muted, fontWeight: '500' },
  filterTextActive: { color: C.white },
  // Method filter chip
  methodFilterRow: { flexDirection: 'row', marginBottom: 12 },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    maxWidth: 260,
  },
  methodChipActive: { backgroundColor: C.primary + '12', borderColor: C.primary },
  methodChipText: { fontSize: 13, color: C.muted, fontWeight: '500', flexShrink: 1 },
  methodChipTextActive: { color: C.primary, fontWeight: '600' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: C.body, marginBottom: 12 },
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
  txnIcon: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  txnTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  txnAmount: { fontSize: 14, fontWeight: '700', color: C.body },
  txnDate: { fontSize: 11, color: C.muted },
  txnMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.pageBg,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  catLabel: { fontSize: 11, color: C.muted, fontWeight: '500' },
  txnNote: { fontSize: 11, color: C.muted, flex: 1 },
  // Method picker sheet
  pmRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 20 },
  pmRowLabel: { fontSize: 14, color: C.body, fontWeight: '500' },
  pmRowSub: { fontSize: 11, color: C.muted, marginTop: 1 },
  pmMethodIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: C.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
