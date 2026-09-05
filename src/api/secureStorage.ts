import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store has NO web implementation (its web build is an empty
// module) - every call throws on `expo start --web`. The native app never
// hits this path, but the web target IS a real, declared entrypoint
// (package.json's "web" script) and is also how this app gets previewed
// in a browser during development, so give it a working fallback rather
// than let every auth call silently fail. localStorage isn't as secure as
// the OS keychain, but it's the same trade-off every other Expo app makes
// for its web build - never used on iOS/Android, where SecureStore runs.
const isWeb = Platform.OS === 'web';

export async function getItemAsync(key: string): Promise<string | null> {
  if (isWeb) return window.localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (isWeb) { window.localStorage.setItem(key, value); return; }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (isWeb) { window.localStorage.removeItem(key); return; }
  await SecureStore.deleteItemAsync(key);
}
