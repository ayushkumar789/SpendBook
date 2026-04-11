import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useBooks } from '../../hooks/useBooks';
import { useTheme } from '../../hooks/useTheme';
import { deleteBook } from '../../lib/supabase';
import { Book } from '../../constants/types';
import { AppColors } from '../../constants/colors';
import { formatCurrency } from '../../lib/format';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { FAB } from '../../components/ui/FAB';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { useTransactions as useBookTransactions } from '../../hooks/useTransactions';

function BookStatsRow({ bookId }: { bookId: string }) {
  const { cashIn, cashOut, balance } = useBookTransactions(bookId);
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={[{ flex: 1, borderRadius: 8, padding: 8, alignItems: 'center' }, { backgroundColor: colors.cashInBg }]}>
        <Text style={{ fontSize: 10, fontWeight: '600', marginBottom: 2, color: colors.cashInDark }}>Cash In</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.cashIn }} numberOfLines={1}>{formatCurrency(cashIn)}</Text>
      </View>
      <View style={[{ flex: 1, borderRadius: 8, padding: 8, alignItems: 'center' }, { backgroundColor: colors.cashOutBg }]}>
        <Text style={{ fontSize: 10, fontWeight: '600', marginBottom: 2, color: colors.cashOutDark }}>Cash Out</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.cashOut }} numberOfLines={1}>{formatCurrency(cashOut)}</Text>
      </View>
      <View style={[{ flex: 1, borderRadius: 8, padding: 8, alignItems: 'center' }, { backgroundColor: colors.balanceBg }]}>
        <Text style={{ fontSize: 10, fontWeight: '600', marginBottom: 2, color: colors.balanceDark }}>Balance</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.balance }} numberOfLines={1}>{formatCurrency(balance)}</Text>
      </View>
    </View>
  );
}

function BookCard({ book, onPress, onLongPress }: { book: Book; onPress: () => void; onLongPress: () => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.85}>
      <View style={[styles.colorAccent, { backgroundColor: book.color_tag }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.bookEmoji}>{book.icon_emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bookName}>{book.name}</Text>
            {book.description ? (
              <Text style={styles.bookDesc} numberOfLines={1}>{book.description}</Text>
            ) : null}
          </View>
          {book.is_shared ? (
            <View style={styles.sharedBadge}>
              <Ionicons name="people" size={12} color={colors.primary} />
              <Text style={styles.sharedText}>Shared</Text>
            </View>
          ) : null}
        </View>
        <BookStatsRow bookId={book.id} />
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { books, loading } = useBooks(user?.id ?? null);
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [activeBook, setActiveBook] = useState<Book | null>(null);

  const styles = makeStyles(colors);

  async function handleDelete(book: Book) {
    setActiveBook(null);
    Alert.alert(
      'Delete Book',
      `Delete "${book.name}"? This will also delete all its transactions permanently.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBook(book.id);
            } catch {
              Alert.alert('Error', 'Failed to delete book.');
            }
          },
        },
      ]
    );
  }

  async function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {books.length === 0 ? (
          <EmptyState
            emoji="📒"
            title="No books yet"
            subtitle="Tap the + button to create your first expense book"
          />
        ) : (
          books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onPress={() => router.push(`/book/${book.id}`)}
              onLongPress={() => setActiveBook(book)}
            />
          ))
        )}
      </ScrollView>
      <FAB onPress={() => router.push('/book/create')} />

      <BottomSheet
        visible={activeBook !== null}
        onClose={() => setActiveBook(null)}
        title={activeBook?.name}
      >
        <TouchableOpacity
          style={styles.optRow}
          onPress={() => { setActiveBook(null); router.push(`/book/${activeBook!.id}`); }}
          activeOpacity={0.7}
        >
          <Ionicons name="book-open-outline" size={22} color={colors.body} />
          <Text style={styles.optLabel}>Open Book</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.optRow}
          onPress={() => { setActiveBook(null); router.push(`/book/edit/${activeBook!.id}`); }}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil-outline" size={22} color={colors.body} />
          <Text style={styles.optLabel}>Edit Book</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.optRow, { borderBottomWidth: 0 }]}
          onPress={() => handleDelete(activeBook!)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={22} color={colors.cashOut} />
          <Text style={[styles.optLabel, { color: colors.cashOut }]}>Delete Book</Text>
        </TouchableOpacity>
      </BottomSheet>
    </View>
  );
}

const makeStyles = (C: AppColors) => StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 0.5,
    borderColor: C.border,
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  colorAccent: { width: 6 },
  cardBody: { flex: 1, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  bookEmoji: { fontSize: 28 },
  bookName: { fontSize: 16, fontWeight: '700', color: C.body },
  bookDesc: { fontSize: 12, color: C.muted, marginTop: 2 },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ede9fe',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  sharedText: { fontSize: 10, color: C.primary, fontWeight: '600' },
  optRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  optLabel: { fontSize: 15, fontWeight: '500', color: C.body },
});
