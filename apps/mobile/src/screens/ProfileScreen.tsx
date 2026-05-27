import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { biometricUnlock, requestPushToken } from '../lib/native';

export function ProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [biometric, setBiometric] = useState(false);

  useEffect(() => {
    api('/profiles/me').then(setProfile).catch(() => null);
    void requestPushToken();
  }, []);

  async function unlock() {
    setBiometric(await biometricUnlock());
  }

  const data = profile ?? {
    username: 'krazyverse',
    displayName: 'KrazyVerse Creator',
    bio: 'Build, post, remix, message, and monetize.',
    followersCount: 0,
    followingCount: 0,
    xp: 120,
    level: 2,
  };

  return (
    <ScrollView style={styles.screen}>
      <View style={styles.cover} />
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{data.username[0].toUpperCase()}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{data.displayName}</Text>
        <Text style={styles.handle}>@{data.username}</Text>
        <Text style={styles.bio}>{data.bio}</Text>
        <View style={styles.stats}>
          <Stat label="Followers" value={data.followersCount} />
          <Stat label="Following" value={data.followingCount} />
          <Stat label="Level" value={data.level} />
          <Stat label="XP" value={data.xp} />
        </View>
        <View style={styles.actions}>
          <Pressable style={styles.button}>
            <Ionicons name="create-outline" size={19} color="#111827" />
            <Text style={styles.buttonText}>Edit</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={unlock}>
            <Ionicons name="finger-print" size={19} color="#111827" />
            <Text style={styles.buttonText}>{biometric ? 'Unlocked' : 'Biometric'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  cover: { height: 140, backgroundColor: '#0f766e' },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#7c3aed', marginTop: -46, marginLeft: 18, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 34 },
  body: { padding: 18, gap: 8 },
  name: { fontSize: 24, fontWeight: '900', color: '#111827' },
  handle: { color: '#6b7280' },
  bio: { color: '#374151', lineHeight: 21 },
  stats: { flexDirection: 'row', marginTop: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e5e7eb' },
  stat: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  statValue: { fontWeight: '900', color: '#111827' },
  statLabel: { color: '#6b7280', fontSize: 12, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  button: { height: 42, borderRadius: 8, backgroundColor: '#f3f4f6', flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', flex: 1 },
  buttonText: { fontWeight: '800', color: '#111827' },
});
