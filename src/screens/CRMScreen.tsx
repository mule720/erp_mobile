import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet,
  TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { gql } from '../api/graphql';
import { useAuth } from '../store/AuthContext';
import ModuleTabs from '../components/ModuleTabs';
import StatusBadge from '../components/StatusBadge';
import FormModal from '../components/FormModal';
import { Field, SelectField, Section } from '../components/Field';
import FAB from '../components/FAB';

const NAVY = '#1E3A5F';
const GOLD = '#C9A84C';
const fmt = (n: any, cur = 'ZMW') => new Intl.NumberFormat('en-ZM', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(Number(n ?? 0));

const TABS = [
  { key: 'customers', label: 'Customers' },
  { key: 'leads', label: 'Leads' },
];

function Loader() { return <View style={s.center}><ActivityIndicator size="large" color={NAVY} /></View>; }
function Empty({ msg = 'No records' }: { msg?: string }) { return <Text style={s.empty}>{msg}</Text>; }

/* ─────────────────────────── CUSTOMERS ─────────────────────────── */
function CustomersTab({ tenantId }: { tenantId: string }) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', address: '', taxNumber: '',
    creditLimit: '', currency: 'ZMW', paymentTerms: '30',
  });

  const load = useCallback(async () => {
    try {
      const d = await gql<any>(`query($t:UUID!){customers(tenantId:$t,limit:200){id name email phone address creditLimit tpin paymentTermsDays status}}`, { t: tenantId });
      const list = d?.customers || [];
      setCustomers(list); setFiltered(list);
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setFiltered(customers.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()))); }, [search, customers]);

  const create = async () => {
    if (!form.name) { Alert.alert('Error', 'Name required'); return; }
    setSaving(true);
    try {
      const input = {
        name: form.name, email: form.email || undefined, phone: form.phone || undefined,
        company: form.address || undefined,
      };
      await gql<any>(`mutation($t:UUID!,$i:CustomerInput!){createCustomer(tenantId:$t,input:$i){ok error}}`, { t: tenantId, i: input });
      setShowCreate(false);
      setForm({ name: '', email: '', phone: '', address: '', taxNumber: '', creditLimit: '', currency: 'ZMW', paymentTerms: '30' });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <View style={s.searchWrap}>
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search customers…" placeholderTextColor="#9CA3AF" />
      </View>
      <ScrollView style={{ flex: 1 }}>
        <View style={[s.card, { marginBottom: 100 }]}>
          {filtered.length === 0 ? <Empty msg="No customers" /> : filtered.map((c, i) => (
            <TouchableOpacity key={c.id} style={[s.row, i < filtered.length - 1 && s.border]} onPress={() => setSelected(c)} activeOpacity={0.7}>
              <View style={[s.avatar, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[s.avatarTxt, { color: '#D97706' }]}>{c.name?.[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{c.name}</Text>
                {c.email && <Text style={s.sub}>{c.email}</Text>}
                {c.phone && <Text style={s.sub2}>{c.phone}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {c.balance != null && <Text style={[s.amount, { color: c.balance < 0 ? '#DC2626' : NAVY }]}>{fmt(c.balance, c.currency)}</Text>}
                {c.creditLimit > 0 && <Text style={s.sub2}>Limit: {fmt(c.creditLimit, c.currency)}</Text>}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <FAB onPress={() => setShowCreate(true)} />

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>{selected?.name}</Text>
          <TouchableOpacity onPress={() => setSelected(null)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        {selected && (
          <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
            <View style={s.avatarBig}>
              <View style={[s.avatarCircle, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[s.avatarBigTxt, { color: '#D97706' }]}>{selected.name?.[0]?.toUpperCase()}</Text>
              </View>
              <Text style={s.customerName}>{selected.name}</Text>
              {selected.email && <Text style={s.customerEmail}>{selected.email}</Text>}
            </View>
            <View style={[s.card, { marginTop: 0 }]}>
              {[['Phone', selected.phone], ['Address', selected.address], ['Tax Number', selected.taxNumber], ['Payment Terms', selected.paymentTerms ? `${selected.paymentTerms} days` : undefined], ['Currency', selected.currency], ['Balance', selected.balance != null ? fmt(selected.balance, selected.currency) : undefined], ['Credit Limit', selected.creditLimit > 0 ? fmt(selected.creditLimit, selected.currency) : undefined]].filter(([, v]) => v).map(([l, v]) => (
                <View key={l} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                  <Text style={s.detailLabel}>{l}</Text><Text style={s.detailValue}>{v}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </Modal>

      <FormModal visible={showCreate} title="New Customer" onClose={() => setShowCreate(false)} onSubmit={create} submitting={saving}>
        <Field label="Name" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} required />
        <Field label="Email" value={form.email} onChangeText={v => setForm(f => ({ ...f, email: v }))} keyboardType="email-address" />
        <Field label="Phone" value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} />
        <Field label="Address" value={form.address} onChangeText={v => setForm(f => ({ ...f, address: v }))} multiline />
        <Field label="Tax Number (TPIN)" value={form.taxNumber} onChangeText={v => setForm(f => ({ ...f, taxNumber: v }))} />
        <Field label="Credit Limit" value={form.creditLimit} onChangeText={v => setForm(f => ({ ...f, creditLimit: v }))} keyboardType="decimal-pad" />
        <Field label="Payment Terms (days)" value={form.paymentTerms} onChangeText={v => setForm(f => ({ ...f, paymentTerms: v }))} keyboardType="numeric" />
        <SelectField label="Currency" value={form.currency} onChange={v => setForm(f => ({ ...f, currency: v }))} options={[{ label: 'ZMW', value: 'ZMW' }, { label: 'USD', value: 'USD' }]} />
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── LEADS ─────────────────────────── */
function LeadsTab({ tenantId }: { tenantId: string }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', companyName: '', email: '', phone: '', source: 'manual',
    estimatedValue: '', assignedToId: '', notes: '',
  });

  const load = useCallback(async () => {
    try {
      const [lData, eData] = await Promise.all([
        gql<any>(`query($t:UUID!){leads(tenantId:$t,limit:200){id name source score stage estimatedValue createdAt}}`, { t: tenantId }),
        gql<any>(`query($t:UUID!){employees(tenantId:$t,limit:200){id firstName lastName}}`, { t: tenantId }),
      ]);
      setLeads((lData?.leads || []).filter(Boolean));
      setEmployees((eData?.employees || []).filter(Boolean));
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const stats = {
    total: leads.length,
    qualified: leads.filter(l => l.stage === 'qualified').length,
    converted: leads.filter(l => l.stage === 'converted').length,
  };

  const create = async () => {
    if (!form.name) { Alert.alert('Error', 'Lead name required'); return; }
    setSaving(true);
    try {
      const input = {
        name: form.name, source: form.source,
        estimatedValue: parseFloat(form.estimatedValue) || undefined,
      };
      await gql<any>(`mutation($t:UUID!,$i:LeadInput!){createLead(tenantId:$t,input:$i){ok error}}`, { t: tenantId, i: input });
      setShowCreate(false);
      setForm({ name: '', companyName: '', email: '', phone: '', source: 'manual', estimatedValue: '', assignedToId: '', notes: '' });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const updateStatus = async (lead: any, status: string) => {
    try {
      await gql<any>(`mutation($id:UUID!,$s:String!){updateLead(id:$id,input:{stage:$s}){ok error}}`, { id: lead.id, s: status });
      setSelected(null); load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const STATUS_COLOR: Record<string, string> = { new: '#3B82F6', contacted: '#8B5CF6', qualified: '#F59E0B', converted: '#16A34A', lost: '#6B7280' };

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingTop: 12, gap: 8 }}>
        {[['Total', stats.total, '#3B82F6'], ['Qualified', stats.qualified, '#F59E0B'], ['Converted', stats.converted, '#16A34A']].map(([l, v, c]) => (
          <View key={l as string} style={[s.statCard, { borderTopColor: c as string }]}>
            <Text style={[s.statNum, { color: c as string }]}>{v}</Text>
            <Text style={s.statLabel}>{l}</Text>
          </View>
        ))}
      </View>
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>All Leads</Text>
        <View style={[s.card, { marginBottom: 100 }]}>
          {leads.length === 0 ? <Empty msg="No leads" /> : leads.map((lead, i) => (
            <TouchableOpacity key={lead.id} style={[s.row, i < leads.length - 1 && s.border]} onPress={() => setSelected(lead)} activeOpacity={0.7}>
              <View style={[s.leadDot, { backgroundColor: STATUS_COLOR[lead.stage] || '#6B7280' }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{lead.name}</Text>
                {lead.source && <Text style={s.sub}>{lead.source}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {lead.estimatedValue && <Text style={s.amount}>{fmt(lead.estimatedValue)}</Text>}
                <StatusBadge status={lead.stage} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <FAB onPress={() => setShowCreate(true)} />

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>{selected?.name}</Text>
          <TouchableOpacity onPress={() => setSelected(null)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        {selected && (
          <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
            <View style={[s.card, { marginTop: 12 }]}>
              {[['Source', selected.source], ['Stage', selected.stage], ['Score', selected.score], ['Est. Value', selected.estimatedValue ? fmt(selected.estimatedValue) : undefined]].filter(([, v]) => v).map(([l, v]) => (
                <View key={l} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                  <Text style={s.detailLabel}>{l}</Text><Text style={s.detailValue}>{v}</Text>
                </View>
              ))}
            </View>
            <Text style={[s.sectionTitle, { marginTop: 16 }]}>Update Status</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 }}>
              {['contacted', 'qualified', 'converted', 'lost'].map(status => (
                <TouchableOpacity key={status} style={[s.statusBtn, { backgroundColor: STATUS_COLOR[status] }]} onPress={() => updateStatus(selected, status)}>
                  <Text style={s.statusBtnTxt}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
      </Modal>

      <FormModal visible={showCreate} title="New Lead" onClose={() => setShowCreate(false)} onSubmit={create} submitting={saving}>
        <Field label="Lead Name / Contact" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} required />
        <Field label="Company Name" value={form.companyName} onChangeText={v => setForm(f => ({ ...f, companyName: v }))} />
        <Field label="Email" value={form.email} onChangeText={v => setForm(f => ({ ...f, email: v }))} keyboardType="email-address" />
        <Field label="Phone" value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} />
        <SelectField label="Source" value={form.source} onChange={v => setForm(f => ({ ...f, source: v }))} options={[
          { label: 'Manual', value: 'manual' }, { label: 'Referral', value: 'referral' },
          { label: 'Website', value: 'website' }, { label: 'Social Media', value: 'social_media' },
          { label: 'Cold Call', value: 'cold_call' },
        ]} />
        <Field label="Estimated Value (ZMW)" value={form.estimatedValue} onChangeText={v => setForm(f => ({ ...f, estimatedValue: v }))} keyboardType="decimal-pad" />
        <SelectField label="Assign To" value={form.assignedToId} onChange={v => setForm(f => ({ ...f, assignedToId: v }))} options={employees.map(e => ({ label: `${e.firstName} ${e.lastName}`, value: e.id }))} />
        <Field label="Notes" value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} multiline />
      </FormModal>
    </View>
  );
}

export default function CRMScreen() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id || '';
  const [tab, setTab] = useState('customers');
  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      <ModuleTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'customers' && <CustomersTab tenantId={tenantId} />}
      {tab === 'leads' && <LeadsTab tenantId={tenantId} />}
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
  avatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarTxt: { fontSize: 15, fontWeight: '700' },
  avatarBig: { alignItems: 'center', padding: 24, backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 16 },
  avatarCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarBigTxt: { fontSize: 28, fontWeight: '800' },
  customerName: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  customerEmail: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#fff' },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: NAVY },
  modalClose: { fontSize: 18, color: '#6B7280', padding: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  detailLabel: { fontSize: 13, color: '#6B7280' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  searchInput: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12, borderTopWidth: 3, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, elevation: 1 },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, color: '#6B7280', fontWeight: '700', marginTop: 2 },
  leadDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  statusBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  statusBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
