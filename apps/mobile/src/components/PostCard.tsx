import { memo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { likeHaptic } from '../lib/native';

type Post = {
  id: string;
  caption?: string;
  author?: { profile?: { username: string; displayName: string; profilePictureUrl?: string } };
  media?: { url: string; type: string }[];
  _count?: { likes: number; comments: number };
};

export const PostCard = memo(function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(false);
  const media = post.media?.[0];

  async function onLike() {
    setLiked((value) => !value);
    await likeHaptic();
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{post.author?.profile?.username?.[0]?.toUpperCase() ?? 'K'}</Text>
        </View>
        <View>
          <Text style={styles.name}>{post.author?.profile?.displayName ?? 'KrazyVerse Creator'}</Text>
          <Text style={styles.handle}>@{post.author?.profile?.username ?? 'krazyverse'}</Text>
        </View>
      </View>
      <Pressable onPress={onLike}>
        {media ? (
          <Image source={{ uri: media.url }} style={styles.media} />
        ) : (
          <View style={[styles.media, styles.emptyMedia]}>
            <Text style={styles.emptyText}>KrazyVerse</Text>
          </View>
        )}
      </Pressable>
      <View style={styles.actions}>
        <Pressable onPress={onLike} style={styles.iconButton}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={25} color={liked ? '#e11d48' : '#111827'} />
        </Pressable>
        <Ionicons name="chatbubble-outline" size={23} color="#111827" />
        <Ionicons name="paper-plane-outline" size={23} color="#111827" />
        <View style={styles.spacer} />
        <Ionicons name="bookmark-outline" size={23} color="#111827" />
      </View>
      <Text style={styles.caption}>
        <Text style={styles.name}>@{post.author?.profile?.username ?? 'creator'} </Text>
        {post.caption ?? 'Welcome to the KrazyVerse feed.'}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  header: { height: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },
  name: { fontWeight: '800', color: '#111827' },
  handle: { color: '#6b7280', fontSize: 12 },
  media: { width: '100%', aspectRatio: 1, backgroundColor: '#f3f4f6' },
  emptyMedia: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 28, fontWeight: '900', color: '#7c3aed' },
  actions: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 14 },
  iconButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  spacer: { flex: 1 },
  caption: { color: '#111827', paddingHorizontal: 14, paddingBottom: 14, lineHeight: 20 },
});
