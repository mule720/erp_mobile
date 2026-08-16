import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

interface Props { path: string; title: string; }

const NAVY = '#1E3A5F';
const WEB_BASE = 'https://netonerppro.com';

export default function WebModuleScreen({ path, title }: Props) {
  if (Platform.OS === 'web') {
    return (
      <View style={s.root}>
        <iframe
          src={`${WEB_BASE}${path}`}
          style={{ flex: 1, border: 'none', width: '100%', height: '100%' } as any}
          title={title}
        />
      </View>
    );
  }

  // Native fallback — show a message directing user to web
  return (
    <View style={s.fallback}>
      <Text style={s.icon}>🌐</Text>
      <Text style={s.heading}>{title}</Text>
      <Text style={s.body}>Open the Nexora ERP web app at{'\n'}netonerppro.com{path}{'\n'}for full access to this module.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#F1F5F9' },
  icon: { fontSize: 48, marginBottom: 16 },
  heading: { fontSize: 20, fontWeight: '700', color: NAVY, marginBottom: 8 },
  body: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
});
