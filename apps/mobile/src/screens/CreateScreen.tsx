import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { pickMedia } from '../lib/native';

export function CreateScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);

  async function chooseMedia() {
    const result = await pickMedia();
    if (!result.canceled) {
      setMediaUri(result.assets[0]?.uri ?? null);
    }
  }

  async function publish() {
    if (!mediaUri) {
      return;
    }
    await api('/posts', {
      method: 'POST',
      body: JSON.stringify({
        caption,
        media: [{ type: 'IMAGE', url: mediaUri, altText: caption }],
        hashtags: caption.match(/#[\w]+/g)?.map((tag) => tag.slice(1)) ?? [],
      }),
    }).catch(() => null);
    setCaption('');
  }

  if (cameraOpen) {
    if (!permission?.granted) {
      return (
        <View style={styles.center}>
          <Pressable style={styles.primary} onPress={requestPermission}>
            <Ionicons name="camera" size={20} color="#fff" />
            <Text style={styles.primaryText}>Allow Camera</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.cameraWrap}>
        <CameraView style={styles.camera} mode="picture" />
        <Pressable style={styles.closeCamera} onPress={() => setCameraOpen(false)}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <Pressable style={styles.tool} onPress={chooseMedia}>
          <Ionicons name="images-outline" size={22} color="#111827" />
        </Pressable>
        <Pressable style={styles.tool} onPress={() => setCameraOpen(true)}>
          <Ionicons name="camera-outline" size={22} color="#111827" />
        </Pressable>
        <Pressable style={styles.tool}>
          <Ionicons name="musical-notes-outline" size={22} color="#111827" />
        </Pressable>
        <Pressable style={styles.tool}>
          <Ionicons name="sparkles-outline" size={22} color="#111827" />
        </Pressable>
      </View>
      <View style={styles.preview}>{mediaUri ? <Image source={{ uri: mediaUri }} style={styles.image} /> : <Text style={styles.previewText}>Create a post, story, or reel</Text>}</View>
      <TextInput value={caption} onChangeText={setCaption} placeholder="Write a caption..." multiline style={styles.caption} maxLength={2200} />
      <Pressable style={styles.primary} onPress={publish}>
        <Ionicons name="send" size={20} color="#fff" />
        <Text style={styles.primaryText}>Publish</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff', padding: 14, gap: 14 },
  toolbar: { height: 48, flexDirection: 'row', gap: 10 },
  tool: { width: 46, height: 46, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  previewText: { color: '#6b7280', fontWeight: '700' },
  caption: { minHeight: 120, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, textAlignVertical: 'top' },
  primary: { height: 48, borderRadius: 8, backgroundColor: '#7c3aed', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  cameraWrap: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  closeCamera: { position: 'absolute', top: 60, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,.35)', alignItems: 'center', justifyContent: 'center' },
});
