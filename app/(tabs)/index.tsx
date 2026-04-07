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
import { useTransactions } from '../../hooks/useTransactions';
import { deleteBook } from '../../lib/supabase';
import { Book } from '../../constants/types';
import { Colors } from '../../constants/colors';
import { formatCurrency } from '../../lib/format';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { FAB } from '../../components/ui/FAB';
import { useTransactions as useBookTransactions } from '../../hooks/useTransactions';

// Book stats card shown inside the book list item
function BookStatsRow({ bookId }: { bookId: string }) {
  const { cashIn, cashOut, balance } = useBookTransactions(bookId);
  return (
    <View style={styles.statsRow}>
      <View style={[styles.statBox, { backgroundColor: Colors.cashInBg }]}>
        <Text style={[styles.statLabel, { color: Colors.cashInDark }]}>Cash In</Text>
        <Text style={[styles.statValue, { color: Colors.cashIn }]} numberOfLines={1}>
          {formatCurrency(cashIn)}
        </Text>
      </View>
      <View style={[styles.statBox, { backgroundColor: Colors.cashOutBg }]}>
        <Text style={[styles.statLabel, { color: Colors.cashOutDark }]}>Cash Out</Text>
        <Text style={[styles.statValue, { color: Colors.cashOut }]} numberOfLines={1}>
          {formatCurrency(cashOut)}
        </Text>
      </View>
      <View style={[styles.statBox, { backgroundColor: Colors.balanceBg }]}>
        <Text style={[styles.statLabel, { color: Colors.balanceDark }]}>Balance</Text>
        <Text style={[styles.statValue, { color: Colors.balance }]} numberOfLines={1}>
          {formatCurrency(balance)}
        </Text>
      </View>
    </View>
  );
}

function BookCard({ book, onPress, onLongPress }: { book: Book; onPress: () => void; onLongPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.85}
    >
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
              <Ionicons name="people" size={12} color={Colors.primary} />
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
  const [refreshing, setRefreshing] = useState(false);

  async function handleDelete(book: Book) {
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

  function showBookOptions(book: Book) {
    Alert.alert(book.name, 'Choose an action', [
      { text: 'Open', onPress: () => router.push(`/book/${book.id}`) },
      { text: 'Edit', onPress: () => router.push(`/book/edit/${book.id}`) },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(book) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.pageBg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
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
              onLongPress={() => showBookOptions(book)}
            />
          ))
        )}
      </ScrollView>
      <FAB onPress={() => router.push('/book/create')} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 0.5,
    borderColor: Colors.border,
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  colorAccent: {
    width: 6,
  },
  cardBody: {
    flex: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  bookEmoji: {
    fontSize: 28,
  },
  bookName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.body,
  },
  bookDesc: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ede9fe',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  sharedText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
  },
});
