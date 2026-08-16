import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { gql } from '../api/graphql';
import { useAuth } from '../store/AuthContext';

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

export default function LoginScreen() {
  const { signIn, setEmployeeId } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

      // Resolve employee record for self-service features
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>N</Text>
          </View>
          <Text style={styles.brand}>Nexora ERP</Text>
          <Text style={styles.tagline}>Your business, in your pocket</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password"
          />

          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Sign In</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#F0F4F8', justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: '#1E3A5F',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  logoText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  brand: { fontSize: 26, fontWeight: '700', color: '#1E3A5F' },
  tagline: { fontSize: 14, color: '#64748B', marginTop: 4 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
    padding: 12, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB',
  },
  btn: {
    marginTop: 24, backgroundColor: '#1E3A5F', borderRadius: 10,
    padding: 14, alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
