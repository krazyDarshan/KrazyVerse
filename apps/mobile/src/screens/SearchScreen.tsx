import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';

export function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>({ users: [], posts: [], hashtags: [] });

  async function search(text: string) {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults({ users: [], posts: [], hashtags: [] });
      return;
    }
    const data = await api<any>(`/discovery/search?q=${encodeURIComponent(text)}`).catch(() => null);
    if (data) {
      setResults(data);
    }
  }

  const rows = [
    ...(results.users ?? []).map((item: any) => ({ type: 'user', label: `@${item.username}`, sub: item.displayName })),
    ...(results.hashtags ?? []).map((item: any) => ({ type: 'hashtag', label: `#${item.tag}`, sub: `${item.useCount} posts` })),
    ...(results.posts ?? []).map((item: any) => ({ type: 'post', label: item.caption ?? 'Post', sub: item.author?.profile?.username })),
  ];

  return (
    <View style={styles.screen}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#6b7280" />
        <TextInput value={query} onChangeText={search} placeholder="Search users, tags, audio, places" style={styles.input} />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item, index) => `${item.type}-${index}`}
        renderItem={({ item }) => (
          <Pressable style={styles.row}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.sub}>{item.sub}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Explore trending creators, hashtags, locations, audio, and posts.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff', padding: 14 },
  searchBox: { height: 46, borderRadius: 8, backgroundColor: '#f3f4f6', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  label: { fontWeight: '800', color: '#111827', fontSize: 16 },
  sub: { color: '#6b7280', marginTop: 3 },
  empty: { color: '#6b7280', marginTop: 24, lineHeight: 21 },
});
