import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';

export async function likeHaptic() {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export async function requestPushToken() {
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    return null;
  }
  return Notifications.getExpoPushTokenAsync();
}

export async function biometricUnlock() {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    return false;
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock KrazyVerse',
    fallbackLabel: 'Use password',
  });
  return result.success;
}

export async function pickMedia() {
  await ImagePicker.requestMediaLibraryPermissionsAsync();
  return ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    quality: 0.9,
    videoMaxDuration: 60,
  });
}
