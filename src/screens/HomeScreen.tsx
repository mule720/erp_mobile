import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';
import { gql } from '../api/graphql';
import { COLORS, FONT, RADIUS, SHADOW } from '../theme';

const NAVY = COLORS.navy;

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

const ACTIVITY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  invoice: 'receipt-outline',
  payment: 'card-outline',
  purchase: 'cube-outline',
  payroll: 'people-outline',
  expense: 'trending-down-outline',
  journal_entry: 'book-outline',
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
      icon: 'trending-up-outline' as const,
      color: COLORS.success,
      bg: COLORS.successBg,
    },
    {
      label: 'Active Employees',
      value: payroll ? String(payroll.activeEmployees ?? 0) : '—',
      icon: 'people-outline' as const,
      color: COLORS.info,
      bg: COLORS.infoBg,
    },
    {
      label: 'Total Invoices',
      value: summary ? String(summary.total ?? 0) : '—',
      icon: 'receipt-outline' as const,
      color: COLORS.violet,
      bg: COLORS.violetBg,
    },
    {
      label: 'Overdue',
      value: summary ? String(summary.overdue ?? 0) : '—',
      icon: 'alert-circle-outline' as const,
      color: COLORS.danger,
      bg: COLORS.dangerBg,
    },
  ];

  const quickActions = [
    { label: 'New Invoice', icon: 'receipt-outline' as const, key: 'sales' },
    { label: 'Purchasing', icon: 'cube-outline' as const, key: 'purchasing' },
    { label: 'Finance', icon: 'bar-chart-outline' as const, key: 'finance' },
    { label: 'People (HR)', icon: 'people-outline' as const, key: 'people' },
  ];

  return (
    <ScrollView
      style={s.root}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={NAVY} />}
    >
      {/* ── Greeting ── */}
      <View style={s.greeting}>
        <Text style={s.greetingText}>{greeting()}, <Text style={{ fontFamily: FONT.displaySemibold }}>{user?.firstName || 'there'}</Text></Text>
        <Text style={s.org}>{tenant?.name}</Text>
      </View>

      {/* ── Stat Cards ── */}
      <View style={s.cardGrid}>
        {loading
          ? [0, 1, 2, 3].map(i => <View key={i} style={[s.statCard, { backgroundColor: '#F1F5F9' }]}><ActivityIndicator color={NAVY} /></View>)
          : statCards.map((c) => (
            <View key={c.label} style={s.statCard}>
              <View style={s.statTop}>
                <Text style={s.statLabel}>{c.label}</Text>
                <View style={[s.statIconWrap, { backgroundColor: c.bg }]}>
                  <Ionicons name={c.icon} size={15} color={c.color} />
                </View>
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
            <Ionicons name="time-outline" size={16} color={NAVY} style={s.sectionIcon} />
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
                      <Ionicons name={ACTIVITY_ICONS[a.activityType] || 'ellipse'} size={13} color="#fff" />
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
            <Ionicons name="flash-outline" size={16} color={COLORS.amber} style={s.sectionIcon} />
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
                <View style={s.qaIconWrap}>
                  <Ionicons name={a.icon} size={20} color={NAVY} />
                </View>
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
            <Ionicons name="clipboard-outline" size={16} color={NAVY} style={s.sectionIcon} />
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
  root: { flex: 1, backgroundColor: COLORS.surfaceMuted },

  greeting: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  greetingText: { fontSize: 20, color: COLORS.ink, fontFamily: FONT.bodyRegular },
  org: { fontSize: 12, color: COLORS.faint, marginTop: 2, fontFamily: FONT.bodyRegular },

  cardGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, gap: 8, marginTop: 4,
  },
  statCard: {
    width: '47.5%', borderRadius: RADIUS.lg, padding: 14,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    ...SHADOW.card,
  },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statLabel: { fontSize: 11, color: COLORS.subtle, fontFamily: FONT.heading, flex: 1 },
  statIconWrap: { width: 26, height: 26, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 20, fontFamily: FONT.display },

  breakdownRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 8,
  },
  pill: {
    flex: 1, borderRadius: RADIUS.sm, borderWidth: 1.5, paddingVertical: 8,
    alignItems: 'center', backgroundColor: COLORS.surface,
  },
  pillVal: { fontSize: 16, fontFamily: FONT.display },
  pillLbl: { fontSize: 10, color: COLORS.subtle, marginTop: 2, fontFamily: FONT.bodyRegular },

  twoCol: { marginTop: 4 },

  section: { marginHorizontal: 16, marginTop: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionIcon: { marginRight: 6 },
  sectionTitle: { fontSize: 15, fontFamily: FONT.heading, color: NAVY },

  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.border,
    ...SHADOW.card,
  },

  actRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  border: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  actDot: { width: 28, height: 28, borderRadius: 14, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  actDesc: { fontSize: 13, fontFamily: FONT.heading, color: COLORS.ink },
  actRef: { fontSize: 11, color: COLORS.faint, marginTop: 2, fontFamily: FONT.bodyRegular },
  actAmt: { fontSize: 13, fontFamily: FONT.heading, color: NAVY, marginLeft: 8 },

  empty: { color: COLORS.faint, textAlign: 'center', paddingVertical: 20, fontSize: 13, fontFamily: FONT.bodyRegular },

  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qaBtn: {
    width: '47.5%', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
    ...SHADOW.card,
  },
  qaIconWrap: {
    width: 36, height: 36, borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  qaLabel: { fontSize: 13, fontFamily: FONT.heading, color: COLORS.ink },

  divider: { width: 1, backgroundColor: '#F1F5F9', marginVertical: 8 },
  payVal: { fontSize: 16, fontFamily: FONT.display, color: NAVY },
  payLbl: { fontSize: 10, color: COLORS.subtle, marginTop: 2, textAlign: 'center', fontFamily: FONT.bodyRegular },
});
