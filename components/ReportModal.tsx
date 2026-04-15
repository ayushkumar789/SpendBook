import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Transaction, Book, PaymentMethod, PaymentMethodGroupWithMembers } from '../constants/types';
import { AppColors } from '../constants/colors';
import { useTheme } from '../hooks/useTheme';
import { getUpiAppByKey } from '../constants/upiApps';
import { generateAndSharePdf, ReportOptions } from '../lib/generatePdf';

// ─── date presets ────────────────────────────────────────────────────────────

type DatePreset = 'all' | 'this_month' | 'last_month' | 'last_3' | 'last_6' | 'custom';

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'all', label: 'All Time' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'last_3', label: '3 Months' },
  { key: 'last_6', label: '6 Months' },
  { key: 'custom', label: 'Custom' },
];

function getPresetDates(preset: DatePreset): { start: string | null; end: string | null } {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().split('T')[0];
  const todayStr = iso(today);

  switch (preset) {
    case 'all':
      return { start: null, end: null };
    case 'this_month':
      return { start: iso(new Date(today.getFullYear(), today.getMonth(), 1)), end: todayStr };
    case 'last_month': {
      const firstOfThis = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastOfPrev = new Date(firstOfThis.getTime() - 86400000);
      const firstOfPrev = new Date(lastOfPrev.getFullYear(), lastOfPrev.getMonth(), 1);
      return { start: iso(firstOfPrev), end: iso(lastOfPrev) };
    }
    case 'last_3':
      return { start: iso(new Date(today.getFullYear(), today.getMonth() - 2, 1)), end: todayStr };
    case 'last_6':
      return { start: iso(new Date(today.getFullYear(), today.getMonth() - 5, 1)), end: todayStr };
    default:
      return { start: null, end: null };
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function pmLabel(m: PaymentMethod): string {
  if (m.payment_type === 'UPI') {
    const appName = m.upi_app_is_custom ? m.upi_app_name : getUpiAppByKey(m.upi_app ?? '')?.name;
    const suffix = m.last_four_digits ? ` ••${m.last_four_digits}` : '';
    return `${appName ?? 'UPI'} • ${m.bank_name}${suffix}`;
  }
  return `${m.bank_name}${m.last_four_digits ? ` ••${m.last_four_digits}` : ''}`;
}

// ─── component ───────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  book: Book;
  transactions: Transaction[];
  methods: PaymentMethod[];
  groups: PaymentMethodGroupWithMembers[];
}

export function ReportModal({ visible, onClose, book, transactions, methods, groups }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [methodFilter, setMethodFilter] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const hasCash = useMemo(() => transactions.some((t) => !t.payment_method_id), [transactions]);

  const resolvedDates = useMemo(() => {
    if (preset === 'custom') return { start: customStart || null, end: customEnd || null };
    return getPresetDates(preset);
  }, [preset, customStart, customEnd]);

  const datePreviewText = useMemo(() => {
    const { start, end } = resolvedDates;
    if (start && end) return `${start}  →  ${end}`;
    if (start) return `From ${start}`;
    if (end) return `Up to ${end}`;
    return 'All time — no date filter';
  }, [resolvedDates]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const options: ReportOptions = {
        book,
        transactions,
        methods,
        groups,
        dateStart: resolvedDates.start,
        dateEnd: resolvedDates.end,
        methodFilter,
      };
      await generateAndSharePdf(options);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to generate PDF.');
    } finally {
      setGenerating(false);
    }
  }

  const showMethodSection = methods.length > 0 || hasCash || groups.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.pageBg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Modal header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="document-text-outline" size={20} color={colors.primary} />
            <Text style={styles.title}>Generate Report</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color={colors.body} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Date Range ─────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>Date Range</Text>
          <View style={styles.presetRow}>
            {DATE_PRESETS.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[styles.presetChip, preset === p.key && styles.presetChipActive]}
                onPress={() => setPreset(p.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.presetChipText, preset === p.key && styles.presetChipTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {preset === 'custom' && (
            <View style={styles.customRow}>
              <View style={styles.customField}>
                <Text style={styles.customLabel}>From (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.customInput}
                  value={customStart}
                  onChangeText={setCustomStart}
                  placeholder="2025-01-01"
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
              <View style={styles.customField}>
                <Text style={styles.customLabel}>To (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.customInput}
                  value={customEnd}
                  onChangeText={setCustomEnd}
                  placeholder="2025-12-31"
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
            </View>
          )}

          <View style={styles.datePreview}>
            <Ionicons name="calendar-outline" size={13} color={colors.primary} />
            <Text style={styles.datePreviewText}>{datePreviewText}</Text>
          </View>

          {/* ── Payment Method ─────────────────────────────────── */}
          {showMethodSection && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 22 }]}>Payment Method</Text>
              <View style={styles.methodList}>

                {/* All Methods */}
                <TouchableOpacity
                  style={[styles.methodRow, methodFilter === null && styles.methodRowActive]}
                  onPress={() => setMethodFilter(null)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.methodIcon, methodFilter === null && { backgroundColor: colors.primary + '18' }]}>
                    <Ionicons name="apps-outline" size={15} color={methodFilter === null ? colors.primary : colors.muted} />
                  </View>
                  <Text style={[styles.methodRowLabel, methodFilter === null && styles.methodRowLabelActive]}>
                    All Methods
                  </Text>
                  {methodFilter === null && <Ionicons name="checkmark-circle" size={17} color={colors.primary} />}
                </TouchableOpacity>

                {/* Groups */}
                {groups.map((g) => {
                  const isActive = methodFilter === `__grp__:${g.id}`;
                  return (
                    <TouchableOpacity
                      key={g.id}
                      style={[styles.methodRow, isActive && styles.methodRowActive]}
                      onPress={() => setMethodFilter(`__grp__:${g.id}`)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.methodIcon, { backgroundColor: g.color + '22' }]}>
                        <Ionicons name="folder-outline" size={15} color={g.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.methodRowLabel, isActive && styles.methodRowLabelActive]} numberOfLines={1}>
                          {g.name}
                        </Text>
                        <Text style={styles.methodRowSub}>
                          {g.member_ids.length} method{g.member_ids.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      {isActive && <Ionicons name="checkmark-circle" size={17} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}

                {/* Cash */}
                {hasCash && (
                  <TouchableOpacity
                    style={[styles.methodRow, methodFilter === '__cash__' && styles.methodRowActive]}
                    onPress={() => setMethodFilter('__cash__')}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.methodIcon, methodFilter === '__cash__' && { backgroundColor: colors.primary + '18' }]}>
                      <Ionicons name="cash-outline" size={15} color={methodFilter === '__cash__' ? colors.primary : colors.muted} />
                    </View>
                    <Text style={[styles.methodRowLabel, { flex: 1 }, methodFilter === '__cash__' && styles.methodRowLabelActive]}>
                      Cash
                    </Text>
                    {methodFilter === '__cash__' && <Ionicons name="checkmark-circle" size={17} color={colors.primary} />}
                  </TouchableOpacity>
                )}

                {/* Individual payment methods */}
                {methods.map((m) => {
                  const isActive = methodFilter === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.methodRow, isActive && styles.methodRowActive]}
                      onPress={() => setMethodFilter(m.id)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.methodIcon, isActive && { backgroundColor: colors.primary + '18' }]}>
                        <Ionicons
                          name={m.payment_type === 'UPI' ? 'phone-portrait-outline' : 'card-outline'}
                          size={15}
                          color={isActive ? colors.primary : colors.muted}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.methodRowLabel, isActive && styles.methodRowLabelActive]} numberOfLines={1}>
                          {pmLabel(m)}
                        </Text>
                        <Text style={styles.methodRowSub}>{m.payment_type}</Text>
                      </View>
                      {isActive && <Ionicons name="checkmark-circle" size={17} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>

        {/* Generate button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.generateBtn, generating && { opacity: 0.6 }]}
            onPress={handleGenerate}
            disabled={generating}
            activeOpacity={0.85}
          >
            {generating ? (
              <ActivityIndicator size={20} color={colors.white} />
            ) : (
              <>
                <Ionicons name="document-text-outline" size={18} color={colors.white} />
                <Text style={styles.generateBtnText}>Generate &amp; Share PDF</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const makeStyles = (C: AppColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
      backgroundColor: C.card,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 18, fontWeight: '800', color: C.body },
    closeBtn: { padding: 4 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: C.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    presetChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
    },
    presetChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    presetChipText: { fontSize: 13, color: C.muted, fontWeight: '500' },
    presetChipTextActive: { color: C.white, fontWeight: '700' },
    customRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    customField: { flex: 1 },
    customLabel: { fontSize: 11, color: C.muted, fontWeight: '500', marginBottom: 5 },
    customInput: {
      backgroundColor: C.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      color: C.body,
      fontFamily: 'monospace',
    },
    datePreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: C.primary + '10',
      borderRadius: 9,
      paddingHorizontal: 13,
      paddingVertical: 9,
    },
    datePreviewText: { fontSize: 12, color: C.primary, fontWeight: '500', flex: 1 },
    methodList: {
      backgroundColor: C.card,
      borderRadius: 13,
      borderWidth: 0.5,
      borderColor: C.border,
      overflow: 'hidden',
    },
    methodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    methodRowActive: { backgroundColor: C.primary + '0c' },
    methodRowLabel: { fontSize: 13, color: C.body, fontWeight: '500', flex: 1 },
    methodRowLabelActive: { color: C.primary, fontWeight: '700' },
    methodRowSub: { fontSize: 10, color: C.muted, marginTop: 1 },
    methodIcon: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: C.pageBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footer: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
      backgroundColor: C.card,
    },
    generateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.primary,
      borderRadius: 14,
      paddingVertical: 16,
    },
    generateBtnText: { color: C.white, fontSize: 16, fontWeight: '700' },
  });
