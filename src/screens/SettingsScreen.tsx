import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../store/AuthContext';
import { useRole } from '../store/RoleContext';

const NAVY = '#1E3A5F';
const GOLD = '#C9A84C';

interface SettingRow { label: string; value?: string; icon: string; danger?: boolean; onPress?: () => void; }

export default function SettingsScreen() {
  const { user, tenant, signOut } = useAuth();
  const { userRoles, isAdmin, isHRAdmin, isAccountant } = useRole();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const roleNames = userRoles.map(ur => ur.role?.name).filter(Boolean).join(', ') || 'No roles assigned';

  const accountRows: SettingRow[] = [
    { icon: '👤', label: 'Name', value: user?.fullName || `${user?.firstName} ${user?.lastName}` },
    { icon: '📧', label: 'Email', value: user?.email },
    { icon: '🏢', label: 'Organisation', value: tenant?.name },
    { icon: '🎭', label: 'Roles', value: roleNames },
  ];

  const accessRows: SettingRow[] = [
    { icon: '🔑', label: 'Admin Access', value: isAdmin ? 'Yes' : 'No' },
    { icon: '👥', label: 'HR Admin', value: isHRAdmin ? 'Yes' : 'No' },
    { icon: '💼', label: 'Accountant', value: isAccountant ? 'Yes' : 'No' },
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
            <Text style={s.icon}>{row.icon}</Text>
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
            <Text style={s.icon}>{row.icon}</Text>
            <Text style={[s.rowLabel, { flex: 1, marginLeft: 12 }]}>{row.label}</Text>
            <View style={[s.badge, { backgroundColor: row.value === 'Yes' ? '#DCFCE7' : '#F1F5F9' }]}>
              <Text style={[s.badgeText, { color: row.value === 'Yes' ? '#16A34A' : '#6B7280' }]}>
                {row.value}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={s.sectionTitle}>App</Text>
      <View style={[s.card, { marginBottom: 32 }]}>
        <View style={[s.row, s.border]}>
          <Text style={s.icon}>📱</Text>
          <Text style={[s.rowLabel, { flex: 1, marginLeft: 12 }]}>Version</Text>
          <Text style={s.rowValue}>1.0.0</Text>
        </View>
        <View style={[s.row, s.border]}>
          <Text style={s.icon}>🌐</Text>
          <Text style={[s.rowLabel, { flex: 1, marginLeft: 12 }]}>API Endpoint</Text>
          <Text style={s.rowValue}>:8004</Text>
        </View>
        <TouchableOpacity style={s.row} onPress={handleSignOut} activeOpacity={0.7}>
          <Text style={s.icon}>🚪</Text>
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
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: 16, marginTop: 20, marginBottom: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, marginHorizontal: 16, marginTop: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  border: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  icon: { fontSize: 18, width: 24, textAlign: 'center' },
  rowLabel: { fontSize: 14, color: '#374151', fontWeight: '500' },
  rowValue: { fontSize: 13, color: '#9CA3AF' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
