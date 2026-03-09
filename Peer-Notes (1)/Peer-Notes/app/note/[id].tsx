import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  useColorScheme, ActivityIndicator, Alert, Platform, Linking
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Note } from '../../shared/schema';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { fetch } from 'expo/fetch';

function StarRating({ rating, onRate, disabled }: { rating: number; onRate: (r: number) => void; disabled: boolean }) {
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? Colors.dark : Colors.light;
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map(star => (
        <Pressable
          key={star}
          onPress={() => !disabled && onRate(star)}
          hitSlop={8}
        >
          <Ionicons
            name={star <= rating ? 'star' : 'star-outline'}
            size={28}
            color={star <= rating ? C.star : C.textTertiary}
          />
        </Pressable>
      ))}
    </View>
  );
}

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { user } = useAuth();
  const qc = useQueryClient();
  const [localLiked, setLocalLiked] = useState<boolean | null>(null);
  const [localLikeCount, setLocalLikeCount] = useState<number | null>(null);
  const [localRating, setLocalRating] = useState<number | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const heartScale = useSharedValue(1);

  const { data: note, isLoading } = useQuery<Note>({
    queryKey: ['/api/notes', id],
    queryFn: async () => {
      const url = new URL(`/api/notes/${id}`, getApiUrl());
      const res = await fetch(url.toString(), { credentials: 'include' });
      return res.json();
    },
  });

  const handleLike = async () => {
    if (!user) { Alert.alert('Sign in to like notes'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    heartScale.value = withSpring(1.3, { damping: 4 }, () => { heartScale.value = withSpring(1); });
    const currentLiked = localLiked ?? !!note?.user_liked;
    const currentCount = localLikeCount ?? (note?.like_count || 0);
    setLocalLiked(!currentLiked);
    setLocalLikeCount(currentLiked ? currentCount - 1 : currentCount + 1);
    try {
      const res = await apiRequest('POST', `/api/notes/${id}/like`);
      const data = await res.json();
      setLocalLiked(data.liked);
      setLocalLikeCount(data.count);
    } catch {
      setLocalLiked(currentLiked);
      setLocalLikeCount(currentCount);
    }
  };

  const handleRate = async (rating: number) => {
    if (!user) { Alert.alert('Sign in to rate notes'); return; }
    setRatingLoading(true);
    setLocalRating(rating);
    try {
      await apiRequest('POST', `/api/notes/${id}/rate`, { rating });
      qc.invalidateQueries({ queryKey: ['/api/notes', id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setRatingLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!user) { Alert.alert('Sign in to download notes'); return; }
    setDownloadLoading(true);
    try {
      await apiRequest('POST', `/api/notes/${id}/download`);
      const fileUrl = new URL(note!.file_url, getApiUrl()).toString();
      await Linking.openURL(fileUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Cannot open file', 'The file could not be opened. It may be a sample placeholder.');
    } finally {
      setDownloadLoading(false);
    }
  };

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.tint} size="large" />
      </View>
    );
  }

  if (!note) {
    return (
      <View style={[styles.centered, { backgroundColor: C.background }]}>
        <Ionicons name="document-outline" size={48} color={C.textTertiary} />
        <Text style={[styles.errorText, { color: C.textSecondary }]}>Note not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ color: C.tint, fontFamily: 'Nunito_600SemiBold' }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const liked = localLiked ?? !!note.user_liked;
  const likeCount = localLikeCount ?? note.like_count;
  const userRating = localRating ?? (note.user_rating ? parseInt(String(note.user_rating)) : 0);

  const fileSize = note.file_size
    ? note.file_size > 1024 * 1024
      ? `${(note.file_size / 1024 / 1024).toFixed(1)} MB`
      : `${Math.round(note.file_size / 1024)} KB`
    : 'Unknown size';

  const fileIcon = note.file_type?.includes('pdf')
    ? 'document-text'
    : note.file_type?.includes('image')
    ? 'image'
    : 'document';

  const fileColor = note.file_type?.includes('pdf')
    ? '#EF4444'
    : note.file_type?.includes('image')
    ? '#10B981'
    : '#3B82F6';

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + webTopPadding + 8, backgroundColor: C.card, borderBottomColor: C.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={[styles.subjectBadge, { backgroundColor: (note.subject_color || '#0EA5E9') + '22' }]}>
          <Text style={[styles.subjectBadgeText, { color: note.subject_color || '#0EA5E9' }]}>
            {note.subject_name}
          </Text>
        </View>
        {user?.id === note.uploader_id && (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(50).springify()} style={[styles.mainCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <View style={styles.titleSection}>
            <Text style={[styles.noteTitle, { color: C.text }]}>{note.title}</Text>
            {note.description ? (
              <Text style={[styles.noteDesc, { color: C.textSecondary }]}>{note.description}</Text>
            ) : null}
          </View>

          <View style={[styles.divider, { backgroundColor: C.border }]} />

          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Ionicons name="school-outline" size={14} color={C.textSecondary} />
              <Text style={[styles.metaText, { color: C.textSecondary }]}>Semester {note.semester}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={C.textSecondary} />
              <Text style={[styles.metaText, { color: C.textSecondary }]}>
                {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="download-outline" size={14} color={C.textSecondary} />
              <Text style={[styles.metaText, { color: C.textSecondary }]}>{note.downloads} downloads</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={14} color={C.textSecondary} />
              <Text style={[styles.metaText, { color: C.textSecondary }]}>{note.rating_count} ratings</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).springify()}
          style={[styles.fileCard, { backgroundColor: fileColor + '11', borderColor: fileColor + '33' }]}
        >
          <View style={[styles.fileIconWrapper, { backgroundColor: fileColor + '22' }]}>
            <Ionicons name={fileIcon as any} size={28} color={fileColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fileName, { color: C.text }]} numberOfLines={1}>{note.file_name}</Text>
            <Text style={[styles.fileSize, { color: C.textSecondary }]}>{fileSize}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.downloadBtn, { backgroundColor: fileColor, opacity: pressed ? 0.85 : 1 }]}
            onPress={handleDownload}
            disabled={downloadLoading}
          >
            {downloadLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="download" size={18} color="#fff" />
            }
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).springify()}
          style={[styles.uploaderCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}
        >
          <Text style={[styles.sectionLabel, { color: C.textSecondary }]}>Uploaded by</Text>
          <View style={styles.uploaderRow}>
            <View style={[styles.uploaderAvatar, { backgroundColor: note.uploader_avatar_color || '#3B82F6' }]}>
              <Text style={styles.uploaderAvatarText}>
                {(note.uploader_username || 'U')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.uploaderName, { color: C.text }]}>{note.uploader_username || 'Unknown'}</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()}
          style={[styles.ratingCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}
        >
          <View style={styles.ratingHeader}>
            <View>
              <Text style={[styles.sectionLabel, { color: C.textSecondary }]}>Rating</Text>
              <View style={styles.avgRow}>
                <Text style={[styles.avgRating, { color: C.text }]}>
                  {parseFloat(String(note.avg_rating || 0)).toFixed(1)}
                </Text>
                <Ionicons name="star" size={18} color={C.star} />
                <Text style={[styles.ratingCount, { color: C.textSecondary }]}>
                  ({note.rating_count})
                </Text>
              </View>
            </View>
            <Animated.View style={heartStyle}>
              <Pressable
                style={[styles.likeBtn, liked && styles.likeBtnActive]}
                onPress={handleLike}
              >
                <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? '#EF4444' : C.textSecondary} />
                <Text style={[styles.likeCount, { color: liked ? '#EF4444' : C.textSecondary }]}>{likeCount}</Text>
              </Pressable>
            </Animated.View>
          </View>

          {user && (
            <View style={styles.rateSection}>
              <Text style={[styles.rateLabel, { color: C.textSecondary }]}>
                {userRating ? 'Your rating' : 'Rate this note'}
              </Text>
              <StarRating rating={userRating} onRate={handleRate} disabled={ratingLoading} />
              {ratingLoading && <ActivityIndicator size="small" color={C.tint} />}
            </View>
          )}
        </Animated.View>

        <Pressable
          style={({ pressed }) => [styles.bigDownloadBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
          onPress={handleDownload}
          disabled={downloadLoading}
        >
          {downloadLoading
            ? <ActivityIndicator color="#fff" />
            : <>
              <Ionicons name="cloud-download" size={20} color="#fff" />
              <Text style={styles.bigDownloadText}>Download Note</Text>
            </>
          }
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  subjectBadge: { flex: 1, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginHorizontal: 8 },
  subjectBadgeText: { fontSize: 13, fontFamily: 'Nunito_700Bold' },
  scroll: { padding: 16, gap: 14 },
  mainCard: { borderRadius: 20, padding: 20, borderWidth: 1, gap: 16 },
  titleSection: { gap: 8 },
  noteTitle: { fontSize: 20, fontFamily: 'Nunito_800ExtraBold', lineHeight: 28 },
  noteDesc: { fontSize: 14, fontFamily: 'Nunito_400Regular', lineHeight: 21 },
  divider: { height: 1 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 13, fontFamily: 'Nunito_500Medium' },
  fileCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fileIconWrapper: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 14, fontFamily: 'Nunito_600SemiBold' },
  fileSize: { fontSize: 12, fontFamily: 'Nunito_400Regular', marginTop: 2 },
  downloadBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  uploaderCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 10 },
  sectionLabel: { fontSize: 12, fontFamily: 'Nunito_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  uploaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  uploaderAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  uploaderAvatarText: { fontSize: 16, fontFamily: 'Nunito_700Bold', color: '#fff' },
  uploaderName: { fontSize: 16, fontFamily: 'Nunito_700Bold' },
  ratingCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 14 },
  ratingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  avgRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  avgRating: { fontSize: 24, fontFamily: 'Nunito_800ExtraBold' },
  ratingCount: { fontSize: 13, fontFamily: 'Nunito_400Regular' },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  likeBtnActive: { backgroundColor: '#EF444411', borderColor: '#EF444433' },
  likeCount: { fontSize: 14, fontFamily: 'Nunito_600SemiBold' },
  rateSection: { gap: 8 },
  rateLabel: { fontSize: 13, fontFamily: 'Nunito_600SemiBold' },
  stars: { flexDirection: 'row', gap: 6 },
  bigDownloadBtn: {
    backgroundColor: '#0EA5E9',
    borderRadius: 18,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  bigDownloadText: { color: '#fff', fontSize: 16, fontFamily: 'Nunito_700Bold' },
  backBtn: { padding: 8 },
  errorText: { fontSize: 16, fontFamily: 'Nunito_600SemiBold' },
});
