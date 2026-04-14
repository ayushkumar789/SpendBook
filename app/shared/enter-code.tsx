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
import { getBookByAnyShareId } from '../../lib/supabase';
import { Colors } from '../../constants/colors';

export default function EnterCodeScreen() {
  const router = useRouter();
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
      router.push(`/shared/${trimmed}`);
    } catch {
      Alert.alert('Error', 'Failed to look up the code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.pageBg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Ionicons name="qr-code-outline" size={56} color={Colors.primary} />
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
          placeholderTextColor={Colors.muted}
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
            <ActivityIndicator size={20} color={Colors.white} />
          ) : (
            <>
              <Ionicons name="eye-outline" size={18} color={Colors.white} />
              <Text style={styles.btnText}>View Shared Book</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.body,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  input: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: Colors.body,
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
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%',
  },
  btnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
