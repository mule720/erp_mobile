import 'react-native-gesture-handler';
import React, { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/store/AuthContext';
import { RoleProvider } from './src/store/RoleContext';
import AppNavigator from './src/navigation/AppNavigator';
import { COLORS } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  // Plus Jakarta Sans - the same display face erp_frontend uses - loaded
  // once here so every screen can reference it by name via src/theme.ts's
  // FONT tokens. Held behind the splash screen rather than flashing the
  // system font first and swapping mid-render.
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const onLayout = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  useEffect(() => { onLayout(); }, [onLayout]);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: COLORS.navy }} />;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RoleProvider>
          <AppNavigator />
          <StatusBar style="light" />
        </RoleProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
