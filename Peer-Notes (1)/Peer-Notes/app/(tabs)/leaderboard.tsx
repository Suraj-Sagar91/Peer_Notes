import React from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet,
  useColorScheme, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useQuery } from '@tanstack/react-query';
import type { LeaderboardEntry } from '../../shared/schema';
import { useAuth } from '@/contexts/AuthContext';
import Animated, { FadeInDown } from 'react-native-reanimated';

const RANK_COLORS = ['#F59E0B', '#94A3B8', '#CD7C2F'];
const RANK_ICONS = ['trophy', 'medal', 'ribbon'];

function LeaderEntry({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { user } = useAuth();
  const isCurrentUser = user?.id === entry.id;
  const rankColor = index < 3 ? RANK_COLORS[index] : C.textSecondary;
  const isTop3 = index < 3;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <View style={[
        styles.entry,
        { backgroundColor: isCurrentUser ? '#0EA5E922' : isTop3 ? C.card : C.card, borderColor: isCurrentUser ? '#0EA5E9' : C.cardBorder },
        isTop3 && { borderColor: rankColor + '44' }
      ]}>
        <View style={[styles.rankBadge, { backgroundColor: rankColor + '22' }]}>
          {isTop3
            ? <Ionicons name={RANK_ICONS[index] as any} size={18} color={rankColor} />
            : <Text style={[styles.rankNumber, { color: C.textSecondary }]}>#{entry.rank}</Text>
          }
        </View>

        <View style={[styles.avatar, { backgroundColor: entry.avatar_color }]}>
          <Text style={styles.avatarText}>{entry.username[0].toUpperCase()}</Text>
        </View>

        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.username, { color: C.text }]} numberOfLines={1}>{entry.username}</Text>
            {isCurrentUser && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>You</Text>
              </View>
            )}
          </View>
          <Text style={[styles.statsText, { color: C.textSecondary }]}>
            {entry.total_uploads} uploads • {entry.total_downloads} downloads
          </Text>
        </View>

        <View style={styles.scoreWrapper}>
          <Text style={[styles.score, { color: rankColor }]}>{entry.score}</Text>
          <Text style={[styles.scoreLabel, { color: C.textTertiary }]}>pts</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const C = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { user } = useAuth();

  const { data: leaders = [], isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ['/api/leaderboard'],
  });

  const webTopPadding = Platform.OS === 'web' ? 67 : 0;
  const webBottomPadding = Platform.OS === 'web' ? 34 : 0;

  const myRank = leaders.findIndex(l => l.id === user?.id) + 1;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <FlatList
        data={leaders}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => <LeaderEntry entry={item} index={index} />}
        contentContainerStyle={[
          styles.list,
          {
            paddingTop: insets.top + webTopPadding + 16,
            paddingBottom: insets.bottom + webBottomPadding + 90,
          }
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: C.text }]}>Leaderboard</Text>
              <Text style={[styles.subtitle, { color: C.textSecondary }]}>Top contributors this month</Text>
            </View>

            {myRank > 0 && (
              <View style={[styles.myRankCard, { backgroundColor: '#0EA5E922', borderColor: '#0EA5E944' }]}>
                <Ionicons name="person-circle" size={16} color="#0EA5E9" />
                <Text style={styles.myRankText}>Your rank: #{myRank}</Text>
              </View>
            )}

            <View style={[styles.scoreGuide, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Text style={[styles.guideTitle, { color: C.textSecondary }]}>How scores are calculated</Text>
              <View style={styles.guideRow}>
                <View style={styles.guideItem}>
                  <Ionicons name="cloud-upload" size={14} color="#0EA5E9" />
                  <Text style={[styles.guideText, { color: C.textSecondary }]}>+10 per upload</Text>
                </View>
                <View style={styles.guideItem}>
                  <Ionicons name="download" size={14} color="#10B981" />
                  <Text style={[styles.guideText, { color: C.textSecondary }]}>+1 per download</Text>
                </View>
              </View>
            </View>

            {leaders.length > 0 && (
              <View style={styles.podium}>
                {leaders.slice(0, 3).map((l, i) => {
                  const order = [1, 0, 2];
                  const heights = [90, 120, 70];
                  const item = leaders[order[i]];
                  if (!item) return null;
                  const actualIndex = order[i];
                  return (
                    <View key={item.id} style={[styles.podiumItem, { height: heights[i] + 40 }]}>
                      <View style={[styles.podiumAvatar, { backgroundColor: item.avatar_color }]}>
                        <Text style={styles.podiumAvatarText}>{item.username[0].toUpperCase()}</Text>
                      </View>
                      <Text style={[styles.podiumName, { color: C.text }]} numberOfLines={1}>{item.username}</Text>
                      <View style={[styles.podiumBase, { backgroundColor: RANK_COLORS[actualIndex] + '33', height: heights[i] }]}>
                        <Ionicons name={RANK_ICONS[actualIndex] as any} size={20} color={RANK_COLORS[actualIndex]} />
                        <Text style={[styles.podiumScore, { color: RANK_COLORS[actualIndex] }]}>{item.score}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <Text style={[styles.allTitle, { color: C.text }]}>All Rankings</Text>
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="trophy-outline" size={48} color={C.textTertiary} />
              <Text style={[styles.emptyText, { color: C.textSecondary }]}>No data yet</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: 16, gap: 10 },
  header: { gap: 14, marginBottom: 8 },
  title: { fontSize: 26, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontFamily: 'Nunito_400Regular' },
  myRankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  myRankText: { fontSize: 14, fontFamily: 'Nunito_700Bold', color: '#0EA5E9' },
  scoreGuide: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  guideTitle: { fontSize: 12, fontFamily: 'Nunito_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  guideRow: { flexDirection: 'row', gap: 20 },
  guideItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  guideText: { fontSize: 13, fontFamily: 'Nunito_500Medium' },
  podium: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 8,
    paddingVertical: 8,
    height: 200,
  },
  podiumItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  podiumAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  podiumAvatarText: { fontSize: 16, fontFamily: 'Nunito_700Bold', color: '#fff' },
  podiumName: { fontSize: 11, fontFamily: 'Nunito_600SemiBold', textAlign: 'center' },
  podiumBase: {
    width: '100%',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  podiumScore: { fontSize: 14, fontFamily: 'Nunito_700Bold' },
  allTitle: { fontSize: 16, fontFamily: 'Nunito_700Bold' },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumber: { fontSize: 13, fontFamily: 'Nunito_700Bold' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontFamily: 'Nunito_700Bold', color: '#fff' },
  userInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  username: { fontSize: 15, fontFamily: 'Nunito_700Bold' },
  youBadge: {
    backgroundColor: '#0EA5E922',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0EA5E944',
  },
  youBadgeText: { fontSize: 10, fontFamily: 'Nunito_600SemiBold', color: '#0EA5E9' },
  statsText: { fontSize: 12, fontFamily: 'Nunito_400Regular' },
  scoreWrapper: { alignItems: 'flex-end' },
  score: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold' },
  scoreLabel: { fontSize: 11, fontFamily: 'Nunito_500Medium' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: 'Nunito_600SemiBold' },
});
