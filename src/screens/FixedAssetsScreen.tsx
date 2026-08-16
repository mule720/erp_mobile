import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet,
  TouchableOpacity, Modal, Alert, RefreshControl,
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
const fmt = (n: any) =>
  new Intl.NumberFormat('en-ZM', { style: 'currency', currency: 'ZMW' }).format(Number(n ?? 0));

const TABS = [
  { key: 'register', label: 'Asset Register' },
  { key: 'depreciation', label: 'Depreciation' },
  { key: 'categories', label: 'Categories' },
  { key: 'maintenance', label: 'Maintenance' },
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

/* ─────────────────────────── ASSET REGISTER ─────────────────────────── */
function AssetRegisterTab({ tenantId }: { tenantId: string }) {
  const { isAdmin } = useRole();
  const [assets, setAssets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDispose, setShowDispose] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '', categoryId: '', purchaseDate: today(), purchasePrice: '',
    usefulLife: '', residualValue: '', depreciationMethod: 'straight_line',
    location: '', serialNumber: '',
  });
  const [disposeForm, setDisposeForm] = useState({ disposalDate: today(), disposalValue: '' });

  const load = useCallback(async () => {
    try {
      const [aData, cData] = await Promise.all([
        gql<any>(`query($t:UUID!){fixedAssets(tenantId:$t)}`, { t: tenantId }),
        gql<any>(`query($t:UUID!){assetCategories(tenantId:$t)}`, { t: tenantId }),
      ]);
      setAssets(parseList(aData?.fixedAssets));
      setCategories(parseList(cData?.assetCategories));
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const createAsset = async () => {
    if (!form.name) { Alert.alert('Error', 'Asset name required'); return; }
    setSaving(true);
    try {
      const data: any = {
        name: form.name,
        categoryId: form.categoryId || undefined,
        purchaseDate: form.purchaseDate,
        purchasePrice: parseFloat(form.purchasePrice) || 0,
        usefulLife: parseInt(form.usefulLife) || 0,
        residualValue: parseFloat(form.residualValue) || 0,
        depreciationMethod: form.depreciationMethod,
        location: form.location || undefined,
        serialNumber: form.serialNumber || undefined,
      };
      await gql<any>(`mutation($t:UUID!,$d:GenericScalar!){createFixedAsset(tenantId:$t,data:$d){ok error}}`, { t: tenantId, d: data });
      setShowCreate(false);
      setForm({ name: '', categoryId: '', purchaseDate: today(), purchasePrice: '', usefulLife: '', residualValue: '', depreciationMethod: 'straight_line', location: '', serialNumber: '' });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const disposeAsset = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await gql<any>(`mutation($id:UUID!,$date:Date!,$val:Float!){disposeAsset(assetId:$id,disposalDate:$date,disposalValue:$val){ok error}}`,
        { id: selected.id, date: disposeForm.disposalDate, val: parseFloat(disposeForm.disposalValue) || 0 });
      setShowDispose(false);
      setSelected(null);
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Fixed Assets ({assets.length})</Text>
        <View style={[s.card, { marginBottom: 100 }]}>
          {assets.length === 0 ? <Empty msg="No assets registered" /> : assets.map((a, i) => (
            <TouchableOpacity key={a.id} style={[s.row, i < assets.length - 1 && s.border]} onPress={() => setSelected(a)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{a.name}</Text>
                <Text style={s.sub}>{a.category?.name || 'Uncategorised'} · {a.purchaseDate?.slice(0, 10)}</Text>
                {a.location && <Text style={s.sub2}>{a.location}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.amount}>{fmt(a.currentValue)}</Text>
                <View style={{ marginTop: 4 }}><StatusBadge status={a.status} /></View>
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
              {[
                ['Category', selected.category?.name],
                ['Purchase Date', selected.purchaseDate?.slice(0, 10)],
                ['Purchase Price', fmt(selected.purchasePrice)],
                ['Current Value', fmt(selected.currentValue)],
                ['Useful Life', selected.usefulLife ? `${selected.usefulLife} years` : undefined],
                ['Depreciation', selected.depreciationMethod?.replace('_', ' ')],
                ['Location', selected.location],
                ['Serial #', selected.serialNumber],
                ['Status', selected.status],
              ].filter(([, v]) => v).map(([l, v]) => (
                <View key={String(l)} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                  <Text style={s.detailLabel}>{l}</Text><Text style={s.detailValue}>{v}</Text>
                </View>
              ))}
            </View>
            {isAdmin && selected.status !== 'disposed' && (
              <View style={s.actionRow}>
                <ActionBtn label="Dispose Asset" color="#DC2626" onPress={() => setShowDispose(true)} />
              </View>
            )}
          </ScrollView>
        )}
      </Modal>

      <FormModal visible={showCreate} title="New Fixed Asset" onClose={() => setShowCreate(false)} onSubmit={createAsset} submitting={saving}>
        <Section title="Asset Details" />
        <Field label="Name" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} required />
        <SelectField label="Category" value={form.categoryId} onChange={v => setForm(f => ({ ...f, categoryId: v }))} options={categories.map(c => ({ label: c.name, value: c.id }))} />
        <Field label="Serial Number" value={form.serialNumber} onChangeText={v => setForm(f => ({ ...f, serialNumber: v }))} />
        <Field label="Location" value={form.location} onChangeText={v => setForm(f => ({ ...f, location: v }))} />
        <Section title="Financials" />
        <Field label="Purchase Date" value={form.purchaseDate} onChangeText={v => setForm(f => ({ ...f, purchaseDate: v }))} placeholder="YYYY-MM-DD" required />
        <Field label="Purchase Price (ZMW)" value={form.purchasePrice} onChangeText={v => setForm(f => ({ ...f, purchasePrice: v }))} keyboardType="decimal-pad" />
        <Field label="Useful Life (years)" value={form.usefulLife} onChangeText={v => setForm(f => ({ ...f, usefulLife: v }))} keyboardType="numeric" />
        <Field label="Residual Value (ZMW)" value={form.residualValue} onChangeText={v => setForm(f => ({ ...f, residualValue: v }))} keyboardType="decimal-pad" />
        <SelectField label="Depreciation Method" value={form.depreciationMethod} onChange={v => setForm(f => ({ ...f, depreciationMethod: v }))} options={[{ label: 'Straight Line', value: 'straight_line' }, { label: 'Reducing Balance', value: 'reducing_balance' }]} />
      </FormModal>

      <FormModal visible={showDispose} title="Dispose Asset" onClose={() => setShowDispose(false)} onSubmit={disposeAsset} submitting={saving} submitLabel="Dispose">
        <Field label="Disposal Date" value={disposeForm.disposalDate} onChangeText={v => setDisposeForm(f => ({ ...f, disposalDate: v }))} required placeholder="YYYY-MM-DD" />
        <Field label="Disposal Value (ZMW)" value={disposeForm.disposalValue} onChangeText={v => setDisposeForm(f => ({ ...f, disposalValue: v }))} keyboardType="decimal-pad" />
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── DEPRECIATION ─────────────────────────── */
function DepreciationTab({ tenantId }: { tenantId: string }) {
  const { isAdmin } = useRole();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const [period, setPeriod] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await gql<any>(`query($t:UUID!){assetDepreciationSchedule(tenantId:$t)}`, { t: tenantId });
      setSchedules(parseList(d?.assetDepreciationSchedule));
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const runDepreciation = async () => {
    if (!period) { Alert.alert('Error', 'Enter a period (e.g. 2024-01)'); return; }
    setRunning(true);
    try {
      await gql<any>(`mutation($t:UUID!,$p:String!){runDepreciation(tenantId:$t,period:$p){ok error}}`, { t: tenantId, p: period });
      setShowRun(false);
      setPeriod('');
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setRunning(false); }
  };

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        {isAdmin && (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <ActionBtn label="Run Depreciation" color={GOLD} onPress={() => setShowRun(true)} />
          </View>
        )}
        <Text style={s.sectionTitle}>Depreciation Schedules ({schedules.length})</Text>
        <View style={[s.card, { marginBottom: 32 }]}>
          {schedules.length === 0 ? <Empty msg="No depreciation records" /> : schedules.map((sc, i) => (
            <View key={sc.id} style={[s.row, i < schedules.length - 1 && s.border]}>
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{sc.asset?.name || sc.asset_name}</Text>
                <Text style={s.sub}>Period: {sc.period}</Text>
                <Text style={s.sub2}>Cumulative: {fmt(sc.cumulativeDepreciation ?? sc.cumulative_depreciation)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.amount}>{fmt(sc.depreciationAmount ?? sc.depreciation_amount)}</Text>
                <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }}>Book: {fmt(sc.bookValue ?? sc.book_value)}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <FormModal visible={showRun} title="Run Depreciation" onClose={() => setShowRun(false)} onSubmit={runDepreciation} submitting={running} submitLabel="Run">
        <Field label="Period (YYYY-MM)" value={period} onChangeText={setPeriod} required placeholder="e.g. 2024-01" />
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── CATEGORIES ─────────────────────────── */
function CategoriesTab({ tenantId }: { tenantId: string }) {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', depreciationRate: '', depreciationMethod: 'straight_line' });

  const load = useCallback(async () => {
    try {
      const d = await gql<any>(`query($t:UUID!){assetCategories(tenantId:$t)}`, { t: tenantId });
      setCategories(parseList(d?.assetCategories));
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.name) { Alert.alert('Error', 'Name required'); return; }
    setSaving(true);
    try {
      const data = { name: form.name, depreciationRate: parseFloat(form.depreciationRate) || 0, depreciationMethod: form.depreciationMethod };
      await gql<any>(`mutation($t:UUID!,$d:GenericScalar!){createAssetCategory(tenantId:$t,data:$d){ok error}}`, { t: tenantId, d: data });
      setShowCreate(false);
      setForm({ name: '', depreciationRate: '', depreciationMethod: 'straight_line' });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Asset Categories ({categories.length})</Text>
        <View style={[s.card, { marginBottom: 100 }]}>
          {categories.length === 0 ? <Empty msg="No categories" /> : categories.map((c, i) => (
            <View key={c.id} style={[s.row, i < categories.length - 1 && s.border]}>
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{c.name}</Text>
                <Text style={s.sub}>{c.depreciationMethod?.replace('_', ' ')}</Text>
              </View>
              <Text style={s.amount}>{c.depreciationRate}%</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <FAB onPress={() => setShowCreate(true)} />
      <FormModal visible={showCreate} title="New Category" onClose={() => setShowCreate(false)} onSubmit={create} submitting={saving}>
        <Field label="Name" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} required />
        <Field label="Depreciation Rate (%)" value={form.depreciationRate} onChangeText={v => setForm(f => ({ ...f, depreciationRate: v }))} keyboardType="decimal-pad" />
        <SelectField label="Depreciation Method" value={form.depreciationMethod} onChange={v => setForm(f => ({ ...f, depreciationMethod: v }))} options={[{ label: 'Straight Line', value: 'straight_line' }, { label: 'Reducing Balance', value: 'reducing_balance' }]} />
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── MAINTENANCE ─────────────────────────── */
function MaintenanceTab({ tenantId }: { tenantId: string }) {
  const [records, setRecords] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    assetId: '', maintenanceType: '', scheduledDate: today(),
    description: '', estimatedCost: '',
  });

  const load = useCallback(async () => {
    try {
      const aData = await gql<any>(`query($t:UUID!){fixedAssets(tenantId:$t)}`, { t: tenantId });
      const assetList = parseList(aData?.fixedAssets);
      setAssets(assetList);
      // Fetch maintenance records for each asset and flatten
      const allRecords: any[] = [];
      await Promise.all(assetList.slice(0, 20).map(async (a: any) => {
        try {
          const mData = await gql<any>(`query($id:UUID!){assetMaintenanceRecords(assetId:$id)}`, { id: a.id });
          const recs = parseList(mData?.assetMaintenanceRecords);
          recs.forEach((r: any) => allRecords.push({ ...r, asset: a }));
        } catch {}
      }));
      setRecords(allRecords);
    } catch {} finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const logMaintenance = async () => {
    if (!form.assetId) { Alert.alert('Error', 'Select an asset'); return; }
    if (!form.maintenanceType) { Alert.alert('Error', 'Enter maintenance type'); return; }
    setSaving(true);
    try {
      const data = { assetId: form.assetId, maintenanceType: form.maintenanceType, scheduledDate: form.scheduledDate, description: form.description, estimatedCost: parseFloat(form.estimatedCost) || 0 };
      await gql<any>(`mutation($t:UUID!,$d:GenericScalar!){addMaintenanceRecord(tenantId:$t,data:$d){ok error}}`, { t: tenantId, d: data });
      setShowCreate(false);
      setForm({ assetId: '', maintenanceType: '', scheduledDate: today(), description: '', estimatedCost: '' });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const markComplete = async (rec: any) => {
    try {
      await gql<any>(`mutation($id:UUID!){completeMaintenance(maintenanceId:$id){ok error}}`, { id: rec.id });
      setSelected(null);
      load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Maintenance Records ({records.length})</Text>
        <View style={[s.card, { marginBottom: 100 }]}>
          {records.length === 0 ? <Empty msg="No maintenance records" /> : records.map((r, i) => (
            <TouchableOpacity key={r.id} style={[s.row, i < records.length - 1 && s.border]} onPress={() => setSelected(r)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{r.asset?.name}</Text>
                <Text style={s.sub}>{r.maintenanceType} · {r.scheduledDate?.slice(0, 10)}</Text>
                {r.description && <Text style={s.sub2} numberOfLines={1}>{r.description}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {r.cost != null && <Text style={s.amount}>{fmt(r.cost)}</Text>}
                <View style={{ marginTop: 4 }}><StatusBadge status={r.status} /></View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <FAB onPress={() => setShowCreate(true)} />

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>{selected?.asset?.name}</Text>
          <TouchableOpacity onPress={() => setSelected(null)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        {selected && (
          <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
            <View style={[s.card, { marginTop: 12 }]}>
              {[
                ['Type', selected.maintenanceType],
                ['Scheduled', selected.scheduledDate?.slice(0, 10)],
                ['Status', selected.status],
                ['Cost', selected.cost != null ? fmt(selected.cost) : undefined],
                ['Description', selected.description],
              ].filter(([, v]) => v).map(([l, v]) => (
                <View key={String(l)} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                  <Text style={s.detailLabel}>{l}</Text><Text style={s.detailValue}>{v}</Text>
                </View>
              ))}
            </View>
            {selected.status !== 'completed' && (
              <View style={s.actionRow}>
                <ActionBtn label="Mark Complete" color="#16A34A" onPress={() => markComplete(selected)} />
              </View>
            )}
          </ScrollView>
        )}
      </Modal>

      <FormModal visible={showCreate} title="Log Maintenance" onClose={() => setShowCreate(false)} onSubmit={logMaintenance} submitting={saving}>
        <SelectField label="Asset" value={form.assetId} onChange={v => setForm(f => ({ ...f, assetId: v }))} options={assets.map(a => ({ label: a.name, value: a.id }))} />
        <Field label="Maintenance Type" value={form.maintenanceType} onChangeText={v => setForm(f => ({ ...f, maintenanceType: v }))} placeholder="e.g. Servicing, Repair" required />
        <Field label="Scheduled Date" value={form.scheduledDate} onChangeText={v => setForm(f => ({ ...f, scheduledDate: v }))} placeholder="YYYY-MM-DD" />
        <Field label="Description" value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} multiline />
        <Field label="Estimated Cost (ZMW)" value={form.estimatedCost} onChangeText={v => setForm(f => ({ ...f, estimatedCost: v }))} keyboardType="decimal-pad" />
      </FormModal>
    </View>
  );
}

/* ─────────────────────────── ROOT ─────────────────────────── */
export default function FixedAssetsScreen() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id || '';
  const [tab, setTab] = useState('register');
  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      <ModuleTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'register' && <AssetRegisterTab tenantId={tenantId} />}
      {tab === 'depreciation' && <DepreciationTab tenantId={tenantId} />}
      {tab === 'categories' && <CategoriesTab tenantId={tenantId} />}
      {tab === 'maintenance' && <MaintenanceTab tenantId={tenantId} />}
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
});
