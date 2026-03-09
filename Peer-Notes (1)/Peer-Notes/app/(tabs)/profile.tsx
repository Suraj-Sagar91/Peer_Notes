import React from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet,
  useColorScheme, Alert, Platform, ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { Note } from '../../shared/schema';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? Colors.dark : Colors.light;
  return (
    <View style={[styles.statCard, { backgroundColor: color + '11', borderColor: color + '33' }]}>
      <Ionicons name={icon as any} size={22} color={color} />
      <Text style={[styles.statValue, { color: C.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: C.textSecondary }]}>{label}</Text>
    </View>
  );
}

function NoteItem({ note }: { note: Note }) {
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? Colors.dark : Colors.light;
  return (
    <Pressable
      style={[styles.noteItem, { backgroundColor: C.card, borderColor: C.cardBorder }]}
      onPress={() => router.push(`/note/${note.id}`)}
    >
      <View style={styles.noteItemLeft}>
        <View style={[styles.noteStatus, { backgroundColor: note.approved ? '#10B98122' : '#F59E0B22' }]}>
          <Ionicons
            name={note.approved ? 'checkmark-circle' : 'time'}
            size={14}
            color={note.approved ? '#10B981' : '#F59E0B'}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.noteTitle, { color: C.text }]} numberOfLines={1}>{note.title}</Text>
          <Text style={[styles.noteMeta, { color: C.textSecondary }]}>
            {note.subject_name} • Sem {note.semester} • {note.approved ? 'Published' : 'Pending'}
          </Text>
        </View>
      </View>
      <View style={styles.noteStats}>
        <Ionicons name="download-outline" size={13} color={C.textSecondary} />
        <Text style={[styles.noteStatText, { color: C.textSecondary }]}>{note.downloads}</Text>
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { user, logout } = useAuth();
  const qc = useQueryClient();

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const webBottomPadding = Platform.OS === 'web' ? 34 : 0;

  const { data: myNotes = [] } = useQuery<Note[]>({
    queryKey: ['/api/users', user?.id, 'notes'],
    queryFn: async () => {
      const { getApiUrl } = await import('@/lib/query-client');
      const { fetch } = await import('expo/fetch');
      const url = new URL(`/api/users/${user?.id}/notes`, getApiUrl());
      const res = await fetch(url.toString(), { credentials: 'include' });
      return res.json();
    },
    enabled: !!user,
  });

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          qc.clear();
          router.replace('/(auth)/login');
        }
      }
    ]);
  };

  if (!user) return null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: C.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + webTopPadding + 16,
        paddingBottom: insets.bottom + webBottomPadding + 90,
        paddingHorizontal: 16,
        gap: 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageHeader}>
        <Text style={[styles.title, { color: C.text }]}>Profile</Text>
        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color="#EF4444" />
        </Pressable>
      </View>

      <Animated.View entering={FadeInDown.delay(50).springify()}>
        <View style={[styles.profileCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <View style={[styles.bigAvatar, { backgroundColor: user.avatar_color }]}>
            <Text style={styles.bigAvatarText}>{user.username[0].toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.username, { color: C.text }]}>{user.username}</Text>
            <Text style={[styles.email, { color: C.textSecondary }]}>{user.email}</Text>
            <View style={styles.badges}>
              <View style={[styles.roleBadge, { backgroundColor: user.role === 'admin' ? '#EF444422' : '#0EA5E922' }]}>
                <Ionicons
                  name={user.role === 'admin' ? 'shield-checkmark' : 'school'}
                  size={12}
                  color={user.role === 'admin' ? '#EF4444' : '#0EA5E9'}
                />
                <Text style={[styles.roleText, { color: user.role === 'admin' ? '#EF4444' : '#0EA5E9' }]}>
                  {user.role === 'admin' ? 'Admin' : `Semester ${user.semester}`}
                </Text>
              </View>
              {user.role === 'admin' && (
                <Pressable
                  style={[styles.adminPanelBtn, { backgroundColor: '#EF444422' }]}
                  onPress={() => router.push('/admin')}
                >
                  <Ionicons name="settings" size={12} color="#EF4444" />
                  <Text style={[styles.adminPanelText, { color: '#EF4444' }]}>Admin Panel</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.statsRow}>
        <StatCard icon="cloud-upload" label="Uploads" value={user.total_uploads} color="#0EA5E9" />
        <StatCard icon="download" label="Downloads" value={user.total_downloads} color="#10B981" />
        <StatCard icon="document-text" label="Notes" value={myNotes.length} color="#6366F1" />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).springify()}>
        <Text style={[styles.sectionTitle, { color: C.text }]}>My Notes</Text>
        {myNotes.length === 0 ? (
          <View style={[styles.emptyNotes, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Ionicons name="document-outline" size={36} color={C.textTertiary} />
            <Text style={[styles.emptyText, { color: C.textSecondary }]}>No notes uploaded yet</Text>
            <Pressable
              style={styles.uploadNowBtn}
              onPress={() => router.push('/(tabs)/upload')}
            >
              <Text style={styles.uploadNowText}>Upload your first note</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {myNotes.map(note => <NoteItem key={note.id} note={note} />)}
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 26, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.5 },
  logoutBtn: { padding: 8 },
  profileCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  bigAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigAvatarText: { fontSize: 28, fontFamily: 'Nunito_800ExtraBold', color: '#fff' },
  profileInfo: { flex: 1, gap: 4 },
  username: { fontSize: 20, fontFamily: 'Nunito_700Bold' },
  email: { fontSize: 13, fontFamily: 'Nunito_400Regular' },
  badges: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleText: { fontSize: 12, fontFamily: 'Nunito_600SemiBold' },
  adminPanelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  adminPanelText: { fontSize: 12, fontFamily: 'Nunito_600SemiBold' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  statValue: { fontSize: 22, fontFamily: 'Nunito_800ExtraBold' },
  statLabel: { fontSize: 11, fontFamily: 'Nunito_500Medium', textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontFamily: 'Nunito_700Bold', marginBottom: 10 },
  noteItem: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  noteStatus: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  noteTitle: { fontSize: 14, fontFamily: 'Nunito_600SemiBold' },
  noteMeta: { fontSize: 12, fontFamily: 'Nunito_400Regular', marginTop: 2 },
  noteStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  noteStatText: { fontSize: 13, fontFamily: 'Nunito_500Medium' },
  emptyNotes: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 30,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: { fontSize: 15, fontFamily: 'Nunito_500Medium' },
  uploadNowBtn: { backgroundColor: '#0EA5E9', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  uploadNowText: { color: '#fff', fontFamily: 'Nunito_700Bold', fontSize: 14 },
});
