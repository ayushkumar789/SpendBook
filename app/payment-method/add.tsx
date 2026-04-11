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
import { useAuth } from '../../hooks/useAuth';
import { usePaymentMethods } from '../../hooks/usePaymentMethods';
import { addPaymentMethod } from '../../lib/supabase';
import { PaymentType } from '../../constants/types';
import { Colors } from '../../constants/colors';
import { BANKS, Bank } from '../../constants/banks';
import { UPI_APPS, UpiApp } from '../../constants/upiApps';

const PAYMENT_TYPES: { type: PaymentType; icon: string; label: string }[] = [
  { type: 'UPI', icon: '📲', label: 'UPI' },
  { type: 'Debit', icon: '💳', label: 'Debit Card' },
  { type: 'Credit', icon: '💎', label: 'Credit Card' },
  { type: 'Net Banking', icon: '🏦', label: 'Net Banking' },
];

export default function AddPaymentMethodScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { methods } = usePaymentMethods(user?.id ?? null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [customBankName, setCustomBankName] = useState('');
  const [selectedType, setSelectedType] = useState<PaymentType | null>(null);
  const [selectedUpiApp, setSelectedUpiApp] = useState<UpiApp | null>(null);
  const [customUpiAppName, setCustomUpiAppName] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [saving, setSaving] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');

  function checkDuplicate(): boolean {
    if (!selectedBank || !selectedType) return false;
    const bankKey = selectedBank.key;
    const l4 = lastFour.trim();
    return methods.some((m) => {
      if (m.bank_key !== bankKey) return false;
      if (m.payment_type !== selectedType) return false;
      if ((m.last_four_digits ?? '') !== l4) return false;
      if (selectedType === 'UPI') {
        return m.upi_app === (selectedUpiApp?.key ?? '');
      }
      return true;
    });
  }

  async function handleSave() {
    if (!user?.id || !selectedBank || !selectedType) return;
    setDuplicateError('');

    if (checkDuplicate()) {
      setDuplicateError('This payment method already exists.');
      return;
    }

    const isCustomBank = selectedBank.key === 'other';
    const bankName = isCustomBank ? customBankName.trim() : selectedBank.name;
    if (isCustomBank && !bankName) {
      setDuplicateError('Please enter your bank name.');
      return;
    }

    if (selectedType === 'UPI' && !selectedUpiApp) {
      setDuplicateError('Please select a UPI app.');
      return;
    }

    if (lastFour.length > 0 && lastFour.length !== 4) {
      setDuplicateError('Last 4 digits must be exactly 4 digits.');
      return;
    }

    setSaving(true);
    try {
      await addPaymentMethod({
        owner_id: user.id,
        bank_key: selectedBank.key,
        bank_name: bankName,
        bank_is_custom: isCustomBank,
        payment_type: selectedType,
        upi_app: selectedUpiApp?.key ?? null,
        upi_app_is_custom: selectedUpiApp?.key === 'other',
        upi_app_name: selectedUpiApp?.key === 'other' ? customUpiAppName.trim() : selectedUpiApp?.name ?? null,
        last_four_digits: lastFour || null,
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to add payment method.');
    } finally {
      setSaving(false);
    }
  }

  // ── STEP 1: Pick Bank ──────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.pageBg }}>
        <View style={styles.stepIndicator}>
          {[1, 2, 3].map((s) => (
            <View key={s} style={[styles.stepDot, step >= s && styles.stepDotActive]}>
              <Text style={[styles.stepDotText, step >= s && styles.stepDotTextActive]}>{s}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.stepTitle}>Step 1: Select Bank</Text>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
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
              {selectedBank?.key === bank.key ? (
                <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
              ) : (
                <View style={styles.radioEmpty} />
              )}
            </TouchableOpacity>
          ))}
          {selectedBank?.key === 'other' ? (
            <TextInput
              style={[styles.input, { marginTop: 12 }]}
              value={customBankName}
              onChangeText={setCustomBankName}
              placeholder="Enter bank name"
              placeholderTextColor={Colors.muted}
            />
          ) : null}
          <TouchableOpacity
            style={[styles.nextBtn, !selectedBank && { opacity: 0.4 }]}
            onPress={() => selectedBank && setStep(2)}
            disabled={!selectedBank}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>Next →</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── STEP 2: Pick Type ──────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.pageBg }}>
        <View style={styles.stepIndicator}>
          {[1, 2, 3].map((s) => (
            <View key={s} style={[styles.stepDot, step >= s && styles.stepDotActive]}>
              <Text style={[styles.stepDotText, step >= s && styles.stepDotTextActive]}>{s}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.stepTitle}>Step 2: Select Type</Text>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={styles.bankChosen}>
            Bank: {selectedBank?.key === 'other' ? customBankName || selectedBank.name : selectedBank?.name}
          </Text>
          {PAYMENT_TYPES.map((pt) => (
            <TouchableOpacity
              key={pt.type}
              style={[styles.listRow, selectedType === pt.type && styles.listRowActive]}
              onPress={() => setSelectedType(pt.type)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 24 }}>{pt.icon}</Text>
              <Text style={styles.listLabel}>{pt.label}</Text>
              {selectedType === pt.type ? (
                <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
              ) : (
                <View style={styles.radioEmpty} />
              )}
            </TouchableOpacity>
          ))}
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nextBtn, { flex: 1 }, !selectedType && { opacity: 0.4 }]}
              onPress={() => selectedType && setStep(3)}
              disabled={!selectedType}
              activeOpacity={0.85}
            >
              <Text style={styles.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── STEP 3: Details ────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: Colors.pageBg }}>
      <View style={styles.stepIndicator}>
        {[1, 2, 3].map((s) => (
          <View key={s} style={[styles.stepDot, step >= s && styles.stepDotActive]}>
            <Text style={[styles.stepDotText, step >= s && styles.stepDotTextActive]}>{s}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.stepTitle}>Step 3: Details</Text>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.bankChosen}>
          {selectedBank?.key === 'other' ? customBankName : selectedBank?.name} · {selectedType}
        </Text>

        {selectedType === 'UPI' ? (
          <>
            <Text style={styles.label}>UPI App *</Text>
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
                {selectedUpiApp?.key === app.key ? (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                ) : (
                  <View style={styles.radioEmpty} />
                )}
              </TouchableOpacity>
            ))}
            {selectedUpiApp?.key === 'other' ? (
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                value={customUpiAppName}
                onChangeText={setCustomUpiAppName}
                placeholder="Enter UPI app name"
                placeholderTextColor={Colors.muted}
              />
            ) : null}
          </>
        ) : null}

        <Text style={styles.label}>Account Number – Last 4 Digits (optional)</Text>
        <TextInput
          style={styles.input}
          value={lastFour}
          onChangeText={(t) => setLastFour(t.replace(/\D/g, '').slice(0, 4))}
          placeholder="e.g. 4521"
          placeholderTextColor={Colors.muted}
          keyboardType="numeric"
          maxLength={4}
        />

        {duplicateError ? (
          <Text style={styles.errorText}>{duplicateError}</Text>
        ) : null}

        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(2)}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.nextBtn, { flex: 1 }, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size={20} color={Colors.white} />
            ) : (
              <Text style={styles.nextBtnText}>Add Method</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  stepIndicator: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, paddingVertical: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: Colors.primary },
  stepDotText: { fontSize: 13, fontWeight: '700', color: Colors.muted },
  stepDotTextActive: { color: Colors.white },
  stepTitle: { fontSize: 17, fontWeight: '700', color: Colors.body, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  bankChosen: { fontSize: 13, color: Colors.muted, marginBottom: 14, fontWeight: '500' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: Colors.border },
  listRowActive: { borderColor: Colors.primary, borderWidth: 2, backgroundColor: '#faf5ff' },
  bankBadge: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bankInitials: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  listLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.body },
  radioEmpty: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border },
  label: { fontSize: 13, fontWeight: '600', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.body },
  errorText: { color: Colors.cashOut, fontSize: 13, marginTop: 8, fontWeight: '500' },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  backBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, backgroundColor: Colors.pageBg, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 15, color: Colors.muted, fontWeight: '600' },
  nextBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
});
