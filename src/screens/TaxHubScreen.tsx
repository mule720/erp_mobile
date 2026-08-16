import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet,
  TouchableOpacity, Modal, Alert,
} from 'react-native';
import { gql } from '../api/graphql';
import { useAuth } from '../store/AuthContext';
import { useRole } from '../store/RoleContext';
import ModuleTabs from '../components/ModuleTabs';
import StatusBadge from '../components/StatusBadge';
import FormModal from '../components/FormModal';
import { Field, SelectField, Section } from '../components/Field';
import FAB from '../components/FAB';

const NAVY = '#1E3A5F';
const GOLD = '#C9A84C';
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n: any) =>
  new Intl.NumberFormat('en-ZM', { style: 'currency', currency: 'ZMW' }).format(Number(n ?? 0));

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'rates', label: 'Tax Rates' },
  { key: 'vat', label: 'VAT Returns' },
  { key: 'einvoice', label: 'Smart Invoice' },
  { key: 'calendar', label: 'Tax Calendar' },
];

function Loader() { return <View style={s.center}><ActivityIndicator size="large" color={NAVY} /></View>; }
function Empty({ msg = 'No records' }: { msg?: string }) { return <Text style={s.empty}>{msg}</Text>; }

function ActionBtn({ label, color = NAVY, onPress }: { label: string; color?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.actionBtn, { backgroundColor: color }]} onPress={onPress} activeOpacity={0.8}>
      <Text style={s.actionBtnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ─────────────────────────── OVERVIEW ─────────────────────────── */
function OverviewTab({ tenantId }: { tenantId: string }) {
  const [calendar, setCalendar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await gql<any>(`query($t:UUID!){taxCalendar(tenantId:$t)}`, { t: tenantId });
      const raw = d?.taxCalendar;
      const list = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
      setCalendar(list.sort((a: any, b: any) => (a.dueDate || '').localeCompare(b.dueDate || '')));
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const pending = calendar.filter(d => d.status !== 'filed').length;
  const overdue = calendar.filter(d => d.status !== 'filed' && d.dueDate && new Date(d.dueDate) < new Date()).length;

  if (loading) return <Loader />;
  return (
    <ScrollView style={{ flex: 1 }}>
      <View style={s.card}>
        <View style={s.summaryGrid}>
          <View style={s.summaryCell}>
            <Text style={s.summaryLabel}>Total Deadlines</Text>
            <Text style={[s.summaryValue, { color: NAVY }]}>{calendar.length}</Text>
          </View>
          <View style={s.summaryCell}>
            <Text style={s.summaryLabel}>Pending</Text>
            <Text style={[s.summaryValue, { color: '#D97706' }]}>{pending}</Text>
          </View>
          <View style={s.summaryCell}>
            <Text style={s.summaryLabel}>Overdue</Text>
            <Text style={[s.summaryValue, { color: '#DC2626' }]}>{overdue}</Text>
          </View>
          <View style={s.summaryCell}>
            <Text style={s.summaryLabel}>Filed</Text>
            <Text style={[s.summaryValue, { color: '#16A34A' }]}>{calendar.length - pending}</Text>
          </View>
        </View>
      </View>

      <Text style={s.sectionTitle}>Upcoming Tax Obligations ({calendar.length})</Text>
      <View style={[s.card, { marginBottom: 32 }]}>
        {calendar.length === 0 ? <Empty msg="No tax obligations" /> : calendar.slice(0, 10).map((item, i) => (
          <View key={item.id || i} style={[s.row, i < Math.min(calendar.length, 10) - 1 && s.border]}>
            <View style={{ flex: 1 }}>
              <Text style={s.main}>{item.taxType?.toUpperCase() || 'TAX'} — {item.description || item.period || ''}</Text>
              <Text style={s.sub}>Due: {item.dueDate?.slice(0, 10)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {item.amount != null && <Text style={s.amount}>{fmt(item.amount)}</Text>}
              <View style={{ marginTop: 4 }}><StatusBadge status={item.status || 'pending'} /></View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────── TAX RATES ─────────────────────────── */
function TaxRatesTab({ tenantId }: { tenantId: string }) {
  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', rate: '', taxType: 'vat' });

  const load = useCallback(async () => {
    try {
      const d = await gql<any>(`query{taxProfiles{id name code taxType calculationMethod isActive appliesTo jurisdiction description}}`, {});
      const raw = d?.taxProfiles;
      setRates(Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []));
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.name) { Alert.alert('Error', 'Name required'); return; }
    setSaving(true);
    try {
      const data = { name: form.name, rate: parseFloat(form.rate) || 0, taxType: form.taxType };
      await gql<any>(`mutation($t:UUID!,$d:GenericScalar!){saveTaxRateProfile(tenantId:$t,data:$d){ok error}}`, { t: tenantId, d: data });
      setShowCreate(false);
      setForm({ name: '', rate: '', taxType: 'vat' });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Tax Rates ({rates.length})</Text>
        <View style={[s.card, { marginBottom: 100 }]}>
          {rates.length === 0 ? <Empty msg="No tax rates configured" /> : rates.map((r, i) => (
            <View key={r.id} style={[s.row, i < rates.length - 1 && s.border]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.main}>{r.name}</Text>
                  {r.isDefault && <View style={s.defaultBadge}><Text style={s.defaultBadgeTxt}>Default</Text></View>}
                </View>
                <Text style={s.sub}>{r.taxType?.toUpperCase()}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.amount}>{r.rate}%</Text>
                <Text style={{ fontSize: 11, color: r.isActive ? '#16A34A' : '#9CA3AF', marginTop: 2 }}>{r.isActive ? 'Active' : 'Inactive'}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <FAB onPress={() => setShowCreate(true)} />
      <FormModal visible={showCreate} title="New Tax Rate" onClose={() => setShowCreate(false)} onSubmit={create} submitting={saving}>
        <Field label="Name" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} required placeholder="e.g. Standard VAT" />
        <Field label="Rate (%)" value={form.rate} onChangeText={v => setForm(f => ({ ...f, rate: v }))} keyboardType="decimal-pad" required />
        <SelectField label="Tax Type" value={form.taxType} onChange={v => setForm(f => ({ ...f, taxType: v }))} options={[{ label: 'VAT', value: 'vat' }, { label: 'Withholding', value: 'withholding' }, { label: 'Income', value: 'income' }]} />
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── VAT RETURNS ─────────────────────────── */
function VatReturnsTab({ tenantId }: { tenantId: string }) {
  return (
    <ScrollView style={{ flex: 1 }}>
      <View style={[s.card, { marginTop: 20, padding: 24, alignItems: 'center' }]}>
        <Text style={{ fontSize: 32, marginBottom: 12 }}>🌐</Text>
        <Text style={[s.main, { textAlign: 'center', marginBottom: 8 }]}>VAT Returns managed on web portal</Text>
        <Text style={[s.sub, { textAlign: 'center' }]}>
          Please use the ERP web application to create, review, and submit VAT returns to ZRA.
        </Text>
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────── SMART INVOICE ─────────────────────────── */
function SmartInvoiceTab({ tenantId }: { tenantId: string }) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await gql<any>(`query($t:UUID!){fiscalDocuments(tenantId:$t)}`, { t: tenantId });
      const raw = d?.fiscalDocuments;
      setInvoices(Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []));
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const sendToZra = async (inv: any) => {
    setSending(inv.id);
    try {
      await gql<any>(`mutation($id:UUID!){submitInvoiceForFiscalisation(invoiceId:$id){ok error}}`, { id: inv.id });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSending(null); }
  };

  const statusColor = (status: string) => {
    if (status === 'verified') return '#16A34A';
    if (status === 'rejected') return '#DC2626';
    if (status === 'sent') return GOLD;
    return '#6B7280';
  };

  if (loading) return <Loader />;
  return (
    <ScrollView style={{ flex: 1 }}>
      <Text style={s.sectionTitle}>ZRA e-Invoices ({invoices.length})</Text>
      <View style={[s.card, { marginBottom: 32 }]}>
        {invoices.length === 0 ? <Empty msg="No smart invoices" /> : invoices.map((inv, i) => (
          <View key={inv.id} style={[s.row, { alignItems: 'flex-start' }, i < invoices.length - 1 && s.border]}>
            <View style={{ flex: 1 }}>
              <Text style={s.main}>{inv.invoiceNumber}</Text>
              <Text style={s.sub}>{inv.customerName}</Text>
              <Text style={s.sub2}>{inv.createdAt?.slice(0, 10)}</Text>
              {inv.zraCode && (
                <View style={s.zraCodeBox}>
                  <Text style={s.zraCodeLabel}>ZRA Code</Text>
                  <Text style={s.zraCode}>{inv.zraCode}</Text>
                </View>
              )}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              <Text style={s.amount}>{fmt(inv.amount)}</Text>
              <Text style={[s.sub, { color: statusColor(inv.status), fontWeight: '700' }]}>{inv.status?.toUpperCase()}</Text>
              {inv.status === 'pending' && (
                <TouchableOpacity
                  style={[s.actionBtn, { paddingHorizontal: 12, paddingVertical: 7, opacity: sending === inv.id ? 0.5 : 1 }]}
                  onPress={() => sendToZra(inv)}
                  disabled={sending === inv.id}
                  activeOpacity={0.8}
                >
                  <Text style={[s.actionBtnTxt, { fontSize: 12 }]}>{sending === inv.id ? 'Sending…' : 'Send to ZRA'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────── TAX CALENDAR ─────────────────────────── */
function TaxCalendarTab({ tenantId }: { tenantId: string }) {
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await gql<any>(`query($t:UUID!){taxCalendar(tenantId:$t)}`, { t: tenantId });
      const raw = d?.taxCalendar;
      const parsed = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
      const list = parsed.sort((a: any, b: any) => (a.dueDate || '').localeCompare(b.dueDate || ''));
      setDeadlines(list);
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const urgencyColor = (dueDate: string, status: string) => {
    if (status === 'filed') return '#16A34A';
    const now = new Date();
    const due = new Date(dueDate);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return '#DC2626';
    if (diffDays <= 7) return '#F59E0B';
    return NAVY;
  };

  const urgencyLabel = (dueDate: string, status: string) => {
    if (status === 'filed') return 'Filed';
    const now = new Date();
    const due = new Date(dueDate);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return 'Due today';
    if (diffDays <= 7) return `${diffDays}d left`;
    return `${diffDays}d`;
  };

  if (loading) return <Loader />;
  return (
    <ScrollView style={{ flex: 1 }}>
      <Text style={s.sectionTitle}>Upcoming Tax Deadlines ({deadlines.length})</Text>
      <View style={[s.card, { marginBottom: 32 }]}>
        {deadlines.length === 0 ? <Empty msg="No upcoming deadlines" /> : deadlines.map((d, i) => {
          const color = urgencyColor(d.dueDate, d.status);
          return (
            <View key={d.id} style={[s.row, i < deadlines.length - 1 && s.border]}>
              <View style={[s.urgencyBar, { backgroundColor: color }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{d.taxType?.toUpperCase()}</Text>
                <Text style={s.sub}>{d.description}</Text>
                <Text style={s.sub2}>{d.dueDate?.slice(0, 10)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.urgencyLabel, { color }]}>{urgencyLabel(d.dueDate, d.status)}</Text>
                <StatusBadge status={d.status} />
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────── ROOT ─────────────────────────── */
export default function TaxHubScreen() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id || '';
  const [tab, setTab] = useState('overview');
  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      <ModuleTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'overview' && <OverviewTab tenantId={tenantId} />}
      {tab === 'rates' && <TaxRatesTab tenantId={tenantId} />}
      {tab === 'vat' && <VatReturnsTab tenantId={tenantId} />}
      {tab === 'einvoice' && <SmartInvoiceTab tenantId={tenantId} />}
      {tab === 'calendar' && <TaxCalendarTab tenantId={tenantId} />}
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  empty: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, marginHorizontal: 16, marginTop: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  border: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  main: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  sub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  sub2: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  amount: { fontSize: 14, fontWeight: '700', color: NAVY },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: NAVY, marginHorizontal: 16, marginTop: 16, marginBottom: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#fff' },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: NAVY },
  modalClose: { fontSize: 18, color: '#6B7280', padding: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  detailLabel: { fontSize: 13, color: '#6B7280' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#1F2937', flex: 1, textAlign: 'right' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16 },
  actionBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, backgroundColor: NAVY },
  actionBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8 },
  summaryCell: { width: '50%', paddingVertical: 10, paddingHorizontal: 4 },
  summaryLabel: { fontSize: 11, color: '#6B7280', marginBottom: 4 },
  summaryValue: { fontSize: 15, fontWeight: '800', color: NAVY },
  defaultBadge: { backgroundColor: '#EEF2FF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  defaultBadgeTxt: { fontSize: 10, fontWeight: '700', color: '#4F46E5' },
  urgencyBar: { width: 4, borderRadius: 2, marginRight: 12, alignSelf: 'stretch' },
  urgencyLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  zraCodeBox: { marginTop: 6, backgroundColor: '#F0FDF4', borderRadius: 6, padding: 6 },
  zraCodeLabel: { fontSize: 10, color: '#16A34A', fontWeight: '600' },
  zraCode: { fontSize: 12, color: '#166534', fontWeight: '700', fontFamily: 'monospace' },
});
