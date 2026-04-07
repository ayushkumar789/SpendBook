import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Colors } from '../constants/colors';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    const onLoginPage = segments.length === 0 || segments[0] === 'index';
    const onSharedPage = segments[0] === 'shared';
    const onCallbackPage = segments[0] === 'auth';

    if (session && onLoginPage) {
      // Authenticated user landed on login — send them home.
      router.replace('/(tabs)');
    } else if (!session && !onLoginPage && !onSharedPage && !onCallbackPage) {
      // Unauthenticated user tried to access a protected screen — send to login.
      router.replace('/');
    }
  }, [session, loading, segments]);

  // Handle deep links for OAuth callback
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (url.includes('auth/callback') || url.includes('access_token') || url.includes('code=')) {
        const parsed = Linking.parse(url);
        const code = parsed.queryParams?.code as string | undefined;
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
          return;
        }
        const hash = url.split('#')[1] ?? '';
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken ?? '',
          });
        }
      }
    };

    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: Colors.pageBg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="book/create" options={{ title: 'Create Book', presentation: 'modal' }} />
        <Stack.Screen name="book/[id]" options={{ title: 'Book Detail' }} />
        <Stack.Screen name="book/edit/[id]" options={{ title: 'Edit Book', presentation: 'modal' }} />
        <Stack.Screen name="transaction/add" options={{ title: 'Add Transaction', presentation: 'modal' }} />
        <Stack.Screen name="transaction/edit/[id]" options={{ title: 'Edit Transaction', presentation: 'modal' }} />
        <Stack.Screen name="payment-method/add" options={{ title: 'Add Payment Method', presentation: 'modal' }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="shared/enter-code" options={{ title: 'Enter Share Code', headerStyle: { backgroundColor: Colors.primary }, headerTintColor: Colors.white }} />
        <Stack.Screen name="shared/[shareId]" options={{ title: 'Shared Book' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
