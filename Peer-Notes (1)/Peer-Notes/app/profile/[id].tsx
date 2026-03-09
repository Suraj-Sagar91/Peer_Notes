import React from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  useColorScheme, Platform, ActivityIndicator
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useQuery } from '@tanstack/react-query';
import type { Note, PublicUser } from '../../shared/schema';
import { getApiUrl } from '@/lib/query-client';
import { fetch } from 'expo/fetch';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function ProfileDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;

  const { data: user, isLoading } = useQuery<PublicUser>({
    queryKey: ['/api/users', id],
    queryFn: async () => {
      const url = new URL(`/api/users/${id}`, getApiUrl());
      const res = await fetch(url.toString(), { credentials: 'include' });
      return res.json();
    },
  });

  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: ['/api/users', id, 'notes'],
    queryFn: async () => {
      const url = new URL(`/api/users/${id}/notes`, getApiUrl());
      const res = await fetch(url.toString(), { credentials: 'include' });
      return res.json();
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.tint} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.centered, { backgroundColor: C.background }]}>
        <Text style={[styles.errorText, { color: C.textSecondary }]}>User not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopPadding + 10, backgroundColor: C.card, borderBottomColor: C.border }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.text }]}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(50).springify()} style={[styles.profileCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <View style={[styles.avatar, { backgroundColor: user.avatar_color }]}>
            <Text style={styles.avatarText}>{user.username[0].toUpperCase()}</Text>
          </View>
          <Text style={[styles.username, { color: C.text }]}>{user.username}</Text>
          {user.bio ? <Text style={[styles.bio, { color: C.textSecondary }]}>{user.bio}</Text> : null}
          <View style={[styles.semBadge, { backgroundColor: '#0EA5E922' }]}>
            <Ionicons name="school" size={14} color="#0EA5E9" />
            <Text style={styles.semText}>Semester {user.semester}</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#0EA5E911', borderColor: '#0EA5E933' }]}>
            <Ionicons name="cloud-upload" size={22} color="#0EA5E9" />
            <Text style={[styles.statValue, { color: C.text }]}>{user.total_uploads}</Text>
            <Text style={[styles.statLabel, { color: C.textSecondary }]}>Uploads</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#10B98111', borderColor: '#10B98133' }]}>
            <Ionicons name="download" size={22} color="#10B981" />
            <Text style={[styles.statValue, { color: C.text }]}>{user.total_downloads}</Text>
            <Text style={[styles.statLabel, { color: C.textSecondary }]}>Downloads</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>Published Notes ({notes.length})</Text>
          {notes.length === 0 ? (
            <View style={[styles.emptyNotes, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Ionicons name="document-outline" size={36} color={C.textTertiary} />
              <Text style={[styles.emptyText, { color: C.textSecondary }]}>No published notes yet</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {notes.map(note => (
                <Pressable
                  key={note.id}
                  style={[styles.noteCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}
                  onPress={() => router.push(`/note/${note.id}`)}
                >
                  <View style={[styles.notePill, { backgroundColor: (note.subject_color || '#0EA5E9') + '22' }]}>
                    <Text style={[styles.notePillText, { color: note.subject_color || '#0EA5E9' }]}>
                      {note.subject_name} • Sem {note.semester}
                    </Text>
                  </View>
                  <Text style={[styles.noteTitle, { color: C.text }]} numberOfLines={1}>{note.title}</Text>
                  <View style={styles.noteMeta}>
                    <Ionicons name="star" size={12} color={C.star} />
                    <Text style={[styles.metaText, { color: C.textSecondary }]}>
                      {parseFloat(note.avg_rating as any || '0').toFixed(1)}
                    </Text>
                    <Ionicons name="download-outline" size={12} color={C.textSecondary} />
                    <Text style={[styles.metaText, { color: C.textSecondary }]}>{note.downloads}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, fontFamily: 'Nunito_600SemiBold' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: 'Nunito_700Bold' },
  scroll: { padding: 16, gap: 14 },
  profileCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText: { fontSize: 32, fontFamily: 'Nunito_800ExtraBold', color: '#fff' },
  username: { fontSize: 22, fontFamily: 'Nunito_800ExtraBold' },
  bio: { fontSize: 14, fontFamily: 'Nunito_400Regular', textAlign: 'center' },
  semBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 4,
  },
  semText: { color: '#0EA5E9', fontSize: 13, fontFamily: 'Nunito_600SemiBold' },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', gap: 6, borderWidth: 1 },
  statValue: { fontSize: 24, fontFamily: 'Nunito_800ExtraBold' },
  statLabel: { fontSize: 12, fontFamily: 'Nunito_500Medium' },
  sectionTitle: { fontSize: 18, fontFamily: 'Nunito_700Bold', marginBottom: 10 },
  emptyNotes: { borderRadius: 16, borderWidth: 1, padding: 30, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 15, fontFamily: 'Nunito_500Medium' },
  noteCard: { borderRadius: 14, padding: 14, borderWidth: 1, gap: 8 },
  notePill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  notePillText: { fontSize: 11, fontFamily: 'Nunito_600SemiBold' },
  noteTitle: { fontSize: 14, fontFamily: 'Nunito_600SemiBold' },
  noteMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, fontFamily: 'Nunito_500Medium' },
});
