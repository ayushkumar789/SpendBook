import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../hooks/useAuth';
import { usePaymentMethods } from '../../../hooks/usePaymentMethods';
import { supabase, updateTransaction } from '../../../lib/supabase';
import { Transaction, PaymentMethod } from '../../../constants/types';
import { Colors } from '../../../constants/colors';
import { getCategoriesForType } from '../../../constants/categories';
import { getUpiAppByKey } from '../../../constants/upiApps';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';

function paymentLabel(m: PaymentMethod): string {
  if (m.payment_type === 'UPI') {
    const app = m.upi_app_is_custom ? m.upi_app_name : getUpiAppByKey(m.upi_app ?? '')?.name;
    return `${app ?? 'UPI'} • ${m.bank_name}`;
  }
  return `${m.bank_name} ${m.payment_type}${m.last_four_digits ? ` ••${m.last_four_digits}` : ''}`;
}

function DatePickerModal({
  visible,
  value,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  value: string;
  onClose: () => void;
  onConfirm: (date: string) => void;
}) {
  const parts = value.split('-');
  const [year, setYear] = useState(parts[0] ?? '2025');
  const [month, setMonth] = useState(parts[1] ?? '01');
  const [day, setDay] = useState(parts[2] ?? '01');

  function confirm() {
    onConfirm(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={dpStyles.overlay}>
        <View style={dpStyles.box}>
          <Text style={dpStyles.title}>Pick Date</Text>
          <View style={dpStyles.row}>
            <View style={dpStyles.col}>
              <Text style={dpStyles.colLabel}>Day</Text>
              <TextInput style={dpStyles.input} value={day} onChangeText={setDay} keyboardType="numeric" maxLength={2} placeholder="DD" />
            </View>
            <View style={dpStyles.col}>
              <Text style={dpStyles.colLabel}>Month</Text>
              <TextInput style={dpStyles.input} value={month} onChangeText={setMonth} keyboardType="numeric" maxLength={2} placeholder="MM" />
            </View>
            <View style={dpStyles.col}>
              <Text style={dpStyles.colLabel}>Year</Text>
              <TextInput style={dpStyles.input} value={year} onChangeText={setYear} keyboardType="numeric" maxLength={4} placeholder="YYYY" />
            </View>
          </View>
          <View style={dpStyles.actions}>
            <TouchableOpacity onPress={onClose} style={dpStyles.cancelBtn}>
              <Text style={dpStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirm} style={dpStyles.confirmBtn}>
              <Text style={dpStyles.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const dpStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  box: { backgroundColor: Colors.white, borderRadius: 20, padding: 24, width: '85%' },
  title: { fontSize: 16, fontWeight: '700', color: Colors.body, marginBottom: 16, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  col: { flex: 1, alignItems: 'center' },
  colLabel: { fontSize: 12, color: Colors.muted, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, textAlign: 'center', fontSize: 16, color: Colors.body, width: '100%' },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: Colors.pageBg, alignItems: 'center' },
  cancelText: { fontSize: 15, color: Colors.muted, fontWeight: '600' },
  confirmBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  confirmText: { fontSize: 15, color: Colors.white, fontWeight: '700' },
});

export default function EditTransactionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { methods } = usePaymentMethods(user?.id ?? null);

  const [txn, setTxn] = useState<Transaction | null>(null);
  const [txnType, setTxnType] = useState<'in' | 'out'>('out');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pmSheetVisible, setPmSheetVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          const t = data as Transaction;
          setTxn(t);
          setTxnType(t.type);
          setAmount(t.amount.toString());
          setCategory(t.category);
          setPaymentMethodId(t.payment_method_id);
          setNote(t.note);
          setDate(t.date);
        }
        setLoading(false);
      });
  }, [id]);

  const categories = getCategoriesForType(txnType);
  const selectedMethod = methods.find((m) => m.id === paymentMethodId);

  async function handleSave() {
    const amtNum = parseFloat(amount);
    if (!amount || isNaN(amtNum) || amtNum <= 0) {
      Alert.alert('Validation', 'Enter a valid amount greater than 0.');
      return;
    }
    if (!category) {
      Alert.alert('Validation', 'Please select a category.');
      return;
    }
    if (!id) return;
    setSaving(true);
    try {
      await updateTransaction(id, {
        type: txnType,
        amount: amtNum,
        category,
        payment_method_id: paymentMethodId,
        note: note.trim(),
        date,
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.pageBg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <View style={styles.typeRow}>
          <TouchableOpacity style={[styles.typeBtn, txnType === 'in' && styles.typeBtnIn]} onPress={() => { setTxnType('in'); setCategory(''); }} activeOpacity={0.8}>
            <Ionicons name="arrow-down-outline" size={18} color={txnType === 'in' ? Colors.white : Colors.cashIn} />
            <Text style={[styles.typeBtnText, txnType === 'in' && { color: Colors.white }]}>Cash In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.typeBtn, txnType === 'out' && styles.typeBtnOut]} onPress={() => { setTxnType('out'); setCategory(''); }} activeOpacity={0.8}>
            <Ionicons name="arrow-up-outline" size={18} color={txnType === 'out' ? Colors.white : Colors.cashOut} />
            <Text style={[styles.typeBtnText, txnType === 'out' && { color: Colors.white }]}>Cash Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Amount *</Text>
        <View style={styles.amountRow}>
          <Text style={styles.rupee}>₹</Text>
          <TextInput style={styles.amountInput} value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor={Colors.muted} keyboardType="decimal-pad" />
        </View>

        <Text style={styles.label}>Category *</Text>
        <View style={styles.chipGrid}>
          {categories.map((c) => (
            <TouchableOpacity key={c.key} style={[styles.chip, category === c.key && styles.chipActive]} onPress={() => setCategory(c.key)} activeOpacity={0.7}>
              <Text style={{ fontSize: 14 }}>{c.emoji}</Text>
              <Text style={[styles.chipText, category === c.key && styles.chipTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Payment Method</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setPmSheetVisible(true)} activeOpacity={0.8}>
          <Ionicons name="card-outline" size={18} color={Colors.muted} />
          <Text style={[styles.selectorText, selectedMethod && { color: Colors.body }]}>
            {selectedMethod ? paymentLabel(selectedMethod) : 'Select payment method (optional)'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={Colors.muted} />
        </TouchableOpacity>

        <Text style={styles.label}>Note</Text>
        <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="Optional note…" placeholderTextColor={Colors.muted} maxLength={200} />

        <Text style={styles.label}>Date</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setDatePickerVisible(true)} activeOpacity={0.8}>
          <Ionicons name="calendar-outline" size={18} color={Colors.muted} />
          <Text style={[styles.selectorText, { color: Colors.body }]}>{date}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator size={20} color={Colors.white} /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>

      <BottomSheet visible={pmSheetVisible} onClose={() => setPmSheetVisible(false)} title="Select Payment Method">
        <TouchableOpacity style={styles.pmRow} onPress={() => { setPaymentMethodId(null); setPmSheetVisible(false); }}>
          <Ionicons name="cash-outline" size={20} color={Colors.muted} />
          <Text style={styles.pmLabel}>Cash (no method)</Text>
          {!paymentMethodId ? <Ionicons name="checkmark" size={18} color={Colors.primary} /> : null}
        </TouchableOpacity>
        {methods.map((m) => (
          <TouchableOpacity key={m.id} style={styles.pmRow} onPress={() => { setPaymentMethodId(m.id); setPmSheetVisible(false); }}>
            <Ionicons name="card-outline" size={20} color={Colors.muted} />
            <Text style={styles.pmLabel}>{paymentLabel(m)}</Text>
            {paymentMethodId === m.id ? <Ionicons name="checkmark" size={18} color={Colors.primary} /> : null}
          </TouchableOpacity>
        ))}
      </BottomSheet>

      <DatePickerModal visible={datePickerVisible} value={date} onClose={() => setDatePickerVisible(false)} onConfirm={setDate} />
    </View>
  );
}

const styles = StyleSheet.create({
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border },
  typeBtnIn: { backgroundColor: Colors.cashIn, borderColor: Colors.cashIn },
  typeBtnOut: { backgroundColor: Colors.cashOut, borderColor: Colors.cashOut },
  typeBtnText: { fontSize: 15, fontWeight: '700', color: Colors.body },
  label: { fontSize: 13, fontWeight: '600', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 16 },
  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14 },
  rupee: { fontSize: 22, color: Colors.primary, fontWeight: '700', marginRight: 4 },
  amountInput: { flex: 1, fontSize: 24, fontWeight: '700', color: Colors.body, paddingVertical: 14 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.card, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: '#ede9fe', borderColor: Colors.primary },
  chipText: { fontSize: 12, color: Colors.muted, fontWeight: '500' },
  chipTextActive: { color: Colors.primary, fontWeight: '700' },
  selector: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 14 },
  selectorText: { flex: 1, fontSize: 14, color: Colors.muted },
  input: { backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.body },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 32 },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  pmRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 20, borderTopWidth: 0.5, borderTopColor: Colors.border },
  pmLabel: { flex: 1, fontSize: 14, color: Colors.body, fontWeight: '500' },
});
