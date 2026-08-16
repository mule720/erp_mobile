import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet,
  TouchableOpacity, Modal, Alert, TextInput,
} from 'react-native';
import { gql } from '../api/graphql';
const parseList = (v: any): any[] => Array.isArray(v) ? v : (typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch { return []; } })() : []);
import { useAuth } from '../store/AuthContext';
import { useRole } from '../store/RoleContext';
import ModuleTabs from '../components/ModuleTabs';
import FormModal from '../components/FormModal';
import { Field, SelectField, Section } from '../components/Field';
import FAB from '../components/FAB';

const NAVY = '#1E3A5F';
const GOLD = '#C9A84C';
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n: any, cur = 'ZMW') =>
  new Intl.NumberFormat('en-ZM', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(Number(n ?? 0));

const TABS = [
  { key: 'products', label: 'Products' },
  { key: 'categories', label: 'Categories' },
  { key: 'stock', label: 'Stock' },
  { key: 'wastage', label: 'Wastage' },
  { key: 'warehouses', label: 'Warehouses' },
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

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.chip, active && s.chipActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[s.chipTxt, active && s.chipTxtActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ─────────────────────────── PRODUCTS ─────────────────────────── */
function ProductsTab({ tenantId }: { tenantId: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [saving, setSaving] = useState(false);

  const blankForm = { name: '', sku: '', description: '', unitPrice: '', costPrice: '', unit: 'pcs', reorderPoint: '10', category: '', trackStock: 'true' };
  const [form, setForm] = useState(blankForm);
  const [adjForm, setAdjForm] = useState({ quantity: '', adjustmentType: 'add', reason: '' });

  const load = useCallback(async () => {
    try {
      const d = await gql<any>(`{ supplyChainProducts }`);
      const list = parseList(d?.supplyChainProducts);
      setProducts(list);
      const cats = ['All', ...Array.from(new Set<string>(list.map((p: any) => p.category).filter(Boolean))) as string[]];
      setCategories(cats);
    } catch { } finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let list = products;
    if (catFilter !== 'All') list = list.filter((p: any) => p.category === catFilter);
    if (search) list = list.filter((p: any) => p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase()));
    setFiltered(list);
  }, [products, search, catFilter]);

  const save = async (isEdit: boolean) => {
    if (!form.name) { Alert.alert('Error', 'Name required'); return; }
    setSaving(true);
    try {
      const data: any = {
        name: form.name, sku: form.sku, description: form.description,
        unitPrice: parseFloat(form.unitPrice) || 0,
        costPrice: parseFloat(form.costPrice) || 0,
        unit: form.unit,
        reorderPoint: parseInt(form.reorderPoint) || 10,
        category: form.category,
        trackStock: form.trackStock === 'true',
      };
      if (isEdit && selected) data.id = selected.id;
      await gql<any>(`mutation($t:UUID!,$d:GenericScalar!){saveSupplyChainProduct(tenantId:$t,data:$d){ok error}}`, { t: tenantId, d: data });
      isEdit ? setShowEdit(false) : setShowCreate(false);
      setForm(blankForm);
      if (isEdit) setSelected(null);
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const adjustStock = async () => {
    if (!adjForm.quantity) { Alert.alert('Error', 'Enter quantity'); return; }
    setSaving(true);
    try {
      const data = { productId: selected.id, quantity: parseFloat(adjForm.quantity), adjustmentType: adjForm.adjustmentType, reason: adjForm.reason };
      await gql<any>(`mutation($t:UUID!,$d:GenericScalar!){adjustSupplyChainStock(tenantId:$t,data:$d){ok error}}`, { t: tenantId, d: data });
      setShowAdjust(false);
      setSelected(null);
      setAdjForm({ quantity: '', adjustmentType: 'add', reason: '' });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const openEdit = () => {
    setForm({
      name: selected.name || '',
      sku: selected.sku || '',
      description: selected.description || '',
      unitPrice: String(selected.price ?? selected.unit_price ?? ''),
      costPrice: String(selected.cost ?? ''),
      unit: selected.unit || 'pcs',
      reorderPoint: String(selected.reorderPoint ?? '10'),
      category: selected.category || '',
      trackStock: selected.trackStock === false ? 'false' : 'true',
    });
    setShowEdit(true);
  };

  const productForm = (
    <>
      <Field label="Name" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} required />
      <Field label="SKU" value={form.sku} onChangeText={v => setForm(f => ({ ...f, sku: v }))} placeholder="e.g. PROD-001" />
      <Field label="Category" value={form.category} onChangeText={v => setForm(f => ({ ...f, category: v }))} />
      <Field label="Description" value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} multiline />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="Unit Price" value={form.unitPrice} onChangeText={v => setForm(f => ({ ...f, unitPrice: v }))} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label="Cost Price" value={form.costPrice} onChangeText={v => setForm(f => ({ ...f, costPrice: v }))} keyboardType="decimal-pad" /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="Unit" value={form.unit} onChangeText={v => setForm(f => ({ ...f, unit: v }))} placeholder="pcs, kg…" /></View>
        <View style={{ flex: 1 }}><Field label="Reorder Point" value={form.reorderPoint} onChangeText={v => setForm(f => ({ ...f, reorderPoint: v }))} keyboardType="numeric" /></View>
      </View>
      <SelectField label="Track Stock" value={form.trackStock} onChange={v => setForm(f => ({ ...f, trackStock: v }))} options={[{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }]} />
    </>
  );

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <View style={s.searchWrap}>
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search products…" placeholderTextColor="#9CA3AF" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {categories.map(c => (
          <FilterChip key={c} label={c} active={catFilter === c} onPress={() => setCatFilter(c)} />
        ))}
      </ScrollView>
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Products ({filtered.length})</Text>
        <View style={[s.card, { marginBottom: 100 }]}>
          {filtered.length === 0 ? <Empty msg="No products" /> : filtered.map((p, i) => {
            const lowStock = p.stock != null && p.reorderPoint != null && p.stock <= p.reorderPoint;
            return (
              <TouchableOpacity key={p.id} style={[s.row, i < filtered.length - 1 && s.border]} onPress={() => setSelected(p)} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={s.main}>{p.name}</Text>
                  {p.sku ? <Text style={s.sub}>SKU: {p.sku}</Text> : null}
                  {p.category ? <Text style={s.sub2}>{p.category}</Text> : null}
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
      <FAB onPress={() => { setForm(blankForm); setShowCreate(true); }} />

      {/* Detail modal */}
      <Modal visible={!!selected && !showEdit && !showAdjust} animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>{selected?.name}</Text>
          <TouchableOpacity onPress={() => setSelected(null)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        {selected && (
          <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
            <View style={[s.card, { marginTop: 12 }]}>
              {([
                ['SKU', selected.sku],
                ['Category', selected.category],
                ['Unit Price', fmt(selected.price ?? selected.unit_price)],
                ['Cost Price', fmt(selected.cost)],
                ['Stock Level', String(selected.stock ?? '–')],
                ['Reorder Point', String(selected.reorderPoint ?? '–')],
                ['Unit', selected.unit],
                ['Description', selected.description],
              ] as [string, any][]).filter(([, v]) => v && v !== 'undefined').map(([l, v]) => (
                <View key={l} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                  <Text style={s.detailLabel}>{l}</Text>
                  <Text style={s.detailValue}>{v}</Text>
                </View>
              ))}
            </View>
            <View style={s.actionRow}>
              <ActionBtn label="Edit" color={GOLD} onPress={openEdit} />
              <ActionBtn label="Adjust Stock" onPress={() => setShowAdjust(true)} />
            </View>
          </ScrollView>
        )}
      </Modal>

      <FormModal visible={showCreate} title="New Product" onClose={() => setShowCreate(false)} onSubmit={() => save(false)} submitting={saving}>
        {productForm}
      </FormModal>

      <FormModal visible={showEdit} title="Edit Product" onClose={() => setShowEdit(false)} onSubmit={() => save(true)} submitting={saving} submitLabel="Save Changes">
        {productForm}
      </FormModal>

      <FormModal visible={showAdjust} title="Adjust Stock" onClose={() => setShowAdjust(false)} onSubmit={adjustStock} submitting={saving} submitLabel="Adjust">
        <SelectField label="Type" value={adjForm.adjustmentType} onChange={v => setAdjForm(f => ({ ...f, adjustmentType: v }))}
          options={[{ label: 'Add Stock', value: 'add' }, { label: 'Remove Stock', value: 'remove' }, { label: 'Set to Value', value: 'set' }]} />
        <Field label="Quantity" value={adjForm.quantity} onChangeText={v => setAdjForm(f => ({ ...f, quantity: v }))} keyboardType="decimal-pad" required />
        <Field label="Reason" value={adjForm.reason} onChangeText={v => setAdjForm(f => ({ ...f, reason: v }))} multiline placeholder="Reason for adjustment" />
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── CATEGORIES ─────────────────────────── */
function CategoriesTab({ tenantId }: { tenantId: string }) {
  const [cats, setCats] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  const load = useCallback(async () => {
    try {
      const d = await gql<any>(`{ supplyChainProducts }`);
      const prods = parseList(d?.supplyChainProducts);
      setProducts(prods);
      const catNames = Array.from(new Set<string>(prods.map((p: any) => p.category).filter(Boolean)));
      setCats(catNames.map(name => ({
        id: name, name,
        description: '',
        productCount: prods.filter((p: any) => p.category === name).length,
      })));
    } catch { } finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.name) { Alert.alert('Error', 'Name required'); return; }
    // Categories are stored as strings on products; create a dummy product to seed the category
    Alert.alert('Info', `Category "${form.name}" will appear once a product is assigned to it.`);
    setShowCreate(false);
    setForm({ name: '', description: '' });
  };

  const catProducts = selected ? products.filter((p: any) => p.category === selected.name) : [];

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Categories ({cats.length})</Text>
        <View style={[s.card, { marginBottom: 100 }]}>
          {cats.length === 0 ? <Empty msg="No categories" /> : cats.map((c, i) => (
            <TouchableOpacity key={c.id} style={[s.row, i < cats.length - 1 && s.border]} onPress={() => setSelected(c)} activeOpacity={0.7}>
              <View style={[s.catIcon, { backgroundColor: NAVY + '15' }]}>
                <Text style={{ fontSize: 15, color: NAVY, fontWeight: '700' }}>{c.name?.[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{c.name}</Text>
                {c.description ? <Text style={s.sub}>{c.description}</Text> : null}
              </View>
              <View style={s.countBadge}>
                <Text style={s.countBadgeTxt}>{c.productCount ?? 0}</Text>
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
            {selected.description ? (
              <View style={[s.card, { marginTop: 12 }]}>
                <Text style={[s.sub, { paddingVertical: 10 }]}>{selected.description}</Text>
              </View>
            ) : null}
            <Text style={s.sectionTitle}>Products in "{selected.name}" ({catProducts.length})</Text>
            <View style={[s.card, { marginBottom: 32 }]}>
              {catProducts.length === 0 ? <Empty msg="No products in this category" /> : catProducts.map((p: any, i: number) => (
                <View key={p.id} style={[s.row, i < catProducts.length - 1 && s.border]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.main}>{p.name}</Text>
                    {p.sku ? <Text style={s.sub}>SKU: {p.sku}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </Modal>

      <FormModal visible={showCreate} title="New Category" onClose={() => setShowCreate(false)} onSubmit={create} submitting={saving}>
        <Field label="Name" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} required />
        <Field label="Description" value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} multiline />
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── STOCK MOVEMENTS ─────────────────────────── */
const MOVEMENT_FILTERS = ['All', 'In', 'Out', 'Adjustment'];
const MOVEMENT_COLORS: Record<string, string> = { in: '#16A34A', out: '#DC2626', adjustment: '#2563EB', transfer: '#9333EA' };
const MOVEMENT_ICONS: Record<string, string> = { in: '↑', out: '↓', adjustment: '⇄', transfer: '→' };

function StockTab({ tenantId }: { tenantId: string }) {
  const [movements, setMovements] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await gql<any>(`{ supplyChainStockMovements }`);
      setMovements(parseList(d?.supplyChainStockMovements));
    } catch { } finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (filter === 'All') { setFiltered(movements); return; }
    const key = filter.toLowerCase();
    setFiltered(movements.filter((m: any) => m.movementType?.toLowerCase().includes(key)));
  }, [movements, filter]);

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {MOVEMENT_FILTERS.map(f => (
          <FilterChip key={f} label={f} active={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ScrollView>
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Stock Movements ({filtered.length})</Text>
        <View style={[s.card, { marginBottom: 32 }]}>
          {filtered.length === 0 ? <Empty msg="No stock movements" /> : filtered.map((m, i) => {
            const type = m.movementType?.toLowerCase() || 'in';
            const color = MOVEMENT_COLORS[type] || NAVY;
            const icon = MOVEMENT_ICONS[type] || '•';
            return (
              <View key={m.id} style={[s.row, i < filtered.length - 1 && s.border]}>
                <View style={[s.movIcon, { backgroundColor: color + '18' }]}>
                  <Text style={{ color, fontSize: 16, fontWeight: '800' }}>{icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.main}>{m.product?.name || '–'}</Text>
                  <Text style={s.sub}>{m.date?.slice(0, 10)} · {m.movementType}</Text>
                  {(m.warehouseFrom?.name || m.warehouseTo?.name) && (
                    <Text style={s.sub2}>{m.warehouseFrom?.name ?? '–'} → {m.warehouseTo?.name ?? '–'}</Text>
                  )}
                  {m.reference ? <Text style={s.sub2}>Ref: {m.reference}</Text> : null}
                </View>
                <Text style={[s.amount, { color }]}>{m.quantity > 0 ? '+' : ''}{m.quantity}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────── WASTAGE ─────────────────────────── */
function WastageTab({ tenantId }: { tenantId: string }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ productId: '', quantity: '', reason: '', date: today(), estimatedCost: '' });

  const load = useCallback(async () => {
    try {
      const [wData, pData] = await Promise.all([
        gql<any>(`query($t:UUID!){wastageNotes(tenantId:$t,limit:100)}`, { t: tenantId }),
        gql<any>(`{ supplyChainProducts }`),
      ]);
      setNotes(parseList(wData?.wastageNotes));
      setProducts(parseList(pData?.supplyChainProducts));
    } catch { } finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const record = async () => {
    if (!form.productId || !form.quantity) { Alert.alert('Error', 'Product and quantity required'); return; }
    setSaving(true);
    try {
      const data: any = {
        productId: form.productId,
        quantity: parseFloat(form.quantity) || 0,
        reason: form.reason,
        date: form.date,
      };
      if (form.estimatedCost) data.estimatedCost = parseFloat(form.estimatedCost);
      await gql<any>(`mutation($t:UUID!,$d:GenericScalar!){createWastageNote(tenantId:$t,data:$d){ok error}}`, { t: tenantId, d: data });
      setShowCreate(false);
      setForm({ productId: '', quantity: '', reason: '', date: today(), estimatedCost: '' });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const totalCost = notes.reduce((sum, n) => sum + (Number(n.cost) || 0), 0);

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <View style={s.statRow}>
          <View style={s.statCard}>
            <Text style={s.statNum}>{notes.length}</Text>
            <Text style={s.statLbl}>Total Records</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statNum, { fontSize: 16 }]}>{fmt(totalCost)}</Text>
            <Text style={s.statLbl}>Total Cost</Text>
          </View>
        </View>
        <Text style={s.sectionTitle}>Wastage Records</Text>
        <View style={[s.card, { marginBottom: 100 }]}>
          {notes.length === 0 ? <Empty msg="No wastage records" /> : notes.map((n, i) => (
            <View key={n.id} style={[s.row, i < notes.length - 1 && s.border]}>
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{n.product?.name || '–'}</Text>
                <Text style={s.sub}>{n.date?.slice(0, 10)} · Qty: {n.quantity}</Text>
                {n.reason ? <Text style={s.sub2}>{n.reason}</Text> : null}
              </View>
              {n.cost ? <Text style={[s.amount, { color: '#DC2626' }]}>{fmt(n.cost)}</Text> : null}
            </View>
          ))}
        </View>
      </ScrollView>
      <FAB onPress={() => setShowCreate(true)} />

      <FormModal visible={showCreate} title="Record Wastage" onClose={() => setShowCreate(false)} onSubmit={record} submitting={saving}>
        <SelectField
          label="Product"
          value={form.productId}
          onChange={v => setForm(f => ({ ...f, productId: v }))}
          options={products.map(p => ({ label: p.name, value: p.id }))}
        />
        <Field label="Date" value={form.date} onChangeText={v => setForm(f => ({ ...f, date: v }))} placeholder="YYYY-MM-DD" required />
        <Field label="Quantity" value={form.quantity} onChangeText={v => setForm(f => ({ ...f, quantity: v }))} keyboardType="decimal-pad" required />
        <Field label="Estimated Cost" value={form.estimatedCost} onChangeText={v => setForm(f => ({ ...f, estimatedCost: v }))} keyboardType="decimal-pad" />
        <Field label="Reason" value={form.reason} onChangeText={v => setForm(f => ({ ...f, reason: v }))} multiline placeholder="Why was this wasted?" />
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── WAREHOUSES ─────────────────────────── */
function WarehousesTab({ tenantId }: { tenantId: string }) {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', capacity: '' });

  const load = useCallback(async () => {
    try {
      const d = await gql<any>(`{ supplyChainWarehouses }`);
      setWarehouses(parseList(d?.supplyChainWarehouses));
    } catch { } finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.name) { Alert.alert('Error', 'Name required'); return; }
    setSaving(true);
    try {
      const data = { name: form.name, location: form.location, capacity: parseFloat(form.capacity) || 0 };
      await gql<any>(`mutation($t:UUID!,$d:GenericScalar!){createWarehouse(tenantId:$t,data:$d){ok error}}`, { t: tenantId, d: data });
      setShowCreate(false);
      setForm({ name: '', location: '', capacity: '' });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Warehouses ({warehouses.length})</Text>
        <View style={[s.card, { marginBottom: 100 }]}>
          {warehouses.length === 0 ? <Empty msg="No warehouses" /> : warehouses.map((w, i) => {
            const pct = w.capacity > 0 ? Math.min(100, (w.usedCapacity / w.capacity) * 100) : 0;
            const fillColor = pct > 85 ? '#DC2626' : pct > 60 ? GOLD : '#16A34A';
            return (
              <View key={w.id} style={[s.row, i < warehouses.length - 1 && s.border, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 4 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.main}>{w.name}</Text>
                    {w.location ? <Text style={s.sub}>{w.location}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.sub}>{w.usedCapacity ?? 0} / {w.capacity ?? 0} units</Text>
                    <Text style={[s.sub2, { color: fillColor }]}>{Math.round(pct)}% full</Text>
                  </View>
                </View>
                <View style={s.progressBg}>
                  <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: fillColor }]} />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <FAB onPress={() => setShowCreate(true)} />

      <FormModal visible={showCreate} title="New Warehouse" onClose={() => setShowCreate(false)} onSubmit={create} submitting={saving}>
        <Field label="Name" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} required />
        <Field label="Location" value={form.location} onChangeText={v => setForm(f => ({ ...f, location: v }))} placeholder="Physical address or zone" />
        <Field label="Capacity (units)" value={form.capacity} onChangeText={v => setForm(f => ({ ...f, capacity: v }))} keyboardType="numeric" />
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── MAIN SCREEN ─────────────────────────── */
export default function InventoryScreen() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id || '';
  const [tab, setTab] = useState('products');
  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      <ModuleTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'products' && <ProductsTab tenantId={tenantId} />}
      {tab === 'categories' && <CategoriesTab tenantId={tenantId} />}
      {tab === 'stock' && <StockTab tenantId={tenantId} />}
      {tab === 'wastage' && <WastageTab tenantId={tenantId} />}
      {tab === 'warehouses' && <WarehousesTab tenantId={tenantId} />}
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
  searchWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  searchInput: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' },
  chipRow: { paddingVertical: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  chipActive: { backgroundColor: NAVY, borderColor: NAVY },
  chipTxt: { fontSize: 12, fontWeight: '600', color: '#374151' },
  chipTxtActive: { color: '#fff' },
  progressBg: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, width: '100%', marginTop: 6, marginBottom: 4 },
  progressFill: { height: 6, borderRadius: 3 },
  movIcon: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  catIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  countBadge: { backgroundColor: NAVY + '18', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  countBadgeTxt: { fontSize: 13, fontWeight: '700', color: NAVY },
  statRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  statNum: { fontSize: 20, fontWeight: '800', color: NAVY },
  statLbl: { fontSize: 11, color: '#6B7280', marginTop: 2 },
});
