import { useEffect, useState } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { likeHaptic } from '../lib/native';

const height = Dimensions.get('window').height - 92;

export function ReelsScreen() {
  const [reels, setReels] = useState<any[]>([]);

  useEffect(() => {
    api<any[]>('/reels').then(setReels).catch(() => setReels(demoReels));
  }, []);

  return (
    <FlatList
      data={reels.length ? reels : demoReels}
      pagingEnabled
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.reel}>
          <Text style={styles.brand}>KrazyVerse Reels</Text>
          <View style={styles.caption}>
            <Text style={styles.creator}>@{item.author?.profile?.username ?? 'creator'}</Text>
            <Text style={styles.text}>{item.caption ?? 'AI captions, audio remix, duet, subtitles, and watch history are wired in the API.'}</Text>
          </View>
          <View style={styles.rail}>
            <Pressable onPress={likeHaptic} style={styles.action}>
              <Ionicons name="heart" size={28} color="#fff" />
            </Pressable>
            <Ionicons name="chatbubble" size={28} color="#fff" />
            <Ionicons name="paper-plane" size={28} color="#fff" />
            <Ionicons name="bookmark" size={28} color="#fff" />
          </View>
        </View>
      )}
    />
  );
}

const demoReels = [{ id: 'demo-reel' }];

const styles = StyleSheet.create({
  reel: { height, backgroundColor: '#111827', justifyContent: 'flex-end', padding: 18 },
  brand: { position: 'absolute', top: 18, left: 18, color: '#fff', fontSize: 20, fontWeight: '900' },
  caption: { width: '78%', gap: 6, marginBottom: 24 },
  creator: { color: '#fff', fontWeight: '900' },
  text: { color: '#e5e7eb', lineHeight: 20 },
  rail: { position: 'absolute', right: 14, bottom: 74, alignItems: 'center', gap: 22 },
  action: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
