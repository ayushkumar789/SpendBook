import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { useAuth } from '../../../hooks/useAuth';
import { usePaymentMethods } from '../../../hooks/usePaymentMethods';
import { useTheme } from '../../../hooks/useTheme';
import { supabase, updateTransaction } from '../../../lib/supabase';
import { Transaction, PaymentMethod, TransactionType } from '../../../constants/types';
import { AppColors } from '../../../constants/colors';
import { getCategoriesForType } from '../../../constants/categories';
import { getUpiAppByKey } from '../../../constants/upiApps';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';

function paymentLabel(m: PaymentMethod): string {
  if (m.payment_type === 'UPI') {
    const app = m.upi_app_is_custom ? m.upi_app_name : getUpiAppByKey(m.upi_app ?? '')?.name;
    const suffix = m.last_four_digits ? ` ••${m.last_four_digits}` : '';
    return `${app ?? 'UPI'} • ${m.bank_name}${suffix}`;
  }
  return `${m.bank_name} ${m.payment_type}${m.last_four_digits ? ` ••${m.last_four_digits}` : ''}`;
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseISO(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y, month: (m ?? 1) - 1, day: d ?? 1 };
}

const CELL_SIZE = 40;

const makeCalStyles = (C: AppColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 20, width: '100%', maxWidth: 360 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.body },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: C.muted, paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  dayCircle: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: CELL_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: C.primary },
  dayCircleToday: { borderWidth: 1.5, borderColor: C.primary },
  dayText: { fontSize: 14, color: C.body, fontWeight: '400' },
  dayTextSelected: { color: C.white, fontWeight: '700' },
  dayTextToday: { color: C.primary, fontWeight: '700' },
  selectedLabel: { textAlign: 'center', fontSize: 13, color: C.muted, marginTop: 12, marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: C.pageBg, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  cancelText: { fontSize: 15, color: C.muted, fontWeight: '600' },
  confirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: C.primary, alignItems: 'center' },
  confirmText: { fontSize: 15, color: C.white, fontWeight: '700' },
});

function CalendarModal({ visible, value, onClose, onConfirm }: { visible: boolean; value: string; onClose: () => void; onConfirm: (date: string) => void }) {
  const { colors } = useTheme();
  const calStyles = makeCalStyles(colors);
  const today = new Date();
  const todayIso = toISO(today.getFullYear(), today.getMonth(), today.getDate());
  const parsed = parseISO(value || todayIso);
  const [viewYear, setViewYear] = useState(parsed.year);
  const [viewMonth, setViewMonth] = useState(parsed.month);
  const [selected, setSelected] = useState(value || todayIso);

  useEffect(() => {
    if (visible) {
      const p = parseISO(value || todayIso);
      setViewYear(p.year);
      setViewMonth(p.month);
      setSelected(value || todayIso);
    }
  }, [visible]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }
  function buildGrid(): number[] {
    const firstDow = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: number[] = Array(firstDow).fill(0);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(0);
    return cells;
  }

  const grid = buildGrid();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={calStyles.overlay}>
        <View style={calStyles.card}>
          <View style={calStyles.header}>
            <TouchableOpacity onPress={prevMonth} style={calStyles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={calStyles.headerTitle}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={calStyles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={calStyles.weekRow}>
            {WEEK_DAYS.map(d => <Text key={d} style={calStyles.weekLabel}>{d}</Text>)}
          </View>
          <View style={calStyles.grid}>
            {grid.map((day, idx) => {
              if (day === 0) return <View key={`e-${idx}`} style={calStyles.cell} />;
              const iso = toISO(viewYear, viewMonth, day);
              const isSelected = iso === selected;
              const isToday = iso === todayIso;
              return (
                <TouchableOpacity key={iso} style={calStyles.cell} onPress={() => setSelected(toISO(viewYear, viewMonth, day))} activeOpacity={0.7}>
                  <View style={[calStyles.dayCircle, isSelected && calStyles.dayCircleSelected, !isSelected && isToday && calStyles.dayCircleToday]}>
                    <Text style={[calStyles.dayText, isSelected && calStyles.dayTextSelected, !isSelected && isToday && calStyles.dayTextToday]}>{day}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={calStyles.selectedLabel}>
            {new Date(selected + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          <View style={calStyles.actions}>
            <TouchableOpacity onPress={onClose} style={calStyles.cancelBtn}>
              <Text style={calStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { onConfirm(selected); onClose(); }} style={calStyles.confirmBtn}>
              <Text style={calStyles.confirmText}>Select</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Contact Picker ────────────────────────────────────────────────────────────

const makeCpStyles = (C: AppColors) => StyleSheet.create({
  header: { backgroundColor: C.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 48 : 56, paddingBottom: 16 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.white },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 4 },
  searchInput: { flex: 1, fontSize: 15, color: C.body },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  centreTitle: { fontSize: 17, fontWeight: '700', color: C.body, textAlign: 'center' },
  centreText: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, backgroundColor: C.card },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: C.white },
  contactName: { flex: 1, fontSize: 15, color: C.body, fontWeight: '500' },
  separator: { height: 0.5, backgroundColor: C.border, marginLeft: 68 },
});

function ContactPickerModal({ visible, onClose, onSelect }: { visible: boolean; onClose: () => void; onSelect: (name: string) => void }) {
  const { colors } = useTheme();
  const cpStyles = makeCpStyles(colors);
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setPermissionDenied(false);
    loadContacts();
  }, [visible]);

  async function loadContacts() {
    setLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') { setPermissionDenied(true); setLoading(false); return; }
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Name], sort: Contacts.SortTypes.FirstName });
      setContacts(data.filter((c) => !!c.name?.trim()));
    } catch {
      Alert.alert('Error', 'Could not load contacts.');
    } finally {
      setLoading(false);
    }
  }

  const filtered = query.trim()
    ? contacts.filter((c) => c.name?.toLowerCase().includes(query.trim().toLowerCase()))
    : contacts;

  function Initials({ name }: { name: string }) {
    const parts = name.trim().split(/\s+/);
    const letters = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
    const palette = ['#5c2d91', '#2563eb', '#0891b2', '#16a34a', '#d97706', '#dc2626'];
    const color = palette[name.length % palette.length];
    return (
      <View style={[cpStyles.avatar, { backgroundColor: color }]}>
        <Text style={cpStyles.avatarText}>{letters}</Text>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.pageBg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={cpStyles.header}>
          <TouchableOpacity onPress={onClose} style={cpStyles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={cpStyles.headerTitle}>Select Contact</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={cpStyles.searchRow}>
          <Ionicons name="search-outline" size={18} color={colors.muted} style={{ marginRight: 8 }} />
          <TextInput style={cpStyles.searchInput} value={query} onChangeText={setQuery} placeholder="Search contacts…" placeholderTextColor={colors.muted} autoCorrect={false} clearButtonMode="while-editing" />
          {query.length > 0 && Platform.OS === 'android' && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
        {loading ? (
          <View style={cpStyles.centre}><ActivityIndicator size={36} color={colors.primary} /><Text style={cpStyles.centreText}>Loading contacts…</Text></View>
        ) : permissionDenied ? (
          <View style={cpStyles.centre}>
            <Ionicons name="lock-closed-outline" size={52} color={colors.muted} />
            <Text style={cpStyles.centreTitle}>Permission denied</Text>
            <Text style={cpStyles.centreText}>SpendBook needs access to your contacts.{'\n'}Go to Settings → SpendBook → Contacts and enable access.</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={cpStyles.centre}>
            <Ionicons name="person-outline" size={52} color={colors.muted} />
            <Text style={cpStyles.centreTitle}>{query.trim() ? 'No matches' : 'No contacts found'}</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id ?? item.name ?? String(Math.random())}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
            ItemSeparatorComponent={() => <View style={cpStyles.separator} />}
            renderItem={({ item }) => (
              <TouchableOpacity style={cpStyles.contactRow} onPress={() => { onSelect(item.name!); onClose(); }} activeOpacity={0.7}>
                <Initials name={item.name!} />
                <Text style={cpStyles.contactName}>{item.name}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </TouchableOpacity>
            )}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main styles factory ───────────────────────────────────────────────────────

const makeStyles = (C: AppColors) => StyleSheet.create({
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border },
  typeBtnIn: { backgroundColor: C.cashIn, borderColor: C.cashIn },
  typeBtnOut: { backgroundColor: C.cashOut, borderColor: C.cashOut },
  typeBtnTransfer: { backgroundColor: C.balance, borderColor: C.balance },
  typeBtnText: { fontSize: 13, fontWeight: '700', color: C.body },
  label: { fontSize: 13, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 16 },
  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14 },
  rupee: { fontSize: 22, color: C.primary, fontWeight: '700', marginRight: 4 },
  amountInput: { flex: 1, fontSize: 24, fontWeight: '700', color: C.body, paddingVertical: 14 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: '#ede9fe', borderColor: C.primary },
  chipText: { fontSize: 12, color: C.muted, fontWeight: '500' },
  chipTextActive: { color: C.primary, fontWeight: '700' },
  selector: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 14 },
  selectorText: { flex: 1, fontSize: 14, color: C.muted },
  selectorFilled: { borderColor: C.primary, borderWidth: 1.5 },
  input: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.body },
  saveBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 32 },
  saveBtnText: { color: C.white, fontSize: 16, fontWeight: '700' },
  pmRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 20, borderTopWidth: 0.5, borderTopColor: C.border },
  pmLabel: { flex: 1, fontSize: 14, color: C.body, fontWeight: '500' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personInput: { flex: 1, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.body },
  contactBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.primary + '40' },
});

// ─── Edit Transaction Screen ───────────────────────────────────────────────────

export default function EditTransactionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { methods } = usePaymentMethods(user?.id ?? null);
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [txnType, setTxnType] = useState<TransactionType>('out');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [toPaymentMethodId, setToPaymentMethodId] = useState<string | null>(null);
  const [person, setPerson] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fromSheetVisible, setFromSheetVisible] = useState(false);
  const [toSheetVisible, setToSheetVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [contactPickerVisible, setContactPickerVisible] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const noteY = useRef(0);

  const isTransfer = txnType === 'transfer';
  const categories = getCategoriesForType(isTransfer ? 'out' : txnType);
  const fromMethod = methods.find((m) => m.id === paymentMethodId);
  const toMethod = methods.find((m) => m.id === toPaymentMethodId);

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
          setTxnType(t.type);
          setAmount(t.amount.toString());
          setCategory(t.category);
          setPaymentMethodId(t.payment_method_id);
          setToPaymentMethodId(t.to_payment_method_id);
          setPerson(t.person ?? '');
          setNote(t.note);
          setDate(t.date);
        }
        setLoading(false);
      });
  }, [id]);

  function switchType(t: TransactionType) {
    setTxnType(t);
    setCategory('');
    setPaymentMethodId(null);
    setToPaymentMethodId(null);
  }

  async function handleSave() {
    const amtNum = parseFloat(amount);
    if (!amount || isNaN(amtNum) || amtNum <= 0) { Alert.alert('Validation', 'Enter a valid amount greater than 0.'); return; }
    if (!isTransfer && !category) { Alert.alert('Validation', 'Please select a category.'); return; }
    if (!id) return;
    setSaving(true);
    try {
      await updateTransaction(id, {
        type: txnType,
        amount: amtNum,
        category: isTransfer ? 'other' : category,
        payment_method_id: paymentMethodId,
        to_payment_method_id: isTransfer ? toPaymentMethodId : null,
        person: person.trim(),
        note: note.trim(),
        date,
      });
      router.back();
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.pageBg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={{ padding: 20, paddingBottom: 100 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Type Toggle */}
        <View style={styles.typeRow}>
          <TouchableOpacity style={[styles.typeBtn, txnType === 'in' && styles.typeBtnIn]} onPress={() => switchType('in')} activeOpacity={0.8}>
            <Ionicons name="arrow-down-outline" size={16} color={txnType === 'in' ? colors.white : colors.cashIn} />
            <Text style={[styles.typeBtnText, txnType === 'in' && { color: colors.white }]}>Cash In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.typeBtn, txnType === 'out' && styles.typeBtnOut]} onPress={() => switchType('out')} activeOpacity={0.8}>
            <Ionicons name="arrow-up-outline" size={16} color={txnType === 'out' ? colors.white : colors.cashOut} />
            <Text style={[styles.typeBtnText, txnType === 'out' && { color: colors.white }]}>Cash Out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.typeBtn, isTransfer && styles.typeBtnTransfer]} onPress={() => switchType('transfer')} activeOpacity={0.8}>
            <Ionicons name="swap-horizontal-outline" size={16} color={isTransfer ? colors.white : colors.balance} />
            <Text style={[styles.typeBtnText, isTransfer && { color: colors.white }]}>Transfer</Text>
          </TouchableOpacity>
        </View>

        {/* Amount */}
        <Text style={styles.label}>Amount *</Text>
        <View style={styles.amountRow}>
          <Text style={styles.rupee}>₹</Text>
          <TextInput style={styles.amountInput} value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor={colors.muted} keyboardType="decimal-pad" />
        </View>

        {/* Category */}
        {!isTransfer && (
          <>
            <Text style={styles.label}>Category *</Text>
            <View style={styles.chipGrid}>
              {categories.map((c) => (
                <TouchableOpacity key={c.key} style={[styles.chip, category === c.key && styles.chipActive]} onPress={() => setCategory(c.key)} activeOpacity={0.7}>
                  <Text style={{ fontSize: 14 }}>{c.emoji}</Text>
                  <Text style={[styles.chipText, category === c.key && styles.chipTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Payment Method(s) */}
        {isTransfer ? (
          <>
            <Text style={styles.label}>From Account</Text>
            <TouchableOpacity style={[styles.selector, paymentMethodId && styles.selectorFilled]} onPress={() => setFromSheetVisible(true)} activeOpacity={0.8}>
              <Ionicons name="arrow-up-circle-outline" size={18} color={paymentMethodId ? colors.cashOut : colors.muted} />
              <Text style={[styles.selectorText, fromMethod && { color: colors.body }]}>{fromMethod ? paymentLabel(fromMethod) : 'Select source account (optional)'}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.muted} />
            </TouchableOpacity>
            <Text style={styles.label}>To Account</Text>
            <TouchableOpacity style={[styles.selector, toPaymentMethodId && styles.selectorFilled]} onPress={() => setToSheetVisible(true)} activeOpacity={0.8}>
              <Ionicons name="arrow-down-circle-outline" size={18} color={toPaymentMethodId ? colors.cashIn : colors.muted} />
              <Text style={[styles.selectorText, toMethod && { color: colors.body }]}>{toMethod ? paymentLabel(toMethod) : 'Select destination account (optional)'}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.muted} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>Payment Method</Text>
            <TouchableOpacity style={styles.selector} onPress={() => setFromSheetVisible(true)} activeOpacity={0.8}>
              <Ionicons name="card-outline" size={18} color={colors.muted} />
              <Text style={[styles.selectorText, fromMethod && { color: colors.body }]}>{fromMethod ? paymentLabel(fromMethod) : 'Select payment method (optional)'}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.muted} />
            </TouchableOpacity>
          </>
        )}

        {/* Person */}
        <Text style={styles.label}>{txnType === 'in' ? 'Received From' : txnType === 'out' ? 'Paid To' : 'Person / Note'}</Text>
        <View style={styles.personRow}>
          <TextInput
            style={styles.personInput}
            value={person}
            onChangeText={setPerson}
            placeholder={txnType === 'in' ? 'e.g. Dad, Client name…' : txnType === 'out' ? 'e.g. Amazon, Zomato…' : 'e.g. Savings account, Dad…'}
            placeholderTextColor={colors.muted}
            maxLength={100}
          />
          <TouchableOpacity style={styles.contactBtn} onPress={() => setContactPickerVisible(true)} activeOpacity={0.7} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
            <Ionicons name="person-add-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Note */}
        <View onLayout={(e) => { noteY.current = e.nativeEvent.layout.y; }}>
          <Text style={styles.label}>Note</Text>
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            placeholder="Optional note…"
            placeholderTextColor={colors.muted}
            maxLength={200}
            onFocus={() => scrollViewRef.current?.scrollTo({ y: noteY.current - 16, animated: true })}
          />
        </View>

        {/* Date */}
        <Text style={styles.label}>Date</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setDatePickerVisible(true)} activeOpacity={0.8}>
          <Ionicons name="calendar-outline" size={18} color={colors.muted} />
          <Text style={[styles.selectorText, { color: colors.body }]}>{date}</Text>
        </TouchableOpacity>

        {/* Save */}
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator size={20} color={colors.white} /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>

      <BottomSheet visible={fromSheetVisible} onClose={() => setFromSheetVisible(false)} title={isTransfer ? 'From Account' : 'Payment Method'}>
        <TouchableOpacity style={styles.pmRow} onPress={() => { setPaymentMethodId(null); setFromSheetVisible(false); }}>
          <Ionicons name="cash-outline" size={20} color={colors.muted} />
          <Text style={styles.pmLabel}>Cash (no method)</Text>
          {!paymentMethodId ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
        </TouchableOpacity>
        {methods.map((m) => (
          <TouchableOpacity key={m.id} style={styles.pmRow} onPress={() => { setPaymentMethodId(m.id); setFromSheetVisible(false); }}>
            <Ionicons name="card-outline" size={20} color={colors.muted} />
            <Text style={styles.pmLabel}>{paymentLabel(m)}</Text>
            {paymentMethodId === m.id ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
          </TouchableOpacity>
        ))}
      </BottomSheet>

      <BottomSheet visible={toSheetVisible} onClose={() => setToSheetVisible(false)} title="To Account">
        <TouchableOpacity style={styles.pmRow} onPress={() => { setToPaymentMethodId(null); setToSheetVisible(false); }}>
          <Ionicons name="cash-outline" size={20} color={colors.muted} />
          <Text style={styles.pmLabel}>Cash (no method)</Text>
          {!toPaymentMethodId ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
        </TouchableOpacity>
        {methods.map((m) => (
          <TouchableOpacity key={m.id} style={styles.pmRow} onPress={() => { setToPaymentMethodId(m.id); setToSheetVisible(false); }}>
            <Ionicons name="card-outline" size={20} color={colors.muted} />
            <Text style={styles.pmLabel}>{paymentLabel(m)}</Text>
            {toPaymentMethodId === m.id ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
          </TouchableOpacity>
        ))}
      </BottomSheet>

      <CalendarModal visible={datePickerVisible} value={date} onClose={() => setDatePickerVisible(false)} onConfirm={setDate} />
      <ContactPickerModal visible={contactPickerVisible} onClose={() => setContactPickerVisible(false)} onSelect={(name) => setPerson(name)} />
    </KeyboardAvoidingView>
  );
}
