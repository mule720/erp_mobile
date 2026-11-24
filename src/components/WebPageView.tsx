import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, BackHandler, StatusBar, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from '../api/secureStorage';
import { useAuth } from '../store/AuthContext';
import { COLORS } from '../theme';

const WEB_BASE = 'https://netonerppro.com';

/** A page of the web app shown inside the mobile app: already signed in as the same person, without the web's own header and menus. */
export default function WebPageView({ path, title, onClose }: { path: string; title: string; onClose: () => void }) {
  const { user, tenant } = useAuth();
  const ref = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [boot, setBoot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Sign the web page in as the person already signed in here: the same tokens, set before the page loads.
  useEffect(() => {
    (async () => {
      const token = (await SecureStore.getItemAsync('erp_token')) || '';
      const refresh = (await SecureStore.getItemAsync('erp_refresh_token')) || '';
      const set = (k: string, v: string) => `try{localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(v)});}catch(e){}`;
      setBoot([
        set('auth_token', token), refresh ? set('refresh_token', refresh) : '', set('erp_tenant_id', tenant?.id || ''),
        set('user_email', user?.email || ''), set('user_name', user?.fullName || ''), set('tenant_name', tenant?.name || ''),
        "try{sessionStorage.setItem('erp_embed','1');}catch(e){}", 'true;',
      ].join(''));
    })();
  }, [tenant?.id]);

  const back = useCallback(() => {
    if (canGoBack) { ref.current?.goBack(); return true; }
    onClose(); return true;
  }, [canGoBack, onClose]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  }, [back]);

  const url = `${WEB_BASE}${path}${path.includes('?') ? '&' : '?'}embed=1`;
  const insets = useSafeAreaInsets();
  const PT = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 44);

  return (
    <View style={[s.root, { paddingBottom: insets.bottom }]}>
      <View style={[s.bar, { paddingTop: PT + 6 }]}>
        <TouchableOpacity onPress={back} style={s.btn} accessibilityLabel="Back"><Ionicons name={canGoBack ? 'chevron-back' : 'close'} size={22} color="#fff" /></TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        <TouchableOpacity onPress={() => ref.current?.reload()} style={s.btn} accessibilityLabel="Reload"><Ionicons name="refresh" size={20} color="#fff" /></TouchableOpacity>
      </View>
      {Platform.OS === 'web' ? (
        // web preview of the app: the page cannot be signed in across sites, so just open it
        <View style={s.fallback}><Text style={s.fallbackTxt}>This page opens inside the phone app. In a browser, open:{'\n'}{WEB_BASE}{path}</Text></View>
      ) : boot === null ? (
        <View style={s.fallback}><ActivityIndicator color={COLORS.navy} /></View>
      ) : (
        <View style={{ flex: 1 }}>
          <WebView
            ref={ref}
            source={{ uri: url }}
            injectedJavaScriptBeforeContentLoaded={boot}
            onNavigationStateChange={n => setCanGoBack(n.canGoBack)}
            onLoadEnd={() => setLoading(false)}
            startInLoadingState
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            setSupportMultipleWindows={false}
            allowsBackForwardNavigationGestures
            originWhitelist={['https://*', 'blob:*', 'data:*', 'about:*']}
            renderLoading={() => <View style={s.fallback}><ActivityIndicator color={COLORS.navy} /></View>}
            onShouldStartLoadWithRequest={r => {
              if (r.url.startsWith('https://netonerppro.com') || r.url.startsWith('about:') || r.url.startsWith('blob:') || r.url.startsWith('data:')) return true;
              Linking.openURL(r.url).catch(() => {});   // WhatsApp, phone, mail and other sites open in their own app
              return false;
            }}
          />
          {loading && <View style={s.loadingBar} />}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: '#F1F5F9', zIndex: 50 },
  bar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy, paddingHorizontal: 6, paddingBottom: 8 },
  btn: { padding: 8 },
  title: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700', marginHorizontal: 6 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  fallbackTxt: { color: COLORS.subtle, textAlign: 'center', lineHeight: 22 },
  loadingBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: COLORS.amber },
});
