import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet,
  RefreshControl, useColorScheme, ScrollView, Platform
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import type { Note, Subject } from '../../shared/schema';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

function NoteCard({ note, index }: { note: Note; index: number }) {
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const fileIcon = note.file_type?.includes('pdf')
    ? 'document-text'
    : note.file_type?.includes('image')
    ? 'image'
    : 'document';

  const fileIconColor = note.file_type?.includes('pdf')
    ? '#EF4444'
    : note.file_type?.includes('image')
    ? '#10B981'
    : '#F59E0B';

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <Pressable
        style={({ pressed }) => [
          styles.noteCard,
          { backgroundColor: C.card, borderColor: C.cardBorder },
          pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] }
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/note/${note.id}`);
        }}
      >
        <View style={styles.noteTop}>
          <View style={[styles.subjectPill, { backgroundColor: (note.subject_color || '#0EA5E9') + '22' }]}>
            <Text style={[styles.subjectText, { color: note.subject_color || '#0EA5E9' }]}>
              {note.subject_code || 'GEN'} • Sem {note.semester}
            </Text>
          </View>
          <View style={styles.fileTypeTag}>
            <Ionicons name={fileIcon as any} size={12} color={fileIconColor} />
          </View>
        </View>

        <Text style={[styles.noteTitle, { color: C.text }]} numberOfLines={2}>{note.title}</Text>
        <Text style={[styles.noteDesc, { color: C.textSecondary }]} numberOfLines={2}>{note.description}</Text>

        <View style={styles.noteMeta}>
          <View style={styles.metaLeft}>
            <View style={[styles.avatar, { backgroundColor: note.uploader_avatar_color || '#3B82F6' }]}>
              <Text style={styles.avatarText}>
                {(note.uploader_username || 'U')[0].toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.uploaderName, { color: C.textSecondary }]}>
              {note.uploader_username || 'Unknown'}
            </Text>
          </View>
          <View style={styles.metaRight}>
            <View style={styles.statItem}>
              <Ionicons name="star" size={12} color={C.star} />
              <Text style={[styles.statText, { color: C.textSecondary }]}>
                {parseFloat(note.avg_rating as any || '0').toFixed(1)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="heart" size={12} color="#EF4444" />
              <Text style={[styles.statText, { color: C.textSecondary }]}>{note.like_count}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="download-outline" size={12} color={C.textSecondary} />
              <Text style={[styles.statText, { color: C.textSecondary }]}>{note.downloads}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function SubjectPill({ subject, active, onPress }: { subject: Subject; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.subjectFilterPill, active && { backgroundColor: subject.color, borderColor: subject.color }]}
      onPress={onPress}
    >
      <Text style={[styles.subjectFilterText, active && { color: '#fff' }]}>
        {subject.name}
      </Text>
    </Pressable>
  );
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { user } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ['/api/subjects'] });
  const { data: notes = [], refetch, isLoading } = useQuery<Note[]>({
    queryKey: ['/api/notes', selectedSubject, selectedSemester],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedSubject) params.set('subject_id', selectedSubject);
      if (selectedSemester) params.set('semester', String(selectedSemester));
      const { getApiUrl } = await import('@/lib/query-client');
      const { fetch } = await import('expo/fetch');
      const url = new URL(`/api/notes?${params}`, getApiUrl());
      const res = await fetch(url.toString(), { credentials: 'include' });
      return res.json();
    }
  });

  const { data: recommendations = [] } = useQuery<Note[]>({
    queryKey: ['/api/recommendations'],
    enabled: !!user,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const webBottomPadding = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <FlatList
        data={notes}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => <NoteCard note={item} index={index} />}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: insets.top + webTopPadding + 16,
            paddingBottom: insets.bottom + webBottomPadding + 90,
          }
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.tint} />
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View>
                <Text style={[styles.greeting, { color: C.textSecondary }]}>
                  Hello, {user?.username || 'Student'}
                </Text>
                <Text style={[styles.pageTitle, { color: C.text }]}>Explore Notes</Text>
              </View>
              {user?.role === 'admin' && (
                <Pressable
                  style={[styles.adminBtn, { backgroundColor: '#EF444422' }]}
                  onPress={() => router.push('/admin')}
                >
                  <Ionicons name="shield-checkmark" size={18} color="#EF4444" />
                </Pressable>
              )}
            </View>

            {recommendations.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: C.text }]}>Recommended for You</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.recsRow}>
                    {recommendations.slice(0, 4).map(note => (
                      <Pressable
                        key={note.id}
                        style={[styles.recCard, { backgroundColor: note.subject_color ? note.subject_color + '22' : '#0EA5E922', borderColor: note.subject_color ? note.subject_color + '44' : '#0EA5E944' }]}
                        onPress={() => router.push(`/note/${note.id}`)}
                      >
                        <Text style={[styles.recSubject, { color: note.subject_color || '#0EA5E9' }]}>
                          {note.subject_code}
                        </Text>
                        <Text style={[styles.recTitle, { color: C.text }]} numberOfLines={2}>
                          {note.title}
                        </Text>
                        <View style={styles.recMeta}>
                          <Ionicons name="star" size={11} color={C.star} />
                          <Text style={[styles.recRating, { color: C.textSecondary }]}>
                            {parseFloat(note.avg_rating as any || '0').toFixed(1)}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: C.text }]}>Filter by Subject</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterRow}>
                  <Pressable
                    style={[styles.subjectFilterPill, !selectedSubject && styles.allPillActive]}
                    onPress={() => setSelectedSubject(null)}
                  >
                    <Text style={[styles.subjectFilterText, !selectedSubject && { color: '#fff' }]}>All</Text>
                  </Pressable>
                  {subjects.map(sub => (
                    <SubjectPill
                      key={sub.id}
                      subject={sub}
                      active={selectedSubject === sub.id}
                      onPress={() => setSelectedSubject(selectedSubject === sub.id ? null : sub.id)}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: C.text }]}>Filter by Semester</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterRow}>
                  <Pressable
                    style={[styles.semPill, !selectedSemester && styles.semPillActive]}
                    onPress={() => setSelectedSemester(null)}
                  >
                    <Text style={[styles.semPillText, !selectedSemester && { color: '#0EA5E9' }]}>All</Text>
                  </Pressable>
                  {SEMESTERS.map(s => (
                    <Pressable
                      key={s}
                      style={[styles.semPill, selectedSemester === s && styles.semPillActive]}
                      onPress={() => setSelectedSemester(selectedSemester === s ? null : s)}
                    >
                      <Text style={[styles.semPillText, selectedSemester === s && { color: '#0EA5E9' }]}>
                        Sem {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.notesHeader}>
              <Text style={[styles.sectionTitle, { color: C.text }]}>
                {isLoading ? 'Loading...' : `${notes.length} Notes`}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Ionicons name="documents-outline" size={48} color={C.textTertiary} />
              <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>No notes found</Text>
              <Text style={[styles.emptySubtitle, { color: C.textTertiary }]}>
                Be the first to share notes in this category
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 16, gap: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: { fontSize: 14, fontFamily: 'Nunito_500Medium' },
  pageTitle: { fontSize: 26, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.5 },
  adminBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Nunito_700Bold', marginBottom: 10 },
  filterRow: { flexDirection: 'row', gap: 8 },
  subjectFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  subjectFilterText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: '#64748B' },
  allPillActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  semPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#33415544',
  },
  semPillText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: '#64748B' },
  semPillActive: { borderColor: '#0EA5E9' },
  notesHeader: { marginBottom: 4 },
  noteCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  noteTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subjectPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  subjectText: { fontSize: 12, fontFamily: 'Nunito_600SemiBold' },
  fileTypeTag: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#F1F5F911',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteTitle: { fontSize: 15, fontFamily: 'Nunito_700Bold', lineHeight: 22 },
  noteDesc: { fontSize: 13, fontFamily: 'Nunito_400Regular', lineHeight: 19 },
  noteMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 10, fontFamily: 'Nunito_700Bold', color: '#fff' },
  uploaderName: { fontSize: 12, fontFamily: 'Nunito_500Medium' },
  metaRight: { flexDirection: 'row', gap: 10 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { fontSize: 12, fontFamily: 'Nunito_500Medium' },
  recsRow: { flexDirection: 'row', gap: 12 },
  recCard: {
    width: 160,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 6,
  },
  recSubject: { fontSize: 11, fontFamily: 'Nunito_700Bold', textTransform: 'uppercase' },
  recTitle: { fontSize: 13, fontFamily: 'Nunito_700Bold', lineHeight: 18 },
  recMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  recRating: { fontSize: 12, fontFamily: 'Nunito_500Medium' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Nunito_700Bold' },
  emptySubtitle: { fontSize: 14, fontFamily: 'Nunito_400Regular', textAlign: 'center', paddingHorizontal: 40 },
});
