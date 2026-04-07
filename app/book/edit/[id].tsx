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
import { getBook, updateBook } from '../../../lib/supabase';
import { Colors } from '../../../constants/colors';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';

const BOOK_COLORS = Colors.bookColors;
const BOOK_EMOJIS = ['📒', '💰', '🏠', '🏥', '🎓', '🛒', '✈️', '🏋️', '🍽️', '💼', '🎁', '🚗'];

export default function EditBookScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [colorTag, setColorTag] = useState(BOOK_COLORS[0]);
  const [iconEmoji, setIconEmoji] = useState(BOOK_EMOJIS[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getBook(id).then((book) => {
      if (book) {
        setName(book.name);
        setDescription(book.description);
        setColorTag(book.color_tag);
        setIconEmoji(book.icon_emoji);
      }
      setLoading(false);
    });
  }, [id]);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Validation', 'Book name is required.');
      return;
    }
    if (!id) return;
    setSaving(true);
    try {
      await updateBook(id, {
        name: name.trim(),
        description: description.trim(),
        color_tag: colorTag,
        icon_emoji: iconEmoji,
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
    <ScrollView style={{ flex: 1, backgroundColor: Colors.pageBg }} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        {/* Preview */}
        <View style={[styles.preview, { borderLeftColor: colorTag }]}>
          <Text style={{ fontSize: 36 }}>{iconEmoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.previewName}>{name || 'Book Name'}</Text>
            {description ? <Text style={styles.previewDesc}>{description}</Text> : null}
          </View>
        </View>

        <Text style={styles.label}>Book Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Book name"
          placeholderTextColor={Colors.muted}
          maxLength={50}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Optional description…"
          placeholderTextColor={Colors.muted}
          multiline
          maxLength={200}
        />

        <Text style={styles.label}>Icon</Text>
        <View style={styles.grid}>
          {BOOK_EMOJIS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={[styles.emojiBtn, iconEmoji === emoji && styles.emojiBtnActive]}
              onPress={() => setIconEmoji(emoji)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 24 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Color</Text>
        <View style={styles.colorRow}>
          {BOOK_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.colorDot, { backgroundColor: c }, colorTag === c && styles.colorDotActive]}
              onPress={() => setColorTag(c)}
              activeOpacity={0.7}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size={20} color={Colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  preview: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderLeftWidth: 6,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  previewName: { fontSize: 18, fontWeight: '700', color: Colors.body },
  previewDesc: { fontSize: 13, color: Colors.muted, marginTop: 2 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.body,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBtnActive: {
    borderColor: Colors.primary,
    borderWidth: 2.5,
    backgroundColor: '#ede9fe',
  },
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  colorDotActive: { borderWidth: 3, borderColor: Colors.body },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
