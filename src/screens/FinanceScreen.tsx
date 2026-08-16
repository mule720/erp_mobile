import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet,
  TouchableOpacity, Modal, Alert, RefreshControl, TextInput,
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
const fmt = (n: any) => Number(n ?? 0).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK = (n: any) => `K${Number(n ?? 0).toLocaleString()}`;

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'journals', label: 'Journals' },
  { key: 'payments', label: 'Payments' },
  { key: 'expenses', label: 'Expense Claims' },
  { key: 'petty', label: 'Petty Cash' },
  { key: 'bankrec', label: 'Bank Rec' },
  { key: 'reports', label: 'Reports' },
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
  const [dash, setDash] = useState<any>(null);
  const [cashFlow, setCashFlow] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [dData, cfData, eData] = await Promise.all([
        gql<any>(`query{accountingDashboard}`, {}),
        gql<any>(`query($t:UUID!){cashFlowTrend(tenantId:$t,months:6){month operating investing financing netCash}}`, { t: tenantId }),
        gql<any>(`query($t:UUID!){expenseBreakdown(tenantId:$t){name amount percent accountId accountCode}}`, { t: tenantId }),
      ]);
      setDash(dData?.accountingDashboard);
      setCashFlow(cfData?.cashFlowTrend || []);
      setExpenses(eData?.expenseBreakdown || []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);
  if (loading) return <Loader />;

  const d = typeof dash === 'string' ? JSON.parse(dash) : (dash || {});
  const maxBar = Math.max(...cashFlow.map(m => Math.max(Number(m.operating || 0), Number(m.investing || 0), Number(m.financing || 0))), 1);

  return (
    <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[NAVY]} />}>
      {/* KPI cards */}
      <View style={s.kpiRow}>
        {[
          { label: 'Revenue', value: fmtK(d.totalRevenue ?? d.revenue), color: '#16A34A' },
          { label: 'Expenses', value: fmtK(d.totalExpenses ?? d.expenses), color: '#DC2626' },
          { label: 'Net Profit', value: fmtK(d.netProfit ?? d.profit), color: NAVY },
          { label: 'Cash Balance', value: fmtK(d.cashBalance ?? d.cash), color: GOLD },
        ].map(k => (
          <View key={k.label} style={s.kpi}>
            <Text style={s.kpiLabel}>{k.label}</Text>
            <Text style={[s.kpiValue, { color: k.color }]}>{k.value}</Text>
          </View>
        ))}
      </View>

      {/* AR/AP summary */}
      {(d.arBalance != null || d.apBalance != null) && (
        <View style={[s.card, { flexDirection: 'row', paddingVertical: 14 }]}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.kpiLabel}>Accounts Receivable</Text>
            <Text style={[s.kpiValue, { color: '#2563EB', fontSize: 16 }]}>{fmtK(d.arBalance ?? d.receivables)}</Text>
          </View>
          <View style={{ width: 1, backgroundColor: '#E5E7EB' }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.kpiLabel}>Accounts Payable</Text>
            <Text style={[s.kpiValue, { color: '#DC2626', fontSize: 16 }]}>{fmtK(d.apBalance ?? d.payables)}</Text>
          </View>
        </View>
      )}

      {/* Cash flow bars */}
      {cashFlow.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Cash Flow (6 months)</Text>
          <View style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 4, paddingVertical: 8 }}>
              {cashFlow.map((m, i) => {
                const opH = (Math.abs(Number(m.operating || 0)) / maxBar) * 64;
                const netH = (Math.abs(Number(m.netCash || 0)) / maxBar) * 64;
                const netPos = Number(m.netCash || 0) >= 0;
                return (
                  <View key={i} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 64 }}>
                      <View style={{ width: 6, height: Math.max(2, opH), backgroundColor: '#16A34A', borderRadius: 2 }} />
                      <View style={{ width: 6, height: Math.max(2, netH), backgroundColor: netPos ? '#3B82F6' : '#DC2626', borderRadius: 2 }} />
                    </View>
                    <Text style={{ fontSize: 8, color: '#9CA3AF', textAlign: 'center' }}>{m.month?.slice(0, 3)}</Text>
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: 16, paddingBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, backgroundColor: '#16A34A', borderRadius: 2 }} />
                <Text style={{ fontSize: 11, color: '#6B7280' }}>Inflow</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, backgroundColor: '#DC2626', borderRadius: 2 }} />
                <Text style={{ fontSize: 11, color: '#6B7280' }}>Outflow</Text>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Expense breakdown */}
      <Text style={s.sectionTitle}>Expense Breakdown</Text>
      <View style={[s.card, { marginBottom: 32 }]}>
        {expenses.length === 0 ? <Empty /> : expenses.slice(0, 8).map((e, i) => (
          <View key={i} style={[s.row, i < Math.min(expenses.length, 8) - 1 && s.border]}>
            <View style={{ flex: 1 }}>
              <Text style={s.main}>{e.name}</Text>
              {e.accountCode && <Text style={s.sub}>{e.accountCode}</Text>}
            </View>
            <Text style={s.amount}>{fmtK(e.amount)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────── JOURNALS ─────────────────────────── */
function JournalsTab({ tenantId }: { tenantId: string }) {
  const { isAdmin, isAccountant } = useRole();
  const [entries, setEntries] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: today(), description: '',
    lines: [{ accountId: '', debit: '', credit: '', description: '' }],
  });

  const load = useCallback(async () => {
    try {
      const [jData, aData] = await Promise.all([
        gql<any>(`query{accountingJournalEntries}`, {}),
        gql<any>(`query{accountingAccounts}`, {}),
      ]);
      const rawEntries = jData?.accountingJournalEntries;
      setEntries(Array.isArray(rawEntries) ? rawEntries : (typeof rawEntries === 'string' ? JSON.parse(rawEntries) : []));
      const rawAccounts = aData?.accountingAccounts;
      setAccounts(Array.isArray(rawAccounts) ? rawAccounts : (typeof rawAccounts === 'string' ? JSON.parse(rawAccounts) : []));
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const setLine = (i: number, k: string, v: string) =>
    setForm(f => ({ ...f, lines: f.lines.map((l, j) => j === i ? { ...l, [k]: v } : l) }));

  const saveJournal = async () => {
    if (!form.description) { Alert.alert('Error', 'Description required'); return; }
    setSaving(true);
    try {
      const data = {
        date: form.date,
        description: form.description,
        lines: form.lines.map(l => ({
          accountId: l.accountId,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          description: l.description,
        })),
      };
      await gql<any>(`mutation($t:UUID!,$d:GenericScalar!){saveJournalEntry(tenantId:$t,data:$d){ok error}}`, { t: tenantId, d: data });
      setShowCreate(false);
      setForm({ date: today(), description: '', lines: [{ accountId: '', debit: '', credit: '', description: '' }] });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const postJournal = async (journalId: string) => {
    try {
      await gql<any>(`mutation($id:UUID!){postJournalEntry(journalId:$id){ok error}}`, { id: journalId });
      setSelected(null); load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Journal Entries ({entries.length})</Text>
        <View style={[s.card, { marginBottom: 100 }]}>
          {entries.length === 0 ? <Empty msg="No journal entries" /> : entries.map((e, i) => (
            <TouchableOpacity key={e.id} style={[s.row, i < entries.length - 1 && s.border]} onPress={() => setSelected(e)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{e.reference || 'JE'} · {e.date?.slice(0, 10)}</Text>
                <Text style={s.sub} numberOfLines={1}>{e.description}</Text>
                <Text style={s.sub2}>Dr: K{fmt(e.totalDebit)} · Cr: K{fmt(e.totalCredit)}</Text>
              </View>
              <StatusBadge status={e.status || 'draft'} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <FAB onPress={() => setShowCreate(true)} />

      {/* Detail modal */}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Journal Entry</Text>
          <TouchableOpacity onPress={() => setSelected(null)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        {selected && (
          <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
            <View style={[s.card, { marginTop: 12 }]}>
              {[
                ['Reference', selected.reference],
                ['Date', selected.date?.slice(0, 10)],
                ['Description', selected.description],
                ['Total Debit', `K${fmt(selected.totalDebit)}`],
                ['Total Credit', `K${fmt(selected.totalCredit)}`],
                ['Status', selected.status],
                ['Posted By', selected.postedBy ? `${selected.postedBy.firstName} ${selected.postedBy.lastName}` : null],
              ].filter(([, v]) => v).map(([l, v]) => (
                <View key={l} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                  <Text style={s.detailLabel}>{l}</Text>
                  <Text style={s.detailValue}>{v}</Text>
                </View>
              ))}
            </View>
            {(isAdmin || isAccountant) && selected.status === 'draft' && (
              <View style={s.actionRow}>
                <ActionBtn label="Post Journal" color="#16A34A" onPress={() => postJournal(selected.id)} />
              </View>
            )}
          </ScrollView>
        )}
      </Modal>

      {/* Create journal modal */}
      <FormModal visible={showCreate} title="New Journal Entry" onClose={() => setShowCreate(false)} onSubmit={saveJournal} submitting={saving}>
        <Section title="Entry Details" />
        <Field label="Date" value={form.date} onChangeText={v => setForm(f => ({ ...f, date: v }))} required placeholder="YYYY-MM-DD" />
        <Field label="Description" value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} required multiline />
        <Section title="Line Items" />
        {form.lines.map((line, i) => (
          <View key={i} style={s.lineItem}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280' }}>Line {i + 1}</Text>
              {form.lines.length > 1 && (
                <TouchableOpacity onPress={() => setForm(f => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))}>
                  <Text style={{ color: '#DC2626', fontSize: 13 }}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
            <SelectField
              label="Account"
              value={line.accountId}
              onChange={v => setLine(i, 'accountId', v)}
              options={accounts.map(a => ({ label: `${a.code} – ${a.name}`, value: a.id }))}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Field label="Debit" value={line.debit} onChangeText={v => setLine(i, 'debit', v)} keyboardType="decimal-pad" placeholder="0.00" /></View>
              <View style={{ flex: 1 }}><Field label="Credit" value={line.credit} onChangeText={v => setLine(i, 'credit', v)} keyboardType="decimal-pad" placeholder="0.00" /></View>
            </View>
            <Field label="Line Description" value={line.description} onChangeText={v => setLine(i, 'description', v)} placeholder="Optional" />
          </View>
        ))}
        <TouchableOpacity style={s.addLineBtn} onPress={() => setForm(f => ({ ...f, lines: [...f.lines, { accountId: '', debit: '', credit: '', description: '' }] }))}>
          <Text style={s.addLineTxt}>+ Add Line</Text>
        </TouchableOpacity>
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── PAYMENTS ─────────────────────────── */
function PaymentsTab({ tenantId }: { tenantId: string }) {
  const [customerPayments, setCustomerPayments] = useState<any[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'customer' | 'supplier'>('customer');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customerId: '', customerName: '', amount: '', date: today(), method: 'cash', reference: '' });

  const load = useCallback(async () => {
    try {
      const [cpData, spData] = await Promise.all([
        gql<any>(`query($t:UUID!){customerPayments(tenantId:$t){id amount date customerName reference paymentMethod}}`, { t: tenantId }),
        gql<any>(`query($t:UUID!){supplierBills(tenantId:$t,limit:100){id totalAmount dueDate status supplier{name} invoiceDate}}`, { t: tenantId }),
      ]);
      setCustomerPayments(cpData?.customerPayments || []);
      setSupplierPayments((spData?.supplierBills || []).map((b: any) => ({
        id: b.id,
        supplierName: b.supplier?.name,
        amount: b.totalAmount,
        date: b.invoiceDate || b.dueDate,
        status: b.status,
      })));
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const recordPayment = async () => {
    if (!form.amount) { Alert.alert('Error', 'Amount required'); return; }
    setSaving(true);
    try {
      await gql<any>(
        `mutation($t:UUID!,$cid:UUID,$cn:String,$d:String!,$a:Float!,$m:String,$r:String){recordCustomerPayment(tenantId:$t,customerId:$cid,customerName:$cn,paymentDate:$d,amount:$a,method:$m,reference:$r){ok error}}`,
        { t: tenantId, cid: form.customerId || undefined, cn: form.customerName || undefined, d: form.date, a: parseFloat(form.amount), m: form.method, r: form.reference }
      );
      setShowCreate(false);
      setForm({ customerId: '', customerName: '', amount: '', date: today(), method: 'cash', reference: '' });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  if (loading) return <Loader />;

  const list = view === 'customer' ? customerPayments : supplierPayments;
  const total = list.reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <View style={{ flex: 1 }}>
      {/* Toggle chips */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
        {(['customer', 'supplier'] as const).map(v => (
          <TouchableOpacity key={v} onPress={() => setView(v)}
            style={[s.chip, view === v && { backgroundColor: NAVY }]}>
            <Text style={[s.chipTxt, view === v && { color: '#fff' }]}>{v === 'customer' ? 'Customer' : 'Supplier'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.kpiRow}>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>{view === 'customer' ? 'Total Received' : 'Total Paid'}</Text>
          <Text style={[s.kpiValue, { color: view === 'customer' ? '#16A34A' : '#DC2626' }]}>{fmtK(total)}</Text>
        </View>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>Transactions</Text>
          <Text style={s.kpiValue}>{list.length}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>{view === 'customer' ? 'Customer' : 'Supplier'} Payments ({list.length})</Text>
        <View style={[s.card, { marginBottom: 100 }]}>
          {list.length === 0 ? <Empty msg="No payments" /> : list.map((p, i) => (
            <View key={p.id} style={[s.row, i < list.length - 1 && s.border]}>
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{p.customerName || p.supplierName || 'Unknown'}</Text>
                <Text style={s.sub}>{p.reference} · {p.date?.slice(0, 10)}</Text>
                {p.paymentMethod && <Text style={s.sub2}>{p.paymentMethod}</Text>}
              </View>
              <Text style={[s.amount, { color: view === 'customer' ? '#16A34A' : '#DC2626' }]}>K{fmt(p.amount)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {view === 'customer' && <FAB onPress={() => setShowCreate(true)} />}

      <FormModal visible={showCreate} title="Record Customer Payment" onClose={() => setShowCreate(false)} onSubmit={recordPayment} submitting={saving}>
        <Field label="Customer Name" value={form.customerName} onChangeText={v => setForm(f => ({ ...f, customerName: v }))} placeholder="Customer name" />
        <Field label="Amount" value={form.amount} onChangeText={v => setForm(f => ({ ...f, amount: v }))} keyboardType="decimal-pad" required />
        <Field label="Payment Date" value={form.date} onChangeText={v => setForm(f => ({ ...f, date: v }))} placeholder="YYYY-MM-DD" required />
        <SelectField label="Method" value={form.method} onChange={v => setForm(f => ({ ...f, method: v }))} options={[
          { label: 'Cash', value: 'cash' },
          { label: 'Bank Transfer', value: 'bank_transfer' },
          { label: 'Cheque', value: 'cheque' },
          { label: 'Mobile Money', value: 'mobile_money' },
        ]} />
        <Field label="Reference" value={form.reference} onChangeText={v => setForm(f => ({ ...f, reference: v }))} placeholder="Ref / receipt number" />
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── EXPENSE CLAIMS ─────────────────────────── */
function ExpenseClaimsTab({ tenantId }: { tenantId: string }) {
  const { isAdmin } = useRole();
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ description: '', amount: '', category: '', date: today(), receipt: '' });

  const load = useCallback(async () => {
    try {
      const d = await gql<any>(`query($t:UUID!){expenseClaims(tenantId:$t,limit:100){id description amount category date status employeeName receiptRef}}`, { t: tenantId });
      setClaims(d?.expenseClaims || []);
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.description || !form.amount) { Alert.alert('Error', 'Description and amount required'); return; }
    setSaving(true);
    try {
      await gql<any>(
        `mutation($t:UUID!,$desc:String!,$amt:Float!,$cat:String!,$date:String!,$rec:String){submitExpenseClaim(tenantId:$t,description:$desc,amount:$amt,category:$cat,date:$date,receiptRef:$rec){ok error}}`,
        { t: tenantId, desc: form.description, amt: parseFloat(form.amount), cat: form.category, date: form.date, rec: form.receipt || undefined }
      );
      setShowCreate(false);
      setForm({ description: '', amount: '', category: '', date: today(), receipt: '' });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const approve = async (claimId: string) => {
    try {
      await gql<any>(`mutation($id:UUID!){approveExpenseClaim(claimId:$id){ok error}}`, { id: claimId });
      setSelected(null); load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const reject = async () => {
    if (!rejectReason) { Alert.alert('Error', 'Enter rejection reason'); return; }
    setSaving(true);
    try {
      await gql<any>(`mutation($id:UUID!,$r:String!){rejectExpenseClaim(claimId:$id,reason:$r){ok error}}`, { id: selected?.id, r: rejectReason });
      setShowReject(false); setSelected(null); setRejectReason(''); load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  if (loading) return <Loader />;

  const pending = claims.filter(c => c.status?.toLowerCase() === 'pending').length;
  const total = claims.reduce((s, c) => s + Number(c.amount || 0), 0);

  return (
    <View style={{ flex: 1 }}>
      <View style={s.kpiRow}>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>Total Claims</Text>
          <Text style={s.kpiValue}>{fmtK(total)}</Text>
        </View>
        <View style={s.kpi}>
          <Text style={s.kpiLabel}>Pending</Text>
          <Text style={[s.kpiValue, { color: '#D97706' }]}>{pending}</Text>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Expense Claims ({claims.length})</Text>
        <View style={[s.card, { marginBottom: 100 }]}>
          {claims.length === 0 ? <Empty msg="No expense claims" /> : claims.map((c, i) => (
            <TouchableOpacity key={c.id} style={[s.row, i < claims.length - 1 && s.border]} onPress={() => setSelected(c)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{c.description}</Text>
                <Text style={s.sub}>{c.employeeName} · {c.date?.slice(0, 10)}</Text>
                {c.category && <Text style={s.sub2}>{c.category}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.amount}>K{fmt(c.amount)}</Text>
                <View style={{ marginTop: 4 }}><StatusBadge status={c.status} /></View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <FAB onPress={() => setShowCreate(true)} />

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Expense Claim</Text>
          <TouchableOpacity onPress={() => setSelected(null)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        {selected && (
          <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
            <View style={[s.card, { marginTop: 12 }]}>
              {[
                ['Description', selected.description],
                ['Employee', selected.employeeName],
                ['Amount', `K${fmt(selected.amount)}`],
                ['Category', selected.category],
                ['Date', selected.date?.slice(0, 10)],
                ['Receipt Ref', selected.receiptRef],
                ['Status', selected.status],
              ].filter(([, v]) => v).map(([l, v]) => (
                <View key={l} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                  <Text style={s.detailLabel}>{l}</Text>
                  <Text style={s.detailValue}>{v}</Text>
                </View>
              ))}
            </View>
            {isAdmin && selected.status?.toLowerCase() === 'pending' && (
              <View style={s.actionRow}>
                <ActionBtn label="Approve" color="#16A34A" onPress={() => approve(selected.id)} />
                <ActionBtn label="Reject" color="#DC2626" onPress={() => Alert.alert('Reject Claim', 'Contact your administrator to reject expense claims.')} />
              </View>
            )}
          </ScrollView>
        )}
      </Modal>

      <FormModal visible={showCreate} title="Submit Expense Claim" onClose={() => setShowCreate(false)} onSubmit={submit} submitting={saving}>
        <Field label="Description" value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} required multiline />
        <Field label="Amount" value={form.amount} onChangeText={v => setForm(f => ({ ...f, amount: v }))} keyboardType="decimal-pad" required />
        <SelectField label="Category" value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} options={[
          { label: 'Travel', value: 'travel' }, { label: 'Meals', value: 'meals' },
          { label: 'Office Supplies', value: 'office_supplies' }, { label: 'Utilities', value: 'utilities' },
          { label: 'Entertainment', value: 'entertainment' }, { label: 'Other', value: 'other' },
        ]} />
        <Field label="Date" value={form.date} onChangeText={v => setForm(f => ({ ...f, date: v }))} placeholder="YYYY-MM-DD" required />
        <Field label="Receipt Reference" value={form.receipt} onChangeText={v => setForm(f => ({ ...f, receipt: v }))} placeholder="Receipt / invoice number" />
      </FormModal>

    </View>
  );
}

/* ─────────────────────────── PETTY CASH ─────────────────────────── */
function PettyCashTab({ tenantId }: { tenantId: string }) {
  const [floats, setFloats] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFloat, setSelectedFloat] = useState<any>(null);
  const [showVoucher, setShowVoucher] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ amount: '', description: '', category: '', date: today() });

  const load = useCallback(async () => {
    try {
      const [fData, vData] = await Promise.all([
        gql<any>(`query($t:UUID!){pettyCashFloats(tenantId:$t){id name custodian balance currency}}`, { t: tenantId }),
        gql<any>(`query($t:UUID!){pettyCashVouchers(tenantId:$t){id amount description date category status floatId floatName}}`, { t: tenantId }),
      ]);
      setFloats(fData?.pettyCashFloats || []);
      setVouchers(vData?.pettyCashVouchers || []);
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const postVoucher = async () => {
    if (!form.amount || !form.description) { Alert.alert('Error', 'Amount and description required'); return; }
    setSaving(true);
    try {
      await gql<any>(
        `mutation($fid:UUID!,$a:Float!,$desc:String!,$cat:String!,$d:String!){postPettyCashVoucher(floatId:$fid,amount:$a,description:$desc,category:$cat,date:$d){ok error}}`,
        { fid: selectedFloat?.id, a: parseFloat(form.amount), desc: form.description, cat: form.category, d: form.date }
      );
      setShowVoucher(false);
      setForm({ amount: '', description: '', category: '', date: today() });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  if (loading) return <Loader />;

  const filteredVouchers = selectedFloat
    ? vouchers.filter(v => v.floatId === selectedFloat.id || v.floatName === selectedFloat.name)
    : vouchers;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Cash Floats</Text>
        <View style={s.card}>
          {floats.length === 0 ? <Empty msg="No floats configured" /> : floats.map((f, i) => (
            <TouchableOpacity
              key={f.id}
              style={[s.row, i < floats.length - 1 && s.border, selectedFloat?.id === f.id && { backgroundColor: NAVY + '08' }]}
              onPress={() => setSelectedFloat(selectedFloat?.id === f.id ? null : f)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{f.name}</Text>
                {f.custodian && <Text style={s.sub}>Custodian: {f.custodian}</Text>}
              </View>
              <Text style={s.amount}>{f.currency} {Number(f.balance).toLocaleString()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.sectionTitle}>
          Vouchers {selectedFloat ? `— ${selectedFloat.name}` : '(All Floats)'}
        </Text>
        <View style={[s.card, { marginBottom: selectedFloat ? 100 : 32 }]}>
          {filteredVouchers.length === 0 ? <Empty msg="No vouchers" /> : filteredVouchers.slice(0, 40).map((v, i) => (
            <View key={v.id} style={[s.row, i < Math.min(filteredVouchers.length, 40) - 1 && s.border]}>
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{v.description}</Text>
                <Text style={s.sub}>{v.date?.slice(0, 10)}{v.category ? ` · ${v.category}` : ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.amount, { color: '#DC2626' }]}>K{fmt(v.amount)}</Text>
                <View style={{ marginTop: 4 }}><StatusBadge status={v.status} /></View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {selectedFloat && <FAB onPress={() => setShowVoucher(true)} />}

      <FormModal visible={showVoucher} title={`New Voucher — ${selectedFloat?.name}`} onClose={() => setShowVoucher(false)} onSubmit={postVoucher} submitting={saving}>
        <Field label="Amount" value={form.amount} onChangeText={v => setForm(f => ({ ...f, amount: v }))} keyboardType="decimal-pad" required />
        <Field label="Description" value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} required multiline />
        <SelectField label="Category" value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} options={[
          { label: 'Office Supplies', value: 'office_supplies' }, { label: 'Transport', value: 'transport' },
          { label: 'Refreshments', value: 'refreshments' }, { label: 'Stationery', value: 'stationery' },
          { label: 'Utilities', value: 'utilities' }, { label: 'Other', value: 'other' },
        ]} />
        <Field label="Date" value={form.date} onChangeText={v => setForm(f => ({ ...f, date: v }))} placeholder="YYYY-MM-DD" required />
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── BANK REC ─────────────────────────── */
function BankRecTab({ tenantId }: { tenantId: string }) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [showReconcile, setShowReconcile] = useState(false);
  const [statementBalance, setStatementBalance] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await gql<any>(`query($t:UUID!){bankAccounts(tenantId:$t){id name accountNumber balance lastReconciled currency}}`, { t: tenantId });
        setAccounts(d?.bankAccounts || []);
      } catch {} finally { setLoading(false); }
    })();
  }, [tenantId]);

  const selectAccount = async (acct: any) => {
    setSelectedAccount(acct);
    setTxLoading(true);
    try {
      const d = await gql<any>(`query($aid:UUID!){bankTransactions(accountId:$aid)}`, { aid: acct.id });
      const raw = d?.bankTransactions;
      setTransactions(Array.isArray(raw) ? raw : (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : []));
    } catch {} finally { setTxLoading(false); }
  };

  if (loading) return <Loader />;

  const unreconciled = transactions.filter(tx => !tx.isReconciled);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Bank Accounts</Text>
        <View style={s.card}>
          {accounts.length === 0 ? <Empty msg="No bank accounts" /> : accounts.map((a, i) => (
            <TouchableOpacity
              key={a.id}
              style={[s.row, i < accounts.length - 1 && s.border, selectedAccount?.id === a.id && { backgroundColor: NAVY + '08' }]}
              onPress={() => selectAccount(a)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{a.name}</Text>
                {a.accountNumber && <Text style={s.sub}>{a.accountNumber}</Text>}
                {a.lastReconciled && <Text style={s.sub2}>Last reconciled: {a.lastReconciled?.slice(0, 10)}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.amount}>{a.currency} {Number(a.balance).toLocaleString()}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {selectedAccount && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginTop: 16 }}>
              <Text style={s.sectionTitle}>Unreconciled Transactions ({unreconciled.length})</Text>
              <TouchableOpacity style={[s.actionBtn, { paddingHorizontal: 14, paddingVertical: 8 }]} onPress={() => setShowReconcile(true)}>
                <Text style={s.actionBtnTxt}>Reconcile</Text>
              </TouchableOpacity>
            </View>
            {txLoading ? <Loader /> : (
              <View style={[s.card, { marginBottom: 32 }]}>
                {unreconciled.length === 0 ? <Empty msg="All transactions reconciled" /> : unreconciled.slice(0, 30).map((tx, i) => (
                  <View key={tx.id} style={[s.row, i < Math.min(unreconciled.length, 30) - 1 && s.border]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.main}>{tx.description}</Text>
                      <Text style={s.sub}>{tx.date?.slice(0, 10)}{tx.reference ? ` · ${tx.reference}` : ''}</Text>
                    </View>
                    <Text style={[s.amount, { color: tx.txType === 'credit' ? '#16A34A' : '#DC2626' }]}>
                      {tx.txType === 'credit' ? '+' : '-'}K{fmt(tx.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={showReconcile} animationType="slide" onRequestClose={() => setShowReconcile(false)}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Reconcile — {selectedAccount?.name}</Text>
          <TouchableOpacity onPress={() => setShowReconcile(false)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9', padding: 16 }}>
          <View style={s.card}>
            <Text style={[s.sub, { padding: 4, marginBottom: 8 }]}>Enter the closing balance from your bank statement to reconcile.</Text>
            <Field label="Statement Balance" value={statementBalance} onChangeText={setStatementBalance} keyboardType="decimal-pad" required placeholder="0.00" />
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Book Balance</Text>
              <Text style={s.detailValue}>{fmtK(selectedAccount?.balance)}</Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Unreconciled Items</Text>
              <Text style={s.detailValue}>{unreconciled.length}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[s.actionBtn, { margin: 16, alignItems: 'center', opacity: saving ? 0.5 : 1 }]}
            onPress={() => {
              Alert.alert('Reconciliation', 'Reconciliation submitted. Review any differences in the web app.');
              setShowReconcile(false);
            }}
            disabled={saving}
          >
            <Text style={s.actionBtnTxt}>Submit Reconciliation</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

/* ─────────────────────────── REPORTS ─────────────────────────── */
function ReportsTab({ tenantId }: { tenantId: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(new Date().getFullYear() + '-01-01');
  const [toDate, setToDate] = useState(today());
  const [asOf, setAsOf] = useState(today());

  const fetchReport = async (type: string) => {
    setSelected(type); setLoading(true); setData(null);
    try {
      const reportType = type === 'trial_balance' ? 'trial_balance' : type === 'pl' ? 'profit_and_loss' : 'balance_sheet';
      const d = await gql<any>(
        `query($t:UUID!,$type:String!,$f:String!,$to:String!){financialReport(tenantId:$t,reportType:$type,fromDate:$f,toDate:$to)}`,
        { t: tenantId, type: reportType, f: fromDate, to: toDate }
      );
      const raw = d?.financialReport;
      setData(typeof raw === 'string' ? JSON.parse(raw) : raw);
    } catch {} finally { setLoading(false); }
  };

  const REPORTS = [
    { key: 'trial_balance', label: 'Trial Balance', icon: '⚖', desc: 'Debit/credit totals by account' },
    { key: 'pl', label: 'Profit & Loss', icon: '📈', desc: 'Revenue, expenses, net profit' },
    { key: 'balance_sheet', label: 'Balance Sheet', icon: '🏦', desc: 'Assets, liabilities, equity' },
  ];

  return (
    <ScrollView style={{ flex: 1 }}>
      {/* Date range inputs */}
      <View style={[s.card, { marginTop: 12 }]}>
        <Text style={[s.sub, { marginBottom: 8, fontWeight: '600' }]}>Report Period</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Field label="From" value={fromDate} onChangeText={setFromDate} placeholder="YYYY-MM-DD" /></View>
          <View style={{ flex: 1 }}><Field label="To / As Of" value={toDate} onChangeText={v => { setToDate(v); setAsOf(v); }} placeholder="YYYY-MM-DD" /></View>
        </View>
      </View>

      <Text style={s.sectionTitle}>Financial Reports</Text>
      <View style={s.card}>
        {REPORTS.map((r, i) => (
          <TouchableOpacity key={r.key} style={[s.row, i < REPORTS.length - 1 && s.border, { gap: 12 }]} onPress={() => fetchReport(r.key)} activeOpacity={0.7}>
            <Text style={{ fontSize: 24 }}>{r.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.main}>{r.label}</Text>
              <Text style={s.sub}>{r.desc}</Text>
            </View>
            <Text style={{ color: GOLD, fontSize: 18, fontWeight: '700' }}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Report results */}
      {selected && (
        <>
          <Text style={s.sectionTitle}>{REPORTS.find(r => r.key === selected)?.label}</Text>
          {loading ? <Loader /> : data ? (
            <>
              <View style={[s.card, { marginBottom: 8 }]}>
                {selected === 'trial_balance' && (
                  <>
                    <View style={[s.row, { borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }]}>
                      <Text style={[s.detailLabel, { flex: 2 }]}>Account</Text>
                      <Text style={[s.detailLabel, { flex: 1, textAlign: 'right' }]}>Debit</Text>
                      <Text style={[s.detailLabel, { flex: 1, textAlign: 'right' }]}>Credit</Text>
                    </View>
                    {(data.accounts || []).slice(0, 20).map((a: any, i: number) => (
                      <View key={i} style={[s.row, i < data.accounts.length - 1 && s.border]}>
                        <Text style={[s.sub, { flex: 2 }]}>{a.code} {a.name}</Text>
                        <Text style={[s.sub, { flex: 1, textAlign: 'right' }]}>{a.debit ? fmtK(a.debit) : '–'}</Text>
                        <Text style={[s.sub, { flex: 1, textAlign: 'right' }]}>{a.credit ? fmtK(a.credit) : '–'}</Text>
                      </View>
                    ))}
                    <View style={[s.detailRow, { borderTopWidth: 2, borderTopColor: NAVY }]}>
                      <Text style={[s.detailLabel, { fontWeight: '800' }]}>TOTALS</Text>
                      <Text style={s.detailValue}>Dr: {fmtK(data.totalDebit)} · Cr: {fmtK(data.totalCredit)}</Text>
                    </View>
                  </>
                )}
                {selected === 'pl' && (
                  <>
                    {[['Revenue', data.revenue, '#16A34A'], ['Expenses', data.expenses, '#DC2626'], ['Net Profit', data.netProfit, NAVY]].map(([l, v, c]) => (
                      <View key={l as string} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                        <Text style={s.detailLabel}>{l}</Text>
                        <Text style={[s.detailValue, { color: c as string }]}>{fmtK(v)}</Text>
                      </View>
                    ))}
                    {(data.sections || []).map((sec: any, i: number) => (
                      <View key={i} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                        <Text style={s.detailLabel}>{sec.name}</Text>
                        <Text style={s.detailValue}>{fmtK(sec.amount)}</Text>
                      </View>
                    ))}
                  </>
                )}
                {selected === 'balance_sheet' && (
                  <>
                    {[['Total Assets', data.totalAssets, '#16A34A'], ['Total Liabilities', data.totalLiabilities, '#DC2626'], ['Total Equity', data.totalEquity, NAVY]].map(([l, v, c]) => (
                      <View key={l as string} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                        <Text style={s.detailLabel}>{l}</Text>
                        <Text style={[s.detailValue, { color: c as string }]}>{fmtK(v)}</Text>
                      </View>
                    ))}
                    {(data.sections || []).map((sec: any, i: number) => (
                      <View key={i} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                        <Text style={s.detailLabel}>{sec.name}</Text>
                        <Text style={s.detailValue}>{fmtK(sec.amount)}</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
              <View style={{ marginHorizontal: 16, marginBottom: 32 }}>
                <ActionBtn label="Export Report" color={GOLD} onPress={() => Alert.alert('Export', 'Use the web app to export reports to PDF or Excel.')} />
              </View>
            </>
          ) : <Empty msg="No data returned" />}
        </>
      )}
    </ScrollView>
  );
}

/* ─────────────────────────── MAIN SCREEN ─────────────────────────── */
export default function FinanceScreen() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id || '';
  const [tab, setTab] = useState('overview');

  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      <ModuleTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'overview' && <OverviewTab tenantId={tenantId} />}
      {tab === 'journals' && <JournalsTab tenantId={tenantId} />}
      {tab === 'payments' && <PaymentsTab tenantId={tenantId} />}
      {tab === 'expenses' && <ExpenseClaimsTab tenantId={tenantId} />}
      {tab === 'petty' && <PettyCashTab tenantId={tenantId} />}
      {tab === 'bankrec' && <BankRecTab tenantId={tenantId} />}
      {tab === 'reports' && <ReportsTab tenantId={tenantId} />}
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
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  kpi: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  kpiLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase' },
  kpiValue: { fontSize: 18, fontWeight: '800', color: NAVY, marginTop: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#fff' },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: NAVY },
  modalClose: { fontSize: 18, color: '#6B7280', padding: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  detailLabel: { fontSize: 13, color: '#6B7280' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#1F2937', flex: 1, textAlign: 'right', marginLeft: 8 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16 },
  actionBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, backgroundColor: NAVY },
  actionBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  lineItem: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  addLineBtn: { borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 14 },
  addLineTxt: { color: NAVY, fontSize: 13, fontWeight: '600' },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#E5E7EB' },
  chipTxt: { fontSize: 13, fontWeight: '600', color: '#374151' },
});
