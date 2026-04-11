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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../hooks/useAuth';
import { usePaymentMethods } from '../../../hooks/usePaymentMethods';
import { updatePaymentMethod } from '../../../lib/supabase';
import { PaymentType } from '../../../constants/types';
import { Colors } from '../../../constants/colors';
import { BANKS, Bank } from '../../../constants/banks';
import { UPI_APPS, UpiApp } from '../../../constants/upiApps';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';

const PAYMENT_TYPES: { type: PaymentType; icon: string; label: string }[] = [
  { type: 'UPI', icon: '📲', label: 'UPI' },
  { type: 'Debit', icon: '💳', label: 'Debit Card' },
  { type: 'Credit', icon: '💎', label: 'Credit Card' },
  { type: 'Net Banking', icon: '🏦', label: 'Net Banking' },
];

export default function EditPaymentMethodScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { methods } = usePaymentMethods(user?.id ?? null);

  const [initialized, setInitialized] = useState(false);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [customBankName, setCustomBankName] = useState('');
  const [selectedType, setSelectedType] = useState<PaymentType | null>(null);
  const [selectedUpiApp, setSelectedUpiApp] = useState<UpiApp | null>(null);
  const [customUpiAppName, setCustomUpiAppName] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const method = methods.find((m) => m.id === id);

  useEffect(() => {
    if (method && !initialized) {
      const bank = BANKS.find((b) => b.key === method.bank_key) ?? BANKS.find((b) => b.key === 'other')!;
      setSelectedBank(bank);
      if (method.bank_is_custom) setCustomBankName(method.bank_name);
      setSelectedType(method.payment_type);
      if (method.upi_app) {
        const upiApp = UPI_APPS.find((a) => a.key === method.upi_app) ?? UPI_APPS.find((a) => a.key === 'other')!;
        setSelectedUpiApp(upiApp);
      }
      if (method.upi_app_is_custom) setCustomUpiAppName(method.upi_app_name ?? '');
      setLastFour(method.last_four_digits ?? '');
      setInitialized(true);
    }
  }, [method, initialized]);

  async function handleSave() {
    if (!selectedBank || !selectedType) return;
    setError('');

    const isCustomBank = selectedBank.key === 'other';
    const bankName = isCustomBank ? customBankName.trim() : selectedBank.name;
    if (isCustomBank && !bankName) {
      setError('Please enter your bank name.');
      return;
    }
    if (selectedType === 'UPI' && !selectedUpiApp) {
      setError('Please select a UPI app.');
      return;
    }
    if (lastFour.length > 0 && lastFour.length !== 4) {
      setError('Last 4 digits must be exactly 4 digits.');
      return;
    }

    const isCustomUpi = selectedType === 'UPI' && selectedUpiApp?.key === 'other';

    setSaving(true);
    try {
      await updatePaymentMethod(id!, {
        bank_key: selectedBank.key,
        bank_name: bankName,
        bank_is_custom: isCustomBank,
        payment_type: selectedType,
        upi_app: selectedType === 'UPI' ? (selectedUpiApp?.key ?? null) : null,
        upi_app_is_custom: isCustomUpi,
        upi_app_name: selectedType === 'UPI'
          ? (isCustomUpi ? customUpiAppName.trim() : (selectedUpiApp?.name ?? null))
          : null,
        last_four_digits: lastFour || null,
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to update payment method.');
    } finally {
      setSaving(false);
    }
  }

  if (!initialized) return <LoadingSpinner fullScreen />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.pageBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Payment Type */}
      <Text style={styles.label}>Payment Type</Text>
      {PAYMENT_TYPES.map((pt) => (
        <TouchableOpacity
          key={pt.type}
          style={[styles.listRow, selectedType === pt.type && styles.listRowActive]}
          onPress={() => {
            setSelectedType(pt.type);
            if (pt.type !== 'UPI') setSelectedUpiApp(null);
          }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 22 }}>{pt.icon}</Text>
          <Text style={styles.listLabel}>{pt.label}</Text>
          {selectedType === pt.type
            ? <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
            : <View style={styles.radioEmpty} />}
        </TouchableOpacity>
      ))}

      {/* Bank */}
      <Text style={[styles.label, { marginTop: 20 }]}>Bank</Text>
      {BANKS.map((bank) => (
        <TouchableOpacity
          key={bank.key}
          style={[styles.listRow, selectedBank?.key === bank.key && styles.listRowActive]}
          onPress={() => setSelectedBank(bank)}
          activeOpacity={0.7}
        >
          <View style={[styles.bankBadge, { backgroundColor: bank.color }]}>
            <Text style={styles.bankInitials}>{bank.initials}</Text>
          </View>
          <Text style={styles.listLabel}>{bank.name}</Text>
          {selectedBank?.key === bank.key
            ? <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
            : <View style={styles.radioEmpty} />}
        </TouchableOpacity>
      ))}
      {selectedBank?.key === 'other' && (
        <TextInput
          style={[styles.input, { marginTop: 8 }]}
          value={customBankName}
          onChangeText={setCustomBankName}
          placeholder="Enter bank name"
          placeholderTextColor={Colors.muted}
        />
      )}

      {/* UPI App */}
      {selectedType === 'UPI' && (
        <>
          <Text style={[styles.label, { marginTop: 20 }]}>UPI App</Text>
          {UPI_APPS.map((app) => (
            <TouchableOpacity
              key={app.key}
              style={[styles.listRow, selectedUpiApp?.key === app.key && styles.listRowActive]}
              onPress={() => setSelectedUpiApp(app)}
              activeOpacity={0.7}
            >
              <View style={[styles.bankBadge, { backgroundColor: app.color }]}>
                <Text style={styles.bankInitials}>{app.initials}</Text>
              </View>
              <Text style={styles.listLabel}>{app.name}</Text>
              {selectedUpiApp?.key === app.key
                ? <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                : <View style={styles.radioEmpty} />}
            </TouchableOpacity>
          ))}
          {selectedUpiApp?.key === 'other' && (
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={customUpiAppName}
              onChangeText={setCustomUpiAppName}
              placeholder="Enter UPI app name"
              placeholderTextColor={Colors.muted}
            />
          )}
        </>
      )}

      {/* Last 4 digits */}
      <Text style={[styles.label, { marginTop: 20 }]}>Account Number – Last 4 Digits (optional)</Text>
      <TextInput
        style={styles.input}
        value={lastFour}
        onChangeText={(t) => setLastFour(t.replace(/\D/g, '').slice(0, 4))}
        placeholder="e.g. 4521"
        placeholderTextColor={Colors.muted}
        keyboardType="numeric"
        maxLength={4}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.7 }]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving
          ? <ActivityIndicator size={20} color={Colors.white} />
          : <Text style={styles.saveBtnText}>Save Changes</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: Colors.border },
  listRowActive: { borderColor: Colors.primary, borderWidth: 2, backgroundColor: '#faf5ff' },
  bankBadge: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bankInitials: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  listLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.body },
  radioEmpty: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border },
  input: { backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.body },
  errorText: { color: Colors.cashOut, fontSize: 13, marginTop: 8, fontWeight: '500' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  saveBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
});
