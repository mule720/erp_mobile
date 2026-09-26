import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { gql } from '../api/graphql';
import { useAuth } from '../store/AuthContext';
import { COLORS, FONT, RADIUS, SHADOW } from '../theme';

const LOGIN = `
  mutation($email: String!, $password: String!) {
    authLogin(email: $email, password: $password) {
      ok error
      auth {
        token
        refreshToken
        user { id email firstName lastName fullName }
        tenant { id name }
      }
    }
  }
`;

const FIND_EMPLOYEE = `
  query($tenantId: UUID!, $email: String!) {
    employees(tenantId: $tenantId, email: $email, limit: 1) {
      id
    }
  }
`;

export default function LoginScreen({ navigation }: any) {
  const { signIn, setEmployeeId } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const data = await gql(LOGIN, { email: email.trim(), password });
      const result = data?.authLogin;
      if (!result?.ok) throw new Error(result?.error || 'Login failed');

      const { token, refreshToken, user, tenant } = result.auth;
      await signIn(
        token,
        { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, fullName: user.fullName },
        { id: tenant.id, name: tenant.name },
        refreshToken,
      );

      try {
        const empData = await gql(FIND_EMPLOYEE, { tenantId: tenant.id, email: user.email });
        const emp = empData?.employees?.[0];
        if (emp?.id) await setEmployeeId(emp.id);
      } catch {}
    } catch (e: any) {
      Alert.alert('Login failed', e.message || 'Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      {/* Ledger-rule texture on the dark ground - same technique as the
          web landing page hero, so the brand reads as one product across
          both apps instead of a generic gradient-blob login screen. */}
      <View style={s.ruleLayer} pointerEvents="none">
        {Array.from({ length: 14 }).map((_, i) => <View key={i} style={s.rule} />)}
        <View style={s.margin} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <View style={s.logo}>
              <Ionicons name="layers" size={30} color={COLORS.navy} />
            </View>
            <Text style={s.brand}>NetOn ERP Pro</Text>
            <Text style={s.tagline}>Your business, in your pocket</Text>
          </View>

          <View style={s.card}>
            <Text style={s.label}>Email</Text>
            <TextInput
              style={[s.input, focused === 'email' && s.inputFocused]}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              placeholder="you@company.com"
              placeholderTextColor={COLORS.faint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Text style={s.label}>Password</Text>
            <TextInput
              style={[s.input, focused === 'password' && s.inputFocused]}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              placeholder="••••••••"
              placeholderTextColor={COLORS.faint}
              secureTextEntry
              autoComplete="password"
            />

            <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : (
                  <>
                    <Text style={s.btnText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </>
                )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.switchLink} onPress={() => navigation.navigate('Register')} activeOpacity={0.7}>
            <Text style={s.switchText}>New retail shop? <Text style={s.switchTextBold}>Create an account</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  ruleLayer: { ...StyleSheet.absoluteFillObject, opacity: 0.4 },
  rule: { height: 1, backgroundColor: '#334155', marginTop: 34 },
  margin: { position: 'absolute', top: 0, bottom: 0, left: 64, width: 1, backgroundColor: 'rgba(245,158,11,0.35)' },

  container: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 72 },
  header: { alignItems: 'center', marginBottom: 36 },
  logo: {
    width: 72, height: 72, borderRadius: RADIUS.lg, backgroundColor: COLORS.amberLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    ...SHADOW.raised,
  },
  brand: { fontSize: 26, color: '#fff', fontFamily: FONT.display },
  tagline: { fontSize: 14, color: '#94A3B8', marginTop: 6, fontFamily: FONT.bodyRegular },

  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: 24,
    ...SHADOW.raised,
  },
  label: { fontSize: 12, fontFamily: FONT.heading, color: COLORS.subtle, marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: COLORS.ink,
    backgroundColor: COLORS.surfaceMuted, fontFamily: FONT.bodyRegular,
  },
  inputFocused: { borderColor: COLORS.navy, backgroundColor: COLORS.surface },
  btn: {
    marginTop: 26, backgroundColor: COLORS.navy, borderRadius: RADIUS.md,
    paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontFamily: FONT.heading },

  switchLink: { marginTop: 24, alignItems: 'center' },
  switchText: { color: '#94A3B8', fontSize: 13, fontFamily: FONT.bodyRegular },
  switchTextBold: { color: COLORS.amberLight, fontFamily: FONT.heading },
});
