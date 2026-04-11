import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../hooks/useTheme';
import { Transaction, PaymentMethod } from '../../constants/types';
import { AppColors } from '../../constants/colors';
import { formatCurrency } from '../../lib/format';
import { getCategoryByKey } from '../../constants/categories';
import { getUpiAppByKey } from '../../constants/upiApps';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

// ─── helpers ──────────────────────────────────────────────────────────────────

function paymentLabel(m: PaymentMethod): string {
  if (m.payment_type === 'UPI') {
    const app = m.upi_app_is_custom ? m.upi_app_name : getUpiAppByKey(m.upi_app ?? '')?.name;
    const suffix = m.last_four_digits ? ` ••${m.last_four_digits}` : '';
    return `${app ?? 'UPI'} • ${m.bank_name}${suffix}`;
  }
  return `${m.bank_name} ${m.payment_type}${m.last_four_digits ? ` ••${m.last_four_digits}` : ''}`;
}

async function fetchMethod(id: string | null): Promise<PaymentMethod | null> {
  if (!id) return null;
  const { data } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('id', id)
    .single();
  return (data as PaymentMethod | null) ?? null;
}

function longDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Detail row ───────────────────────────────────────────────────────────────

function DetailRow({
  icon,
  iconColor,
  label,
  value,
  styles,
  border = true,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
  border?: boolean;
}) {
  return (
    <View style={[styles.row, border && styles.rowBorder]}>
      <View style={styles.rowIconBox}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [txn, setTxn] = useState<Transaction | null>(null);
  const [fromMethod, setFromMethod] = useState<PaymentMethod | null>(null);
  const [toMethod, setToMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .single();

      if (!data) { setLoading(false); return; }
      const t = data as Transaction;
      setTxn(t);

      const [fm, tm] = await Promise.all([
        fetchMethod(t.payment_method_id),
        fetchMethod(t.to_payment_method_id),
      ]);
      setFromMethod(fm);
      setToMethod(tm);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <LoadingSpinner fullScreen />;

  if (!txn) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pageBg }}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.muted} />
        <Text style={{ color: colors.muted, marginTop: 12, fontSize: 15 }}>Transaction not found.</Text>
      </View>
    );
  }

  const isIn = txn.type === 'in';
  const isTransfer = txn.type === 'transfer';
  const cat = getCategoryByKey(txn.category);

  const typeColor = isIn ? colors.cashIn : isTransfer ? colors.balance : colors.cashOut;
  const typeBg = isIn ? colors.cashInBg : isTransfer ? colors.balanceBg : colors.cashOutBg;
  const typeIcon: keyof typeof Ionicons.glyphMap = isIn
    ? 'arrow-down-circle'
    : isTransfer
    ? 'swap-horizontal-circle'
    : 'arrow-up-circle';
  const typeLabel = isIn ? 'Cash In' : isTransfer ? 'Self Transfer' : 'Cash Out';
  const amountPrefix = isIn ? '+' : isTransfer ? '' : '−';

  const personLabel = isIn ? 'Received From' : isTransfer ? 'Reference' : 'Paid To';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.pageBg }}
      contentContainerStyle={{ paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero ────────────────────────────────────────────────── */}
      <View style={styles.heroCard}>
        {/* Colored type indicator strip */}
        <View style={[styles.heroStrip, { backgroundColor: typeColor }]} />

        <View style={styles.heroBody}>
          <View style={[styles.heroIconCircle, { backgroundColor: typeBg }]}>
            <Ionicons name={typeIcon} size={40} color={typeColor} />
          </View>

          <Text style={[styles.heroTypeLabel, { color: typeColor }]}>{typeLabel}</Text>

          <Text style={[styles.heroAmount, { color: typeColor }]}>
            {amountPrefix} {formatCurrency(txn.amount)}
          </Text>

          <Text style={styles.heroDate}>{longDate(txn.date)}</Text>
        </View>
      </View>

      {/* ── Details card ────────────────────────────────────────── */}
      <View style={styles.detailCard}>
        {/* Category (not shown for transfers) */}
        {!isTransfer && cat && (
          <View style={[styles.row]}>
            <View style={[styles.rowIconBox, styles.emojiBox]}>
              <Text style={styles.catEmoji}>{cat.emoji}</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Category</Text>
              <Text style={styles.rowValue}>{cat.label}</Text>
            </View>
          </View>
        )}

        {/* Payment method (or "From Account" for transfers) */}
        <DetailRow
          icon="card-outline"
          iconColor={colors.primary}
          label={isTransfer ? 'From Account' : 'Payment Method'}
          value={fromMethod ? paymentLabel(fromMethod) : 'Cash'}
          styles={styles}
          border={!isTransfer && !!cat}
        />

        {/* To account (transfer only) */}
        {isTransfer && (
          <DetailRow
            icon="arrow-forward-circle-outline"
            iconColor={colors.balance}
            label="To Account"
            value={toMethod ? paymentLabel(toMethod) : 'Cash'}
            styles={styles}
          />
        )}

        {/* Person */}
        {!!txn.person && (
          <DetailRow
            icon="person-outline"
            iconColor={colors.primary}
            label={personLabel}
            value={txn.person}
            styles={styles}
          />
        )}

        {/* Note */}
        {!!txn.note && (
          <DetailRow
            icon="document-text-outline"
            iconColor={colors.primary}
            label="Note"
            value={txn.note}
            styles={styles}
          />
        )}
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (C: AppColors) =>
  StyleSheet.create({
    // Hero
    heroCard: {
      backgroundColor: C.card,
      marginHorizontal: 16,
      marginTop: 20,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 0.5,
      borderColor: C.border,
      // iOS shadow
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 8,
      // Android elevation
      elevation: 3,
    },
    heroStrip: {
      height: 5,
      width: '100%',
    },
    heroBody: {
      alignItems: 'center',
      paddingVertical: 28,
      paddingHorizontal: 24,
      gap: 8,
    },
    heroIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    heroTypeLabel: {
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    heroAmount: {
      fontSize: 36,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    heroDate: {
      fontSize: 13,
      color: C.muted,
      fontWeight: '500',
      marginTop: 2,
    },

    // Detail card
    detailCard: {
      backgroundColor: C.card,
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 0.5,
      borderColor: C.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 8,
      elevation: 3,
    },

    // Rows
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 15,
      paddingHorizontal: 18,
      gap: 14,
    },
    rowBorder: {
      borderTopWidth: 0.5,
      borderTopColor: C.border,
    },
    rowIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: C.pageBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emojiBox: {
      // same sizing, emoji version
    },
    catEmoji: {
      fontSize: 18,
    },
    rowContent: {
      flex: 1,
    },
    rowLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: C.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 2,
    },
    rowValue: {
      fontSize: 15,
      fontWeight: '500',
      color: C.body,
    },
  });
