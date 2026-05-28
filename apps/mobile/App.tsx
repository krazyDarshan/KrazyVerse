import { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type TabName = 'Home' | 'Search' | 'Create' | 'Reels' | 'Profile';

const tabs: TabName[] = ['Home', 'Search', 'Create', 'Reels', 'Profile'];
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export default function App() {
  const [tab, setTab] = useState<TabName>('Home');

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.logo}>KrazyVerse</Text>
        <Text style={styles.pill}>SDK 51 Ready</Text>
      </View>
      <View style={styles.content}>{renderTab(tab)}</View>
      <View style={styles.tabs}>
        {tabs.map((item) => (
          <Pressable
            key={item}
            onPress={() => setTab(item)}
            style={[styles.tab, tab === item && styles.activeTab]}
          >
            <Text style={[styles.tabText, tab === item && styles.activeTabText]}>{item}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function renderTab(tab: TabName) {
  if (tab === 'Home') {
    return <Home />;
  }
  if (tab === 'Search') {
    return <Search />;
  }
  if (tab === 'Create') {
    return <Create />;
  }
  if (tab === 'Reels') {
    return <Reels />;
  }
  return <Profile />;
}

function Home() {
  const [status, setStatus] = useState('Checking API...');

  useEffect(() => {
    fetch(`${apiUrl}/feed?mode=recommended`)
      .then((response) => response.json())
      .then((payload) => {
        setStatus(payload?.success ? 'API connected' : 'API responded with an error');
      })
      .catch(() => setStatus('API not reachable from phone'));
  }, []);

  return (
    <FlatList
      data={[1, 2, 3]}
      keyExtractor={(item) => String(item)}
      ListHeaderComponent={
        <View>
          <View style={styles.storyRow}>
            {['You', 'AI', 'Live', 'Close', 'Music'].map((story) => (
              <View key={story} style={styles.story}>
                <View style={styles.storyCircle} />
                <Text style={styles.storyText}>{story}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.status}>{status}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.post}>
          <View style={styles.postHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>K</Text>
            </View>
            <View>
              <Text style={styles.name}>KrazyVerse Creator</Text>
              <Text style={styles.muted}>@krazyverse</Text>
            </View>
          </View>
          <View style={[styles.media, item === 2 && styles.mediaAlt]}>
            <Text style={styles.mediaText}>KrazyVerse</Text>
          </View>
          <Text style={styles.caption}>
            A working Expo Go build with feed, search, create, reels, and profile tabs.
          </Text>
        </View>
      )}
    />
  );
}

function Search() {
  return (
    <View style={styles.panel}>
      <TextInput placeholder="Search users, hashtags, places, audio" style={styles.input} />
      {['#launchday', '#reels', '#creatorpro', '@krazyverse'].map((row) => (
        <Text key={row} style={styles.row}>
          {row}
        </Text>
      ))}
    </View>
  );
}

function Create() {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Create</Text>
      <TextInput multiline placeholder="Write a caption..." style={[styles.input, styles.textarea]} />
      <Pressable style={styles.primary}>
        <Text style={styles.primaryText}>Publish Draft</Text>
      </Pressable>
    </View>
  );
}

function Reels() {
  return (
    <View style={styles.reel}>
      <Text style={styles.reelTitle}>Reels</Text>
      <Text style={styles.reelCopy}>Vertical video feed, duet, subtitles, audio remix, and saves are wired in the API.</Text>
    </View>
  );
}

function Profile() {
  return (
    <ScrollView style={styles.panel}>
      <View style={styles.cover} />
      <View style={styles.profileAvatar}>
        <Text style={styles.profileAvatarText}>K</Text>
      </View>
      <Text style={styles.title}>KrazyVerse Creator</Text>
      <Text style={styles.muted}>@krazyverse</Text>
      <Text style={styles.bio}>Build, post, remix, message, and monetize.</Text>
      <View style={styles.stats}>
        <Stat label="Followers" value="0" />
        <Stat label="Following" value="0" />
        <Stat label="Level" value="2" />
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    height: 58,
    backgroundColor: '#fff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: { fontSize: 24, fontWeight: '900', color: '#111827' },
  pill: {
    backgroundColor: '#ecfeff',
    color: '#0f766e',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    fontWeight: '800',
  },
  content: { flex: 1 },
  tabs: {
    height: 68,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopColor: '#e5e7eb',
    borderTopWidth: 1,
    paddingHorizontal: 6,
    paddingTop: 6,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#ede9fe' },
  tabText: { color: '#6b7280', fontSize: 12, fontWeight: '800' },
  activeTabText: { color: '#7c3aed' },
  storyRow: { height: 104, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, backgroundColor: '#fff' },
  story: { width: 58, alignItems: 'center' },
  storyCircle: { width: 54, height: 54, borderRadius: 27, borderWidth: 3, borderColor: '#7c3aed', backgroundColor: '#f0fdfa' },
  storyText: { marginTop: 6, fontSize: 12, color: '#374151' },
  status: { padding: 12, color: '#0f766e', fontWeight: '800' },
  post: { backgroundColor: '#fff', marginBottom: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e5e7eb' },
  postHeader: { height: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '900' },
  name: { color: '#111827', fontWeight: '900' },
  muted: { color: '#6b7280' },
  media: { aspectRatio: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  mediaAlt: { backgroundColor: '#0f766e' },
  mediaText: { color: '#fff', fontSize: 32, fontWeight: '900' },
  caption: { padding: 14, color: '#111827', lineHeight: 21 },
  panel: { flex: 1, backgroundColor: '#fff', padding: 16 },
  input: { minHeight: 46, borderColor: '#e5e7eb', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, color: '#111827' },
  textarea: { minHeight: 120, paddingTop: 12, textAlignVertical: 'top' },
  row: { paddingVertical: 16, borderBottomColor: '#f3f4f6', borderBottomWidth: 1, color: '#111827', fontWeight: '800' },
  title: { fontSize: 24, color: '#111827', fontWeight: '900', marginBottom: 6 },
  primary: { height: 46, backgroundColor: '#7c3aed', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryText: { color: '#fff', fontWeight: '900' },
  reel: { flex: 1, backgroundColor: '#111827', justifyContent: 'flex-end', padding: 20 },
  reelTitle: { color: '#fff', fontSize: 32, fontWeight: '900', marginBottom: 10 },
  reelCopy: { color: '#e5e7eb', lineHeight: 22 },
  cover: { height: 120, backgroundColor: '#0f766e', borderRadius: 8 },
  profileAvatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#7c3aed', borderWidth: 4, borderColor: '#fff', marginTop: -44, marginLeft: 14, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: '#fff', fontSize: 34, fontWeight: '900' },
  bio: { color: '#374151', lineHeight: 21, marginTop: 10 },
  stats: { flexDirection: 'row', marginTop: 18, borderTopColor: '#e5e7eb', borderTopWidth: 1 },
  stat: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  statValue: { color: '#111827', fontWeight: '900', fontSize: 18 },
});
