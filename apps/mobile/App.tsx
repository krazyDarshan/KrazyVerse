import { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AuthScreen } from './src/screens/AuthScreen';
import { API_URL, api } from './src/lib/api';
import {
  type AuthSession,
  getStoredSession,
  loadStoredSession,
  logout as logoutDevice,
} from './src/lib/auth';

type TabName = 'Home' | 'Search' | 'Create' | 'Reels' | 'Profile';

const tabs: TabName[] = ['Home', 'Search', 'Create', 'Reels', 'Profile'];

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState<TabName>('Home');

  useEffect(() => {
    let mounted = true;

    loadStoredSession()
      .then((storedSession) => {
        if (mounted && storedSession) {
          setSession(storedSession);
        }
      })
      .finally(() => {
        if (mounted) {
          setBooting(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (booting) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <AuthScreen onAuthenticated={setSession} />;
  }

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>KrazyVerse</Text>
          <Text style={styles.headerSub}>
            {session.user.profile?.username ?? session.user.email}
          </Text>
        </View>
        <Text style={styles.pill}>Live API</Text>
      </View>
      <View style={styles.content}>{renderTab(tab, session, () => setSession(null))}</View>
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

function LoadingScreen() {
  return (
    <SafeAreaView style={styles.loadingScreen}>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.loadingLogo}>KrazyVerse</Text>
      <Text style={styles.loadingText}>Restoring secure session...</Text>
    </SafeAreaView>
  );
}

function renderTab(tab: TabName, session: AuthSession, onLoggedOut: () => void) {
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
  return <Profile session={session} onLoggedOut={onLoggedOut} />;
}

function Home() {
  const [posts, setPosts] = useState<any[]>([]);
  const [status, setStatus] = useState('Loading personalized feed...');
  const [refreshing, setRefreshing] = useState(false);

  async function loadFeed() {
    setRefreshing(true);
    try {
      const data = await api<any[]>('/feed?mode=recommended');
      setPosts(data);
      setStatus(data.length ? 'API connected' : 'API connected. No posts yet.');
    } catch {
      setStatus('API not reachable from phone. Check dev:api and EXPO_PUBLIC_API_URL.');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadFeed();
  }, []);

  const rows = posts.length ? posts : demoPosts;

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadFeed} />}
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
      renderItem={({ item }) => <FeedPost post={item} />}
    />
  );
}

function FeedPost({ post }: { post: any }) {
  const author = post.author?.profile;
  return (
    <View style={styles.post}>
      <View style={styles.postHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{author?.displayName?.[0] ?? 'K'}</Text>
        </View>
        <View>
          <Text style={styles.name}>{author?.displayName ?? 'KrazyVerse Creator'}</Text>
          <Text style={styles.muted}>@{author?.username ?? 'krazyverse'}</Text>
        </View>
      </View>
      <View style={styles.media}>
        <Text style={styles.mediaText}>KrazyVerse</Text>
      </View>
      <Text style={styles.caption}>{post.caption}</Text>
      <Text style={styles.metrics}>
        {post._count?.likes ?? 0} likes | {post._count?.comments ?? 0} comments
      </Text>
    </View>
  );
}

function Search() {
  return (
    <View style={styles.panel}>
      <TextInput
        placeholder="Search users, hashtags, places, audio"
        placeholderTextColor="#94a3b8"
        style={styles.input}
      />
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
      <TextInput
        multiline
        placeholder="Write a caption..."
        placeholderTextColor="#94a3b8"
        style={[styles.input, styles.textarea]}
      />
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
      <Text style={styles.reelCopy}>
        Vertical video feed, duet, subtitles, audio remix, and saves are wired in the API.
      </Text>
    </View>
  );
}

function Profile({ session, onLoggedOut }: { session: AuthSession; onLoggedOut(): void }) {
  const [profile, setProfile] = useState<any>(session.user.profile);
  const [status, setStatus] = useState('Loading profile...');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    api<any>('/profiles/me')
      .then((data) => {
        setProfile(data);
        setStatus(data.user?.emailVerifiedAt ? 'Email verified' : 'Email verification pending');
      })
      .catch(() => setStatus('Profile API unavailable'));
  }, []);

  async function logout() {
    setLoggingOut(true);
    await logoutDevice();
    onLoggedOut();
  }

  const displayName =
    profile?.displayName ?? session.user.profile?.displayName ?? 'KrazyVerse Creator';
  const username = profile?.username ?? session.user.profile?.username ?? 'krazyverse';

  return (
    <ScrollView style={styles.panel}>
      <View style={styles.cover} />
      <View style={styles.profileAvatar}>
        <Text style={styles.profileAvatarText}>{username[0].toUpperCase()}</Text>
      </View>
      <Text style={styles.title}>{displayName}</Text>
      <Text style={styles.muted}>@{username}</Text>
      <Text style={styles.bio}>{profile?.bio ?? 'Build, post, remix, message, and monetize.'}</Text>
      <Text style={styles.status}>{status}</Text>
      <View style={styles.stats}>
        <Stat label="Followers" value={String(profile?.followersCount ?? 0)} />
        <Stat label="Following" value={String(profile?.followingCount ?? 0)} />
        <Stat label="Level" value={String(profile?.level ?? 1)} />
      </View>
      <Text style={styles.apiText}>API: {API_URL}</Text>
      <Pressable disabled={loggingOut} style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>
          {loggingOut ? 'Logging out...' : 'Logout this device'}
        </Text>
      </Pressable>
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

const demoPosts = [
  {
    id: 'demo-1',
    caption:
      'Your account is live. Create the first post from the web/API and it will appear here.',
    author: { profile: { username: 'krazyverse', displayName: 'KrazyVerse' } },
    _count: { likes: 0, comments: 0 },
  },
];

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#f8fafc' },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  loadingLogo: { color: '#111827', fontSize: 34, fontWeight: '900' },
  loadingText: { color: '#64748b', marginTop: 8, fontWeight: '800' },
  header: {
    height: 64,
    backgroundColor: '#fff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: { fontSize: 23, fontWeight: '900', color: '#111827' },
  headerSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
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
  storyRow: {
    height: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  story: { width: 58, alignItems: 'center' },
  storyCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 3,
    borderColor: '#7c3aed',
    backgroundColor: '#f0fdfa',
  },
  storyText: { marginTop: 6, fontSize: 12, color: '#374151' },
  status: { paddingVertical: 12, color: '#0f766e', fontWeight: '800' },
  post: {
    backgroundColor: '#fff',
    marginBottom: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  postHeader: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '900' },
  name: { color: '#111827', fontWeight: '900' },
  muted: { color: '#6b7280' },
  media: {
    aspectRatio: 1,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaText: { color: '#fff', fontSize: 32, fontWeight: '900' },
  caption: { padding: 14, color: '#111827', lineHeight: 21 },
  metrics: { paddingHorizontal: 14, paddingBottom: 14, color: '#64748b', fontWeight: '800' },
  panel: { flex: 1, backgroundColor: '#fff', padding: 16 },
  input: {
    minHeight: 46,
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#111827',
  },
  textarea: { minHeight: 120, paddingTop: 12, textAlignVertical: 'top' },
  row: {
    paddingVertical: 16,
    borderBottomColor: '#f3f4f6',
    borderBottomWidth: 1,
    color: '#111827',
    fontWeight: '800',
  },
  title: { fontSize: 24, color: '#111827', fontWeight: '900', marginBottom: 6 },
  primary: {
    height: 46,
    backgroundColor: '#7c3aed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  primaryText: { color: '#fff', fontWeight: '900' },
  reel: { flex: 1, backgroundColor: '#111827', justifyContent: 'flex-end', padding: 20 },
  reelTitle: { color: '#fff', fontSize: 32, fontWeight: '900', marginBottom: 10 },
  reelCopy: { color: '#e5e7eb', lineHeight: 22 },
  cover: { height: 120, backgroundColor: '#0f766e', borderRadius: 8 },
  profileAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#7c3aed',
    borderWidth: 4,
    borderColor: '#fff',
    marginTop: -44,
    marginLeft: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: { color: '#fff', fontSize: 34, fontWeight: '900' },
  bio: { color: '#374151', lineHeight: 21, marginTop: 10 },
  stats: { flexDirection: 'row', marginTop: 8, borderTopColor: '#e5e7eb', borderTopWidth: 1 },
  stat: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  statValue: { color: '#111827', fontWeight: '900', fontSize: 18 },
  apiText: { color: '#64748b', fontSize: 12, marginTop: 8 },
  logoutButton: {
    height: 46,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  logoutText: { color: '#991b1b', fontWeight: '900' },
});
