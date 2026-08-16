import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text } from 'react-native';

import { useAuth } from '../store/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import SidebarLayout from './SidebarLayout';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { token, ready } = useAuth();

  if (!ready) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E3A5F' }}>
      <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>Nexora ERP</Text>
    </View>
  );

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token
          ? <Stack.Screen name="Main" component={SidebarLayout} />
          : <Stack.Screen name="Login" component={LoginScreen} />
        }
      </Stack.Navigator>
    </NavigationContainer>
  );
}
