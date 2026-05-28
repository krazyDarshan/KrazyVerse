import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import { AuthScreen } from './src/screens/AuthScreen';
import { API_URL, ApiClientError, api, socket as createSocket } from './src/lib/api';
import {
  type AuthSession,
  getStoredSession,
  loadStoredSession,
  logout as logoutDevice,
} from './src/lib/auth';
import {
  getOrCreateSavedConversation,
  listConversations,
  loadMessages,
  markConversationRead,
  sendMessage,
  sendRealtimeMessage,
  sharePostToSavedMessages,
  searchUsers,
  startDirectConversation,
  type Conversation,
  type ConversationListItem,
  type Message,
  type UserSearchResult,
} from './src/lib/chat';
import {
  addPostComment,
  createPost,
  type FeedMode,
  loadFeed as loadFeedPosts,
  loadPostComments,
  type FeedPost as FeedPostType,
  type PostComment,
  togglePostLike,
} from './src/lib/posts';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from './src/lib/notifications';
import {
  followUser,
  getProfileByUsername,
  listFollowingUserIds,
  searchPeople,
  type AppThemeName,
  type FollowState,
  type ProfileDetail,
  type SocialProfile,
  unfollowUser,
  updateProfileSettings,
} from './src/lib/social';
import { blockUser, muteUser, reportTarget } from './src/lib/safety';

type TabName = 'Home' | 'Search' | 'Create' | 'Reels' | 'Chat' | 'Alerts' | 'Profile';

const tabs: TabName[] = ['Home', 'Search', 'Create', 'Reels', 'Chat', 'Alerts', 'Profile'];

const themeOptions: Array<{ name: AppThemeName; label: string; color: string }> = [
  { name: 'purple', label: 'Purple', color: '#7c3aed' },
  { name: 'ocean', label: 'Ocean', color: '#0891b2' },
  { name: 'sunset', label: 'Sunset', color: '#f97316' },
  { name: 'forest', label: 'Forest', color: '#16a34a' },
  { name: 'midnight', label: 'Midnight', color: '#111827' },
];

function getThemeName(profile: unknown): AppThemeName {
  if (profile && typeof profile === 'object' && 'customTheme' in profile) {
    const customTheme = (profile as { customTheme?: { name?: unknown } | null }).customTheme;
    const name = customTheme?.name;
    if (typeof name === 'string' && themeOptions.some((theme) => theme.name === name)) {
      return name as AppThemeName;
    }
  }
  return 'purple';
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState<TabName>('Home');
  const [feedVersion, setFeedVersion] = useState(0);
  const [chatVersion, setChatVersion] = useState(0);
  const [viewingProfileUsername, setViewingProfileUsername] = useState<string | null>(null);
  const [focusConversationId, setFocusConversationId] = useState<string | null>(null);
  const [notificationVersion, setNotificationVersion] = useState(0);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

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

  useEffect(() => {
    if (!session) {
      setNotificationUnreadCount(0);
      return undefined;
    }

    let mounted = true;
    listNotifications()
      .then(({ unreadCount }) => {
        if (mounted) {
          setNotificationUnreadCount(unreadCount);
        }
      })
      .catch(() => undefined);

    const connection = createSocket();
    connection.on('notification:new', () => {
      setNotificationUnreadCount((current) => current + 1);
      setNotificationVersion((current) => current + 1);
    });

    return () => {
      mounted = false;
      connection.disconnect();
    };
  }, [session]);

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
        <Text style={[styles.pill, notificationUnreadCount > 0 && styles.pillUnread]}>
          {notificationUnreadCount > 0 ? `${notificationUnreadCount} alerts` : 'Live API'}
        </Text>
      </View>
      <View style={styles.content}>
        {viewingProfileUsername ? (
          <ProfileViewer
            username={viewingProfileUsername}
            session={session}
            onBack={() => setViewingProfileUsername(null)}
            onOpenChat={(conversationId) => {
              setFocusConversationId(conversationId);
              setViewingProfileUsername(null);
              setChatVersion((current) => current + 1);
              setTab('Chat');
            }}
            onSocialGraphChanged={() => setFeedVersion((current) => current + 1)}
          />
        ) : (
          renderTab(
            tab,
            session,
            feedVersion,
            chatVersion,
            focusConversationId,
            notificationVersion,
            notificationUnreadCount,
            (username) => setViewingProfileUsername(username),
            () => {
              setFeedVersion((current) => current + 1);
              setTab('Home');
            },
            () => {
              setChatVersion((current) => current + 1);
              setTab('Chat');
            },
            (conversationId) => {
              setFocusConversationId(conversationId);
              setChatVersion((current) => current + 1);
              setTab('Chat');
            },
            (unreadCount) => setNotificationUnreadCount(unreadCount),
            () => setFeedVersion((current) => current + 1),
            () => setSession(null),
            () => setSession(null),
          )
        )}
      </View>
      <View style={styles.tabs}>
        {tabs.map((item) => (
          <Pressable
            key={item}
            onPress={() => {
              setViewingProfileUsername(null);
              setTab(item);
            }}
            style={[styles.tab, tab === item && styles.activeTab]}
          >
            <Text style={[styles.tabText, tab === item && styles.activeTabText]}>{item}</Text>
            {item === 'Alerts' && notificationUnreadCount > 0 ? (
              <Text style={styles.tabBadge}>{notificationUnreadCount}</Text>
            ) : null}
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

function renderTab(
  tab: TabName,
  session: AuthSession,
  feedVersion: number,
  chatVersion: number,
  focusConversationId: string | null,
  notificationVersion: number,
  notificationUnreadCount: number,
  onOpenProfile: (username: string) => void,
  onPostCreated: () => void,
  onPostShared: () => void,
  onOpenChat: (conversationId: string) => void,
  onNotificationsRead: (unreadCount: number) => void,
  onSocialGraphChanged: () => void,
  onSessionExpired: () => void,
  onLoggedOut: () => void,
) {
  if (tab === 'Home') {
    return (
      <Home
        session={session}
        refreshKey={feedVersion}
        onPostShared={onPostShared}
        onOpenProfile={onOpenProfile}
      />
    );
  }
  if (tab === 'Search') {
    return (
      <Search
        session={session}
        onOpenProfile={onOpenProfile}
        onSocialGraphChanged={onSocialGraphChanged}
      />
    );
  }
  if (tab === 'Create') {
    return <Create onPostCreated={onPostCreated} onSessionExpired={onSessionExpired} />;
  }
  if (tab === 'Reels') {
    return <Reels />;
  }
  if (tab === 'Chat') {
    return (
      <Chat session={session} refreshKey={chatVersion} focusConversationId={focusConversationId} />
    );
  }
  if (tab === 'Alerts') {
    return (
      <NotificationsCenter
        refreshKey={notificationVersion}
        unreadCount={notificationUnreadCount}
        onOpenChat={onOpenChat}
        onNotificationsRead={onNotificationsRead}
      />
    );
  }
  return <Profile session={session} onLoggedOut={onLoggedOut} />;
}

function Home({
  session,
  refreshKey,
  onPostShared,
  onOpenProfile,
}: {
  session: AuthSession;
  refreshKey: number;
  onPostShared(): void;
  onOpenProfile(username: string): void;
}) {
  const [posts, setPosts] = useState<FeedPostType[]>([]);
  const [feedMode, setFeedMode] = useState<FeedMode>('recommended');
  const [status, setStatus] = useState('Loading personalized feed...');
  const [refreshing, setRefreshing] = useState(false);

  async function loadFeed() {
    setRefreshing(true);
    try {
      const data = await loadFeedPosts(feedMode);
      setPosts(data);
      setStatus(
        data.length
          ? `${feedMode === 'following' ? 'Following' : 'Recommended'} feed loaded`
          : feedMode === 'following'
            ? 'Follow creators in Search to fill this feed.'
            : 'API connected. No posts yet.',
      );
    } catch {
      setStatus('API not reachable from phone. Check dev:api and EXPO_PUBLIC_API_URL.');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadFeed();
  }, [refreshKey, feedMode]);

  const rows = posts.length ? posts : feedMode === 'recommended' ? demoPosts : [];

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
          <View style={styles.feedModeRow}>
            {(['recommended', 'following'] as FeedMode[]).map((mode) => (
              <Pressable
                key={mode}
                style={[styles.feedModeButton, feedMode === mode && styles.feedModeButtonActive]}
                onPress={() => setFeedMode(mode)}
              >
                <Text style={[styles.feedModeText, feedMode === mode && styles.feedModeTextActive]}>
                  {mode === 'following' ? 'Following' : 'Recommended'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.status}>{status}</Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.emptyFeed}>
          Follow people from Search, then their posts will appear here.
        </Text>
      }
      renderItem={({ item }) => (
        <FeedPost
          post={item}
          session={session}
          onPostShared={onPostShared}
          onOpenProfile={onOpenProfile}
        />
      )}
    />
  );
}

function FeedPost({
  post,
  session,
  onPostShared,
  onOpenProfile,
}: {
  post: FeedPostType;
  session: AuthSession;
  onPostShared(): void;
  onOpenProfile(username: string): void;
}) {
  const author = post.author?.profile;
  const media = post.media?.[0];
  const isDemo = post.id.startsWith('demo-');
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post._count?.likes ?? 0);
  const [commentCount, setCommentCount] = useState(post._count?.comments ?? 0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentStatus, setCommentStatus] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [shareStatus, setShareStatus] = useState('Share');
  const [sharing, setSharing] = useState(false);
  const [safetyStatus, setSafetyStatus] = useState('');
  const [reporting, setReporting] = useState(false);

  async function like() {
    if (isDemo) {
      return;
    }

    try {
      const result = await togglePostLike(post.id);
      setLiked(result.liked);
      setLikeCount((current) => Math.max(0, current + (result.liked ? 1 : -1)));
    } catch (error) {
      setCommentStatus(error instanceof Error ? error.message : 'Like failed.');
    }
  }

  async function toggleComments() {
    const nextOpen = !commentsOpen;
    setCommentsOpen(nextOpen);
    if (!nextOpen || isDemo || comments.length) {
      return;
    }

    setLoadingComments(true);
    setCommentStatus('Loading comments...');
    try {
      const loaded = await loadPostComments(post.id);
      setComments(loaded);
      setCommentStatus(loaded.length ? 'Comments loaded' : 'No comments yet.');
    } catch (error) {
      setCommentStatus(error instanceof Error ? error.message : 'Could not load comments.');
    } finally {
      setLoadingComments(false);
    }
  }

  async function addComment() {
    const content = commentDraft.trim();
    if (!content || isDemo) {
      return;
    }

    setCommenting(true);
    try {
      const comment = await addPostComment(post.id, content);
      setCommentDraft('');
      setComments((current) => [comment, ...current]);
      setCommentCount((current) => current + 1);
      setCommentStatus('Comment posted');
    } catch (error) {
      setCommentStatus(error instanceof Error ? error.message : 'Comment failed.');
    } finally {
      setCommenting(false);
    }
  }

  async function share() {
    if (isDemo) {
      setShareStatus('Create a real post first');
      return;
    }

    setSharing(true);
    setShareStatus('Sharing...');
    try {
      await sharePostToSavedMessages({
        currentUserId: session.user.id,
        postId: post.id,
        caption: post.caption,
      });
      setShareStatus('Shared to Chat');
      onPostShared();
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : 'Share failed');
    } finally {
      setSharing(false);
    }
  }

  async function reportPost() {
    if (isDemo) {
      setSafetyStatus('Create a real post first');
      return;
    }

    setReporting(true);
    setSafetyStatus('Sending report...');
    try {
      await reportTarget({
        targetType: 'POST',
        targetId: post.id,
        reason: 'User reported post',
        description: post.caption ? `Caption: ${post.caption}` : undefined,
      });
      setSafetyStatus('Report sent to moderation');
    } catch (error) {
      setSafetyStatus(error instanceof Error ? error.message : 'Report failed.');
    } finally {
      setReporting(false);
    }
  }

  return (
    <View style={styles.post}>
      <Pressable
        style={styles.postHeader}
        onPress={() => {
          if (author?.username && !isDemo) {
            onOpenProfile(author.username);
          }
        }}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{author?.displayName?.[0] ?? 'K'}</Text>
        </View>
        <View>
          <Text style={styles.name}>{author?.displayName ?? 'KrazyVerse Creator'}</Text>
          <Text style={styles.muted}>@{author?.username ?? 'krazyverse'}</Text>
        </View>
      </Pressable>
      {media?.type === 'IMAGE' ? (
        <Image source={{ uri: media.url }} style={styles.mediaImage} resizeMode="cover" />
      ) : (
        <View style={styles.media}>
          <Text style={styles.mediaText}>KrazyVerse</Text>
        </View>
      )}
      <Text style={styles.caption}>{post.caption || 'Untitled KrazyVerse post'}</Text>
      <Text style={styles.metrics}>
        {likeCount} likes | {commentCount} comments
      </Text>
      <View style={styles.actionRow}>
        <Pressable
          disabled={isDemo}
          style={[
            styles.actionButton,
            liked && styles.actionButtonActive,
            isDemo && styles.disabled,
          ]}
          onPress={like}
        >
          <Text style={[styles.actionText, liked && styles.actionTextActive]}>
            {liked ? 'Liked' : 'Like'}
          </Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={toggleComments}>
          <Text style={styles.actionText}>{commentsOpen ? 'Hide' : 'Comment'}</Text>
        </Pressable>
        <Pressable
          disabled={sharing}
          style={[styles.actionButton, sharing && styles.disabled]}
          onPress={share}
        >
          <Text style={styles.actionText}>{shareStatus}</Text>
        </Pressable>
      </View>
      <View style={styles.postSafetyRow}>
        <Pressable
          disabled={reporting || isDemo}
          style={[styles.safetyButton, (reporting || isDemo) && styles.disabled]}
          onPress={reportPost}
        >
          <Text style={styles.safetyButtonText}>{reporting ? 'Reporting...' : 'Report post'}</Text>
        </Pressable>
        {safetyStatus ? <Text style={styles.safetyStatus}>{safetyStatus}</Text> : null}
      </View>
      {commentsOpen ? (
        <View style={styles.commentsPanel}>
          {isDemo ? (
            <Text style={styles.emptyChat}>Create a real post first, then comments work here.</Text>
          ) : (
            <>
              <View style={styles.commentComposer}>
                <TextInput
                  value={commentDraft}
                  onChangeText={setCommentDraft}
                  placeholder="Write a comment..."
                  placeholderTextColor="#94a3b8"
                  style={styles.commentInput}
                />
                <Pressable
                  disabled={commenting || !commentDraft.trim()}
                  style={[
                    styles.commentSend,
                    (commenting || !commentDraft.trim()) && styles.disabled,
                  ]}
                  onPress={addComment}
                >
                  <Text style={styles.commentSendText}>{commenting ? '...' : 'Post'}</Text>
                </Pressable>
              </View>
              {commentStatus ? <Text style={styles.commentStatus}>{commentStatus}</Text> : null}
              {loadingComments ? <Text style={styles.emptyChat}>Loading comments...</Text> : null}
              {comments.map((comment) => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

function CommentItem({ comment }: { comment: PostComment }) {
  const author = comment.author?.profile;
  return (
    <View style={styles.commentItem}>
      <Text style={styles.commentAuthor}>
        @{author?.username ?? 'creator'}
        <Text style={styles.commentText}> {comment.content}</Text>
      </Text>
      {comment.replies?.map((reply) => (
        <View key={reply.id} style={styles.replyItem}>
          <CommentItem comment={reply} />
        </View>
      ))}
    </View>
  );
}

function Search({
  session,
  onOpenProfile,
  onSocialGraphChanged,
}: {
  session: AuthSession;
  onOpenProfile(username: string): void;
  onSocialGraphChanged(): void;
}) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<SocialProfile[]>([]);
  const [followStates, setFollowStates] = useState<Record<string, FollowState>>({});
  const [status, setStatus] = useState('Search people, follow creators, then open Following feed.');
  const [searching, setSearching] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  useEffect(() => {
    listFollowingUserIds(session.user.id)
      .then((ids) => {
        setFollowStates((current) => {
          const next = { ...current };
          ids.forEach((userId) => {
            next[userId] = 'following';
          });
          return next;
        });
      })
      .catch(() => undefined);
  }, [session.user.id]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setUsers([]);
      setSearching(false);
      setStatus('Type at least 2 characters to search users.');
      return;
    }

    let canceled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      searchPeople(q)
        .then((results) => {
          if (canceled) {
            return;
          }

          const filtered = results.filter((user) => user.userId !== session.user.id);
          setUsers(filtered);
          setStatus(
            filtered.length
              ? `${filtered.length} user${filtered.length === 1 ? '' : 's'} found`
              : 'No users found.',
          );
        })
        .catch((error) => {
          if (!canceled) {
            setStatus(error instanceof Error ? error.message : 'User search failed.');
          }
        })
        .finally(() => {
          if (!canceled) {
            setSearching(false);
          }
        });
    }, 250);

    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [query, session.user.id]);

  async function toggleFollow(user: SocialProfile) {
    const currentState = followStates[user.userId] ?? 'idle';
    setBusyUserId(user.userId);
    try {
      if (currentState === 'following' || currentState === 'requested') {
        await unfollowUser(user.userId);
        setFollowStates((current) => ({ ...current, [user.userId]: 'idle' }));
        setUsers((current) =>
          current.map((item) =>
            item.userId === user.userId
              ? {
                  ...item,
                  followersCount:
                    currentState === 'following'
                      ? Math.max(0, (item.followersCount ?? 0) - 1)
                      : item.followersCount,
                }
              : item,
          ),
        );
        setStatus(`Unfollowed @${user.username}`);
      } else {
        const nextState = await followUser(user.userId);
        setFollowStates((current) => ({ ...current, [user.userId]: nextState }));
        setUsers((current) =>
          current.map((item) =>
            item.userId === user.userId
              ? {
                  ...item,
                  followersCount:
                    nextState === 'following'
                      ? (item.followersCount ?? 0) + 1
                      : item.followersCount,
                }
              : item,
          ),
        );
        setStatus(
          nextState === 'requested' ? `Requested @${user.username}` : `Following @${user.username}`,
        );
      }
      onSocialGraphChanged();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Follow action failed.');
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <ScrollView style={styles.panel} keyboardShouldPersistTaps="handled">
      <View style={styles.searchHeader}>
        <Text style={styles.title}>Search</Text>
        <Text style={styles.muted}>{status}</Text>
      </View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        placeholder="Search users by username or name"
        placeholderTextColor="#94a3b8"
        style={styles.input}
      />
      {searching ? <Text style={styles.commentStatus}>Searching...</Text> : null}
      {users.map((user) => {
        const followState = followStates[user.userId] ?? 'idle';
        const busy = busyUserId === user.userId;
        return (
          <View key={user.id} style={styles.searchUserCard}>
            <Pressable style={styles.searchUserMain} onPress={() => onOpenProfile(user.username)}>
              <View style={styles.smallAvatar}>
                <Text style={styles.smallAvatarText}>
                  {user.displayName?.[0] ?? user.username[0]}
                </Text>
              </View>
              <View style={styles.userMeta}>
                <Text style={styles.name}>
                  {user.displayName}
                  {user.verified ? ' verified' : ''}
                </Text>
                <Text style={styles.muted}>@{user.username}</Text>
                <Text style={styles.searchUserStats}>
                  {user.followersCount ?? 0} followers
                  {user.accountType === 'PRIVATE' ? ' | private' : ''}
                </Text>
              </View>
            </Pressable>
            <Pressable
              disabled={busy}
              style={[
                styles.followButton,
                followState !== 'idle' && styles.followButtonActive,
                busy && styles.disabled,
              ]}
              onPress={() => toggleFollow(user)}
            >
              <Text
                style={[
                  styles.followButtonText,
                  followState !== 'idle' && styles.followButtonTextActive,
                ]}
              >
                {busy
                  ? '...'
                  : followState === 'following'
                    ? 'Following'
                    : followState === 'requested'
                      ? 'Requested'
                      : 'Follow'}
              </Text>
            </Pressable>
          </View>
        );
      })}
      {!users.length && query.trim().length < 2 ? (
        <View style={styles.searchTips}>
          {['Find a friend', 'Tap Follow', 'Switch Home to Following'].map((row) => (
            <Text key={row} style={styles.row}>
              {row}
            </Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function Create({
  onPostCreated,
  onSessionExpired,
}: {
  onPostCreated(): void;
  onSessionExpired(): void;
}) {
  const [caption, setCaption] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<{
    uri: string;
    width?: number;
    height?: number;
    mimeType?: string;
    fileName?: string;
  } | null>(null);
  const [status, setStatus] = useState('Pick an image and write a caption.');
  const [publishing, setPublishing] = useState(false);

  async function pickImage() {
    setStatus('Opening photo library...');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setStatus('Photo library access is needed to pick an image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled || !result.assets[0]) {
        setStatus(selectedMedia ? 'Image kept. Ready to publish.' : 'No image selected.');
        return;
      }

      const asset = result.assets[0];
      setSelectedMedia({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        mimeType: asset.mimeType,
        fileName: asset.fileName ?? undefined,
      });
      setStatus('Image selected. Ready to publish.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not open photo library.');
    }
  }

  async function publish() {
    const nextCaption = caption.trim();
    if (!nextCaption) {
      setStatus('Write a caption first.');
      return;
    }
    if (!selectedMedia) {
      setStatus('Pick an image first.');
      return;
    }

    setPublishing(true);
    setStatus('Uploading image...');
    try {
      await createPost({ caption: nextCaption, media: selectedMedia });
      setCaption('');
      setSelectedMedia(null);
      setStatus('Published. Opening Home feed...');
      onPostCreated();
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'SESSION_EXPIRED') {
        setStatus('Session expired. Please log in again.');
        onSessionExpired();
        return;
      }
      setStatus(error instanceof Error ? error.message : 'Post could not be published.');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <ScrollView style={styles.panel} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Create</Text>
      <Pressable style={styles.mediaPicker} onPress={pickImage}>
        {selectedMedia ? (
          <Image
            source={{ uri: selectedMedia.uri }}
            style={styles.createPreview}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.emptyPreview}>
            <Text style={styles.emptyPreviewTitle}>Pick Image</Text>
            <Text style={styles.emptyPreviewText}>Choose a photo from your gallery.</Text>
          </View>
        )}
      </Pressable>
      {selectedMedia ? (
        <Pressable style={styles.removeMediaButton} onPress={() => setSelectedMedia(null)}>
          <Text style={styles.removeMediaText}>Remove image</Text>
        </Pressable>
      ) : null}
      <TextInput
        multiline
        value={caption}
        onChangeText={setCaption}
        placeholder="Write a caption..."
        placeholderTextColor="#94a3b8"
        style={[styles.input, styles.textarea]}
      />
      <Text style={styles.createHint}>
        Local gallery media is used now; Cloudinary upload comes next.
      </Text>
      <Text style={styles.status}>{status}</Text>
      <Pressable
        disabled={publishing || !caption.trim() || !selectedMedia}
        style={[
          styles.primary,
          (publishing || !caption.trim() || !selectedMedia) && styles.disabled,
        ]}
        onPress={publish}
      >
        <Text style={styles.primaryText}>{publishing ? 'Publishing...' : 'Publish Post'}</Text>
      </Pressable>
    </ScrollView>
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

function Chat({
  session,
  refreshKey,
  focusConversationId,
}: {
  session: AuthSession;
  refreshKey: number;
  focusConversationId?: string | null;
}) {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [status, setStatus] = useState('Loading chats...');
  const [socketStatus, setSocketStatus] = useState('Connecting...');
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);
  const activeConversationRef = useRef<Conversation | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const totalUnread = conversations.reduce((sum, item) => sum + (item.unreadCount ?? 0), 0);

  function appendMessage(message: Message) {
    seenMessageIdsRef.current.add(message.id);
    setMessages((current) => {
      if (current.some((item) => item.id === message.id)) {
        return current;
      }
      return [...current, message];
    });
  }

  function joinConversation(conversationId: string) {
    socketRef.current?.emit('conversation:join', { conversationId });
  }

  function emitTyping(isTyping: boolean) {
    const conversationId = activeConversationRef.current?.id;
    if (!conversationId || !socketRef.current?.connected) {
      return;
    }
    socketRef.current.emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId });
  }

  function scheduleConversationListRefresh() {
    if (listRefreshTimerRef.current) {
      clearTimeout(listRefreshTimerRef.current);
    }
    listRefreshTimerRef.current = setTimeout(() => {
      void refreshConversationList();
    }, 350);
  }

  async function refreshConversationList() {
    try {
      const list = await listConversations();
      setConversations(list);
      const current = activeConversationRef.current;
      if (current) {
        const updatedActive = list.find((item) => item.conversationId === current.id)?.conversation;
        if (updatedActive) {
          setActiveConversation(updatedActive);
          activeConversationRef.current = updatedActive;
        }
      }
    } catch {
      setStatus('Chat list refresh failed.');
    }
  }

  function setUnread(conversationId: string, unreadCount: number) {
    setConversations((current) =>
      current.map((item) =>
        item.conversationId === conversationId
          ? { ...item, unreadCount: Math.max(0, unreadCount) }
          : item,
      ),
    );
  }

  function markRead(conversationId: string) {
    setUnread(conversationId, 0);
    socketRef.current?.emit('conversation:read', { conversationId });
    markConversationRead(conversationId).catch(() => undefined);
  }

  function handleIncomingMessage(message: Message) {
    if (seenMessageIdsRef.current.has(message.id)) {
      return;
    }
    seenMessageIdsRef.current.add(message.id);

    const activeId = activeConversationRef.current?.id;
    const isActive = message.conversationId === activeId;
    const isMine = message.senderId === session.user.id;

    if (isActive) {
      setMessages((current) => [...current, message]);
      if (!isMine) {
        markRead(message.conversationId);
      }
    }

    setConversations((current) => {
      let found = false;
      const updated = current.map((item) => {
        if (item.conversationId !== message.conversationId) {
          return item;
        }
        found = true;
        return {
          ...item,
          unreadCount: isMine || isActive ? 0 : (item.unreadCount ?? 0) + 1,
          conversation: {
            ...item.conversation,
            lastMessageAt: message.createdAt,
            messages: [message],
          },
        };
      });

      if (!found) {
        scheduleConversationListRefresh();
      }

      return updated.sort((a, b) => {
        const bTime = b.conversation.lastMessageAt
          ? new Date(b.conversation.lastMessageAt).getTime()
          : 0;
        const aTime = a.conversation.lastMessageAt
          ? new Date(a.conversation.lastMessageAt).getTime()
          : 0;
        return bTime - aTime;
      });
    });

    setStatus(isActive ? 'New message' : 'New unread message');
  }

  async function loadChats() {
    try {
      const saved = await getOrCreateSavedConversation(session.user.id);
      const list = await listConversations();
      setConversations(list);
      const focused = focusConversationId
        ? list.find((item) => item.conversationId === focusConversationId)?.conversation
        : null;
      const preferred =
        focused ??
        list.find((item) => item.conversationId === activeConversationRef.current?.id)
          ?.conversation ??
        saved;
      setActiveConversation(preferred);
      activeConversationRef.current = preferred;
      joinConversation(preferred.id);
      const loadedMessages = await loadMessages(preferred.id);
      loadedMessages.forEach((message) => seenMessageIdsRef.current.add(message.id));
      setMessages(loadedMessages);
      markRead(preferred.id);
      setStatus(
        loadedMessages.length ? conversationTitle(preferred, session.user.id) : 'No messages yet.',
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load chats.');
    }
  }

  useEffect(() => {
    void loadChats();
  }, [refreshKey, focusConversationId]);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
    if (activeConversation) {
      joinConversation(activeConversation.id);
    }
  }, [activeConversation]);

  useEffect(() => {
    const connection = createSocket();
    socketRef.current = connection;

    connection.on('connect', () => {
      setSocketStatus('Live');
      const current = activeConversationRef.current;
      if (current) {
        connection.emit('conversation:join', { conversationId: current.id });
      }
    });

    connection.on('disconnect', () => {
      setSocketStatus('Reconnecting');
    });

    connection.on('message:new', (message: Message) => {
      handleIncomingMessage(message);
    });

    connection.on(
      'typing:update',
      (event: { conversationId: string; userId: string; isTyping: boolean }) => {
        if (
          event.userId === session.user.id ||
          event.conversationId !== activeConversationRef.current?.id
        ) {
          return;
        }

        setTypingUserIds((current) => {
          if (event.isTyping) {
            return current.includes(event.userId) ? current : [...current, event.userId];
          }
          return current.filter((userId) => userId !== event.userId);
        });
      },
    );

    connection.on('conversation:read', (event: { conversationId: string; userId: string }) => {
      if (event.userId === session.user.id) {
        setUnread(event.conversationId, 0);
      }
    });

    connection.on('connect_error', () => {
      setSocketStatus('REST fallback');
    });

    return () => {
      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
      }
      if (listRefreshTimerRef.current) {
        clearTimeout(listRefreshTimerRef.current);
      }
      connection.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    let canceled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      searchUsers(q)
        .then((results) => {
          if (!canceled) {
            setSearchResults(results.filter((user) => user.userId !== session.user.id));
          }
        })
        .catch((error) => {
          if (!canceled) {
            setStatus(error instanceof Error ? error.message : 'User search failed.');
          }
        })
        .finally(() => {
          if (!canceled) {
            setSearching(false);
          }
        });
    }, 250);

    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, session.user.id]);

  async function openConversation(conversation: Conversation) {
    setActiveConversation(conversation);
    activeConversationRef.current = conversation;
    setTypingUserIds([]);
    joinConversation(conversation.id);
    setStatus(`Loading ${conversationTitle(conversation, session.user.id)}...`);
    try {
      const loadedMessages = await loadMessages(conversation.id);
      loadedMessages.forEach((message) => seenMessageIdsRef.current.add(message.id));
      setMessages(loadedMessages);
      markRead(conversation.id);
      setStatus(conversationTitle(conversation, session.user.id));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load messages.');
    }
  }

  async function startDm(user: UserSearchResult) {
    setSearching(true);
    setStatus(`Opening @${user.username}...`);
    try {
      const conversation = await startDirectConversation(session.user.id, user);
      setSearchQuery('');
      setSearchResults([]);
      const list = await listConversations();
      setConversations(list);
      await openConversation(conversation);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not start DM.');
    } finally {
      setSearching(false);
    }
  }

  async function send() {
    const content = draft.trim();
    if (!content || !activeConversation) {
      return;
    }

    setSending(true);
    try {
      emitTyping(false);
      let message: Message;
      try {
        message = await sendRealtimeMessage(socketRef.current, {
          conversationId: activeConversation.id,
          content,
        });
      } catch {
        message = await sendMessage({ conversationId: activeConversation.id, content });
        setSocketStatus('REST fallback');
      }
      setDraft('');
      appendMessage(message);
      markRead(activeConversation.id);
      setStatus('Message sent');
      void loadChats();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }

    if (value.trim()) {
      emitTyping(true);
      typingStopTimerRef.current = setTimeout(() => emitTyping(false), 1600);
      return;
    }

    emitTyping(false);
  }

  const typingLabel = typingText(activeConversation, typingUserIds);

  return (
    <View style={styles.chatScreen}>
      <View style={styles.chatHeader}>
        <View>
          <Text style={styles.title}>Chat</Text>
          <Text style={styles.muted}>
            {status} | {socketStatus}
          </Text>
        </View>
        <Text style={[styles.chatCount, totalUnread > 0 && styles.chatCountUnread]}>
          {totalUnread > 0 ? totalUnread : conversations.length}
        </Text>
      </View>
      <View style={styles.dmSearch}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search people to DM"
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />
        {searching ? <Text style={styles.commentStatus}>Searching...</Text> : null}
        {searchResults.map((user) => (
          <Pressable key={user.id} style={styles.userResult} onPress={() => startDm(user)}>
            <View style={styles.smallAvatar}>
              <Text style={styles.smallAvatarText}>
                {user.displayName?.[0] ?? user.username[0]}
              </Text>
            </View>
            <View>
              <Text style={styles.name}>{user.displayName}</Text>
              <Text style={styles.muted}>@{user.username}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.conversationScroller}
        contentContainerStyle={styles.conversationList}
      >
        {conversations.map((item) => {
          const selected = item.conversationId === activeConversation?.id;
          return (
            <Pressable
              key={item.id}
              style={[styles.conversationChip, selected && styles.conversationChipActive]}
              onPress={() => openConversation(item.conversation)}
            >
              <View style={styles.conversationChipInner}>
                <Text
                  style={[
                    styles.conversationChipText,
                    selected && styles.conversationChipTextActive,
                  ]}
                >
                  {conversationTitle(item.conversation, session.user.id)}
                </Text>
                {item.unreadCount ? (
                  <Text style={styles.unreadBadge}>{item.unreadCount}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={<Text style={styles.emptyChat}>Shared posts and DMs appear here.</Text>}
        renderItem={({ item }) => {
          const mine = item.senderId === session.user.id;
          return (
            <View style={[styles.messageBubble, mine && styles.messageBubbleMine]}>
              <Text style={[styles.messageText, mine && styles.messageTextMine]}>
                {item.content}
              </Text>
              <Text style={[styles.messageMeta, mine && styles.messageMetaMine]}>
                {item.sender?.profile?.username ?? (mine ? 'you' : 'member')}
              </Text>
            </View>
          );
        }}
      />
      {typingLabel ? <Text style={styles.typingText}>{typingLabel}</Text> : null}
      <View style={styles.chatComposer}>
        <TextInput
          value={draft}
          onChangeText={handleDraftChange}
          placeholder={`Message ${activeConversation ? conversationTitle(activeConversation, session.user.id) : 'chat'}`}
          placeholderTextColor="#94a3b8"
          style={styles.chatInput}
        />
        <Pressable
          disabled={sending || !draft.trim()}
          style={[styles.sendButton, (sending || !draft.trim()) && styles.disabled]}
          onPress={send}
        >
          <Text style={styles.sendText}>{sending ? '...' : 'Send'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function conversationTitle(conversation: Conversation, currentUserId: string) {
  if (conversation.title) {
    return conversation.title;
  }
  const otherMember = conversation.members?.find((member) => member.userId !== currentUserId);
  const profile = otherMember?.user?.profile;
  return (
    profile?.displayName ??
    profile?.username ??
    (conversation.isGroup ? 'Group Chat' : 'Direct Message')
  );
}

function typingText(conversation: Conversation | null, typingUserIds: string[]) {
  if (!conversation || typingUserIds.length === 0) {
    return '';
  }

  const names = typingUserIds
    .map((userId) => {
      const profile = conversation.members?.find((member) => member.userId === userId)?.user
        ?.profile;
      return profile?.displayName ?? profile?.username;
    })
    .filter(Boolean);

  if (names.length === 0) {
    return 'Someone is typing...';
  }
  if (names.length === 1) {
    return `${names[0]} is typing...`;
  }
  return `${names.slice(0, 2).join(', ')} are typing...`;
}

function NotificationsCenter({
  refreshKey,
  unreadCount,
  onOpenChat,
  onNotificationsRead,
}: {
  refreshKey: number;
  unreadCount: number;
  onOpenChat(conversationId: string): void;
  onNotificationsRead(unreadCount: number): void;
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [status, setStatus] = useState('Loading notifications...');
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  async function loadAlerts() {
    setRefreshing(true);
    try {
      const result = await listNotifications();
      setNotifications(result.notifications);
      onNotificationsRead(result.unreadCount);
      setStatus(result.notifications.length ? 'Notifications loaded' : 'No notifications yet.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load notifications.');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadAlerts();
  }, [refreshKey]);

  async function openNotification(notification: AppNotification) {
    const wasUnread = !notification.readAt;
    if (wasUnread) {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
      onNotificationsRead(Math.max(0, unreadCount - 1));
      markNotificationRead(notification.id).catch(() => undefined);
    }

    if (
      notification.kind === 'DM' &&
      notification.entityType === 'CONVERSATION' &&
      notification.entityId
    ) {
      onOpenChat(notification.entityId);
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? new Date().toISOString(),
        })),
      );
      onNotificationsRead(0);
      setStatus('All notifications marked read');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not mark notifications read.');
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <View style={styles.notificationsScreen}>
      <View style={styles.notificationsHeader}>
        <View>
          <Text style={styles.title}>Alerts</Text>
          <Text style={styles.muted}>{unreadCount > 0 ? `${unreadCount} unread` : status}</Text>
        </View>
        <Pressable
          disabled={markingAll || unreadCount === 0}
          style={[styles.markAllButton, (markingAll || unreadCount === 0) && styles.disabled]}
          onPress={markAllRead}
        >
          <Text style={styles.markAllText}>{markingAll ? '...' : 'Read all'}</Text>
        </Pressable>
      </View>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAlerts} />}
        contentContainerStyle={styles.notificationsList}
        ListEmptyComponent={
          <Text style={styles.emptyFeed}>
            Likes, comments, follows, mentions, and DMs will appear here.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.notificationCard, !item.readAt && styles.notificationCardUnread]}
            onPress={() => openNotification(item)}
          >
            <View style={styles.notificationIcon}>
              <Text style={styles.notificationIconText}>{notificationInitial(item.kind)}</Text>
            </View>
            <View style={styles.notificationBody}>
              <Text style={styles.notificationTitle}>{item.title}</Text>
              <Text style={styles.notificationText}>
                {item.actor?.profile?.username ? `@${item.actor.profile.username}: ` : ''}
                {item.body ?? notificationLabel(item.kind)}
              </Text>
              <Text style={styles.notificationTime}>{formatNotificationTime(item.createdAt)}</Text>
            </View>
            {!item.readAt ? <View style={styles.unreadDot} /> : null}
          </Pressable>
        )}
      />
    </View>
  );
}

function notificationInitial(kind: AppNotification['kind']) {
  const map: Record<AppNotification['kind'], string> = {
    LIKE: 'L',
    COMMENT: 'C',
    FOLLOW: 'F',
    FOLLOW_REQUEST: 'R',
    MENTION: '@',
    DM: 'D',
    LIVE: 'V',
    SECURITY: 'S',
    SYSTEM: 'K',
  };
  return map[kind];
}

function notificationLabel(kind: AppNotification['kind']) {
  return kind.replace('_', ' ').toLowerCase();
}

function formatNotificationTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) {
    return 'now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return `${Math.floor(diffHours / 24)}d ago`;
}

function ProfileViewer({
  username,
  session,
  onBack,
  onOpenChat,
  onSocialGraphChanged,
}: {
  username: string;
  session: AuthSession;
  onBack(): void;
  onOpenChat(conversationId: string): void;
  onSocialGraphChanged(): void;
}) {
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [followState, setFollowState] = useState<FollowState>('idle');
  const [status, setStatus] = useState('Loading profile...');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [safetyBusy, setSafetyBusy] = useState<'report' | 'mute' | 'block' | null>(null);

  async function loadProfile() {
    setLoading(true);
    try {
      const loaded = await getProfileByUsername(username);
      setProfile(loaded);
      const isSelf = loaded.userId === session.user.id;
      if (!isSelf) {
        const followingIds = await listFollowingUserIds(session.user.id);
        setFollowState(followingIds.has(loaded.userId) ? 'following' : 'idle');
      } else {
        setFollowState('idle');
      }
      setStatus('Profile loaded');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Profile could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, [username, session.user.id]);

  async function toggleProfileFollow() {
    if (!profile || profile.userId === session.user.id) {
      return;
    }

    setBusy(true);
    try {
      if (followState === 'following' || followState === 'requested') {
        await unfollowUser(profile.userId);
        setFollowState('idle');
        setProfile((current) =>
          current
            ? {
                ...current,
                followersCount:
                  followState === 'following'
                    ? Math.max(0, (current.followersCount ?? 0) - 1)
                    : current.followersCount,
              }
            : current,
        );
        setStatus(`Unfollowed @${profile.username}`);
      } else {
        const nextState = await followUser(profile.userId);
        setFollowState(nextState);
        setProfile((current) =>
          current
            ? {
                ...current,
                followersCount:
                  nextState === 'following'
                    ? (current.followersCount ?? 0) + 1
                    : current.followersCount,
              }
            : current,
        );
        setStatus(
          nextState === 'requested'
            ? `Requested @${profile.username}`
            : `Following @${profile.username}`,
        );
      }
      onSocialGraphChanged();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Follow action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function messageProfile() {
    if (!profile || profile.userId === session.user.id) {
      return;
    }

    setBusy(true);
    setStatus(`Opening DM with @${profile.username}...`);
    try {
      const conversation = await startDirectConversation(session.user.id, {
        id: profile.id,
        userId: profile.userId,
        username: profile.username,
        displayName: profile.displayName,
        profilePictureUrl: profile.profilePictureUrl,
        verified: profile.verified,
      });
      onOpenChat(conversation.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not open DM.');
    } finally {
      setBusy(false);
    }
  }

  async function reportProfile() {
    if (!profile || profile.userId === session.user.id) {
      return;
    }

    setSafetyBusy('report');
    setStatus(`Reporting @${profile.username}...`);
    try {
      await reportTarget({
        targetType: 'USER',
        targetId: profile.userId,
        reason: 'User safety report',
        description: `Reported profile @${profile.username}`,
      });
      setStatus(`Report sent for @${profile.username}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Report failed.');
    } finally {
      setSafetyBusy(null);
    }
  }

  async function muteProfile() {
    if (!profile || profile.userId === session.user.id) {
      return;
    }

    setSafetyBusy('mute');
    setStatus(`Muting @${profile.username}...`);
    try {
      await muteUser(profile.userId, 'ALL');
      setStatus(`Muted @${profile.username}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Mute failed.');
    } finally {
      setSafetyBusy(null);
    }
  }

  async function blockProfile() {
    if (!profile || profile.userId === session.user.id) {
      return;
    }

    setSafetyBusy('block');
    setStatus(`Blocking @${profile.username}...`);
    try {
      await blockUser(profile.userId);
      setFollowState('idle');
      setProfile((current) =>
        current && followState === 'following'
          ? { ...current, followersCount: Math.max(0, (current.followersCount ?? 0) - 1) }
          : current,
      );
      setStatus(`Blocked @${profile.username}`);
      onSocialGraphChanged();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Block failed.');
    } finally {
      setSafetyBusy(null);
    }
  }

  const isSelf = profile?.userId === session.user.id;
  const posts = profile?.user?.posts ?? [];

  return (
    <ScrollView style={styles.profileView} keyboardShouldPersistTaps="handled">
      <View style={styles.profileViewTopBar}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.profileViewStatus}>{loading ? 'Loading...' : status}</Text>
      </View>

      <View style={styles.cover}>
        {profile?.coverPhotoUrl ? (
          <Image source={{ uri: profile.coverPhotoUrl }} style={styles.coverImage} />
        ) : null}
      </View>
      <View style={styles.profileAvatar}>
        {profile?.profilePictureUrl ? (
          <Image source={{ uri: profile.profilePictureUrl }} style={styles.profileAvatarImage} />
        ) : (
          <Text style={styles.profileAvatarText}>
            {(profile?.username ?? username)[0]?.toUpperCase() ?? 'K'}
          </Text>
        )}
      </View>

      <View style={styles.profileViewBody}>
        <Text style={styles.title}>
          {profile?.displayName ?? username}
          {profile?.verified ? ' verified' : ''}
        </Text>
        <Text style={styles.muted}>@{profile?.username ?? username}</Text>
        <Text style={styles.bio}>
          {profile?.bio ?? 'KrazyVerse creator profile.'}
          {profile?.accountType === 'PRIVATE' ? ' Private account.' : ''}
        </Text>

        <View style={styles.stats}>
          <Stat label="Followers" value={String(profile?.followersCount ?? 0)} />
          <Stat label="Following" value={String(profile?.followingCount ?? 0)} />
          <Stat label="Posts" value={String(posts.length)} />
        </View>

        {!isSelf && profile ? (
          <View style={styles.profileActions}>
            <Pressable
              disabled={busy}
              style={[
                styles.profileActionButton,
                followState !== 'idle' && styles.profileActionButtonLight,
                busy && styles.disabled,
              ]}
              onPress={toggleProfileFollow}
            >
              <Text
                style={[
                  styles.profileActionText,
                  followState !== 'idle' && styles.profileActionTextDark,
                ]}
              >
                {busy
                  ? '...'
                  : followState === 'following'
                    ? 'Following'
                    : followState === 'requested'
                      ? 'Requested'
                      : 'Follow'}
              </Text>
            </Pressable>
            <Pressable
              disabled={busy}
              style={[
                styles.profileActionButton,
                styles.profileActionButtonLight,
                busy && styles.disabled,
              ]}
              onPress={messageProfile}
            >
              <Text style={styles.profileActionTextDark}>Message</Text>
            </Pressable>
          </View>
        ) : null}

        {!isSelf && profile ? (
          <View style={styles.safetyPanel}>
            <Text style={styles.safetyLabel}>Safety tools</Text>
            <View style={styles.safetyActionRow}>
              <Pressable
                disabled={safetyBusy !== null}
                style={[styles.safetyButton, safetyBusy !== null && styles.disabled]}
                onPress={reportProfile}
              >
                <Text style={styles.safetyButtonText}>
                  {safetyBusy === 'report' ? 'Reporting...' : 'Report'}
                </Text>
              </Pressable>
              <Pressable
                disabled={safetyBusy !== null}
                style={[styles.safetyButton, safetyBusy !== null && styles.disabled]}
                onPress={muteProfile}
              >
                <Text style={styles.safetyButtonText}>
                  {safetyBusy === 'mute' ? 'Muting...' : 'Mute'}
                </Text>
              </Pressable>
              <Pressable
                disabled={safetyBusy !== null}
                style={[
                  styles.safetyButton,
                  styles.safetyButtonDanger,
                  safetyBusy !== null && styles.disabled,
                ]}
                onPress={blockProfile}
              >
                <Text style={[styles.safetyButtonText, styles.safetyButtonTextDanger]}>
                  {safetyBusy === 'block' ? 'Blocking...' : 'Block'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Posts</Text>
        {posts.length ? (
          <View style={styles.profileGrid}>
            {posts.map((post) => (
              <ProfilePostTile key={post.id} post={post} />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyFeed}>No public posts yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function ProfilePostTile({ post }: { post: FeedPostType }) {
  const media = post.media?.[0];
  return (
    <View style={styles.profilePostTile}>
      {media?.type === 'IMAGE' ? (
        <Image source={{ uri: media.url }} style={styles.profilePostImage} resizeMode="cover" />
      ) : (
        <Text style={styles.profilePostFallback}>Post</Text>
      )}
    </View>
  );
}

function Profile({ session, onLoggedOut }: { session: AuthSession; onLoggedOut(): void }) {
  const [profile, setProfile] = useState<any>(session.user.profile);
  const [status, setStatus] = useState('Loading profile...');
  const [loggingOut, setLoggingOut] = useState(false);
  const [savingSetting, setSavingSetting] = useState(false);

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

  async function updateAccountType(accountType: 'PUBLIC' | 'PRIVATE') {
    setSavingSetting(true);
    setStatus('Saving privacy...');
    try {
      const updated = await updateProfileSettings({ accountType });
      setProfile(updated);
      setStatus(accountType === 'PRIVATE' ? 'Profile set to private' : 'Profile set to public');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Privacy update failed.');
    } finally {
      setSavingSetting(false);
    }
  }

  async function updateTheme(theme: AppThemeName) {
    setSavingSetting(true);
    setStatus('Saving theme...');
    try {
      const updated = await updateProfileSettings({ customTheme: { name: theme } });
      setProfile(updated);
      setStatus(`${themeOptions.find((option) => option.name === theme)?.label ?? 'Theme'} saved`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Theme update failed.');
    } finally {
      setSavingSetting(false);
    }
  }

  const displayName =
    profile?.displayName ?? session.user.profile?.displayName ?? 'KrazyVerse Creator';
  const username = profile?.username ?? session.user.profile?.username ?? 'krazyverse';
  const accountType = profile?.accountType === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC';
  const activeTheme = getThemeName(profile);

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
      <View style={styles.settingsSection}>
        <Text style={styles.settingsTitle}>Privacy</Text>
        <View style={styles.settingsRow}>
          {(['PUBLIC', 'PRIVATE'] as const).map((type) => (
            <Pressable
              key={type}
              disabled={savingSetting || accountType === type}
              style={[
                styles.settingChip,
                accountType === type && styles.settingChipActive,
                savingSetting && styles.disabled,
              ]}
              onPress={() => updateAccountType(type)}
            >
              <Text
                style={[
                  styles.settingChipText,
                  accountType === type && styles.settingChipTextActive,
                ]}
              >
                {type === 'PUBLIC' ? 'Public' : 'Private'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.settingsTitle}>Theme</Text>
        <View style={styles.settingsRow}>
          {themeOptions.map((theme) => (
            <Pressable
              key={theme.name}
              disabled={savingSetting || activeTheme === theme.name}
              style={[
                styles.settingChip,
                activeTheme === theme.name && styles.settingChipActive,
                savingSetting && styles.disabled,
              ]}
              onPress={() => updateTheme(theme.name)}
            >
              <View style={[styles.themeSwatch, { backgroundColor: theme.color }]} />
              <Text
                style={[
                  styles.settingChipText,
                  activeTheme === theme.name && styles.settingChipTextActive,
                ]}
              >
                {theme.label}
              </Text>
            </Pressable>
          ))}
        </View>
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
  pillUnread: { backgroundColor: '#fee2e2', color: '#be123c' },
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
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
    textAlignVertical: 'center',
    overflow: 'hidden',
    marginTop: 2,
    paddingHorizontal: 4,
  },
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
  feedModeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 8,
    backgroundColor: '#fff',
  },
  feedModeButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedModeButtonActive: { backgroundColor: '#111827' },
  feedModeText: { color: '#475569', fontWeight: '900' },
  feedModeTextActive: { color: '#fff' },
  emptyFeed: {
    color: '#64748b',
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 26,
    paddingTop: 36,
  },
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
  mediaImage: { width: '100%', aspectRatio: 1, backgroundColor: '#e5e7eb' },
  mediaText: { color: '#fff', fontSize: 32, fontWeight: '900' },
  caption: { padding: 14, color: '#111827', lineHeight: 21 },
  metrics: { paddingHorizontal: 14, paddingBottom: 14, color: '#64748b', fontWeight: '800' },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  actionButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonActive: { backgroundColor: '#fee2e2' },
  actionText: { color: '#334155', fontWeight: '900' },
  actionTextActive: { color: '#be123c' },
  postSafetyRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  safetyButton: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  safetyButtonDanger: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  safetyButtonText: { color: '#c2410c', fontSize: 12, fontWeight: '900' },
  safetyButtonTextDanger: { color: '#991b1b' },
  safetyStatus: { color: '#64748b', flex: 1, fontSize: 12, fontWeight: '800' },
  shareButton: {
    height: 40,
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareText: { color: '#4338ca', fontWeight: '900' },
  commentsPanel: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  commentComposer: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
  },
  commentInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    color: '#111827',
  },
  commentSend: {
    width: 62,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentSendText: { color: '#fff', fontWeight: '900' },
  commentStatus: { color: '#64748b', fontWeight: '800', marginTop: 8 },
  commentItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  commentAuthor: { color: '#111827', fontWeight: '900', lineHeight: 20 },
  commentText: { color: '#334155', fontWeight: '500' },
  replyItem: { marginLeft: 16, marginTop: 4 },
  panel: { flex: 1, backgroundColor: '#fff', padding: 16 },
  searchHeader: { marginBottom: 12 },
  input: {
    minHeight: 46,
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#111827',
  },
  textarea: { minHeight: 120, paddingTop: 12, textAlignVertical: 'top' },
  createHint: { color: '#64748b', marginTop: 10, lineHeight: 20 },
  mediaPicker: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  createPreview: { width: '100%', height: '100%' },
  emptyPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyPreviewTitle: { color: '#111827', fontWeight: '900', fontSize: 20 },
  emptyPreviewText: { color: '#64748b', marginTop: 6, textAlign: 'center' },
  removeMediaButton: {
    height: 40,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  removeMediaText: { color: '#991b1b', fontWeight: '900' },
  row: {
    paddingVertical: 16,
    borderBottomColor: '#f3f4f6',
    borderBottomWidth: 1,
    color: '#111827',
    fontWeight: '800',
  },
  searchTips: { marginTop: 10 },
  searchUserCard: {
    minHeight: 76,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 12,
  },
  searchUserMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  userMeta: { flex: 1 },
  searchUserStats: { color: '#64748b', fontSize: 12, marginTop: 3, fontWeight: '800' },
  followButton: {
    minWidth: 96,
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  followButtonActive: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  followButtonText: { color: '#fff', fontWeight: '900' },
  followButtonTextActive: { color: '#334155' },
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
  disabled: { opacity: 0.65 },
  reel: { flex: 1, backgroundColor: '#111827', justifyContent: 'flex-end', padding: 20 },
  reelTitle: { color: '#fff', fontSize: 32, fontWeight: '900', marginBottom: 10 },
  reelCopy: { color: '#e5e7eb', lineHeight: 22 },
  profileView: { flex: 1, backgroundColor: '#fff' },
  profileViewTopBar: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  backButton: {
    minWidth: 64,
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  backButtonText: { color: '#111827', fontWeight: '900' },
  profileViewStatus: { color: '#64748b', fontSize: 12, fontWeight: '800', flexShrink: 1 },
  profileViewBody: { padding: 16 },
  cover: { height: 120, backgroundColor: '#0f766e', borderRadius: 8, overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
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
  profileAvatarImage: { width: '100%', height: '100%', borderRadius: 44 },
  profileAvatarText: { color: '#fff', fontSize: 34, fontWeight: '900' },
  bio: { color: '#374151', lineHeight: 21, marginTop: 10 },
  stats: { flexDirection: 'row', marginTop: 8, borderTopColor: '#e5e7eb', borderTopWidth: 1 },
  stat: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  statValue: { color: '#111827', fontWeight: '900', fontSize: 18 },
  profileActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  profileActionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileActionButtonLight: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  profileActionText: { color: '#fff', fontWeight: '900' },
  profileActionTextDark: { color: '#334155', fontWeight: '900' },
  safetyPanel: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
    padding: 10,
  },
  safetyLabel: { color: '#9a3412', fontSize: 12, fontWeight: '900', marginBottom: 8 },
  safetyActionRow: { flexDirection: 'row', gap: 8 },
  sectionTitle: { color: '#111827', fontSize: 18, fontWeight: '900', marginTop: 18 },
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 10,
    paddingBottom: 24,
  },
  profilePostTile: {
    width: '32.5%',
    aspectRatio: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePostImage: { width: '100%', height: '100%' },
  profilePostFallback: { color: '#64748b', fontWeight: '900' },
  settingsSection: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 14,
  },
  settingsTitle: { color: '#111827', fontWeight: '900', marginBottom: 8 },
  settingsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  settingChip: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
  },
  settingChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  settingChipText: { color: '#334155', fontWeight: '900' },
  settingChipTextActive: { color: '#fff' },
  themeSwatch: { width: 12, height: 12, borderRadius: 6 },
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
  chatScreen: { flex: 1, backgroundColor: '#fff' },
  chatHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatCount: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    color: '#111827',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '900',
  },
  chatCountUnread: { backgroundColor: '#fee2e2', color: '#be123c' },
  dmSearch: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  userResult: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  smallAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAvatarText: { color: '#fff', fontWeight: '900' },
  conversationScroller: {
    maxHeight: 54,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  conversationList: { gap: 8, paddingHorizontal: 12, paddingVertical: 9 },
  conversationChip: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversationChipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  conversationChipActive: { backgroundColor: '#7c3aed' },
  conversationChipText: { color: '#334155', fontWeight: '900' },
  conversationChipTextActive: { color: '#fff' },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    color: '#fff',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 5,
  },
  messageList: { padding: 14, gap: 10 },
  emptyChat: { color: '#64748b', textAlign: 'center', marginTop: 40, fontWeight: '800' },
  messageBubble: {
    maxWidth: '86%',
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    padding: 10,
    alignSelf: 'flex-start',
  },
  messageBubbleMine: { backgroundColor: '#7c3aed', alignSelf: 'flex-end' },
  messageText: { color: '#111827', lineHeight: 20 },
  messageTextMine: { color: '#fff' },
  messageMeta: { color: '#64748b', marginTop: 5, fontSize: 11, fontWeight: '800' },
  messageMetaMine: { color: '#ede9fe' },
  typingText: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  chatComposer: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 10,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#fff',
  },
  chatInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    color: '#111827',
  },
  sendButton: {
    width: 68,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontWeight: '900' },
  notificationsScreen: { flex: 1, backgroundColor: '#fff' },
  notificationsHeader: {
    minHeight: 74,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  markAllButton: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  markAllText: { color: '#fff', fontWeight: '900' },
  notificationsList: { padding: 12, gap: 10 },
  notificationCard: {
    minHeight: 78,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  notificationCardUnread: { backgroundColor: '#f8fafc', borderColor: '#c7d2fe' },
  notificationIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationIconText: { color: '#fff', fontWeight: '900' },
  notificationBody: { flex: 1 },
  notificationTitle: { color: '#111827', fontWeight: '900' },
  notificationText: { color: '#475569', marginTop: 3, lineHeight: 18 },
  notificationTime: { color: '#94a3b8', fontSize: 12, marginTop: 4, fontWeight: '800' },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#ef4444' },
});
