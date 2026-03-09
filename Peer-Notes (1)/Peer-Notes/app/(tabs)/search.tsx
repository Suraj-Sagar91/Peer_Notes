import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet,
  TextInput, useColorScheme, Platform, ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import type { Note } from '../../shared/schema';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { getApiUrl } from '@/lib/query-client';
import { fetch } from 'expo/fetch';

function NoteCard({ note, index }: { note: Note; index: number }) {
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? Colors.dark : Colors.light;

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).springify()}>
      <Pressable
        style={({ pressed }) => [
          styles.noteCard,
          { backgroundColor: C.card, borderColor: C.cardBorder },
          pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] }
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/note/${note.id}`);
        }}
      >
        <View style={styles.noteTop}>
          <View style={[styles.subjectPill, { backgroundColor: (note.subject_color || '#0EA5E9') + '22' }]}>
            <Text style={[styles.subjectText, { color: note.subject_color || '#0EA5E9' }]}>
              {note.subject_name} • Sem {note.semester}
            </Text>
          </View>
        </View>
        <Text style={[styles.noteTitle, { color: C.text }]} numberOfLines={2}>{note.title}</Text>
        <Text style={[styles.noteDesc, { color: C.textSecondary }]} numberOfLines={2}>{note.description}</Text>
        <View style={styles.noteMeta}>
          <View style={styles.metaLeft}>
            <View style={[styles.avatar, { backgroundColor: note.uploader_avatar_color || '#3B82F6' }]}>
              <Text style={styles.avatarText}>{(note.uploader_username || 'U')[0].toUpperCase()}</Text>
            </View>
            <Text style={[styles.uploaderName, { color: C.textSecondary }]}>{note.uploader_username}</Text>
          </View>
          <View style={styles.metaRight}>
            <Ionicons name="star" size={12} color={C.star} />
            <Text style={[styles.statText, { color: C.textSecondary }]}>
              {parseFloat(note.avg_rating as any || '0').toFixed(1)}
            </Text>
            <Ionicons name="download-outline" size={12} color={C.textSecondary} />
            <Text style={[styles.statText, { color: C.textSecondary }]}>{note.downloads}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const webBottomPadding = Platform.OS === 'web' ? 34 : 0;

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (!text.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    try {
      const url = new URL(`/api/notes?search=${encodeURIComponent(text)}`, getApiUrl());
      const res = await fetch(url.toString(), { credentials: 'include' });
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setSearched(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopPadding + 16 }]}>
        <Text style={[styles.title, { color: C.text }]}>Search Notes</Text>
        <View style={[styles.searchBar, { backgroundColor: C.inputBg, borderColor: C.border }]}>
          <Ionicons name="search" size={18} color={C.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: C.text }]}
            placeholder="Search by title or description..."
            placeholderTextColor={C.textTertiary}
            value={query}
            onChangeText={handleSearch}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
              <Ionicons name="close-circle" size={18} color={C.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={C.tint} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => <NoteCard note={item} index={index} />}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + webBottomPadding + 90 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            searched ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color={C.textTertiary} />
                <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>No results found</Text>
                <Text style={[styles.emptySubtitle, { color: C.textTertiary }]}>
                  Try different keywords
                </Text>
              </View>
            ) : !query ? (
              <View style={styles.emptyState}>
                <Ionicons name="library-outline" size={48} color={C.textTertiary} />
                <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>Find anything</Text>
                <Text style={[styles.emptySubtitle, { color: C.textTertiary }]}>
                  Search across all notes by title or description
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  title: { fontSize: 26, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.5 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'Nunito_500Medium', height: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  noteCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  noteTop: { flexDirection: 'row' },
  subjectPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  subjectText: { fontSize: 12, fontFamily: 'Nunito_600SemiBold' },
  noteTitle: { fontSize: 15, fontFamily: 'Nunito_700Bold', lineHeight: 22 },
  noteDesc: { fontSize: 13, fontFamily: 'Nunito_400Regular', lineHeight: 19 },
  noteMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 10, fontFamily: 'Nunito_700Bold', color: '#fff' },
  uploaderName: { fontSize: 12, fontFamily: 'Nunito_500Medium' },
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontSize: 12, fontFamily: 'Nunito_500Medium' },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Nunito_700Bold' },
  emptySubtitle: { fontSize: 14, fontFamily: 'Nunito_400Regular', textAlign: 'center', paddingHorizontal: 40 },
});
