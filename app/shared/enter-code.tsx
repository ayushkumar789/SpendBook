import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBookByAnyShareId } from '../../lib/supabase';
import { useTheme } from '../../hooks/useTheme';
import { AppColors } from '../../constants/colors';

const SAVED_SHARED_KEY = 'saved_shared_books';

export default function EnterCodeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const trimmed = code.trim();
    if (!trimmed) {
      Alert.alert('Enter a code', 'Please paste or type the share code.');
      return;
    }
    setLoading(true);
    try {
      const result = await getBookByAnyShareId(trimmed);
      if (!result) {
        Alert.alert('Not Found', 'No shared book found with that code. Please check and try again.');
        return;
      }
      // Persist full-access codes so the home screen can show them permanently
      if (result.accessLevel === 'full') {
        try {
          const raw = await AsyncStorage.getItem(SAVED_SHARED_KEY);
          const codes: string[] = raw ? JSON.parse(raw) : [];
          if (!codes.includes(trimmed)) {
            codes.push(trimmed);
            await AsyncStorage.setItem(SAVED_SHARED_KEY, JSON.stringify(codes));
          }
        } catch {
          // storage failure is non-fatal
        }
      }
      router.push(`/shared/${trimmed}`);
    } catch {
      Alert.alert('Error', 'Failed to look up the code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.pageBg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Ionicons name="qr-code-outline" size={56} color={colors.primary} />
        </View>
        <Text style={styles.title}>Enter Share Code</Text>
        <Text style={styles.subtitle}>
          Ask the book owner to share the code with you, then paste it below to view the book in real-time.
        </Text>

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="Paste share code here…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity
          style={[styles.btn, (!code.trim() || loading) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={!code.trim() || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size={20} color={colors.white} />
          ) : (
            <>
              <Ionicons name="eye-outline" size={18} color={colors.white} />
              <Text style={styles.btnText}>View Shared Book</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (C: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 25,
    backgroundColor: C.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: C.body,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  input: {
    width: '100%',
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: C.body,
    fontFamily: 'monospace',
    marginBottom: 20,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%',
  },
  btnText: {
    color: C.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
