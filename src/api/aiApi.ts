import AsyncStorage from '@react-native-async-storage/async-storage';
import { gql } from './graphql';

/** Typed helpers for the AI and manufacturing features. Each one is the same call the web app makes. */

export type Level = 'good' | 'watch' | 'bad';

export interface ExecSummary {
  snapshot: { period: { label: string; start: string; end: string }; currency: string };
  headlines: { level: Level; text: string }[];
  narrative: string | null;
  narrativeAvailable: boolean;
  recommendations?: { priority: string; action: string; because: string; route: string }[];
}
export interface RadarRow {
  id: string; documentName: string; amount: number; requestedBy: string | null; ageDays: number; stepName: string;
  level: 'blocked' | 'overdue' | 'waiting' | 'new'; blockedReason: string | null; reminder: string;
}
export interface Radar { total: number; valueWaiting: number; counts: Record<string, number>; rows: RadarRow[] }
export interface CollectionRow {
  customerId: string; name: string; email: string; phone: string; outstanding: number; overdue: number; oldestDaysOverdue: number;
  riskBand: string; riskReasons: string[]; nextAction: string;
}
export interface CollectionDetail extends CollectionRow {
  draft: { subject: string; body: string; sms: string; total: number } | null; draftInvoiceIds: string[]; currency: string; canEmail: boolean; canSms: boolean;
}
export interface Requirement {
  supplierId: string | null; supplierName: string | null; total: number;
  lines: { productId: string; name: string; unit?: string; suggestedQuantity: number; unitCost: number; urgency: string; reason: string }[];
}

export const executiveSummary = async (t: string, period: string, narrative: boolean): Promise<ExecSummary | null> =>
  (await gql<any>(`query($t:UUID!,$p:String,$n:Boolean){ executiveSummary(tenantId:$t,period:$p,writeNarrative:$n) }`, { t, p: period, n: narrative }))?.executiveSummary ?? null;

export const approvalRadar = async (t: string): Promise<Radar | null> => {
  try { return (await gql<any>(`query($t:UUID!){ approvalRadar(tenantId:$t) }`, { t }))?.approvalRadar ?? null; } catch { return null; }
};

export const collectionsOverview = async (t: string) =>
  (await gql<any>(`query($t:UUID!){ collectionsOverview(tenantId:$t) }`, { t }))?.collectionsOverview as { summary: Record<string, any>; worklist: CollectionRow[]; findings: { level: string; text: string }[] } | null;

export const collectionsCustomer = async (t: string, c: string) =>
  (await gql<any>(`query($t:UUID!,$c:UUID!){ collectionsCustomer(tenantId:$t,customerId:$c) }`, { t, c }))?.collectionsCustomer as CollectionDetail | null;

export const sendReminder = async (t: string, c: string, channel: string, body: string, subject: string, invoiceIds: string[], total: number) => {
  const d = await gql<any>(
    `mutation($t:UUID!,$c:UUID!,$ch:String!,$s:String,$b:String!,$st:String,$i:[String],$a:Float){ sendCollectionReminder(tenantId:$t,customerId:$c,channel:$ch,subject:$s,body:$b,stage:$st,invoiceIds:$i,totalAmount:$a){ ok status detail } }`,
    { t, c, ch: channel, s: subject, b: body, st: null, i: invoiceIds, a: total });
  return d?.sendCollectionReminder as { ok: boolean; status: string; detail: string };
};

export const purchaseRequirements = async (t: string, days = 14) =>
  (await gql<any>(`query($t:UUID!,$w:Int){ purchaseRequirements(tenantId:$t,withinDays:$w) }`, { t, w: days }))?.purchaseRequirements as { groups?: Requirement[]; findings?: { level: string; text: string }[] } | null;

export const leadScores = async (t: string) =>
  (await gql<any>(`query($t:UUID!){ leadScores(tenantId:$t) }`, { t }))?.leadScores as { leads: any[]; forecast: any } | null;

// ── document capture ───────────────────────────────────────────────────────
export interface Facts {
  kind: string; confidence: number | null; party: string | null; number: string | null; date: string | null; currency: string | null;
  tax: number | null; total: number | null; lines: { description: string; quantity: number | null; amount: number | null }[]; summary: string | null;
}
export interface Match { documentType: string; documentId: string; label: string; amount: number | null; date: string | null; reason: string }

export async function captureDocument(t: string, fileName: string, base64: string) {
  const d = await gql<any>(`mutation($t:UUID!,$f:String!,$c:String!){ captureDocument(tenantId:$t,fileName:$f,contentBase64:$c){ result } }`, { t, f: fileName, c: base64 });
  const r = d?.captureDocument?.result;
  if (!r?.ok) throw new Error(r?.note || 'Could not read the document');
  return r as { facts: Facts; matches: Match[]; action: { code: string; label: string } };
}

export async function attachDocument(t: string, documentType: string, documentId: string, fileName: string, base64: string, kind: string) {
  const d = await gql<any>(
    `mutation($t:UUID!,$dt:String!,$did:UUID!,$fn:String!,$c:String!,$k:String,$tags:[String]){ attachDocument(tenantId:$t,documentType:$dt,documentId:$did,fileName:$fn,contentBase64:$c,kind:$k,tags:$tags){ok error} }`,
    { t, dt: documentType, did: documentId, fn: fileName, c: base64, k: kind, tags: ['captured', kind] });
  if (!d?.attachDocument?.ok) throw new Error(d?.attachDocument?.error || 'Could not file the document');
}

export async function extractSupplierBill(t: string, fileName: string, mediaType: string, base64: string) {
  const d = await gql<any>(
    `mutation($t:UUID!,$f:String!,$m:String!,$d:String!){ extractSupplierBill(tenantId:$t,fileName:$f,mediaType:$m,dataBase64:$d){ ok error draft } }`,
    { t, f: fileName, m: mediaType, d: base64 });
  const r = d?.extractSupplierBill;
  if (!r?.ok) throw new Error(r?.error || 'Could not read the bill');
  return r.draft as any;
}

export async function createSupplierBill(t: string, supplierId: string, billNumber: string, billDate: string, dueDate: string | null, lines: any[]) {
  const d = await gql<any>(
    `mutation($t:UUID!,$s:UUID!,$bn:String!,$bd:Date!,$due:Date,$lines:GenericScalar!){ createSupplierBill(tenantId:$t,supplierId:$s,billNumber:$bn,billDate:$bd,dueDate:$due,lines:$lines) }`,
    { t, s: supplierId, bn: billNumber, bd: billDate, due: dueDate, lines });
  const r = d?.createSupplierBill;
  if (r?.ok === false) throw new Error(r?.error || 'Could not save the bill');
  return r?.bill as { id: string; billNumber: string };
}

export async function submitExpenseClaim(t: string, employeeId: string, purpose: string, date: string, lines: any[]) {
  const d = await gql<any>(
    `mutation($t:UUID!,$e:UUID!,$p:String!,$d:Date!,$lines:GenericScalar!){ submitExpenseClaim(tenantId:$t,employeeId:$e,purpose:$p,claimDate:$d,lines:$lines) }`,
    { t, e: employeeId, p: purpose, d: date, lines });
  const r = d?.submitExpenseClaim;
  if (r?.ok === false) throw new Error(r?.error || 'The claim could not be submitted');
  return r?.claim as { id: string; claimNumber: string };
}

// ── manufacturing ──────────────────────────────────────────────────────────
export interface RecipeItem { productId: string; bomId: string; name: string; sku: string; sellingPrice: number; consumeOnSale: boolean; makes: number; steps: number; extras: number }
export interface PlanMaterial {
  productId: string; name: string; unit: string; need: number; onHand: number; short: number; packSize: number; packLabel: string; packsToOrder: number;
  orderQuantity: number; unitCost: number; cost: number; supplierName: string | null; noCost: boolean;
}
export interface Plan {
  products: { productId: string; name: string; quantity: number; materialCost: number; costPerUnit: number; sellingPrice: number; margin: number; marginPercent: number | null }[];
  materials: PlanMaterial[]; totalMaterialCost: number; orderCost: number; shortCount: number; warnings: string[];
}

export const recipeItems = async (t: string): Promise<RecipeItem[]> =>
  (await gql<any>(`query($t:UUID!){ recipeItems(tenantId:$t) }`, { t }))?.recipeItems ?? [];

export const bomDetail = async (id: string) => (await gql<any>(`query($id:UUID!){ bom(id:$id) }`, { id }))?.bom;

export async function productionPlan(t: string, items: { productId: string; quantity: number }[], warehouseId?: string): Promise<Plan> {
  const d = await gql<any>(`query($t:UUID!,$i:GenericScalar!,$w:UUID){ productionPlan(tenantId:$t,items:$i,warehouseId:$w) }`, { t, i: items, w: warehouseId ?? null });
  const r = d?.productionPlan;
  if (!r?.ok) throw new Error(r?.error || 'Could not work out the plan');
  return r;
}

export async function draftPurchaseOrders(t: string, items: { productId: string; quantity: number }[], warehouseId: string) {
  const d = await gql<any>(
    `mutation($t:UUID!,$i:GenericScalar!,$w:UUID!){ createPurchaseOrdersFromPlan(tenantId:$t,items:$i,warehouseId:$w){ ok error orders skipped } }`, { t, i: items, w: warehouseId });
  const r = d?.createPurchaseOrdersFromPlan;
  if (!r?.ok) throw new Error(r?.error || 'Could not draft the purchase orders');
  return r as { orders: { poNumber: string; supplier: string; lines: number; total: number }[]; skipped: { name: string; reason: string }[] };
}

export async function optimiseRecipe(bomId: string) {
  const d = await gql<any>(`mutation($b:UUID!){ optimiseRecipe(bomId:$b){ ok error result } }`, { b: bomId });
  const r = d?.optimiseRecipe;
  if (!r?.ok) throw new Error(r?.error || 'Could not check the recipe');
  return r.result as {
    figures: { materialCost: number; costPerUnit: number; sellingPrice: number; marginPercent: number | null; lines: { ingredient: string; unit: string; quantity: number; cost: number; shareOfCostPercent: number | null; unitCost: number }[] };
    suggestions: { title: string; detail: string; type: string; estimatedSavingPerUnit: number | null }[] | null;
  };
}

export const productionOrders = async (t: string) =>
  (await gql<any>(`query($t:UUID!){ productionOrders(tenantId:$t) }`, { t }))?.productionOrders ?? [];

export const warehouses = async () => (await gql<any>(`{ supplyChainWarehouses }`))?.supplyChainWarehouses ?? [];

// ── display helpers ────────────────────────────────────────────────────────
export const money = (n: number | null | undefined) => `K ${Number(n || 0).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const money0 = (n: number | null | undefined) => `K ${Math.round(Number(n || 0)).toLocaleString('en-ZM')}`;

/** A quantity the way a person reads it: 11000 ml is 11 L, 2500 g is 2.5 kg, counted things say "each". */
export function amount(n: number, unit?: string): string {
  const u = (unit || '').toLowerCase();
  const f = (x: number) => Number(x).toLocaleString('en-ZM', { maximumFractionDigits: 2 });
  if (u === 'g') return n >= 1000 ? `${f(n / 1000)} kg` : `${f(n)} g`;
  if (u === 'ml') return n >= 1000 ? `${f(n / 1000)} L` : `${f(n)} ml`;
  if (u === 'each' || u === 'unit' || u === '') return `${f(n)} each`;
  return `${f(n)} ${u}`;
}

// ── scanning ───────────────────────────────────────────────────────────────
export const productByCode = async (t: string, code: string) =>
  (await gql<any>(`query($t:UUID!,$c:String!){ productByCode(tenantId:$t,code:$c) }`, { t, c: code }))?.productByCode as { id: string; name: string; sku: string; barcode: string | null; sellingPrice: number } | null;

export async function setProductBarcode(t: string, productId: string, barcode: string) {
  const d = await gql<any>(`mutation($t:UUID!,$p:UUID!,$b:String!){ setProductBarcode(tenantId:$t,productId:$p,barcode:$b){ ok error } }`, { t, p: productId, b: barcode });
  if (!d?.setProductBarcode?.ok) throw new Error(d?.setProductBarcode?.error || 'Could not remember the code');
}

export const tenantModules = async (): Promise<string[] | null> => {
  try {
    const raw = (await gql<any>(`query{ myTenant { activeModules } }`))?.myTenant?.activeModules;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') return JSON.parse(raw);
    return null;
  } catch { return null; }
};

// ── recipes: add with AI, import, merge ────────────────────────────────────
export interface ImportRecipe { name: string; price?: number; code?: string; ingredients: { name: string; qty: number; unit?: string }[]; steps?: { title: string; instructions?: string; minutes?: number | null; settings?: string; checkpoint?: string }[] }
export interface ImportReport { recipes: { name: string; price: number; lines: number; steps: number }[]; ingredientsCreated: string[]; ingredientsMatched: string[]; recipeItemsCreated: number; recipeItemsMatched: number; recipesSkipped: { name: string; reason: string }[] }
export interface SimilarGroup { items: { id: string; name: string; sku: string; unit: string; usedIn: number; onHand: number }[]; suggestedKeep: string }

export async function readRecipes(args: { text?: string; fileName?: string; contentBase64?: string }): Promise<ImportRecipe[]> {
  const t = await tenantId();
  const d = await gql<any>(`mutation($t:UUID!,$x:String,$f:String,$c:String){ readRecipes(tenantId:$t,text:$x,fileName:$f,contentBase64:$c){ ok error result } }`,
    { t, x: args.text ?? null, f: args.fileName ?? null, c: args.contentBase64 ?? null });
  const r = d?.readRecipes;
  if (!r?.ok) throw new Error(r?.error || 'The recipes could not be read.');
  return r.result.recipes;
}

export async function importRecipes(recipes: ImportRecipe[], apply: boolean): Promise<ImportReport> {
  const t = await tenantId();
  const d = await gql<any>(`mutation($t:UUID!,$r:GenericScalar!,$a:Boolean){ importRecipes(tenantId:$t,recipes:$r,apply:$a){ ok error report } }`, { t, r: recipes, a: apply });
  const r = d?.importRecipes;
  if (!r?.ok) throw new Error(r?.error || 'The import failed.');
  return r.report;
}

export async function fetchSimilarMaterials(): Promise<SimilarGroup[]> {
  const t = await tenantId();
  return (await gql<any>(`query($t:UUID!){ similarMaterials(tenantId:$t) }`, { t }))?.similarMaterials ?? [];
}

export async function mergeMaterials(keepId: string, mergeIds: string[]) {
  const t = await tenantId();
  const d = await gql<any>(`mutation($t:UUID!,$k:UUID!,$m:[UUID]!){ mergeMaterials(tenantId:$t,keepId:$k,mergeIds:$m){ ok error result } }`, { t, k: keepId, m: mergeIds });
  const r = d?.mergeMaterials;
  if (!r?.ok) throw new Error(r?.error || 'The merge failed.');
  return r.result as { merged: number; recipesChanged: number; hidden: string[]; kept: { name: string; reason: string }[] };
}

async function tenantId(): Promise<string> {
  const raw = await AsyncStorage.getItem('erp_tenant');
  return raw ? JSON.parse(raw).id : '';
}
