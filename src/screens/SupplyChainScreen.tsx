import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet,
  TouchableOpacity, Modal, Alert, RefreshControl, TextInput,
} from 'react-native';
import { gql } from '../api/graphql';
const parseList = (v: any): any[] => Array.isArray(v) ? v : (typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch { return []; } })() : []);
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
const fmt = (n: any, cur = 'ZMW') =>
  new Intl.NumberFormat('en-ZM', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(Number(n ?? 0));

const TABS = [
  { key: 'po', label: 'Purchase Orders' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'products', label: 'Products' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'stockcount', label: 'Stock Count' },
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

/* ─────────────────────────── PURCHASE ORDERS ─────────────────────────── */
function PurchaseOrdersTab({ tenantId }: { tenantId: string }) {
  const { isAdmin } = useRole();
  const [pos, setPos] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    supplierId: '', supplierName: '', orderDate: today(), expectedDeliveryDate: '', currency: 'ZMW', notes: '',
    lines: [{ description: '', quantity: '1', unitPrice: '', unit: 'pcs' }],
  });
  const [receiveForm, setReceiveForm] = useState({ receivedDate: today(), notes: '' });

  const load = useCallback(async () => {
    try {
      const [pData, sData] = await Promise.all([
        gql<any>(`{ supplyChainPurchaseOrders }`),
        gql<any>(`{ supplyChainSuppliers }`),
      ]);
      setPos(parseList(pData?.supplyChainPurchaseOrders));
      setSuppliers(parseList(sData?.supplyChainSuppliers));
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const setLine = (i: number, k: string, v: string) => setForm(f => ({ ...f, lines: f.lines.map((l, j) => j === i ? { ...l, [k]: v } : l) }));

  const createPO = async () => {
    if (!form.supplierId && !form.supplierName) { Alert.alert('Error', 'Select or enter supplier'); return; }
    setSaving(true);
    try {
      const poData: any = {
        supplierId: form.supplierId || undefined,
        supplierName: form.supplierName,
        orderDate: form.orderDate,
        expectedDeliveryDate: form.expectedDeliveryDate || undefined,
        currency: form.currency,
        notes: form.notes,
        lines: form.lines.map(l => ({ description: l.description, quantity: parseFloat(l.quantity) || 1, unitPrice: parseFloat(l.unitPrice) || 0, unit: l.unit })),
      };
      await gql<any>(`mutation($t:UUID!,$d:GenericScalar!){createPurchaseOrder(tenantId:$t,data:$d){ok error}}`, { t: tenantId, d: poData });
      setShowCreate(false);
      setForm({ supplierId: '', supplierName: '', orderDate: today(), expectedDeliveryDate: '', currency: 'ZMW', notes: '', lines: [{ description: '', quantity: '1', unitPrice: '', unit: 'pcs' }] });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const approvePO = async (po: any) => {
    try {
      await gql<any>(`mutation($id:UUID!){postPurchaseOrder(poId:$id){ok error}}`, { id: po.id });
      setSelected(null); load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const receiveGoods = async () => {
    setSaving(true);
    try {
      const data: any = { poId: selected.id, receivedDate: receiveForm.receivedDate, notes: receiveForm.notes };
      await gql<any>(`mutation($t:UUID!,$d:GenericScalar!){receivePurchaseOrderGoods(tenantId:$t,data:$d){ok error}}`, { t: tenantId, d: data });
      setShowReceive(false); setSelected(null); load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Purchase Orders ({pos.length})</Text>
        <View style={[s.card, { marginBottom: 100 }]}>
          {pos.length === 0 ? <Empty msg="No purchase orders" /> : pos.map((po, i) => (
            <TouchableOpacity key={po.id} style={[s.row, i < pos.length - 1 && s.border]} onPress={() => setSelected(po)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{po.poNumber}</Text>
                <Text style={s.sub}>{po.supplier} · {po.date?.slice(0, 10)}</Text>
                {po.expected && <Text style={s.sub2}>Expected: {po.expected?.slice(0, 10)}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.amount}>{fmt(po.totalAmount, po.currency)}</Text>
                <View style={{ marginTop: 4 }}><StatusBadge status={po.status} /></View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <FAB onPress={() => setShowCreate(true)} />

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>{selected?.poNumber}</Text>
          <TouchableOpacity onPress={() => setSelected(null)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        {selected && (
          <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
            <View style={[s.card, { marginTop: 12 }]}>
              {[['Supplier', selected.supplier], ['Date', selected.date?.slice(0, 10)], ['Expected', selected.expected?.slice(0, 10)], ['Total', fmt(selected.totalAmount || selected.total, selected.currency)], ['Status', selected.status]].filter(([, v]) => v).map(([l, v]) => (
                <View key={l} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                  <Text style={s.detailLabel}>{l}</Text><Text style={s.detailValue}>{v}</Text>
                </View>
              ))}
            </View>
            <View style={s.actionRow}>
              {selected.status === 'draft' && isAdmin && <ActionBtn label="Approve PO" color="#16A34A" onPress={() => approvePO(selected)} />}
              {selected.status === 'approved' && <ActionBtn label="Receive Goods" onPress={() => setShowReceive(true)} />}
            </View>
          </ScrollView>
        )}
      </Modal>

      <FormModal visible={showCreate} title="New Purchase Order" onClose={() => setShowCreate(false)} onSubmit={createPO} submitting={saving}>
        <Section title="Supplier" />
        <SelectField label="Supplier" value={form.supplierId} onChange={v => {
          const sup = suppliers.find(x => x.id === v);
          setForm(f => ({ ...f, supplierId: v, supplierName: sup?.name || '' }));
        }} options={suppliers.map(sup => ({ label: sup.name, value: sup.id }))} />
        <Field label="Or Enter Supplier Name" value={form.supplierName} onChangeText={v => setForm(f => ({ ...f, supplierName: v }))} placeholder="Type supplier name" />
        <Section title="Dates" />
        <Field label="Order Date" value={form.orderDate} onChangeText={v => setForm(f => ({ ...f, orderDate: v }))} required placeholder="YYYY-MM-DD" />
        <Field label="Expected Delivery" value={form.expectedDeliveryDate} onChangeText={v => setForm(f => ({ ...f, expectedDeliveryDate: v }))} placeholder="YYYY-MM-DD" />
        <SelectField label="Currency" value={form.currency} onChange={v => setForm(f => ({ ...f, currency: v }))} options={[{ label: 'ZMW', value: 'ZMW' }, { label: 'USD', value: 'USD' }]} />
        <Section title="Line Items" />
        {form.lines.map((line, i) => (
          <View key={i} style={s.lineItem}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280' }}>Line {i + 1}</Text>
              {form.lines.length > 1 && <TouchableOpacity onPress={() => setForm(f => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))}><Text style={{ color: '#DC2626', fontSize: 13 }}>Remove</Text></TouchableOpacity>}
            </View>
            <Field label="Description" value={line.description} onChangeText={v => setLine(i, 'description', v)} placeholder="Item / product" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Field label="Qty" value={line.quantity} onChangeText={v => setLine(i, 'quantity', v)} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 2 }}><Field label="Unit Price" value={line.unitPrice} onChangeText={v => setLine(i, 'unitPrice', v)} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Field label="Unit" value={line.unit} onChangeText={v => setLine(i, 'unit', v)} /></View>
            </View>
          </View>
        ))}
        <TouchableOpacity style={s.addLineBtn} onPress={() => setForm(f => ({ ...f, lines: [...f.lines, { description: '', quantity: '1', unitPrice: '', unit: 'pcs' }] }))}>
          <Text style={s.addLineTxt}>+ Add Line</Text>
        </TouchableOpacity>
        <Field label="Notes" value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} multiline />
      </FormModal>

      <FormModal visible={showReceive} title="Receive Goods (GRN)" onClose={() => setShowReceive(false)} onSubmit={receiveGoods} submitting={saving} submitLabel="Receive">
        <Field label="Received Date" value={receiveForm.receivedDate} onChangeText={v => setReceiveForm(f => ({ ...f, receivedDate: v }))} required placeholder="YYYY-MM-DD" />
        <Field label="Notes" value={receiveForm.notes} onChangeText={v => setReceiveForm(f => ({ ...f, notes: v }))} multiline placeholder="Delivery notes..." />
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── SUPPLIERS ─────────────────────────── */
function SuppliersTab({ tenantId }: { tenantId: string }) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', taxNumber: '', paymentTerms: '30', currency: 'ZMW' });

  const load = useCallback(async () => {
    try {
      const d = await gql<any>(`{ supplyChainSuppliers }`);
      const list = d?.supplyChainSuppliers || [];
      setSuppliers(list); setFiltered(list);
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setFiltered(suppliers.filter(sup => sup.name?.toLowerCase().includes(search.toLowerCase()) || sup.email?.toLowerCase().includes(search.toLowerCase()))); }, [search, suppliers]);

  const create = async () => {
    if (!form.name) { Alert.alert('Error', 'Name required'); return; }
    setSaving(true);
    try {
      const data = { name: form.name, email: form.email, phone: form.phone, address: form.address, taxNumber: form.taxNumber, paymentTermsDays: parseInt(form.paymentTerms) || 30, currency: form.currency };
      await gql<any>(`mutation($t:UUID!,$d:GenericScalar!){createSupplier(tenantId:$t,data:$d){ok error}}`, { t: tenantId, d: data });
      setShowCreate(false); setForm({ name: '', email: '', phone: '', address: '', taxNumber: '', paymentTerms: '30', currency: 'ZMW' }); load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <View style={s.searchWrap}>
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search suppliers…" placeholderTextColor="#9CA3AF" />
      </View>
      <ScrollView style={{ flex: 1 }}>
        <View style={[s.card, { marginBottom: 100 }]}>
          {filtered.length === 0 ? <Empty msg="No suppliers" /> : filtered.map((sup, i) => (
            <TouchableOpacity key={sup.id} style={[s.row, i < filtered.length - 1 && s.border]} onPress={() => setSelected(sup)} activeOpacity={0.7}>
              <View style={[s.avatar, { backgroundColor: '#EEF2FF' }]}>
                <Text style={[s.avatarTxt, { color: '#4F46E5' }]}>{sup.name?.[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{sup.name}</Text>
                {sup.email && <Text style={s.sub}>{sup.email}</Text>}
                {sup.phone && <Text style={s.sub2}>{sup.phone}</Text>}
              </View>
              <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{sup.currency}</Text>
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
              {[['Email', selected.email], ['Phone', selected.phone], ['Address', selected.address], ['Tax #', selected.taxNumber], ['Payment Terms', selected.paymentTerms ? `${selected.paymentTerms} days` : undefined], ['Currency', selected.currency]].filter(([, v]) => v).map(([l, v]) => (
                <View key={l} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                  <Text style={s.detailLabel}>{l}</Text><Text style={s.detailValue}>{v}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </Modal>

      <FormModal visible={showCreate} title="New Supplier" onClose={() => setShowCreate(false)} onSubmit={create} submitting={saving}>
        <Field label="Name" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} required />
        <Field label="Email" value={form.email} onChangeText={v => setForm(f => ({ ...f, email: v }))} keyboardType="email-address" />
        <Field label="Phone" value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} />
        <Field label="Address" value={form.address} onChangeText={v => setForm(f => ({ ...f, address: v }))} multiline />
        <Field label="Tax Number" value={form.taxNumber} onChangeText={v => setForm(f => ({ ...f, taxNumber: v }))} />
        <Field label="Payment Terms (days)" value={form.paymentTerms} onChangeText={v => setForm(f => ({ ...f, paymentTerms: v }))} keyboardType="numeric" />
        <SelectField label="Currency" value={form.currency} onChange={v => setForm(f => ({ ...f, currency: v }))} options={[{ label: 'ZMW', value: 'ZMW' }, { label: 'USD', value: 'USD' }]} />
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── PRODUCTS ─────────────────────────── */
function ProductsTab({ tenantId }: { tenantId: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', sku: '', description: '', unitPrice: '', costPrice: '', unit: 'pcs', reorderPoint: '10', category: '', trackStock: 'true' });
  const [adjForm, setAdjForm] = useState({ quantity: '', adjustmentType: 'add', reason: '' });

  const load = useCallback(async () => {
    try {
      const d = await gql<any>(`{ supplyChainProducts }`);
      const list = d?.supplyChainProducts || [];
      setProducts(list); setFiltered(list);
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setFiltered(products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase()))); }, [search, products]);

  const create = async () => {
    if (!form.name) { Alert.alert('Error', 'Name required'); return; }
    setSaving(true);
    try {
      const data = { name: form.name, sku: form.sku, description: form.description, unitPrice: parseFloat(form.unitPrice) || 0, costPrice: parseFloat(form.costPrice) || 0, unit: form.unit, reorderPoint: parseInt(form.reorderPoint) || 10, category: form.category, trackStock: form.trackStock === 'true' };
      await gql<any>(`mutation($t:UUID!,$d:GenericScalar!){saveSupplyChainProduct(tenantId:$t,data:$d){ok error}}`, { t: tenantId, d: data });
      setShowCreate(false); load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const adjustStock = async () => {
    if (!adjForm.quantity) { Alert.alert('Error', 'Enter quantity'); return; }
    setSaving(true);
    try {
      const data = { productId: selected.id, quantity: parseFloat(adjForm.quantity), adjustmentType: adjForm.adjustmentType, reason: adjForm.reason };
      await gql<any>(`mutation($t:UUID!,$d:GenericScalar!){adjustSupplyChainStock(tenantId:$t,data:$d){ok error}}`, { t: tenantId, d: data });
      setShowAdjust(false); setSelected(null); setAdjForm({ quantity: '', adjustmentType: 'add', reason: '' }); load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <View style={s.searchWrap}>
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search products…" placeholderTextColor="#9CA3AF" />
      </View>
      <ScrollView style={{ flex: 1 }}>
        <View style={[s.card, { marginBottom: 100 }]}>
          {filtered.length === 0 ? <Empty msg="No products" /> : filtered.map((p, i) => {
            const lowStock = p.stock != null && p.reorderPoint != null && p.stock <= p.reorderPoint;
            return (
              <TouchableOpacity key={p.id} style={[s.row, i < filtered.length - 1 && s.border]} onPress={() => setSelected(p)} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={s.main}>{p.name}</Text>
                  {p.sku && <Text style={s.sub}>SKU: {p.sku}</Text>}
                  {p.category && <Text style={s.sub2}>{p.category}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.amount}>{fmt(p.price ?? p.unit_price)}</Text>
                  <Text style={[s.sub, { marginTop: 3, color: lowStock ? '#DC2626' : '#6B7280' }]}>Stock: {p.stock ?? '–'}</Text>
                  {lowStock && <Text style={{ fontSize: 10, color: '#DC2626', fontWeight: '700' }}>LOW</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
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
              {[['SKU', selected.sku], ['Category', selected.category], ['Unit Price', fmt(selected.price ?? selected.unit_price)], ['Cost Price', fmt(selected.cost)], ['Stock Level', String(selected.stock ?? '–')], ['Reorder Point', String(selected.reorderPoint ?? '–')]].filter(([, v]) => v && v !== 'undefined').map(([l, v]) => (
                <View key={l} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                  <Text style={s.detailLabel}>{l}</Text><Text style={s.detailValue}>{v}</Text>
                </View>
              ))}
            </View>
            <View style={s.actionRow}>
              <ActionBtn label="Adjust Stock" onPress={() => setShowAdjust(true)} />
            </View>
          </ScrollView>
        )}
      </Modal>

      <FormModal visible={showCreate} title="New Product" onClose={() => setShowCreate(false)} onSubmit={create} submitting={saving}>
        <Field label="Name" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} required />
        <Field label="SKU" value={form.sku} onChangeText={v => setForm(f => ({ ...f, sku: v }))} placeholder="e.g. PROD-001" />
        <Field label="Category" value={form.category} onChangeText={v => setForm(f => ({ ...f, category: v }))} />
        <Field label="Description" value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} multiline />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Field label="Unit Price" value={form.unitPrice} onChangeText={v => setForm(f => ({ ...f, unitPrice: v }))} keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Cost Price" value={form.costPrice} onChangeText={v => setForm(f => ({ ...f, costPrice: v }))} keyboardType="decimal-pad" /></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Field label="Unit" value={form.unit} onChangeText={v => setForm(f => ({ ...f, unit: v }))} placeholder="pcs, kg, l…" /></View>
          <View style={{ flex: 1 }}><Field label="Reorder Point" value={form.reorderPoint} onChangeText={v => setForm(f => ({ ...f, reorderPoint: v }))} keyboardType="numeric" /></View>
        </View>
        <SelectField label="Track Stock" value={form.trackStock} onChange={v => setForm(f => ({ ...f, trackStock: v }))} options={[{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }]} />
      </FormModal>

      <FormModal visible={showAdjust} title="Adjust Stock" onClose={() => setShowAdjust(false)} onSubmit={adjustStock} submitting={saving} submitLabel="Adjust">
        <SelectField label="Adjustment Type" value={adjForm.adjustmentType} onChange={v => setAdjForm(f => ({ ...f, adjustmentType: v }))} options={[{ label: 'Add Stock', value: 'add' }, { label: 'Remove Stock', value: 'remove' }, { label: 'Set to Value', value: 'set' }]} />
        <Field label="Quantity" value={adjForm.quantity} onChangeText={v => setAdjForm(f => ({ ...f, quantity: v }))} keyboardType="decimal-pad" required />
        <Field label="Reason" value={adjForm.reason} onChangeText={v => setAdjForm(f => ({ ...f, reason: v }))} multiline placeholder="Reason for adjustment" />
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── INVENTORY ─────────────────────────── */
function InventoryTab({ tenantId }: { tenantId: string }) {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [wData, pData] = await Promise.all([
          gql<any>(`{ supplyChainWarehouses }`),
          gql<any>(`{ supplyChainProducts }`),
        ]);
        setWarehouses(wData?.supplyChainWarehouses || []);
        const prods = pData?.supplyChainProducts || [];
        setLowStock(prods.filter((p: any) => p.stock != null && p.reorderPoint != null && p.stock <= p.reorderPoint));
      } catch {} finally { setLoading(false); }
    })();
  }, [tenantId]);

  if (loading) return <Loader />;
  return (
    <ScrollView style={{ flex: 1 }}>
      {warehouses.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Warehouses</Text>
          <View style={[s.card, { marginBottom: 12 }]}>
            {warehouses.map((w, i) => {
              const pct = w.capacity > 0 ? Math.min(100, (w.usedCapacity / w.capacity) * 100) : 0;
              return (
                <View key={w.id} style={[s.row, i < warehouses.length - 1 && s.border, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                    <Text style={s.main}>{w.name}</Text>
                    <Text style={s.sub}>{w.usedCapacity}/{w.capacity} units</Text>
                  </View>
                  {w.location && <Text style={s.sub2}>{w.location}</Text>}
                  <View style={s.progressBg}>
                    <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: pct > 80 ? '#DC2626' : GOLD }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
      <Text style={s.sectionTitle}>Low Stock Alerts ({lowStock.length})</Text>
      <View style={[s.card, { marginBottom: 32 }]}>
        {lowStock.length === 0 ? <Empty msg="No low stock items" /> : lowStock.map((p, i) => (
          <View key={p.id} style={[s.row, i < lowStock.length - 1 && s.border]}>
            <View style={[s.alertDot, { backgroundColor: p.stockLevel === 0 ? '#DC2626' : '#F59E0B' }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.main}>{p.name}</Text>
              {p.sku && <Text style={s.sub}>{p.sku}</Text>}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#DC2626' }}>{p.stock}</Text>
              <Text style={{ fontSize: 11, color: '#9CA3AF' }}>min: {p.reorderPoint}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────── STOCK COUNT ─────────────────────────── */
function StockCountTab({ tenantId }: { tenantId: string }) {
  const [counts, setCounts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCount, setActiveCount] = useState<any>(null);
  const [showStart, setShowStart] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startNotes, setStartNotes] = useState('');
  const [countLines, setCountLines] = useState<Array<{ productId: string; name: string; qty: string }>>([]);

  const load = useCallback(async () => {
    try {
      const [cData, pData] = await Promise.all([
        gql<any>(`query($t:UUID!){stockCounts(tenantId:$t,limit:50)}`, { t: tenantId }),
        gql<any>(`{ supplyChainProducts }`),
      ]);
      setCounts(parseList(cData?.stockCounts));
      setProducts(parseList(pData?.supplyChainProducts));
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const startCount = async () => {
    setSaving(true);
    try {
      const d = await gql<any>(`mutation($t:UUID!,$n:String){startStockCount(tenantId:$t,notes:$n){ok error stockCount{id referenceNumber}}}`,
        { t: tenantId, n: startNotes });
      const sc = d?.startStockCount?.stockCount;
      if (sc) { setActiveCount(sc); setCountLines(products.map(p => ({ productId: p.id, name: p.name, qty: '' }))); }
      setShowStart(false); load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const submitCount = async () => {
    const lines = countLines.filter(l => l.qty !== '');
    if (lines.length === 0) { Alert.alert('Error', 'Enter at least one count'); return; }
    setSaving(true);
    try {
      for (const line of lines) {
        await gql<any>(`mutation($id:UUID!,$pid:UUID!,$qty:Float!){recordCountLine(stockCountId:$id,productId:$pid,countedQuantity:$qty){ok error}}`,
          { id: activeCount.id, pid: line.productId, qty: parseFloat(line.qty) });
      }
      await gql<any>(`mutation($id:UUID!){completeStockCount(stockCountId:$id){ok error}}`, { id: activeCount.id });
      setActiveCount(null); setCountLines([]); load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  if (loading) return <Loader />;

  if (activeCount) {
    return (
      <View style={{ flex: 1 }}>
        <View style={[s.card, { marginTop: 12 }]}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: NAVY, padding: 12 }}>Active Count: {activeCount.referenceNumber}</Text>
        </View>
        <ScrollView style={{ flex: 1, marginTop: 8 }}>
          <Text style={s.sectionTitle}>Enter Counted Quantities</Text>
          <View style={[s.card, { marginBottom: 100 }]}>
            {countLines.map((line, i) => (
              <View key={line.productId} style={[s.row, i < countLines.length - 1 && s.border]}>
                <Text style={[s.main, { flex: 1 }]}>{line.name}</Text>
                <TextInput
                  style={s.countInput}
                  value={line.qty}
                  onChangeText={v => setCountLines(cl => cl.map((l, j) => j === i ? { ...l, qty: v } : l))}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            ))}
          </View>
        </ScrollView>
        <View style={{ flexDirection: 'row', padding: 16, gap: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
          <TouchableOpacity style={[s.actionBtn, { flex: 1, alignItems: 'center', backgroundColor: '#6B7280' }]} onPress={() => { setActiveCount(null); setCountLines([]); }}>
            <Text style={s.actionBtnTxt}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, { flex: 2, alignItems: 'center', opacity: saving ? 0.5 : 1 }]} onPress={submitCount} disabled={saving}>
            <Text style={s.actionBtnTxt}>{saving ? 'Submitting…' : 'Complete Count'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Stock Counts</Text>
        <View style={[s.card, { marginBottom: 100 }]}>
          {counts.length === 0 ? <Empty msg="No stock counts yet" /> : counts.map((c, i) => (
            <View key={c.id} style={[s.row, i < counts.length - 1 && s.border]}>
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{c.referenceNumber}</Text>
                <Text style={s.sub}>{c.startedAt?.slice(0, 10)}</Text>
              </View>
              <StatusBadge status={c.status} />
            </View>
          ))}
        </View>
      </ScrollView>
      <FAB onPress={() => setShowStart(true)} />

      <FormModal visible={showStart} title="Start Stock Count" onClose={() => setShowStart(false)} onSubmit={startCount} submitting={saving} submitLabel="Start">
        <Field label="Notes" value={startNotes} onChangeText={setStartNotes} multiline placeholder="Reason / area for count" />
      </FormModal>
    </View>
  );
}

export default function SupplyChainScreen() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id || '';
  const [tab, setTab] = useState('po');
  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      <ModuleTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'po' && <PurchaseOrdersTab tenantId={tenantId} />}
      {tab === 'suppliers' && <SuppliersTab tenantId={tenantId} />}
      {tab === 'products' && <ProductsTab tenantId={tenantId} />}
      {tab === 'inventory' && <InventoryTab tenantId={tenantId} />}
      {tab === 'stockcount' && <StockCountTab tenantId={tenantId} />}
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
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#fff' },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: NAVY },
  modalClose: { fontSize: 18, color: '#6B7280', padding: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  detailLabel: { fontSize: 13, color: '#6B7280' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16 },
  actionBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, backgroundColor: NAVY },
  actionBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  lineItem: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  addLineBtn: { borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 14 },
  addLineTxt: { color: NAVY, fontSize: 13, fontWeight: '600' },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  searchInput: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' },
  progressBg: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, width: '100%', marginTop: 8 },
  progressFill: { height: 6, borderRadius: 3 },
  alertDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  countInput: { width: 70, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, textAlign: 'center', color: '#111827' },
});
