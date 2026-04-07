import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { signOut } from '../../lib/supabase';
import { Colors } from '../../constants/colors';

export default function SettingsScreen() {
  const { appUser, user } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  function confirmSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } catch {
            Alert.alert('Error', 'Failed to sign out.');
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  }

  const displayName = appUser?.display_name ?? user?.user_metadata?.full_name ?? 'User';
  const email = appUser?.email ?? user?.email ?? '';
  const photoUrl = appUser?.photo_url ?? user?.user_metadata?.avatar_url ?? '';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.pageBg }}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{displayName[0]?.toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{email}</Text>
      </View>

      {/* Menu */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => router.push('/shared/enter-code')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIcon, { backgroundColor: '#ede9fe' }]}>
            <Ionicons name="qr-code-outline" size={20} color={Colors.primary} />
          </View>
          <Text style={styles.menuLabel}>Enter a Share Code</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Info</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Built with</Text>
          <Text style={styles.infoValue}>Expo + Supabase</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Currency</Text>
          <Text style={styles.infoValue}>Indian Rupee (₹)</Text>
        </View>
      </View>

      <View style={{ padding: 20 }}>
        <TouchableOpacity
          style={[styles.signOutBtn, signingOut && { opacity: 0.6 }]}
          onPress={confirmSignOut}
          disabled={signingOut}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.cashOut} />
          <Text style={styles.signOutText}>{signingOut ? 'Signing out…' : 'Sign Out'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: 14,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 34,
    fontWeight: '700',
    color: Colors.white,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  section: {
    marginTop: 20,
    marginHorizontal: 16,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.body,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  infoLabel: { fontSize: 14, color: Colors.muted },
  infoValue: { fontSize: 14, color: Colors.body, fontWeight: '500' },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cashOutBg,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.cashOut,
  },
});
