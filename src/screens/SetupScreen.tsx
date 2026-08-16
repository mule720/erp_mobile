import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet,
  TouchableOpacity, Alert, TextInput,
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

const TABS = [
  { key: 'company', label: 'Company' },
  { key: 'users', label: 'Users' },
  { key: 'roles', label: 'Roles' },
  { key: 'import', label: 'Import' },
  { key: 'coa', label: 'Chart of Accounts' },
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

/* ─────────────────────────── COMPANY ─────────────────────────── */
function CompanyTab({ tenantId }: { tenantId: string }) {
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', registrationNumber: '', taxNumber: '',
    address: '', phone: '', email: '', currency: 'ZMW',
  });

  const load = useCallback(async () => {
    try {
      const d = await gql<any>(`query($t:UUID!){tenant(id:$t){id name registrationNumber taxId address phone email}}`, { t: tenantId });
      const t = d?.tenant;
      if (t) {
        setCompany(t);
        setForm({
          name: t.name || '',
          registrationNumber: t.registrationNumber || '',
          taxNumber: t.taxId || '',
          address: t.address || '',
          phone: t.phone || '',
          email: t.email || '',
          currency: 'ZMW',
        });
      }
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.name) { Alert.alert('Error', 'Company name required'); return; }
    setSaving(true);
    try {
      await gql<any>(`mutation($t:UUID!,$d:GenericScalar!){updateTenant(tenantId:$t,data:$d){ok error}}`, { t: tenantId, d: form });
      setShowEdit(false); load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  if (loading) return <Loader />;

  return (
    <ScrollView style={{ flex: 1 }}>
      {/* Logo / initial circle */}
      <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 8 }}>
        <View style={s.logoCircle}>
          <Text style={s.logoTxt}>{company?.name?.[0]?.toUpperCase() || '?'}</Text>
        </View>
        <Text style={s.companyName}>{company?.name || 'Company'}</Text>
        {company?.currency && <Text style={s.sub}>{company.currency}</Text>}
      </View>

      <Text style={s.sectionTitle}>Company Information</Text>
      <View style={s.card}>
        {[
          ['Registration No.', company?.registrationNumber],
          ['Tax Number (TPIN)', company?.taxNumber],
          ['Address', company?.address],
          ['Phone', company?.phone],
          ['Email', company?.email],
          ['Currency', company?.currency],
        ].filter(([, v]) => v).map(([l, v]) => (
          <View key={l} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
            <Text style={s.detailLabel}>{l}</Text>
            <Text style={s.detailValue}>{v}</Text>
          </View>
        ))}
      </View>

      <View style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 32 }}>
        <ActionBtn label="Edit Company Info" onPress={() => setShowEdit(true)} />
      </View>

      <FormModal visible={showEdit} title="Edit Company Info" onClose={() => setShowEdit(false)} onSubmit={save} submitting={saving}>
        <Field label="Company Name" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} required />
        <Field label="Registration Number" value={form.registrationNumber} onChangeText={v => setForm(f => ({ ...f, registrationNumber: v }))} />
        <Field label="Tax Number (TPIN)" value={form.taxNumber} onChangeText={v => setForm(f => ({ ...f, taxNumber: v }))} />
        <Field label="Address" value={form.address} onChangeText={v => setForm(f => ({ ...f, address: v }))} multiline />
        <Field label="Phone" value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} keyboardType="phone-pad" />
        <Field label="Email" value={form.email} onChangeText={v => setForm(f => ({ ...f, email: v }))} keyboardType="email-address" />
        <SelectField label="Currency" value={form.currency} onChange={v => setForm(f => ({ ...f, currency: v }))} options={[
          { label: 'ZMW — Zambian Kwacha', value: 'ZMW' },
          { label: 'USD — US Dollar', value: 'USD' },
          { label: 'ZAR — South African Rand', value: 'ZAR' },
          { label: 'EUR — Euro', value: 'EUR' },
          { label: 'GBP — British Pound', value: 'GBP' },
        ]} />
      </FormModal>
    </ScrollView>
  );
}

/* ─────────────────────────── USERS ─────────────────────────── */
function UsersTab({ tenantId }: { tenantId: string }) {
  const { isAdmin } = useRole();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: '', roles: 'employee' });

  const load = useCallback(async () => {
    try {
      const d = await gql<any>(`query($t:UUID!){tenantUsers(tenantId:$t){id firstName lastName email fullName isActive}}`, { t: tenantId });
      setUsers(d?.tenantUsers || []);
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const invite = async () => {
    if (!form.email) { Alert.alert('Error', 'Email required'); return; }
    setSaving(true);
    try {
      await gql<any>(`mutation($t:UUID!,$e:String!,$r:[String]!){inviteUser(tenantId:$t,email:$e,roles:$r){ok error}}`, { t: tenantId, e: form.email, r: [form.roles] });
      setShowInvite(false); setForm({ email: '', roles: 'employee' }); load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const toggleStatus = async (userId: string) => {
    try {
      await gql<any>(`mutation($id:UUID!){deactivateUser(userId:$id){ok error}}`, { id: userId });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  if (loading) return <Loader />;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Users ({users.length})</Text>
        <View style={[s.card, { marginBottom: 100 }]}>
          {users.length === 0 ? <Empty msg="No users" /> : users.map((u, i) => {
            const name = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown';
            const email = u.email;
            const roles = '';
            return (
              <View key={u.id} style={[s.row, i < users.length - 1 && s.border]}>
                <View style={[s.avatar, { backgroundColor: u.isActive ? '#EFF6FF' : '#F3F4F6' }]}>
                  <Text style={[s.avatarTxt, { color: u.isActive ? '#2563EB' : '#9CA3AF' }]}>
                    {name?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.main}>{name}</Text>
                  {email && <Text style={s.sub}>{email}</Text>}
                  {roles && <Text style={s.sub2}>{roles}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <StatusBadge status={u.isActive ? 'active' : 'inactive'} />
                  {isAdmin && (
                    <TouchableOpacity onPress={() => toggleStatus(u.id)} style={s.toggleBtn}>
                      <Text style={s.toggleBtnTxt}>{u.isActive ? 'Deactivate' : 'Activate'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
      {isAdmin && <FAB onPress={() => setShowInvite(true)} />}

      <FormModal visible={showInvite} title="Invite User" onClose={() => setShowInvite(false)} onSubmit={invite} submitting={saving} submitLabel="Send Invite">
        <Field label="Email Address" value={form.email} onChangeText={v => setForm(f => ({ ...f, email: v }))} keyboardType="email-address" required placeholder="user@example.com" />
        <SelectField label="Role" value={form.roles} onChange={v => setForm(f => ({ ...f, roles: v }))} options={[
          { label: 'Admin', value: 'admin' },
          { label: 'Accountant', value: 'accountant' },
          { label: 'Manager', value: 'manager' },
          { label: 'Employee', value: 'employee' },
          { label: 'Viewer', value: 'viewer' },
        ]} />
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── ROLES ─────────────────────────── */
function RolesTab({ tenantId }: { tenantId: string }) {
  const { isAdmin } = useRole();
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    (async () => {
      try {
        const d = await gql<any>(`query($t:UUID!){roles(tenantId:$t){id name description permissions{name}}}`, { t: tenantId });
        setRoles(d?.roles || []);
      } catch {} finally { setLoading(false); }
    })();
  }, [tenantId, isAdmin]);

  if (!isAdmin) {
    return (
      <View style={s.center}>
        <Text style={[s.empty, { color: '#DC2626' }]}>Admin access required to manage roles.</Text>
      </View>
    );
  }

  if (loading) return <Loader />;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Roles ({roles.length})</Text>
        <View style={[s.card, { marginBottom: 32 }]}>
          {roles.length === 0 ? <Empty msg="No roles defined" /> : roles.map((r, i) => (
            <TouchableOpacity key={r.id} style={[s.row, i < roles.length - 1 && s.border]} onPress={() => setSelected(r)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{r.name}</Text>
                {r.description && <Text style={s.sub} numberOfLines={1}>{r.description}</Text>}
              </View>
              <View style={s.permBadge}>
                <Text style={s.permBadgeTxt}>{r.permissions?.length ?? 0} perms</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {selected && (
        <View style={s.permSheet}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: NAVY }}>{selected.name}</Text>
            <TouchableOpacity onPress={() => setSelected(null)}><Text style={{ color: '#6B7280', fontSize: 16 }}>✕</Text></TouchableOpacity>
          </View>
          {selected.description && <Text style={[s.sub, { marginBottom: 8 }]}>{selected.description}</Text>}
          <ScrollView style={{ maxHeight: 200 }}>
            {(selected.permissions || []).length === 0 ? <Empty msg="No permissions" /> : (selected.permissions || []).map((p: any, i: number) => (
              <Text key={i} style={[s.sub, { paddingVertical: 3 }]}>- {p.name}</Text>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

/* ─────────────────────────── IMPORT ─────────────────────────── */
function ImportTab({ tenantId }: { tenantId: string }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = await gql<any>(`query($t:UUID!){importHistory(tenantId:$t){id dataType status recordsImported createdAt}}`, { t: tenantId });
        setHistory(d?.importHistory || []);
      } catch {} finally { setLoading(false); }
    })();
  }, [tenantId]);

  const IMPORT_TYPES = [
    { label: 'Customers', desc: 'Import customer records from CSV' },
    { label: 'Products', desc: 'Import product catalog from CSV' },
    { label: 'Suppliers', desc: 'Import supplier list from CSV' },
    { label: 'Chart of Accounts', desc: 'Import account codes from CSV' },
    { label: 'Employees', desc: 'Import employee data from CSV' },
  ];

  return (
    <ScrollView style={{ flex: 1 }}>
      <Text style={s.sectionTitle}>Import Data</Text>
      <View style={s.card}>
        {IMPORT_TYPES.map((t, i) => (
          <View key={t.label} style={[s.row, i < IMPORT_TYPES.length - 1 && s.border, { gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.main}>{t.label}</Text>
              <Text style={s.sub}>{t.desc}</Text>
            </View>
            <TouchableOpacity
              style={[s.actionBtn, { paddingHorizontal: 12, paddingVertical: 7 }]}
              onPress={() => Alert.alert('CSV Import', 'Use the web app for CSV import. Mobile file upload is not supported.')}
            >
              <Text style={[s.actionBtnTxt, { fontSize: 12 }]}>Import CSV</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <Text style={s.sectionTitle}>Recent Imports</Text>
      <View style={[s.card, { marginBottom: 32 }]}>
        {loading ? <Loader /> : history.length === 0 ? <Empty msg="No import history" /> : history.map((h, i) => (
          <View key={h.id} style={[s.row, i < history.length - 1 && s.border]}>
            <View style={{ flex: 1 }}>
              <Text style={s.main}>{h.dataType}</Text>
              <Text style={s.sub}>{h.createdAt?.slice(0, 10)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {h.recordsImported != null && <Text style={s.sub}>{h.recordsImported} records</Text>}
              <View style={{ marginTop: 4 }}><StatusBadge status={h.status} /></View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────── CHART OF ACCOUNTS ─────────────────────────── */
function ChartOfAccountsTab({ tenantId }: { tenantId: string }) {
  const { isAdmin, isAccountant } = useRole();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', accountType: 'asset', parentId: '' });

  const load = useCallback(async () => {
    try {
      const d = await gql<any>(`{accountingAccounts}`, {});
      const raw = d?.accountingAccounts;
      const list = Array.isArray(raw) ? raw : (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : []);
      setAccounts(list); setFiltered(list);
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let list = accounts;
    if (filterType !== 'all') list = list.filter(a => a.accountType === filterType);
    if (search) list = list.filter(a => a.name?.toLowerCase().includes(search.toLowerCase()) || a.code?.toLowerCase().includes(search.toLowerCase()));
    setFiltered(list);
  }, [search, filterType, accounts]);

  const create = async () => {
    if (!form.code || !form.name) { Alert.alert('Error', 'Code and name required'); return; }
    setSaving(true);
    try {
      await gql<any>(
        `mutation($t:UUID!,$code:String!,$name:String!,$type:String!,$pid:UUID){createAccount(tenantId:$t,code:$code,name:$name,accountType:$type,parentId:$pid){ok error}}`,
        { t: tenantId, code: form.code, name: form.name, type: form.accountType, pid: form.parentId || undefined }
      );
      setShowCreate(false); setForm({ code: '', name: '', accountType: 'asset', parentId: '' }); load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const TYPE_COLORS: Record<string, string> = {
    asset: '#2563EB', liability: '#DC2626', equity: '#7C3AED', revenue: '#16A34A', expense: '#D97706',
  };

  const ACCOUNT_TYPES = [
    { label: 'All', value: 'all' },
    { label: 'Asset', value: 'asset' },
    { label: 'Liability', value: 'liability' },
    { label: 'Equity', value: 'equity' },
    { label: 'Revenue', value: 'revenue' },
    { label: 'Expense', value: 'expense' },
  ];

  if (loading) return <Loader />;

  return (
    <View style={{ flex: 1 }}>
      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search accounts…"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 12, paddingBottom: 8 }} contentContainerStyle={{ gap: 6 }}>
        {ACCOUNT_TYPES.map(t => (
          <TouchableOpacity key={t.value} onPress={() => setFilterType(t.value)}
            style={[s.chip, filterType === t.value && { backgroundColor: NAVY }]}>
            <Text style={[s.chipTxt, filterType === t.value && { color: '#fff' }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Accounts ({filtered.length})</Text>
        <View style={[s.card, { marginBottom: 100 }]}>
          {filtered.length === 0 ? <Empty msg="No accounts found" /> : filtered.map((a, i) => (
            <View key={a.id} style={[s.row, i < filtered.length - 1 && s.border]}>
              <View style={[s.typeDot, { backgroundColor: TYPE_COLORS[a.accountType] || '#9CA3AF' }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{a.code} – {a.name}</Text>
                <Text style={s.sub2}>{a.accountType?.toUpperCase()}</Text>
              </View>
              {a.balance != null && (
                <Text style={s.amount}>K{Number(a.balance).toLocaleString()}</Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      {(isAdmin || isAccountant) && (
        <FAB onPress={() => setShowCreate(true)} />
      )}

      <FormModal visible={showCreate} title="New Account" onClose={() => setShowCreate(false)} onSubmit={create} submitting={saving}>
        <Section title="Account Details" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Field label="Code" value={form.code} onChangeText={v => setForm(f => ({ ...f, code: v }))} required placeholder="e.g. 1001" /></View>
          <View style={{ flex: 2 }}><Field label="Name" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} required placeholder="Account name" /></View>
        </View>
        <SelectField label="Account Type" value={form.accountType} onChange={v => setForm(f => ({ ...f, accountType: v }))} options={[
          { label: 'Asset', value: 'asset' },
          { label: 'Liability', value: 'liability' },
          { label: 'Equity', value: 'equity' },
          { label: 'Revenue', value: 'revenue' },
          { label: 'Expense', value: 'expense' },
        ]} />
        <SelectField
          label="Parent Account (optional)"
          value={form.parentId}
          onChange={v => setForm(f => ({ ...f, parentId: v }))}
          options={[{ label: '— None —', value: '' }, ...accounts.map(a => ({ label: `${a.code} – ${a.name}`, value: a.id }))]}
        />
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── MAIN SCREEN ─────────────────────────── */
export default function SetupScreen() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id || '';
  const [tab, setTab] = useState('company');

  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      <ModuleTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'company' && <CompanyTab tenantId={tenantId} />}
      {tab === 'users' && <UsersTab tenantId={tenantId} />}
      {tab === 'roles' && <RolesTab tenantId={tenantId} />}
      {tab === 'import' && <ImportTab tenantId={tenantId} />}
      {tab === 'coa' && <ChartOfAccountsTab tenantId={tenantId} />}
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
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: NAVY, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  logoTxt: { fontSize: 32, fontWeight: '800', color: GOLD },
  companyName: { fontSize: 20, fontWeight: '800', color: NAVY, marginBottom: 2 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  detailLabel: { fontSize: 13, color: '#6B7280' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#1F2937', flex: 1, textAlign: 'right', marginLeft: 8 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16 },
  actionBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, backgroundColor: NAVY },
  actionBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  toggleBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#D1D5DB' },
  toggleBtnTxt: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  permBadge: { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  permBadgeTxt: { fontSize: 11, color: '#2563EB', fontWeight: '700' },
  permSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#E5E7EB' },
  chipTxt: { fontSize: 13, fontWeight: '600', color: '#374151' },
  typeDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  searchInput: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' },
});
