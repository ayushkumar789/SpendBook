import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { usePaymentMethods } from '../../hooks/usePaymentMethods';
import { deletePaymentMethod } from '../../lib/supabase';
import { PaymentMethod, PaymentType } from '../../constants/types';
import { getBankByKey } from '../../constants/banks';
import { getUpiAppByKey } from '../../constants/upiApps';
import { Colors } from '../../constants/colors';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { FAB } from '../../components/ui/FAB';

function BankBadge({ bankKey, bankName, size = 36 }: { bankKey: string; bankName: string; size?: number }) {
  const bank = getBankByKey(bankKey);
  const color = bank?.color ?? '#64748b';
  const initials = bank?.initials ?? bankName.slice(0, 3).toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: size * 0.28, fontWeight: '700' }}>{initials}</Text>
    </View>
  );
}

function UpiAppBadge({ appKey, appName, size = 36 }: { appKey: string; appName: string; size?: number }) {
  const app = getUpiAppByKey(appKey);
  const color = app?.color ?? '#64748b';
  const initials = app?.initials ?? appName.slice(0, 3).toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: size * 0.28, fontWeight: '700' }}>{initials}</Text>
    </View>
  );
}

function MethodLabel(method: PaymentMethod): string {
  if (method.payment_type === 'UPI') {
    const app = method.upi_app_is_custom ? method.upi_app_name : getUpiAppByKey(method.upi_app ?? '')?.name;
    return `${app ?? 'UPI'} • ${method.bank_name}`;
  }
  return `${method.bank_name} ${method.payment_type}${method.last_four_digits ? ` ••${method.last_four_digits}` : ''}`;
}

function MethodCard({ method, onDelete }: { method: PaymentMethod; onDelete: () => void }) {
  const isUpi = method.payment_type === 'UPI';
  const label = MethodLabel(method);

  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        {isUpi && method.upi_app ? (
          <UpiAppBadge
            appKey={method.upi_app_is_custom ? 'other' : method.upi_app}
            appName={method.upi_app_name ?? method.upi_app}
            size={42}
          />
        ) : (
          <BankBadge bankKey={method.bank_key} bankName={method.bank_name} size={42} />
        )}
      </View>
      <View style={styles.cardMid}>
        <Text style={styles.cardLabel} numberOfLines={1}>{label}</Text>
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>{method.payment_type}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="trash-outline" size={18} color={Colors.cashOut} />
      </TouchableOpacity>
    </View>
  );
}

const SECTION_LABELS: Record<PaymentType, { icon: string; color: string }> = {
  UPI: { icon: '📲', color: '#5f259f' },
  Debit: { icon: '💳', color: '#1a56db' },
  Credit: { icon: '💎', color: '#dc2626' },
  'Net Banking': { icon: '🏦', color: '#0d9488' },
};

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { grouped, loading } = usePaymentMethods(user?.id ?? null);

  async function handleDelete(method: PaymentMethod) {
    Alert.alert(
      'Delete Payment Method',
      `Delete "${MethodLabel(method)}"? Old transactions using it will show "Deleted Method".`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePaymentMethod(method.id);
            } catch {
              Alert.alert('Error', 'Failed to delete payment method.');
            }
          },
        },
      ]
    );
  }

  if (loading) return <LoadingSpinner fullScreen />;

  const hasAny = Object.values(grouped).some((arr) => arr.length > 0);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.pageBg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {!hasAny ? (
          <EmptyState
            emoji="💳"
            title="No payment methods yet"
            subtitle="Tap + to add UPI, debit/credit card, or net banking"
          />
        ) : (
          (Object.keys(grouped) as PaymentType[]).map((type) => {
            const items = grouped[type];
            if (!items.length) return null;
            const meta = SECTION_LABELS[type];
            return (
              <View key={type} style={{ marginBottom: 20 }}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionEmoji}>{meta.icon}</Text>
                  <Text style={[styles.sectionTitle, { color: meta.color }]}>{type}</Text>
                  <Text style={styles.sectionCount}>{items.length}</Text>
                </View>
                {items.map((m) => (
                  <MethodCard key={m.id} method={m} onDelete={() => handleDelete(m)} />
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
      <FAB onPress={() => router.push('/payment-method/add')} />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionEmoji: { fontSize: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  sectionCount: {
    backgroundColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    color: Colors.muted,
    fontWeight: '600',
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    gap: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  cardLeft: {},
  cardMid: { flex: 1 },
  cardLabel: { fontSize: 14, fontWeight: '600', color: Colors.body, marginBottom: 4 },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ede9fe',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeText: { fontSize: 10, color: Colors.primary, fontWeight: '600' },
  deleteBtn: { padding: 4 },
});
