import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getBookByShareId,
  getTransactions,
  getUser,
  subscribeToSharedBook,
  subscribeToTransactions,
} from '../../lib/supabase';
import { Book, Transaction, AppUser } from '../../constants/types';
import { Colors } from '../../constants/colors';
import { formatCurrency, formatDateShort } from '../../lib/format';
import { getCategoryByKey } from '../../constants/categories';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { SpendingBarChart } from '../../components/charts/SpendingBarChart';
import { CategoryPieChart } from '../../components/charts/CategoryPieChart';

export default function SharedBookScreen() {
  const { shareId } = useLocalSearchParams<{ shareId: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [owner, setOwner] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadAll(sid: string) {
    const b = await getBookByShareId(sid);
    setBook(b);
    if (b) {
      const txns = await getTransactions(b.id);
      setTransactions(txns);
      const ownerData = await getUser(b.owner_id);
      setOwner(ownerData);
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

  const cashIn = transactions.filter((t) => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const cashOut = transactions.filter((t) => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const balance = cashIn - cashOut;

  if (loading) return <LoadingSpinner fullScreen />;

  if (!book) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.pageBg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Ionicons name="lock-closed-outline" size={56} color={Colors.muted} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.body, marginTop: 16, textAlign: 'center' }}>
          This book is no longer shared or the code is invalid.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.pageBg }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); if (shareId) loadAll(shareId); }}
          tintColor={Colors.primary}
        />
      }
    >
      {/* Book Header */}
      <View style={[styles.headerCard, { borderTopColor: book.color_tag }]}>
        {/* Live Badge */}
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE · Read Only</Text>
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

        {/* Transactions */}
        <Text style={styles.sectionTitle}>All Transactions</Text>
        {transactions.length === 0 ? (
          <EmptyState emoji="📋" title="No transactions yet" />
        ) : (
          transactions.map((t) => {
            const cat = getCategoryByKey(t.category);
            const isIn = t.type === 'in';
            return (
              <View key={t.id} style={styles.txnRow}>
                <View style={[styles.txnIcon, { backgroundColor: isIn ? Colors.cashInBg : Colors.cashOutBg }]}>
                  <Ionicons
                    name={isIn ? 'arrow-down-outline' : 'arrow-up-outline'}
                    size={16}
                    color={isIn ? Colors.cashIn : Colors.cashOut}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.txnTopRow}>
                    <Text style={styles.txnAmount}>
                      {isIn ? '+' : '-'} {formatCurrency(t.amount)}
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
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: Colors.card,
    borderTopWidth: 4,
    padding: 16,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.cashIn },
  liveText: { fontSize: 11, fontWeight: '700', color: Colors.cashInDark, letterSpacing: 0.5 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  bookName: { fontSize: 20, fontWeight: '700', color: Colors.body },
  bookDesc: { fontSize: 13, color: Colors.muted, marginTop: 2 },
  ownerText: { fontSize: 12, color: Colors.secondary, marginTop: 4, fontWeight: '500' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  statLabel: { fontSize: 11, fontWeight: '600', marginBottom: 3 },
  statVal: { fontSize: 13, fontWeight: '700' },
  chartCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  chartTitle: { fontSize: 14, fontWeight: '700', color: Colors.body, marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.body, marginBottom: 12 },
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
  txnIcon: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  txnTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  txnAmount: { fontSize: 14, fontWeight: '700', color: Colors.body },
  txnDate: { fontSize: 11, color: Colors.muted },
  txnMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.pageBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  catLabel: { fontSize: 11, color: Colors.muted, fontWeight: '500' },
  txnNote: { fontSize: 11, color: Colors.muted, flex: 1 },
});
