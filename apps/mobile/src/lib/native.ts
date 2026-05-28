import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';

export async function likeHaptic() {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export async function requestPushToken() {
  try {
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      return null;
    }
    return await Notifications.getExpoPushTokenAsync();
  } catch {
    return null;
  }
}

export async function biometricUnlock() {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return false;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock KrazyVerse',
      fallbackLabel: 'Use password',
    });
    return result.success;
  } catch {
    return false;
  }
}

export async function pickMedia() {
  try {
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    return await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.9,
      videoMaxDuration: 60,
    });
  } catch {
    return { canceled: true, assets: null };
  }
}
