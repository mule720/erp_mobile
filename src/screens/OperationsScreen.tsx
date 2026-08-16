import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet,
  TouchableOpacity, Modal, Alert, RefreshControl,
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
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n: any, cur = 'ZMW') =>
  new Intl.NumberFormat('en-ZM', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(Number(n ?? 0));

const TABS = [
  { key: 'invoices', label: 'Invoices' },
  { key: 'orders', label: 'Sales Orders' },
  { key: 'quotations', label: 'Quotations' },
  { key: 'credit_notes', label: 'Credit Notes' },
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

/* ─────────────────────────── INVOICES ─────────────────────────── */
function InvoicesTab({ tenantId }: { tenantId: string }) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create invoice form
  const [form, setForm] = useState({
    customerName: '', customerId: '',
    invoiceDate: today(), dueDate: '',
    currency: 'ZMW', notes: '',
    lines: [{ description: '', quantity: '1', unitPrice: '', taxRate: '16' }],
  });
  // Payment form
  const [payForm, setPayForm] = useState({ amount: '', method: 'cash', reference: '' });

  const load = useCallback(async () => {
    try {
      const [iData, sData, cData] = await Promise.all([
        gql<any>(`query($t:UUID!){salesInvoices(tenantId:$t,limit:100){id invoiceNumber customerName invoiceDate dueDate status totalAmount currency}}`, { t: tenantId }),
        gql<any>(`query($t:UUID!){invoiceStatusSummary(tenantId:$t){draft paid overdue total}}`, { t: tenantId }),
        gql<any>(`query($t:UUID!){customers(tenantId:$t,limit:200){id name}}`, { t: tenantId }),
      ]);
      setInvoices((iData?.salesInvoices || []).filter(Boolean));
      setSummary(sData?.invoiceStatusSummary);
      setCustomers(cData?.customers || []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const setLine = (i: number, k: string, v: string) => {
    setForm(f => ({ ...f, lines: f.lines.map((l, j) => j === i ? { ...l, [k]: v } : l) }));
  };
  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, { description: '', quantity: '1', unitPrice: '', taxRate: '16' }] }));
  const removeLine = (i: number) => setForm(f => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }));

  const createInvoice = async () => {
    if (!form.customerName || !form.invoiceDate || !form.dueDate) { Alert.alert('Error', 'Fill required fields'); return; }
    setSaving(true);
    try {
      const input = {
        customerName: form.customerName,
        customerId: form.customerId || undefined,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate,
        currency: form.currency || 'ZMW',
        notes: form.notes,
        lines: JSON.stringify(form.lines.map(l => ({
          description: l.description,
          quantity: parseFloat(l.quantity) || 1,
          unitPrice: parseFloat(l.unitPrice) || 0,
          taxRate: parseFloat(l.taxRate) / 100 || 0,
        }))),
      };
      await gql<any>(`mutation($t:UUID!,$i:SalesInvoiceInput!){createSalesInvoice(tenantId:$t,input:$i){ok error invoice{id}}}`, { t: tenantId, i: input });
      setShowCreate(false);
      setForm({ customerName: '', customerId: '', invoiceDate: today(), dueDate: '', currency: 'ZMW', notes: '', lines: [{ description: '', quantity: '1', unitPrice: '', taxRate: '16' }] });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const postInvoice = async (inv: any) => {
    try {
      await gql<any>(`mutation($id:UUID!){postSalesInvoice(invoiceId:$id,paymentMode:"cash"){ok error}}`, { id: inv.id });
      setSelected(null); load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const sendInvoice = async (inv: any) => {
    try {
      await gql<any>(`mutation($id:UUID!,$s:String!){updateInvoiceStatus(id:$id,status:$s){ok error}}`, { id: inv.id, s: 'sent' });
      setSelected(null); load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const recordPayment = async () => {
    if (!payForm.amount) { Alert.alert('Error', 'Enter amount'); return; }
    setSaving(true);
    try {
      const cust = customers.find(c => c.name === (selected?.customer?.name || selected?.customerName));
      await gql<any>(
        `mutation($t:UUID!,$cid:UUID,$d:Date!,$a:Float!,$m:String!,$r:String,$alloc:GenericScalar){recordCustomerPayment(tenantId:$t,customerId:$cid,paymentDate:$d,amount:$a,method:$m,reference:$r,invoiceAllocations:$alloc){ok error}}`,
        {
          t: tenantId, cid: cust?.id || undefined,
          d: today(), a: parseFloat(payForm.amount),
          m: payForm.method, r: payForm.reference,
          alloc: selected ? [{ invoiceId: selected.id, amount: parseFloat(payForm.amount) }] : undefined,
        }
      );
      setShowPayment(false); setSelected(null);
      setPayForm({ amount: '', method: 'cash', reference: '' });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  if (loading) return <Loader />;

  const STATUS_COLORS: Record<string, string> = { draft: '#6B7280', sent: '#2563EB', paid: '#16A34A', overdue: '#DC2626' };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[NAVY]} />}>
        {summary && (
          <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingTop: 12, gap: 8 }}>
            {(['draft', 'paid', 'overdue', 'total'] as const).map(k => (
              <View key={k} style={[s.statCard, { borderTopColor: STATUS_COLORS[k] }]}>
                <Text style={[s.statNum, { color: STATUS_COLORS[k] }]}>{summary[k] ?? 0}</Text>
                <Text style={s.statLabel}>{k.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={s.sectionTitle}>Invoices</Text>
        <View style={[s.card, { marginBottom: 100 }]}>
          {invoices.length === 0 ? <Empty msg="No invoices" /> : invoices.map((inv, i) => (
            <TouchableOpacity key={inv.id} style={[s.row, i < invoices.length - 1 && s.border]} onPress={() => setSelected(inv)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{inv.invoiceNumber}</Text>
                <Text style={s.sub}>{inv.customerName} · {inv.invoiceDate?.slice(0, 10)}</Text>
                <Text style={s.sub2}>Due: {inv.dueDate?.slice(0, 10)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.amount}>{fmt(inv.totalAmount, inv.currency)}</Text>
                <View style={{ marginTop: 4 }}><StatusBadge status={inv.status} /></View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <FAB onPress={() => setShowCreate(true)} />

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>{selected?.invoiceNumber}</Text>
          <TouchableOpacity onPress={() => setSelected(null)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        {selected && (
          <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
            <View style={[s.card, { marginTop: 12 }]}>
              {[['Customer', selected.customerName], ['Date', selected.invoiceDate?.slice(0, 10)], ['Due', selected.dueDate?.slice(0, 10)], ['Total', fmt(selected.totalAmount, selected.currency)], ['Status', selected.status]].map(([l, v]) => (
                <View key={l} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                  <Text style={s.detailLabel}>{l}</Text>
                  <Text style={s.detailValue}>{v}</Text>
                </View>
              ))}
            </View>
            <View style={s.actionRow}>
              {selected.status === 'draft' && <ActionBtn label="Send" color="#2563EB" onPress={() => sendInvoice(selected)} />}
              {selected.status === 'draft' && <ActionBtn label="Post" onPress={() => postInvoice(selected)} />}
              {['sent', 'overdue'].includes(selected.status) && (
                <ActionBtn label="Record Payment" color="#16A34A" onPress={() => setShowPayment(true)} />
              )}
            </View>
          </ScrollView>
        )}
      </Modal>

      {/* Create Invoice Modal */}
      <FormModal visible={showCreate} title="New Invoice" onClose={() => setShowCreate(false)} onSubmit={createInvoice} submitting={saving}>
        <Section title="Customer" />
        <Field label="Customer Name" value={form.customerName} onChangeText={v => setForm(f => ({ ...f, customerName: v }))} required placeholder="Enter customer name" />
        <Section title="Dates" />
        <Field label="Invoice Date" value={form.invoiceDate} onChangeText={v => setForm(f => ({ ...f, invoiceDate: v }))} required placeholder="YYYY-MM-DD" />
        <Field label="Due Date" value={form.dueDate} onChangeText={v => setForm(f => ({ ...f, dueDate: v }))} required placeholder="YYYY-MM-DD" />
        <SelectField label="Currency" value={form.currency} onChange={v => setForm(f => ({ ...f, currency: v }))} options={[{ label: 'ZMW', value: 'ZMW' }, { label: 'USD', value: 'USD' }, { label: 'EUR', value: 'EUR' }]} />
        <Section title="Line Items" />
        {form.lines.map((line, i) => (
          <View key={i} style={s.lineItem}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280' }}>Line {i + 1}</Text>
              {form.lines.length > 1 && (
                <TouchableOpacity onPress={() => removeLine(i)}><Text style={{ color: '#DC2626', fontSize: 13 }}>Remove</Text></TouchableOpacity>
              )}
            </View>
            <Field label="Description" value={line.description} onChangeText={v => setLine(i, 'description', v)} placeholder="Item description" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Field label="Qty" value={line.quantity} onChangeText={v => setLine(i, 'quantity', v)} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 2 }}><Field label="Unit Price" value={line.unitPrice} onChangeText={v => setLine(i, 'unitPrice', v)} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Field label="Tax %" value={line.taxRate} onChangeText={v => setLine(i, 'taxRate', v)} keyboardType="decimal-pad" /></View>
            </View>
          </View>
        ))}
        <TouchableOpacity style={s.addLineBtn} onPress={addLine}>
          <Text style={s.addLineTxt}>+ Add Line</Text>
        </TouchableOpacity>
        <Field label="Notes" value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} multiline placeholder="Optional notes" />
      </FormModal>

      {/* Record Payment Modal */}
      <FormModal visible={showPayment} title="Record Payment" onClose={() => setShowPayment(false)} onSubmit={recordPayment} submitting={saving} submitLabel="Record">
        <Field label="Amount" value={payForm.amount} onChangeText={v => setPayForm(f => ({ ...f, amount: v }))} keyboardType="decimal-pad" required placeholder="0.00" />
        <SelectField label="Payment Method" value={payForm.method} onChange={v => setPayForm(f => ({ ...f, method: v }))} options={[
          { label: 'Cash', value: 'cash' }, { label: 'Bank Transfer', value: 'bank_transfer' },
          { label: 'Mobile Money', value: 'mobile_money' }, { label: 'Cheque', value: 'cheque' },
        ]} />
        <Field label="Reference" value={payForm.reference} onChangeText={v => setPayForm(f => ({ ...f, reference: v }))} placeholder="Receipt / reference number" />
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── SALES ORDERS ─────────────────────────── */
function SalesOrdersTab({ tenantId }: { tenantId: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customerId: '', orderDate: today(), expectedDeliveryDate: '', currency: 'ZMW', notes: '', lines: [{ description: '', quantity: '1', unitPrice: '' }] });

  const load = useCallback(async () => {
    try {
      const [oData, cData] = await Promise.all([
        gql<any>(`query($t:UUID!){salesOrders(tenantId:$t,limit:100){id orderNumber customer{name} orderDate status totalAmount currency expectedDeliveryDate}}`, { t: tenantId }),
        gql<any>(`query($t:UUID!){customers(tenantId:$t,limit:200){id name}}`, { t: tenantId }),
      ]);
      setOrders((oData?.salesOrders || []).filter(Boolean));
      setCustomers(cData?.customers || []);
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const setLine = (i: number, k: string, v: string) => setForm(f => ({ ...f, lines: f.lines.map((l, j) => j === i ? { ...l, [k]: v } : l) }));

  const create = async () => {
    if (!form.customerId || !form.orderDate) { Alert.alert('Error', 'Customer and date required'); return; }
    setSaving(true);
    try {
      const input = {
        customerId: form.customerId, orderDate: form.orderDate,
        expectedDeliveryDate: form.expectedDeliveryDate || undefined,
        currency: form.currency, notes: form.notes,
        lines: form.lines.map(l => ({ description: l.description, quantity: parseFloat(l.quantity) || 1, unitPrice: parseFloat(l.unitPrice) || 0 })),
      };
      await gql<any>(`mutation($t:UUID!,$i:SalesOrderInput!){createSalesOrder(tenantId:$t,input:$i){ok error}}`, { t: tenantId, i: input });
      setShowCreate(false); load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const createInvoice = async (order: any) => {
    try {
      await gql<any>(`mutation($id:UUID!){createInvoiceFromSalesOrder(salesOrderId:$id){ok error}}`, { id: order.id });
      Alert.alert('Success', 'Invoice created from sales order'); setSelected(null); load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Sales Orders ({orders.length})</Text>
        <View style={[s.card, { marginBottom: 100 }]}>
          {orders.length === 0 ? <Empty msg="No sales orders" /> : orders.map((o, i) => (
            <TouchableOpacity key={o.id} style={[s.row, i < orders.length - 1 && s.border]} onPress={() => setSelected(o)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{o.orderNumber}</Text>
                <Text style={s.sub}>{o.customer?.name || o.customerName} · {o.orderDate?.slice(0, 10)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.amount}>{fmt(o.totalAmount, o.currency)}</Text>
                <View style={{ marginTop: 4 }}><StatusBadge status={o.status} /></View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <FAB onPress={() => setShowCreate(true)} />

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>{selected?.orderNumber}</Text>
          <TouchableOpacity onPress={() => setSelected(null)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        {selected && (
          <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
            <View style={[s.card, { marginTop: 12 }]}>
              {[['Customer', selected.customer?.name || selected.customerName], ['Date', selected.orderDate?.slice(0, 10)], ['Delivery', selected.expectedDeliveryDate?.slice(0, 10)], ['Total', fmt(selected.totalAmount, selected.currency)], ['Status', selected.status]].filter(([, v]) => v).map(([l, v]) => (
                <View key={l} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                  <Text style={s.detailLabel}>{l}</Text>
                  <Text style={s.detailValue}>{v}</Text>
                </View>
              ))}
            </View>
            <View style={s.actionRow}>
              {selected.status === 'confirmed' && <ActionBtn label="Create Invoice" color="#16A34A" onPress={() => createInvoice(selected)} />}
            </View>
          </ScrollView>
        )}
      </Modal>

      <FormModal visible={showCreate} title="New Sales Order" onClose={() => setShowCreate(false)} onSubmit={create} submitting={saving}>
        <Section title="Customer" />
        <SelectField label="Customer" value={form.customerId} onChange={v => setForm(f => ({ ...f, customerId: v }))} required
          options={customers.map(c => ({ label: c.name, value: c.id }))} />
        <Section title="Dates" />
        <Field label="Order Date" value={form.orderDate} onChangeText={v => setForm(f => ({ ...f, orderDate: v }))} required placeholder="YYYY-MM-DD" />
        <Field label="Expected Delivery" value={form.expectedDeliveryDate} onChangeText={v => setForm(f => ({ ...f, expectedDeliveryDate: v }))} placeholder="YYYY-MM-DD" />
        <SelectField label="Currency" value={form.currency} onChange={v => setForm(f => ({ ...f, currency: v }))} options={[{ label: 'ZMW', value: 'ZMW' }, { label: 'USD', value: 'USD' }]} />
        <Section title="Line Items" />
        {form.lines.map((line, i) => (
          <View key={i} style={s.lineItem}>
            <Field label={`Line ${i + 1} Description`} value={line.description} onChangeText={v => setLine(i, 'description', v)} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Field label="Qty" value={line.quantity} onChangeText={v => setLine(i, 'quantity', v)} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 2 }}><Field label="Unit Price" value={line.unitPrice} onChangeText={v => setLine(i, 'unitPrice', v)} keyboardType="decimal-pad" /></View>
            </View>
          </View>
        ))}
        <TouchableOpacity style={s.addLineBtn} onPress={() => setForm(f => ({ ...f, lines: [...f.lines, { description: '', quantity: '1', unitPrice: '' }] }))}>
          <Text style={s.addLineTxt}>+ Add Line</Text>
        </TouchableOpacity>
        <Field label="Notes" value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} multiline />
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── QUOTATIONS ─────────────────────────── */
function QuotationsTab({ tenantId }: { tenantId: string }) {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customerId: '', quoteDate: today(), validUntil: '', currency: 'ZMW', notes: '', lines: [{ description: '', quantity: '1', unitPrice: '' }] });

  const load = useCallback(async () => {
    try {
      const [qData, cData] = await Promise.all([
        gql<any>(`query($t:UUID!){quotations(tenantId:$t)}`, { t: tenantId }),
        gql<any>(`query($t:UUID!){customers(tenantId:$t,limit:200){id name}}`, { t: tenantId }),
      ]);
      const raw = qData?.quotations;
      const quotes = Array.isArray(raw) ? raw : (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : (raw ? [raw] : []));
      setQuotes(quotes); setCustomers(cData?.customers || []);
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.customerId) { Alert.alert('Error', 'Select a customer'); return; }
    setSaving(true);
    try {
      const lines = form.lines.map(l => ({ description: l.description, quantity: parseFloat(l.quantity) || 1, unitPrice: parseFloat(l.unitPrice) || 0 }));
      await gql<any>(`mutation($t:UUID!,$cid:UUID!,$d:Date!,$v:Date,$l:GenericScalar,$n:String,$cur:String){createQuotation(tenantId:$t,customerId:$cid,quoteDate:$d,validUntil:$v,lines:$l,notes:$n,currency:$cur){ok error}}`,
        { t: tenantId, cid: form.customerId, d: form.quoteDate, v: form.validUntil || undefined, l: lines, n: form.notes, cur: form.currency });
      setShowCreate(false); load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const convertToOrder = async (q: any) => {
    try {
      await gql<any>(`mutation($id:UUID!){convertQuotationToOrder(quotationId:$id){ok error}}`, { id: q.id });
      Alert.alert('Success', 'Converted to Sales Order'); setSelected(null); load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Quotations ({quotes.length})</Text>
        <View style={[s.card, { marginBottom: 100 }]}>
          {quotes.length === 0 ? <Empty msg="No quotations" /> : quotes.map((q, i) => (
            <TouchableOpacity key={q.id} style={[s.row, i < quotes.length - 1 && s.border]} onPress={() => setSelected(q)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{q.quoteNumber}</Text>
                <Text style={s.sub}>{q.customerName} · {q.quoteDate?.slice(0, 10)}</Text>
                {q.expiryDate && <Text style={s.sub2}>Expires: {q.expiryDate?.slice(0, 10)}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.amount}>{fmt(q.totalAmount, q.currency)}</Text>
                <View style={{ marginTop: 4 }}><StatusBadge status={q.status} /></View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <FAB onPress={() => setShowCreate(true)} />

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>{selected?.quoteNumber}</Text>
          <TouchableOpacity onPress={() => setSelected(null)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        {selected && (
          <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
            <View style={[s.card, { marginTop: 12 }]}>
              {[['Customer', selected.customerName], ['Date', selected.quoteDate?.slice(0, 10)], ['Expires', selected.expiryDate?.slice(0, 10)], ['Total', fmt(selected.totalAmount, selected.currency)], ['Status', selected.status]].filter(([, v]) => v).map(([l, v]) => (
                <View key={l} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                  <Text style={s.detailLabel}>{l}</Text><Text style={s.detailValue}>{v}</Text>
                </View>
              ))}
            </View>
            <View style={s.actionRow}>
              {selected.status === 'draft' && <ActionBtn label="Convert to Order" color="#16A34A" onPress={() => convertToOrder(selected)} />}
            </View>
          </ScrollView>
        )}
      </Modal>

      <FormModal visible={showCreate} title="New Quotation" onClose={() => setShowCreate(false)} onSubmit={create} submitting={saving}>
        <SelectField label="Customer" value={form.customerId} onChange={v => setForm(f => ({ ...f, customerId: v }))} required options={customers.map(c => ({ label: c.name, value: c.id }))} />
        <Field label="Quote Date" value={form.quoteDate} onChangeText={v => setForm(f => ({ ...f, quoteDate: v }))} required placeholder="YYYY-MM-DD" />
        <Field label="Valid Until" value={form.validUntil} onChangeText={v => setForm(f => ({ ...f, validUntil: v }))} placeholder="YYYY-MM-DD" />
        <SelectField label="Currency" value={form.currency} onChange={v => setForm(f => ({ ...f, currency: v }))} options={[{ label: 'ZMW', value: 'ZMW' }, { label: 'USD', value: 'USD' }]} />
        <Section title="Line Items" />
        {form.lines.map((line, i) => (
          <View key={i} style={s.lineItem}>
            <Field label={`Line ${i + 1}`} value={line.description} onChangeText={v => setForm(f => ({ ...f, lines: f.lines.map((l, j) => j === i ? { ...l, description: v } : l) }))} placeholder="Description" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Field label="Qty" value={line.quantity} onChangeText={v => setForm(f => ({ ...f, lines: f.lines.map((l, j) => j === i ? { ...l, quantity: v } : l) }))} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 2 }}><Field label="Unit Price" value={line.unitPrice} onChangeText={v => setForm(f => ({ ...f, lines: f.lines.map((l, j) => j === i ? { ...l, unitPrice: v } : l) }))} keyboardType="decimal-pad" /></View>
            </View>
          </View>
        ))}
        <TouchableOpacity style={s.addLineBtn} onPress={() => setForm(f => ({ ...f, lines: [...f.lines, { description: '', quantity: '1', unitPrice: '' }] }))}><Text style={s.addLineTxt}>+ Add Line</Text></TouchableOpacity>
        <Field label="Notes" value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} multiline />
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── CREDIT NOTES ─────────────────────────── */
function CreditNotesTab({ tenantId }: { tenantId: string }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = await gql<any>(`query($t:UUID!){creditNotes(tenantId:$t)}`, { t: tenantId });
        const raw = d?.creditNotes;
        setNotes(Array.isArray(raw) ? raw : (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : []));
      } catch {} finally { setLoading(false); }
    })();
  }, [tenantId]);

  if (loading) return <Loader />;
  return (
    <ScrollView style={{ flex: 1 }}>
      <Text style={s.sectionTitle}>Credit Notes ({notes.length})</Text>
      <View style={[s.card, { marginBottom: 32 }]}>
        {notes.length === 0 ? <Empty msg="No credit notes" /> : notes.map((n, i) => (
          <View key={n.id} style={[s.row, i < notes.length - 1 && s.border]}>
            <View style={{ flex: 1 }}>
              <Text style={s.main}>{n.creditNoteNumber}</Text>
              <Text style={s.sub}>{n.customerName} · {n.date?.slice(0, 10)}</Text>
              {n.reason && <Text style={s.sub2}>{n.reason}</Text>}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.amount}>{fmt(n.totalAmount, n.currency)}</Text>
              <View style={{ marginTop: 4 }}><StatusBadge status={n.status} /></View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export default function OperationsScreen() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id || '';
  const [tab, setTab] = useState('invoices');
  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      <ModuleTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'invoices' && <InvoicesTab tenantId={tenantId} />}
      {tab === 'orders' && <SalesOrdersTab tenantId={tenantId} />}
      {tab === 'quotations' && <QuotationsTab tenantId={tenantId} />}
      {tab === 'credit_notes' && <CreditNotesTab tenantId={tenantId} />}
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
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12, borderTopWidth: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, color: '#6B7280', fontWeight: '700', marginTop: 2 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#fff' },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: NAVY },
  modalClose: { fontSize: 18, color: '#6B7280', padding: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  detailLabel: { fontSize: 13, color: '#6B7280' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16 },
  actionBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  actionBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  lineItem: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  addLineBtn: { borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 14 },
  addLineTxt: { color: NAVY, fontSize: 13, fontWeight: '600' },
});
