import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';

/**
 * OAuth callback screen — mounted when Supabase redirects back to
 * spendbook://auth/callback?code=<pkce_code>
 *
 * expo-router routes the deep link here automatically.
 * We exchange the PKCE code for a session, then navigate.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    handleCallback();
  }, []);

  async function handleCallback() {
    // 1. Try code from expo-router search params (PKCE)
    const code = params.code;
    if (code) {
      await exchangeCode(code);
      return;
    }

    // 2. Fallback: parse the full URL from Linking (handles hash-based tokens)
    const url = await Linking.getInitialURL();
    if (url) {
      await handleUrl(url);
      return;
    }

    // 3. Nothing found — show error
    fail('No authorization code received. Please try signing in again.');
  }

  async function exchangeCode(code: string) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      fail(error.message);
    } else {
      router.replace('/(tabs)');
    }
  }

  async function handleUrl(url: string) {
    // PKCE code in query string
    const parsed = Linking.parse(url);
    const code = parsed.queryParams?.code as string | undefined;
    if (code) {
      await exchangeCode(code);
      return;
    }

    // Implicit flow — access_token in hash fragment
    const hash = url.split('#')[1] ?? '';
    const hashParams = new URLSearchParams(hash);
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    if (accessToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken ?? '',
      });
      if (error) {
        fail(error.message);
      } else {
        router.replace('/(tabs)');
      }
      return;
    }

    // Error param from OAuth provider
    if (params.error) {
      fail(params.error_description ?? params.error ?? 'OAuth error');
      return;
    }

    fail('Could not complete sign-in. Please try again.');
  }

  function fail(msg: string) {
    setErrorMsg(msg);
    setStatus('error');
    // Auto-redirect to login after 3 seconds
    setTimeout(() => router.replace('/'), 3000);
  }

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorTitle}>Sign-in failed</Text>
        <Text style={styles.errorMsg}>{errorMsg}</Text>
        <Text style={styles.redirect}>Redirecting to login…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size={36} color={Colors.primary} />
      <Text style={styles.loadingText}>Completing sign-in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.muted,
    fontWeight: '500',
  },
  errorEmoji: {
    fontSize: 52,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.body,
  },
  errorMsg: {
    fontSize: 14,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  redirect: {
    fontSize: 13,
    color: Colors.muted,
    fontStyle: 'italic',
  },
});
