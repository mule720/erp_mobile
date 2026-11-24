import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { gql } from '../api/graphql';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { useAuth } from '../store/AuthContext';
import { useRole } from '../store/RoleContext';
import { useThemeMode } from '../store/ThemeContext';
import { useConfirm } from '../store/ConfirmContext';

const NAVY = '#2563EB';
const GOLD = '#0EA5E9';

interface SettingRow { label: string; value?: string; icon: keyof typeof Ionicons.glyphMap | string; danger?: boolean; onPress?: () => void; }

export default function SettingsScreen() {
  const { user, tenant, signOut } = useAuth();
  const { userRoles, isAdmin, isHRAdmin, isAccountant } = useRole();
  const { dark, toggle: toggleTheme } = useThemeMode();

  const confirm = useConfirm();
  const handleSignOut = async () => {
    if (await confirm({ title: 'Sign out', message: 'Are you sure you want to sign out?', confirmLabel: 'Sign out', destructive: true })) signOut();
  };

  const WEB = 'https://netonerppro.com';
  // Asks for the account and personal data to be deleted. The business's legal records are kept; a person replies within 30 days.
  const askDelete = async () => {
    const yes = await confirm({
      title: 'Delete my account',
      message: 'We will delete or anonymise your personal details and reply to your email within 30 days. Records the business must keep by law, such as invoices and payroll, stay with the business.',
      confirmLabel: 'Send request', destructive: true });
    if (!yes) return;
    try {
      const d = await gql<any>(`mutation($s:String){ requestAccountDeletion(source:$s){ ok error message } }`, { s: 'mobile' });
      const r = d?.requestAccountDeletion;
      Alert.alert(r?.ok ? 'Request received' : 'Could not send', r?.ok ? (r.message || 'We will reply by email within 30 days.') : (r?.error || 'Please try again or open the delete-account page.'));
    } catch (e: any) { Alert.alert('Could not send', e?.message || 'Please try again.'); }
  };

  const roleNames = userRoles.map(ur => ur.role?.name).filter(Boolean).join(', ') || 'No roles assigned';

  const accountRows: SettingRow[] = [
    { icon: 'person-outline', label: 'Name', value: user?.fullName || `${user?.firstName} ${user?.lastName}` },
    { icon: 'mail-outline', label: 'Email', value: user?.email },
    { icon: 'business-outline', label: 'Organisation', value: tenant?.name },
    { icon: 'shield-outline', label: 'Roles', value: roleNames },
  ];

  const accessRows: SettingRow[] = [
    { icon: 'key-outline', label: 'Admin Access', value: isAdmin ? 'Yes' : 'No' },
    { icon: 'people-outline', label: 'HR Admin', value: isHRAdmin ? 'Yes' : 'No' },
    { icon: 'briefcase-outline', label: 'Accountant', value: isAccountant ? 'Yes' : 'No' },
  ];

  return (
    <ScrollView style={s.root}>
      <View style={s.header}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{user?.firstName?.[0]?.toUpperCase() || '?'}</Text>
        </View>
        <Text style={s.name}>{user?.fullName || `${user?.firstName} ${user?.lastName}`}</Text>
        <Text style={s.email}>{user?.email}</Text>
        <View style={s.orgBadge}>
          <Text style={s.orgText}>{tenant?.name}</Text>
        </View>
      </View>

      <Text style={s.sectionTitle}>Account</Text>
      <View style={s.card}>
        {accountRows.map((row, i) => (
          <View key={i} style={[s.row, i < accountRows.length - 1 && s.border]}>
            <Ionicons name={row.icon as any} size={19} color={row.danger ? COLORS.danger : COLORS.subtle} style={s.icon} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.rowLabel}>{row.label}</Text>
              <Text style={s.rowValue}>{row.value || '—'}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={s.sectionTitle}>Access Levels</Text>
      <View style={s.card}>
        {accessRows.map((row, i) => (
          <View key={i} style={[s.row, i < accessRows.length - 1 && s.border]}>
            <Ionicons name={row.icon as any} size={19} color={row.danger ? COLORS.danger : COLORS.subtle} style={s.icon} />
            <Text style={[s.rowLabel, { flex: 1, marginLeft: 12 }]}>{row.label}</Text>
            <View style={[s.badge, { backgroundColor: row.value === 'Yes' ? '#DCFCE7' : '#F1F5F9' }]}>
              <Text style={[s.badgeText, { color: row.value === 'Yes' ? '#16A34A' : '#64748B' }]}>
                {row.value}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={s.sectionTitle}>App</Text>
      <View style={[s.card, { marginBottom: 32 }]}>
        <View style={[s.row, s.border]}>
          <Ionicons name="phone-portrait-outline" size={19} color={COLORS.subtle} style={s.icon} />
          <Text style={[s.rowLabel, { flex: 1, marginLeft: 12 }]}>Version</Text>
          <Text style={s.rowValue}>1.0.0</Text>
        </View>
        <View style={[s.row, s.border]}>
          <Ionicons name="globe-outline" size={19} color={COLORS.subtle} style={s.icon} />
          <Text style={[s.rowLabel, { flex: 1, marginLeft: 12 }]}>API Endpoint</Text>
          <Text style={s.rowValue}>:8004</Text>
        </View>
        <TouchableOpacity style={[s.row, s.border]} onPress={toggleTheme} activeOpacity={0.7}>
          <Ionicons name={dark ? 'sunny-outline' : 'moon-outline'} size={19} color={COLORS.subtle} style={s.icon} />
          <Text style={[s.rowLabel, { flex: 1, marginLeft: 12 }]}>{dark ? 'Switch to light mode' : 'Switch to dark mode'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.row, s.border]} onPress={() => Linking.openURL(`${WEB}/privacy`)} activeOpacity={0.7}>
          <Ionicons name="lock-closed-outline" size={19} color={COLORS.subtle} style={s.icon} />
          <Text style={[s.rowLabel, { flex: 1, marginLeft: 12 }]}>Privacy policy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.row, s.border]} onPress={() => Linking.openURL(`${WEB}/terms`)} activeOpacity={0.7}>
          <Ionicons name="document-text-outline" size={19} color={COLORS.subtle} style={s.icon} />
          <Text style={[s.rowLabel, { flex: 1, marginLeft: 12 }]}>Terms of service</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.row, s.border]} onPress={askDelete} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={19} color={COLORS.subtle} style={s.icon} />
          <Text style={[s.rowLabel, { flex: 1, marginLeft: 12, color: '#DC2626' }]}>Delete my account and data</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.row} onPress={handleSignOut} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={19} color={COLORS.subtle} style={s.icon} />
          <Text style={[s.rowLabel, { flex: 1, marginLeft: 12, color: '#DC2626' }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { backgroundColor: NAVY, paddingTop: 32, paddingBottom: 28, alignItems: 'center' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: GOLD, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  name: { color: '#fff', fontSize: 18, fontWeight: '700' },
  email: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  orgBadge: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  orgText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: 16, marginTop: 20, marginBottom: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, marginHorizontal: 16, marginTop: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  border: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  icon: { width: 24, textAlign: 'center' },
  rowLabel: { fontSize: 14, color: '#334155', fontWeight: '500' },
  rowValue: { fontSize: 13, color: '#94A3B8' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
