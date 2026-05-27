import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';
import { cacheJson, readCachedJson } from '../lib/storage';
import { PostCard } from '../components/PostCard';

export function HomeScreen() {
  const [posts, setPosts] = useState<any[]>(readCachedJson<any[]>('feed') ?? []);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    try {
      const data = await api<any[]>('/feed?mode=recommended');
      setPosts(data);
      cacheJson('feed', data);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <FlatList
      data={posts.length ? posts : demoPosts}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      ListHeaderComponent={
        <View style={styles.stories}>
          {['You', 'Close', 'Reels', 'Live', 'AI'].map((story) => (
            <View key={story} style={styles.story}>
              <View style={styles.storyRing} />
              <Text style={styles.storyLabel}>{story}</Text>
            </View>
          ))}
        </View>
      }
      renderItem={({ item }) => <PostCard post={item} />}
    />
  );
}

const demoPosts = [
  {
    id: 'demo',
    caption: 'A runnable KrazyVerse feed with likes, comments, saves, stories, reels, and AI features wired to the API.',
    author: { profile: { username: 'krazyverse', displayName: 'KrazyVerse' } },
    media: [],
    _count: { likes: 0, comments: 0 },
  },
];

const styles = StyleSheet.create({
  stories: { height: 104, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, backgroundColor: '#fff' },
  story: { alignItems: 'center', width: 58 },
  storyRing: { width: 54, height: 54, borderRadius: 27, borderWidth: 3, borderColor: '#7c3aed', backgroundColor: '#f8fafc' },
  storyLabel: { marginTop: 6, fontSize: 12, color: '#111827' },
});
