import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/store/AuthContext';
import { RoleProvider } from './src/store/RoleContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
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
