import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { useAuth } from '../store/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import SidebarLayout from './SidebarLayout';
import SoftPOSScreen from '../screens/SoftPOSScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { token, ready } = useAuth();
  const navRef = useRef<NavigationContainerRef<any>>(null);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

  // Handle push notification taps → navigate to SoftPOS
  useEffect(() => {
    if (Platform.OS === 'web') return;

    function handleData(data: Record<string, unknown>) {
      if (!data) return;
      if (data.type === 'soft_pos_session') {
        navRef.current?.navigate('SoftPos', {
          session_id: (data.session_id ?? data.sessionId) as string,
          amount: String(data.amount ?? ''),
          currency: String(data.currency ?? 'ZMW'),
          description: String(data.description ?? ''),
          app_id: String(data.app_id ?? ''),
        });
      }
    }

    // Handle notification that launched the app from a cold start
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) {
        handleData((response.notification.request.content.data ?? {}) as Record<string, unknown>);
      }
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      handleData((response.notification.request.content.data ?? {}) as Record<string, unknown>);
    });

    return () => {
      responseListener.current?.remove();
    };
  }, []);

  if (!ready) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E3A5F' }}>
      <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>NetOn ERP Pro</Text>
    </View>
  );

  return (
    <NavigationContainer ref={navRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <>
            <Stack.Screen name="Main" component={SidebarLayout} />
            <Stack.Screen
              name="SoftPos"
              component={SoftPOSScreen}
              options={{ presentation: 'modal', headerShown: false }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            {/* Self-serve sign-up — mobile only. Pre-selects the cheapest
                "Retail" plan (mobile_only=True on the backend), which the
                web app never queries or shows. */}
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
