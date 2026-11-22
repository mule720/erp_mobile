import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Modal, Platform, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';
import ModuleTabs from '../components/ModuleTabs';
import PickField from '../components/PickField';
import { AddRecipesModal, MergeMaterialsModal } from '../components/RecipeTools';
import { COLORS, RADIUS, SHADOW } from '../theme';
import {
  amount, bomDetail, draftPurchaseOrders, money, optimiseRecipe, productionOrders, productionPlan, recipeItems, warehouses,
  type Plan, type RecipeItem,
} from '../api/aiApi';

const TABS = [{ key: 'planner', label: 'Planner' }, { key: 'recipes', label: 'Recipes' }, { key: 'orders', label: 'Work orders' }];
const say = (title: string, msg?: string) => (Platform.OS === 'web' ? window.alert(msg ? `${title}\n${msg}` : title) : Alert.alert(title, msg));
const STATUS_COLOR: Record<string, string> = { planned: '#3B82F6', released: '#6366F1', in_progress: '#F59E0B', completed: '#16A34A', closed: '#6B7280', cancelled: '#DC2626' };

/* ───────────────────────────── Planner ───────────────────────────── */
function Planner({ t, items }: { t: string; items: RecipeItem[] }) {
  const [rows, setRows] = useState<{ productId: string; quantity: string }[]>([{ productId: '', quantity: '' }]);
  const [whs, setWhs] = useState<{ id: string; name: string }[]>([]);
  const [wh, setWh] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ orders: any[]; skipped: any[] } | null>(null);

  useEffect(() => { warehouses().then((w: any[]) => { const l = w.map(x => ({ id: String(x.id), name: x.name })); setWhs(l); if (l[0]) setWh(l[0].id); }).catch(() => {}); }, []);
  const wanted = rows.filter(r => r.productId && Number(r.quantity) > 0).map(r => ({ productId: r.productId, quantity: Number(r.quantity) }));
  const set = (i: number, p: Partial<{ productId: string; quantity: string }>) => { setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...p } : r))); setPlan(null); setMade(null); };

  const work = async () => {
    setBusy(true); setMade(null);
    try { setPlan(await productionPlan(t, wanted, wh || undefined)); } catch (e: any) { setPlan(null); say('Could not work it out', e?.message); } finally { setBusy(false); }
  };
  const draft = async () => {
    if (!wh) { say('Choose the warehouse the goods go to'); return; }
    setBusy(true);
    try { setMade(await draftPurchaseOrders(t, wanted, wh)); } catch (e: any) { say('Could not draft the orders', e?.message); } finally { setBusy(false); }
  };
  const short = plan?.materials.filter(m => m.short > 0) ?? [];

  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={s.card}>
        <Text style={s.h}>What do you want to make?</Text>
        {items.length === 0 && <Text style={s.p}>No recipes yet. Add them on the web under Manufacturing → Recipes.</Text>}
        {rows.map((r, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}><PickField value={r.productId} items={items.map(x => ({ id: x.productId, name: x.name }))} onPick={v => set(i, { productId: v })} placeholder="Choose a product" /></View>
            <TextInput style={[s.input, { width: 90 }]} placeholder="Qty" keyboardType="decimal-pad" value={r.quantity} onChangeText={v => set(i, { quantity: v })} />
            {rows.length > 1 && <TouchableOpacity onPress={() => setRows(rs => rs.filter((_, j) => j !== i))} style={{ padding: 10 }}><Ionicons name="trash-outline" size={18} color={COLORS.danger} /></TouchableOpacity>}
          </View>
        ))}
        <TouchableOpacity onPress={() => setRows(rs => [...rs, { productId: '', quantity: '' }])}><Text style={s.link}>+ Add a product</Text></TouchableOpacity>
        <PickField label="Check stock in" value={wh} items={whs} onPick={v => { setWh(v); setPlan(null); }} />
        <TouchableOpacity style={[s.primary, wanted.length === 0 && { opacity: 0.5 }]} onPress={work} disabled={busy || wanted.length === 0}>
          {busy && !plan ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Work out materials</Text>}
        </TouchableOpacity>
      </View>

      {plan && (
        <>
          <View style={s.card}>
            <Text style={s.h}>Cost and margin</Text>
            {plan.products.map(p => (
              <View key={p.productId} style={s.row}>
                <View style={{ flex: 1 }}><Text style={s.val}>{p.name} × {p.quantity}</Text><Text style={s.hint}>cost each {money(p.costPerUnit)} · sells {money(p.sellingPrice)}</Text></View>
                <Text style={[s.val, { color: p.margin < 0 ? COLORS.danger : COLORS.success }]}>{money(p.margin)}{p.marginPercent != null ? ` (${p.marginPercent}%)` : ''}</Text>
              </View>
            ))}
            <Text style={s.hint}>Total material cost {money(plan.totalMaterialCost)}. Costs come from what was actually bought.</Text>
          </View>

          <View style={s.card}>
            <Text style={s.h}>Raw materials needed</Text>
            {plan.warnings.map((w, i) => <Text key={i} style={s.warn}>{w}</Text>)}
            {plan.materials.map(m => (
              <View key={m.productId} style={[s.mat, m.short > 0 && { backgroundColor: '#FFFBEB' }]}>
                <Text style={s.val}>{m.name}</Text>
                <View style={s.matRow}><Text style={s.hint}>Needed</Text><Text style={s.val}>{amount(m.need, m.unit)}</Text></View>
                <View style={s.matRow}><Text style={s.hint}>In stock</Text><Text style={s.val}>{amount(m.onHand, m.unit)}</Text></View>
                {m.short > 0 && (
                  <>
                    <View style={s.matRow}><Text style={s.hint}>Short</Text><Text style={[s.val, { color: '#B45309' }]}>{amount(m.short, m.unit)}</Text></View>
                    <View style={s.matRow}><Text style={s.hint}>To order</Text>
                      <Text style={s.val}>{m.packSize > 1 ? `${m.packsToOrder} × ${m.packLabel || amount(m.packSize, m.unit)} (${amount(m.orderQuantity, m.unit)})` : amount(m.orderQuantity, m.unit)}</Text></View>
                    <View style={s.matRow}><Text style={s.hint}>Supplier</Text><Text style={s.val}>{m.supplierName || 'none set'}</Text></View>
                  </>
                )}
              </View>
            ))}
            {short.length > 0 ? (
              <View style={{ marginTop: 10 }}>
                <Text style={s.val}>{short.length} short · {money(plan.orderCost)} to buy</Text>
                <TouchableOpacity style={s.primary} onPress={draft} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Draft purchase orders</Text>}</TouchableOpacity>
                <Text style={s.hint}>One draft per supplier, in whole packs, for only what is short. Nothing is sent to a supplier until you review it in Purchasing.</Text>
              </View>
            ) : <Text style={[s.val, { color: COLORS.success, marginTop: 8 }]}>Everything needed is already in stock.</Text>}
            {made && (
              <View style={s.ok}>
                {made.orders.map((o, i) => <Text key={i} style={s.val}>{o.poNumber} to {o.supplier}: {o.lines} line{o.lines === 1 ? '' : 's'}, {money(o.total)}</Text>)}
                {made.skipped.length > 0 && <Text style={s.hint}>Not ordered (no supplier): {made.skipped.map(x => x.name).join(', ')}</Text>}
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

/* ───────────────────────────── Recipes ───────────────────────────── */
function Recipes({ items, onRefresh }: { items: RecipeItem[]; onRefresh: () => Promise<void> }) {
  const [open, setOpen] = useState<RecipeItem | null>(null);
  const [bom, setBom] = useState<any>(null);
  const [advice, setAdvice] = useState<Awaited<ReturnType<typeof optimiseRecipe>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  const show = async (r: RecipeItem) => {
    setOpen(r); setBom(null); setAdvice(null);
    try { setBom(await bomDetail(r.bomId)); } catch { /* shown empty */ }
  };
  const check = async () => {
    if (!open) return;
    setBusy(true);
    try { setAdvice(await optimiseRecipe(open.bomId)); } catch (e: any) { say('Could not check the recipe', e?.message); } finally { setBusy(false); }
  };
  const list = items.filter(i => i.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <View style={{ padding: 12, paddingBottom: 0 }}>
        <TextInput style={s.input} placeholder="Search recipes" value={q} onChangeText={setQ} />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <TouchableOpacity style={s.toolBtn} onPress={() => setAddOpen(true)}><Ionicons name="sparkles-outline" size={15} color={COLORS.navy} /><Text style={s.toolTxt}>Add recipes with AI</Text></TouchableOpacity>
          <TouchableOpacity style={s.toolBtn} onPress={() => setMergeOpen(true)}><Ionicons name="git-merge-outline" size={15} color={COLORS.navy} /><Text style={s.toolTxt}>Merge materials</Text></TouchableOpacity>
        </View>
      </View>
      <AddRecipesModal visible={addOpen} onClose={() => setAddOpen(false)} onDone={onRefresh} />
      <MergeMaterialsModal visible={mergeOpen} onClose={() => setMergeOpen(false)} onDone={onRefresh} />
      <ScrollView contentContainerStyle={{ padding: 12, paddingTop: 0 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await onRefresh(); setRefreshing(false); }} />}>
        {list.length === 0 && <Text style={s.empty}>No recipes found.</Text>}
        {list.map(r => (
          <TouchableOpacity key={r.bomId} style={s.item} onPress={() => show(r)} activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              <Text style={s.val}>{r.name}</Text>
              <Text style={s.hint}>{r.sku}{r.steps ? ` · ${r.steps} step${r.steps === 1 ? '' : 's'}` : ''}{r.consumeOnSale ? ' · uses ingredients when sold' : ''}</Text>
            </View>
            <Text style={s.val}>{money(r.sellingPrice)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={!!open} animationType="slide" onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={s.modalHead}><Text style={[s.h, { flex: 1, marginBottom: 0 }]}>{open?.name}</Text><TouchableOpacity onPress={() => setOpen(null)}><Ionicons name="close" size={24} color={COLORS.ink} /></TouchableOpacity></View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {!bom ? <ActivityIndicator style={{ marginTop: 20 }} /> : (
              <>
                <Text style={s.h}>Ingredients (makes {bom.outputQuantity})</Text>
                {(bom.lines || []).map((l: any) => (
                  <View key={l.id} style={s.row}><Text style={[s.val, { flex: 1 }]}>{l.componentName}</Text><Text style={s.val}>{amount(l.quantityPer, l.unit)}</Text></View>
                ))}
                {(bom.steps || []).length > 0 && (
                  <>
                    <Text style={[s.h, { marginTop: 16 }]}>Method</Text>
                    {bom.steps.map((st: any) => (
                      <View key={st.id} style={{ marginBottom: 10 }}>
                        <Text style={s.val}>{st.sequence}. {st.title}{st.minutes ? `  (${st.minutes} min)` : ''}</Text>
                        {!!st.instructions && <Text style={s.p}>{st.instructions}</Text>}
                        {!!st.settings && <Text style={s.hint}>Settings: {st.settings}</Text>}
                        {!!st.checkpoint && <Text style={s.hint}>Check: {st.checkpoint}</Text>}
                      </View>
                    ))}
                  </>
                )}
                <TouchableOpacity style={s.primary} onPress={check} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Check cost and get AI advice</Text>}</TouchableOpacity>
                {advice && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={s.val}>Material cost {money(advice.figures.materialCost)} · each {money(advice.figures.costPerUnit)} · margin {advice.figures.marginPercent != null ? `${advice.figures.marginPercent}%` : '—'}</Text>
                    {advice.figures.lines.slice(0, 8).map(l => (
                      <View key={l.ingredient} style={s.row}><Text style={[s.hint, { flex: 1 }]}>{l.ingredient}{l.unitCost <= 0 ? ' (no cost yet)' : ''}</Text><Text style={s.hint}>{money(l.cost)} · {l.shareOfCostPercent ?? '—'}%</Text></View>
                    ))}
                    {advice.suggestions === null ? <Text style={[s.hint, { marginTop: 8 }]}>AI advice is not available right now. The figures above are exact.</Text>
                      : advice.suggestions.map((sg, i) => (
                        <View key={i} style={s.tip}><Text style={s.val}>{sg.title}</Text><Text style={s.p}>{sg.detail}</Text>{sg.estimatedSavingPerUnit != null && <Text style={[s.hint, { color: COLORS.success }]}>Could save about {money(sg.estimatedSavingPerUnit)} each</Text>}</View>
                      ))}
                    <Text style={s.hint}>Advice only: nothing is changed.</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

/* ───────────────────────────── Work orders ───────────────────────────── */
function Orders({ t }: { t: string }) {
  const [orders, setOrders] = useState<any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { try { setOrders(await productionOrders(t)); } catch { setOrders([]); } }, [t]);
  useEffect(() => { load(); }, [load]);
  if (!orders) return <View style={s.center}><ActivityIndicator /></View>;
  return (
    <ScrollView contentContainerStyle={{ padding: 12 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      {orders.length === 0 && <Text style={s.empty}>No work orders yet.</Text>}
      {orders.map((o: any) => (
        <View key={o.id} style={s.item}>
          <View style={{ flex: 1 }}>
            <Text style={s.val}>{o.orderNumber} · {o.productName}</Text>
            <Text style={s.hint}>{o.quantityProduced} of {o.quantityPlanned} made{o.plannedEndDate ? ` · due ${o.plannedEndDate}` : ''}</Text>
          </View>
          <Text style={[s.badge, { color: STATUS_COLOR[o.status] || COLORS.subtle }]}>{String(o.status).replace('_', ' ')}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

export default function ManufacturingScreen() {
  const { tenant } = useAuth();
  const t = tenant?.id ?? '';
  const [tab, setTab] = useState('planner');
  const [items, setItems] = useState<RecipeItem[] | null>(null);
  const load = useCallback(async () => { try { setItems(await recipeItems(t)); } catch { setItems([]); } }, [t]);
  useEffect(() => { load(); }, [load]);
  if (!items) return <View style={s.center}><ActivityIndicator size="large" color={COLORS.navy} /></View>;
  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      <ModuleTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'planner' && <Planner t={t} items={items} />}
      {tab === 'recipes' && <Recipes items={items} onRefresh={load} />}
      {tab === 'orders' && <Orders t={t} />}
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, ...SHADOW.card },
  h: { fontSize: 15, fontWeight: '800', color: COLORS.ink, marginBottom: 8 },
  p: { fontSize: 13, color: COLORS.subtle, lineHeight: 19 },
  hint: { fontSize: 11, color: COLORS.subtle, marginTop: 2 },
  val: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  link: { color: COLORS.info, fontWeight: '700', fontSize: 13, marginBottom: 10 },
  input: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.ink, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
  primary: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.navy, borderRadius: RADIUS.md, paddingVertical: 13, marginTop: 10 },
  primaryTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 8 },
  warn: { fontSize: 12, color: '#B45309', backgroundColor: '#FFFBEB', padding: 8, borderRadius: 8, marginBottom: 8 },
  mat: { padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  matRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  ok: { backgroundColor: COLORS.successBg, padding: 10, borderRadius: 10, marginTop: 12, gap: 4 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: RADIUS.md, padding: 12, marginBottom: 8, gap: 8, ...SHADOW.card },
  badge: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  empty: { textAlign: 'center', color: COLORS.subtle, marginTop: 40 },
  modalHead: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: Platform.OS === 'ios' ? 52 : 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  toolBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: RADIUS.md, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border },
  toolTxt: { fontSize: 12, fontWeight: '700', color: COLORS.navy },
  tip: { padding: 10, borderRadius: 10, backgroundColor: COLORS.surfaceMuted, marginTop: 8 },
});
