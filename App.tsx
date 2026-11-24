import 'react-native-gesture-handler';
import React, { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/store/AuthContext';
import { RoleProvider } from './src/store/RoleContext';
import { ThemeProvider, useThemeMode } from './src/store/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { COLORS } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function ThemedStatusBar() {
  const { dark } = useThemeMode();
  return <StatusBar style={dark ? 'light' : 'dark'} />;
}

export default function App() {
  // Inter - the same face erp_frontend uses - loaded
  // once here so every screen can reference it by name via src/theme.ts's
  // FONT tokens. Held behind the splash screen rather than flashing the
  // system font first and swapping mid-render.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  const onLayout = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  useEffect(() => { onLayout(); }, [onLayout]);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: COLORS.navy }} />;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RoleProvider>
            <AppNavigator />
            <ThemedStatusBar />
          </RoleProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
