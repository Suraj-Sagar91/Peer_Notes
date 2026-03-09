import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  useColorScheme, Alert, ActivityIndicator, Platform
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Note, PublicUser } from '../../shared/schema';
import { apiRequest } from '@/lib/query-client';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';

function NoteAdminCard({ note, onApprove, onDelete }: {
  note: Note;
  onApprove: () => void;
  onDelete: () => void;
}) {
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const [loading, setLoading] = useState(false);

  return (
    <View style={[styles.card, { backgroundColor: C.card, borderColor: note.approved ? C.cardBorder : '#F59E0B44' }]}>
      <View style={styles.cardTop}>
        <View style={[styles.statusDot, { backgroundColor: note.approved ? '#10B981' : '#F59E0B' }]} />
        <Text style={[styles.cardTitle, { color: C.text }]} numberOfLines={1}>{note.title}</Text>
      </View>
      <Text style={[styles.cardMeta, { color: C.textSecondary }]}>
        {note.subject_name} • Sem {note.semester} • by {note.uploader_username}
      </Text>
      <Text style={[styles.cardStatus, { color: note.approved ? '#10B981' : '#F59E0B' }]}>
        {note.approved ? 'Published' : 'Pending Approval'}
      </Text>
      <View style={styles.cardActions}>
        {!note.approved && (
          <Pressable
            style={[styles.approveBtn, loading && { opacity: 0.7 }]}
            onPress={async () => {
              setLoading(true);
              await onApprove();
              setLoading(false);
            }}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={styles.approveBtnText}>Approve</Text>
              </>
            }
          </Pressable>
        )}
        <Pressable style={styles.deleteBtn} onPress={onDelete}>
          <Ionicons name="trash" size={16} color="#EF4444" />
        </Pressable>
      </View>
    </View>
  );
}

function UserCard({ user, onDelete, isCurrentUser }: {
  user: PublicUser;
  onDelete: () => void;
  isCurrentUser: boolean;
}) {
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? Colors.dark : Colors.light;
  return (
    <View style={[styles.userCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
      <View style={[styles.userAvatar, { backgroundColor: user.avatar_color }]}>
        <Text style={styles.userAvatarText}>{user.username[0].toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.userNameRow}>
          <Text style={[styles.userName, { color: C.text }]}>{user.username}</Text>
          {user.role === 'admin' && (
            <View style={styles.adminTag}>
              <Text style={styles.adminTagText}>Admin</Text>
            </View>
          )}
        </View>
        <Text style={[styles.userEmail, { color: C.textSecondary }]}>{user.email}</Text>
        <Text style={[styles.userStats, { color: C.textTertiary }]}>
          {user.total_uploads} uploads • Sem {user.semester}
        </Text>
      </View>
      {!isCurrentUser && user.role !== 'admin' && (
        <Pressable onPress={onDelete} style={styles.userDeleteBtn}>
          <Ionicons name="person-remove" size={18} color="#EF4444" />
        </Pressable>
      )}
    </View>
  );
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'notes' | 'users'>('notes');

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;

  const { data: allNotes = [], isLoading: notesLoading, refetch: refetchNotes } = useQuery<Note[]>({
    queryKey: ['/api/admin/notes'],
    queryFn: async () => {
      const { getApiUrl } = await import('@/lib/query-client');
      const { fetch } = await import('expo/fetch');
      const url = new URL('/api/admin/notes', getApiUrl());
      const res = await fetch(url.toString(), { credentials: 'include' });
      return res.json();
    },
  });

  const { data: allUsers = [], refetch: refetchUsers } = useQuery<PublicUser[]>({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const { getApiUrl } = await import('@/lib/query-client');
      const { fetch } = await import('expo/fetch');
      const url = new URL('/api/admin/users', getApiUrl());
      const res = await fetch(url.toString(), { credentials: 'include' });
      return res.json();
    },
  });

  const pendingNotes = allNotes.filter(n => !n.approved);
  const publishedNotes = allNotes.filter(n => n.approved);

  const handleApprove = async (noteId: string) => {
    try {
      await apiRequest('PUT', `/api/admin/notes/${noteId}/approve`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refetchNotes();
      qc.invalidateQueries({ queryKey: ['/api/notes'] });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteNote = (noteId: string) => {
    Alert.alert('Delete Note', 'Are you sure you want to delete this note? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiRequest('DELETE', `/api/admin/notes/${noteId}`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await refetchNotes();
            qc.invalidateQueries({ queryKey: ['/api/notes'] });
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        }
      }
    ]);
  };

  const handleDeleteUser = (userId: string) => {
    Alert.alert('Delete User', 'Delete this user and all their notes?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiRequest('DELETE', `/api/admin/users/${userId}`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await refetchUsers();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        }
      }
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopPadding + 12, backgroundColor: C.card, borderBottomColor: C.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: C.text }]}>Admin Panel</Text>
          {pendingNotes.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingNotes.length}</Text>
            </View>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.statsBar, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#F59E0B' }]}>{pendingNotes.length}</Text>
          <Text style={[styles.statLabel, { color: C.textSecondary }]}>Pending</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: C.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#10B981' }]}>{publishedNotes.length}</Text>
          <Text style={[styles.statLabel, { color: C.textSecondary }]}>Published</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: C.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#0EA5E9' }]}>{allUsers.length}</Text>
          <Text style={[styles.statLabel, { color: C.textSecondary }]}>Users</Text>
        </View>
      </View>

      <View style={[styles.tabBar, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        {(['notes', 'users'] as const).map(t => (
          <Pressable
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? '#0EA5E9' : C.textSecondary }]}>
              {t === 'notes' ? 'Notes' : 'Users'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'notes' ? (
          <>
            {pendingNotes.length > 0 && (
              <View>
                <Text style={[styles.sectionTitle, { color: C.text }]}>Pending Review ({pendingNotes.length})</Text>
                {pendingNotes.map(note => (
                  <NoteAdminCard
                    key={note.id}
                    note={note}
                    onApprove={() => handleApprove(note.id)}
                    onDelete={() => handleDeleteNote(note.id)}
                  />
                ))}
              </View>
            )}
            <View>
              <Text style={[styles.sectionTitle, { color: C.text }]}>Published Notes ({publishedNotes.length})</Text>
              {publishedNotes.map(note => (
                <NoteAdminCard
                  key={note.id}
                  note={note}
                  onApprove={() => handleApprove(note.id)}
                  onDelete={() => handleDeleteNote(note.id)}
                />
              ))}
            </View>
            {notesLoading && <ActivityIndicator color={C.tint} />}
          </>
        ) : (
          <View>
            <Text style={[styles.sectionTitle, { color: C.text }]}>All Users ({allUsers.length})</Text>
            {allUsers.map(u => (
              <UserCard
                key={u.id}
                user={u}
                isCurrentUser={u.id === user?.id}
                onDelete={() => handleDeleteUser(u.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontFamily: 'Nunito_700Bold' },
  badge: { backgroundColor: '#F59E0B', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontFamily: 'Nunito_700Bold' },
  backBtn: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  statsBar: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontFamily: 'Nunito_800ExtraBold' },
  statLabel: { fontSize: 11, fontFamily: 'Nunito_500Medium' },
  statDivider: { width: 1 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#0EA5E9' },
  tabText: { fontSize: 14, fontFamily: 'Nunito_600SemiBold' },
  scrollContent: { padding: 16, gap: 8 },
  sectionTitle: { fontSize: 15, fontFamily: 'Nunito_700Bold', marginBottom: 10, marginTop: 8 },
  card: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    gap: 6,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', flex: 1 },
  cardMeta: { fontSize: 12, fontFamily: 'Nunito_400Regular' },
  cardStatus: { fontSize: 11, fontFamily: 'Nunito_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
  },
  approveBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Nunito_600SemiBold' },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF444422',
    borderWidth: 1,
    borderColor: '#EF444433',
  },
  userCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  userAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { fontSize: 18, fontFamily: 'Nunito_700Bold', color: '#fff' },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 15, fontFamily: 'Nunito_700Bold' },
  adminTag: { backgroundColor: '#EF444422', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  adminTagText: { color: '#EF4444', fontSize: 10, fontFamily: 'Nunito_700Bold' },
  userEmail: { fontSize: 12, fontFamily: 'Nunito_400Regular' },
  userStats: { fontSize: 11, fontFamily: 'Nunito_400Regular' },
  userDeleteBtn: { padding: 8 },
});
