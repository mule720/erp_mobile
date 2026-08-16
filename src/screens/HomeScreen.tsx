import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../store/AuthContext';
import { gql } from '../api/graphql';

const NAVY = '#1E3A5F';
const GOLD = '#C9A84C';

const fmt = (n: any) =>
  new Intl.NumberFormat('en-ZM', { style: 'currency', currency: 'ZMW', maximumFractionDigits: 0 }).format(Number(n ?? 0));

const QUERY = `
  query($t: UUID!) {
    recentActivities(tenantId: $t, limit: 6) {
      activityType reference description amount date
    }
    invoiceStatusSummary(tenantId: $t) {
      draft paid overdue total fiscalised
    }
    payrollDashboard(tenantId: $t) {
      totalEmployees activeEmployees grossThisMonth pendingApprovals
    }
    accountingDashboard
  }
`;

const ACTIVITY_COLORS: Record<string, string> = {
  invoice: '#3B82F6',
  payment: '#10B981',
  purchase: '#F59E0B',
  payroll: '#8B5CF6',
  expense: '#EF4444',
  journal_entry: '#6B7280',
};

const ACTIVITY_ICONS: Record<string, string> = {
  invoice: '🧾',
  payment: '💳',
  purchase: '📦',
  payroll: '👥',
  expense: '💸',
  journal_entry: '📒',
};

interface Props { onNavigate?: (key: string) => void }

export default function HomeScreen({ onNavigate }: Props) {
  const { user, tenant } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const d = await gql(QUERY, { t: tenant!.id });
      setData(d);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const summary = data?.invoiceStatusSummary;
  const payroll = data?.payrollDashboard;
  const _acc = data?.accountingDashboard;
  const accounting = typeof _acc === 'string' ? (() => { try { return JSON.parse(_acc); } catch { return null; } })() : _acc;
  const activities = data?.recentActivities || [];

  const statCards = [
    {
      label: 'Total Revenue',
      value: accounting ? fmt(accounting.totalRevenue) : '—',
      icon: '💰',
      color: '#10B981',
      bg: '#ECFDF5',
    },
    {
      label: 'Active Employees',
      value: payroll ? String(payroll.activeEmployees ?? 0) : '—',
      icon: '👥',
      color: '#3B82F6',
      bg: '#EFF6FF',
    },
    {
      label: 'Total Invoices',
      value: summary ? String(summary.total ?? 0) : '—',
      icon: '🧾',
      color: '#8B5CF6',
      bg: '#F5F3FF',
    },
    {
      label: 'Overdue',
      value: summary ? String(summary.overdue ?? 0) : '—',
      icon: '⚠️',
      color: '#EF4444',
      bg: '#FEF2F2',
    },
  ];

  const quickActions = [
    { label: 'New Invoice', icon: '🧾', key: 'sales' },
    { label: 'Purchasing', icon: '📦', key: 'purchasing' },
    { label: 'Finance', icon: '📊', key: 'finance' },
    { label: 'People (HR)', icon: '👥', key: 'people' },
  ];

  return (
    <ScrollView
      style={s.root}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={NAVY} />}
    >
      {/* ── Greeting ── */}
      <View style={s.greeting}>
        <Text style={s.greetingText}>{greeting()}, <Text style={{ fontWeight: '700' }}>{user?.firstName || 'there'}</Text></Text>
        <Text style={s.org}>{tenant?.name}</Text>
      </View>

      {/* ── Stat Cards ── */}
      <View style={s.cardGrid}>
        {loading
          ? [0, 1, 2, 3].map(i => <View key={i} style={[s.statCard, { backgroundColor: '#F1F5F9' }]}><ActivityIndicator color={NAVY} /></View>)
          : statCards.map((c) => (
            <View key={c.label} style={[s.statCard, { backgroundColor: c.bg }]}>
              <View style={s.statTop}>
                <Text style={s.statLabel}>{c.label}</Text>
                <Text style={s.statIcon}>{c.icon}</Text>
              </View>
              <Text style={[s.statValue, { color: c.color }]}>{c.value}</Text>
            </View>
          ))}
      </View>

      {/* ── Invoice breakdown row ── */}
      {!loading && summary && (
        <View style={s.breakdownRow}>
          <BreakdownPill label="Draft" value={summary.draft} color="#F59E0B" />
          <BreakdownPill label="Paid" value={summary.paid} color="#10B981" />
          <BreakdownPill label="Overdue" value={summary.overdue} color="#EF4444" />
          <BreakdownPill label="Fiscalised" value={summary.fiscalised} color="#6B7280" />
        </View>
      )}

      <View style={s.twoCol}>
        {/* ── Recent Activity ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionIcon}>🕐</Text>
            <Text style={s.sectionTitle}>Recent Activity</Text>
          </View>
          <View style={s.card}>
            {loading
              ? [0, 1, 2].map(i => <View key={i} style={[s.actRow, { borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: '#F1F5F9' }]}><ActivityIndicator color={NAVY} /></View>)
              : activities.length === 0
                ? <Text style={s.empty}>No recent activity</Text>
                : activities.map((a: any, i: number) => (
                  <View key={i} style={[s.actRow, i < activities.length - 1 && s.border]}>
                    <View style={[s.actDot, { backgroundColor: ACTIVITY_COLORS[a.activityType] || '#6B7280' }]}>
                      <Text style={{ fontSize: 10 }}>{ACTIVITY_ICONS[a.activityType] || '•'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.actDesc} numberOfLines={1}>{a.description}</Text>
                      <Text style={s.actRef}>{a.reference} · {a.date?.slice(0, 10)}</Text>
                    </View>
                    {a.amount != null && (
                      <Text style={s.actAmt}>{Number(a.amount).toLocaleString('en-ZM', { maximumFractionDigits: 0 })}</Text>
                    )}
                  </View>
                ))
            }
          </View>
        </View>

        {/* ── Quick Actions ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionIcon}>⚡</Text>
            <Text style={s.sectionTitle}>Quick Actions</Text>
          </View>
          <View style={s.qaGrid}>
            {quickActions.map((a) => (
              <TouchableOpacity
                key={a.key}
                style={s.qaBtn}
                onPress={() => onNavigate?.(a.key)}
                activeOpacity={0.7}
              >
                <Text style={s.qaIcon}>{a.icon}</Text>
                <Text style={s.qaLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* ── Payroll snapshot ── */}
      {!loading && payroll && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionIcon}>📋</Text>
            <Text style={s.sectionTitle}>Payroll Snapshot</Text>
          </View>
          <View style={[s.card, { flexDirection: 'row' }]}>
            <PayrollStat label="Total Staff" value={payroll.totalEmployees ?? 0} />
            <View style={s.divider} />
            <PayrollStat label="Active" value={payroll.activeEmployees ?? 0} />
            <View style={s.divider} />
            <PayrollStat label="Gross This Month" value={fmt(payroll.grossThisMonth)} />
            <View style={s.divider} />
            <PayrollStat label="Pending Approvals" value={payroll.pendingApprovals ?? 0} accent={payroll.pendingApprovals > 0} />
          </View>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function BreakdownPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[s.pill, { borderColor: color }]}>
      <Text style={[s.pillVal, { color }]}>{value ?? 0}</Text>
      <Text style={s.pillLbl}>{label}</Text>
    </View>
  );
}

function PayrollStat({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 12 }}>
      <Text style={[s.payVal, accent && { color: '#EF4444' }]}>{value}</Text>
      <Text style={s.payLbl}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },

  greeting: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  greetingText: { fontSize: 20, color: '#111827' },
  org: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  cardGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, gap: 8, marginTop: 4,
  },
  statCard: {
    width: '47.5%', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600', flex: 1 },
  statIcon: { fontSize: 18 },
  statValue: { fontSize: 20, fontWeight: '800' },

  breakdownRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 8,
  },
  pill: {
    flex: 1, borderRadius: 10, borderWidth: 1.5, paddingVertical: 8,
    alignItems: 'center', backgroundColor: '#fff',
  },
  pillVal: { fontSize: 16, fontWeight: '800' },
  pillLbl: { fontSize: 10, color: '#6B7280', marginTop: 2 },

  twoCol: { marginTop: 4 },

  section: { marginHorizontal: 16, marginTop: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionIcon: { fontSize: 16, marginRight: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: NAVY },

  card: {
    backgroundColor: '#fff', borderRadius: 14,
    paddingHorizontal: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },

  actRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  border: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  actDot: { width: 28, height: 28, borderRadius: 14, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  actDesc: { fontSize: 13, fontWeight: '600', color: '#111827' },
  actRef: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  actAmt: { fontSize: 13, fontWeight: '700', color: NAVY, marginLeft: 8 },

  empty: { color: '#9CA3AF', textAlign: 'center', paddingVertical: 20, fontSize: 13 },

  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qaBtn: {
    width: '47.5%', backgroundColor: '#fff', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  qaIcon: { fontSize: 24, marginBottom: 8 },
  qaLabel: { fontSize: 13, fontWeight: '600', color: '#1F2937' },

  divider: { width: 1, backgroundColor: '#F1F5F9', marginVertical: 8 },
  payVal: { fontSize: 16, fontWeight: '800', color: NAVY },
  payLbl: { fontSize: 10, color: '#6B7280', marginTop: 2, textAlign: 'center' },
});
