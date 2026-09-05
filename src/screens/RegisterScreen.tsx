import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from '../api/secureStorage';
import { gql } from '../api/graphql';
import { useAuth } from '../store/AuthContext';
import { COLORS, FONT, RADIUS, SHADOW } from '../theme';

// mobilePlans is a query only this app calls - it returns exactly the
// plans marked mobile_only=True on the backend (today: the single
// "Retail" plan for a one-till shop). It is deliberately NOT the same
// query the web frontend uses (subscriptionPlans), so this plan can
// never appear on the website even by accident - see
// subscriptions.SubscriptionPlan.mobile_only.
const MOBILE_PLANS = `{
  mobilePlans {
    code name description basePrice currency billingCycle trialDays
  }
}`;

const SIMPLE_REGISTER = `
  mutation($email: String!, $phone: String!, $username: String!, $password: String!, $firstName: String, $lastName: String) {
    simpleRegister(email: $email, phone: $phone, username: $username, password: $password, firstName: $firstName, lastName: $lastName) {
      ok error auth { token refreshToken }
    }
  }
`;

const SETUP_COMPANY = `
  mutation($companyName: String!, $plan: String, $startTrial: Boolean) {
    setupCompany(companyName: $companyName, plan: $plan, startTrial: $startTrial) {
      ok error
      auth {
        token refreshToken
        user { id email firstName lastName fullName }
        tenant { id name }
      }
    }
  }
`;

interface MobilePlan {
  code: string; name: string; description: string;
  basePrice: string; currency: string; billingCycle: string; trialDays: number;
}

const FIELDS: Array<{ key: string; label: string; placeholder: string; icon: keyof typeof Ionicons.glyphMap; keyboardType?: any; secure?: boolean; autoCapitalize?: any }> = [
  { key: 'companyName', label: 'Shop / Business Name', placeholder: "Chanda's Store", icon: 'storefront-outline', autoCapitalize: 'words' },
  { key: 'firstName', label: 'First Name', placeholder: 'Chanda', icon: 'person-outline', autoCapitalize: 'words' },
  { key: 'lastName', label: 'Last Name', placeholder: 'Mwale', icon: 'person-outline', autoCapitalize: 'words' },
  { key: 'email', label: 'Email', placeholder: 'you@shop.com', icon: 'mail-outline', keyboardType: 'email-address', autoCapitalize: 'none' },
  { key: 'phone', label: 'Phone Number', placeholder: '+260 97 1234567', icon: 'call-outline', keyboardType: 'phone-pad' },
  { key: 'password', label: 'Password', placeholder: 'Min. 8 characters', icon: 'lock-closed-outline', secure: true },
  { key: 'confirmPassword', label: 'Confirm Password', placeholder: 'Repeat password', icon: 'lock-closed-outline', secure: true },
];

export default function RegisterScreen({ navigation }: any) {
  const { signIn } = useAuth();
  const [plan, setPlan] = useState<MobilePlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const [form, setForm] = useState({
    companyName: '', firstName: '', lastName: '', email: '', phone: '',
    password: '', confirmPassword: '',
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    gql(MOBILE_PLANS)
      .then((data) => setPlan(data?.mobilePlans?.[0] ?? null))
      .catch(() => setPlan(null))
      .finally(() => setPlanLoading(false));
  }, []);

  const handleRegister = async () => {
    if (!form.companyName.trim()) return Alert.alert('Required', 'Enter your shop / business name.');
    if (!form.firstName.trim() || !form.lastName.trim()) return Alert.alert('Required', 'Enter your first and last name.');
    if (!form.email.trim() || !form.phone.trim()) return Alert.alert('Required', 'Enter your email and phone number.');
    if (form.password.length < 8) return Alert.alert('Password too short', 'Use at least 8 characters.');
    if (form.password !== form.confirmPassword) return Alert.alert('Passwords do not match', 'Re-type your password.');
    if (!plan) return Alert.alert('No plan available', 'Please try again in a moment.');

    setLoading(true);
    try {
      const username = `${form.firstName}${form.lastName}`.toLowerCase().replace(/\s+/g, '') || form.email.split('@')[0];
      const reg = await gql(SIMPLE_REGISTER, {
        email: form.email.trim(), phone: form.phone.trim(), username,
        password: form.password, firstName: form.firstName.trim(), lastName: form.lastName.trim(),
      });
      const regResult = reg?.simpleRegister;
      if (!regResult?.ok) throw new Error(regResult?.error || 'Registration failed');

      // gql() reads its bearer token from SecureStore, not a param (see
      // src/api/graphql.ts) - stash the pre-tenant token from simpleRegister
      // there so setupCompany's own auth check finds it; signIn() below
      // overwrites both entries with the final post-setup token/refreshToken.
      await SecureStore.setItemAsync('erp_token', regResult.auth.token);

      const setup = await gql(SETUP_COMPANY, {
        companyName: form.companyName.trim(), plan: plan.code, startTrial: true,
      });
      const setupResult = setup?.setupCompany;
      if (!setupResult?.ok) throw new Error(setupResult?.error || 'Could not set up your shop. Please try again.');

      const { token, refreshToken, user, tenant } = setupResult.auth;
      await signIn(
        token,
        { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, fullName: user.fullName },
        { id: tenant.id, name: tenant.name },
        refreshToken,
      );
    } catch (e: any) {
      // Don't leave a dangling pre-tenant token behind if setupCompany
      // failed after simpleRegister already succeeded - a stale token
      // would otherwise get sent as Authorization on the next gql() call.
      await SecureStore.deleteItemAsync('erp_token');
      Alert.alert('Could not create your account', e.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <View style={s.ruleLayer} pointerEvents="none">
        {Array.from({ length: 6 }).map((_, i) => <View key={i} style={s.rule} />)}
        <View style={s.margin} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <View style={s.logo}><Ionicons name="layers" size={26} color={COLORS.navy} /></View>
            <Text style={s.brand}>Nexora ERP</Text>
            <Text style={s.tagline}>Set up your shop in minutes</Text>
          </View>

          {planLoading ? (
            <ActivityIndicator color={COLORS.amberLight} style={{ marginBottom: 20 }} />
          ) : plan ? (
            <View style={s.planCard}>
              <View style={s.planRow}>
                <Text style={s.planName}>{plan.name} plan</Text>
                <Text style={s.planPrice}>K{Number(plan.basePrice).toLocaleString()}/mo</Text>
              </View>
              <Text style={s.planDesc}>{plan.description}</Text>
              <View style={s.planTrialRow}>
                <Ionicons name="checkmark-circle" size={13} color={COLORS.amberLight} />
                <Text style={s.planTrial}>{plan.trialDays}-day free trial · no credit card needed</Text>
              </View>
            </View>
          ) : (
            <Text style={s.planFallback}>No plan available right now — please try again shortly.</Text>
          )}

          <View style={s.card}>
            {FIELDS.map((f) => (
              <View key={f.key}>
                <Text style={s.label}>{f.label}</Text>
                <View style={[s.inputRow, focusedField === f.key && s.inputRowFocused]}>
                  <Ionicons name={f.icon} size={17} color={focusedField === f.key ? COLORS.navy : COLORS.faint} style={s.inputIcon} />
                  <TextInput
                    style={s.input}
                    value={(form as any)[f.key]}
                    onChangeText={set(f.key as keyof typeof form)}
                    onFocus={() => setFocusedField(f.key)}
                    onBlur={() => setFocusedField(null)}
                    placeholder={f.placeholder}
                    placeholderTextColor={COLORS.faint}
                    keyboardType={f.keyboardType}
                    autoCapitalize={f.autoCapitalize}
                    secureTextEntry={f.secure}
                    autoComplete={f.key === 'email' ? 'email' : f.secure ? 'password' : undefined}
                  />
                </View>
              </View>
            ))}

            <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={loading || planLoading} activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : (
                  <>
                    <Text style={s.btnText}>Create My Shop</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </>
                )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.switchLink} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={s.switchText}>Already have an account? <Text style={s.switchTextBold}>Sign In</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  ruleLayer: { ...StyleSheet.absoluteFillObject, opacity: 0.35 },
  rule: { height: 1, backgroundColor: '#334155', marginTop: 60 },
  margin: { position: 'absolute', top: 0, bottom: 0, left: 64, width: 1, backgroundColor: 'rgba(245,158,11,0.35)' },

  container: { flexGrow: 1, padding: 24, paddingTop: 56 },
  header: { alignItems: 'center', marginBottom: 20 },
  logo: {
    width: 60, height: 60, borderRadius: RADIUS.lg, backgroundColor: COLORS.amberLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  brand: { fontSize: 21, color: '#fff', fontFamily: FONT.display },
  tagline: { fontSize: 13, color: '#94A3B8', marginTop: 4, fontFamily: FONT.bodyRegular },

  planCard: {
    backgroundColor: COLORS.navyLight, borderRadius: RADIUS.lg, padding: 18, marginBottom: 18,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
  },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  planName: { color: '#fff', fontSize: 15, fontFamily: FONT.heading },
  planPrice: { color: COLORS.amberLight, fontSize: 16, fontFamily: FONT.displaySemibold },
  planDesc: { color: '#CBD5E1', fontSize: 12, marginTop: 8, lineHeight: 17, fontFamily: FONT.bodyRegular },
  planTrialRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  planTrial: { color: '#93C5FD', fontSize: 11, fontFamily: FONT.heading },
  planFallback: { color: '#94A3B8', fontSize: 12, marginBottom: 18, textAlign: 'center', fontFamily: FONT.bodyRegular },

  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: 22,
    ...SHADOW.raised,
  },
  label: { fontSize: 11, fontFamily: FONT.heading, color: COLORS.subtle, marginBottom: 7, marginTop: 15, textTransform: 'uppercase', letterSpacing: 0.4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceMuted, paddingHorizontal: 12,
  },
  inputRowFocused: { borderColor: COLORS.navy, backgroundColor: COLORS.surface },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: COLORS.ink, fontFamily: FONT.bodyRegular },

  btn: {
    marginTop: 24, backgroundColor: COLORS.navy, borderRadius: RADIUS.md,
    paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontFamily: FONT.heading },
  switchLink: { marginTop: 20, alignItems: 'center' },
  switchText: { color: '#94A3B8', fontSize: 13, fontFamily: FONT.bodyRegular },
  switchTextBold: { color: COLORS.amberLight, fontFamily: FONT.heading },
});
