import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signInWithGoogle } from '../lib/supabase';
import { Colors } from '../constants/colors';

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    if (loading) return;
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed. Please try again.';
      Alert.alert('Sign-in failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Text style={{ fontSize: 48 }}>📒</Text>
        </View>
        <Text style={styles.appName}>SpendBook</Text>
        <Text style={styles.tagline}>Track every rupee, every day</Text>
      </View>

      {/* Feature bullets */}
      <View style={styles.features}>
        {[
          { icon: 'book-outline', text: 'Multiple expense books' },
          { icon: 'people-outline', text: 'Share with family in real-time' },
          { icon: 'analytics-outline', text: 'Charts & spending insights' },
          { icon: 'card-outline', text: 'Track all payment methods' },
        ].map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Ionicons name={f.icon as keyof typeof Ionicons.glyphMap} size={20} color={Colors.secondary} />
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      {/* Sign In Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.googleBtn, loading && { opacity: 0.7 }]}
          onPress={handleGoogleSignIn}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Ionicons name="logo-google" size={20} color={Colors.body} />
          <Text style={styles.googleBtnText}>
            {loading ? 'Signing in…' : 'Continue with Google'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.codeBtn}
          onPress={() => router.push('/shared/enter-code')}
          activeOpacity={0.85}
        >
          <Ionicons name="qr-code-outline" size={18} color={Colors.white} />
          <Text style={styles.codeBtnText}>Enter a Share Code</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>Your data is stored securely in Supabase</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
  },
  features: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 20,
    gap: 14,
    marginBottom: 40,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '500',
  },
  actions: {
    gap: 12,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.body,
  },
  codeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  codeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  footer: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 32,
  },
});
