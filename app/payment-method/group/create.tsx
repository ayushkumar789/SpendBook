import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../hooks/useAuth';
import { usePaymentMethods } from '../../../hooks/usePaymentMethods';
import { useTheme } from '../../../hooks/useTheme';
import { createGroup } from '../../../lib/supabase';
import { PaymentMethod } from '../../../constants/types';
import { AppColors } from '../../../constants/colors';
import { getUpiAppByKey } from '../../../constants/upiApps';

const GROUP_COLORS = [
  '#5c2d91', '#7c3aed', '#2563eb', '#0891b2',
  '#16a34a', '#d97706', '#dc2626', '#db2777',
];

function methodLabel(method: PaymentMethod): string {
  if (method.payment_type === 'UPI') {
    const app = method.upi_app_is_custom
      ? method.upi_app_name
      : getUpiAppByKey(method.upi_app ?? '')?.name;
    const suffix = method.last_four_digits ? ` ••${method.last_four_digits}` : '';
    return `${app ?? 'UPI'} • ${method.bank_name}${suffix}`;
  }
  return `${method.bank_name} ${method.payment_type}${method.last_four_digits ? ` ••${method.last_four_digits}` : ''}`;
}

export default function CreateGroupScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { methods } = usePaymentMethods(user?.id ?? null);
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [name, setName] = useState('');
  const [color, setColor] = useState(GROUP_COLORS[0]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  function toggleMethod(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Enter a name for this group.');
      return;
    }
    if (selectedIds.size === 0) {
      Alert.alert('No methods selected', 'Select at least one payment method to include.');
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      await createGroup({ owner_id: user.id, name: trimmed, color }, [...selectedIds]);
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to create group. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const canSave = name.trim().length > 0 && selectedIds.size > 0 && !saving;

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">

        {/* Group Name */}
        <Text style={styles.label}>Group Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Daily Spending, Travel, Work…"
          placeholderTextColor={colors.muted}
          maxLength={40}
          returnKeyType="done"
        />

        {/* Color Picker */}
        <Text style={[styles.label, { marginTop: 24 }]}>Color</Text>
        <View style={styles.colorRow}>
          {GROUP_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.colorSwatch, { backgroundColor: c }, color === c && styles.colorSwatchSelected]}
              onPress={() => setColor(c)}
              activeOpacity={0.8}
            >
              {color === c && <Ionicons name="checkmark" size={18} color="#fff" />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Payment Methods */}
        <Text style={[styles.label, { marginTop: 24 }]}>
          Payment Methods
          {selectedIds.size > 0 && (
            <Text style={{ color: colors.primary }}> ({selectedIds.size} selected)</Text>
          )}
        </Text>

        {methods.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="card-outline" size={28} color={colors.muted} />
            <Text style={styles.emptyText}>No payment methods yet.{'\n'}Add some in the Payment Methods tab first.</Text>
          </View>
        ) : (
          methods.map((m) => {
            const checked = selectedIds.has(m.id);
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.methodRow, checked && { borderColor: color, borderWidth: 1.5 }]}
                onPress={() => toggleMethod(m.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.checkbox, checked && { backgroundColor: color, borderColor: color }]}>
                  {checked && <Ionicons name="checkmark" size={13} color="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodLabel} numberOfLines={1}>{methodLabel(m)}</Text>
                  <Text style={styles.methodSub}>{m.payment_type}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: color }, !canSave && { opacity: 0.45 }]}
          onPress={handleCreate}
          disabled={!canSave}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size={18} color="#fff" />
          ) : (
            <>
              <Ionicons name="folder-open-outline" size={18} color="#fff" />
              <Text style={styles.createBtnText}>Create Group</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (C: AppColors) => StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 10,
  },
  input: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: C.body,
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorSwatch: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 13,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodLabel: { fontSize: 14, fontWeight: '600', color: C.body, marginBottom: 2 },
  methodSub: { fontSize: 11, color: C.muted },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 20,
  },
  emptyText: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20 },
  footer: { padding: 16, borderTopWidth: 1, backgroundColor: 'transparent' },
  createBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
