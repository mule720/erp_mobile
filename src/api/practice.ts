import { gql } from './graphql';

/** The accounting-firm calls (practice app on the backend), shared by the firm's client screen and the company's Accountants screen. */
export interface Scope { code: string; label: string }
export interface FirmClientRow {
  id: string; clientId: string; name: string; city: string; country: string; status: string; statusText: string; scopes: string[]; requestedScopes: string[];
  group: string; payer: string; plan: string; requestedAt: string;
}
export interface PracticeOverview {
  clients: FirmClientRow[]; earlier: FirmClientRow[]; groups: string[]; canManage: boolean;
  price: { clients: number; included: number; extraClients: number; basePerMonth: number; extraPerClientPerMonth: number; perMonth: number };
}
export interface FoundCompany { id: string; name: string; city: string; country: string; linkStatus: string | null }
export interface FirmLink {
  id: string; firm: string; status: string; statusText: string; scopes: string[]; requestedScopes: string[]; message: string;
  requestedAt: string; visits: number; lastVisit: string | null;
}
export interface BillingStatement {
  clients: { linkId: string; client: string; payer: string; due: number; invoices: { id: string; number: string; amountDue: number; currency: string }[] }[];
  totalDue: number;
  serviceBills: { id: string; client: string; number: string; total: number | null; status: string; sentAt: string }[];
}

export const kw = (n: number) => `K${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export async function fetchOverview(tenantId: string): Promise<{ overview: PracticeOverview | null; scopes: Scope[] }> {
  const d = await gql<any>(`query($t:UUID!){ practiceOverview(tenantId:$t) practiceScopes }`, { t: tenantId });
  return { overview: d?.practiceOverview || null, scopes: d?.practiceScopes || [] };
}

export async function search(tenantId: string, text: string): Promise<FoundCompany[]> {
  const d = await gql<any>(`query($t:UUID!,$q:String!){ practiceSearch(tenantId:$t, text:$q) }`, { t: tenantId, q: text });
  return d?.practiceSearch || [];
}

/** Runs a mutation whose first field returns { ok, error }; throws the error text when it is refused. */
export async function act(query: string, vars: any): Promise<any> {
  const d = await gql<any>(query, vars);
  const r: any = Object.values(d || {})[0];
  if (!r?.ok) throw new Error(r?.error || 'Not done. Please try again.');
  return r;
}

export const requestAccess = (t: string, clientId: string, scopes: string[], message: string) =>
  act(`mutation($t:UUID!,$c:UUID!,$s:[String]!,$m:String){ requestClientAccess(tenantId:$t, clientId:$c, scopes:$s, message:$m){ ok error } }`, { t, c: clientId, s: scopes, m: message });
export const endLink = (t: string, linkId: string, side: 'firm' | 'client') =>
  act(`mutation($t:UUID!,$l:UUID!,$s:String!){ endClientLink(tenantId:$t, linkId:$l, side:$s){ ok error } }`, { t, l: linkId, s: side });
export const setGroup = (t: string, linkId: string, group: string) =>
  act(`mutation($t:UUID!,$l:UUID!,$g:String){ setClientGroup(tenantId:$t, linkId:$l, group:$g){ ok error } }`, { t, l: linkId, g: group });
export const setPayer = (t: string, linkId: string, payer: string) =>
  act(`mutation($t:UUID!,$l:UUID!,$p:String!){ setClientPayer(tenantId:$t, linkId:$l, payer:$p){ ok error } }`, { t, l: linkId, p: payer });

export async function enterClient(tenantId: string, linkId: string) {
  const d = await gql<any>(
    `mutation($t:UUID!,$l:UUID!){ enterClientCompany(tenantId:$t, linkId:$l){ ok error auth{ token refreshToken user{ id email firstName lastName fullName } tenant{ id name } } } }`,
    { t: tenantId, l: linkId });
  const r = d?.enterClientCompany;
  if (!r?.ok) throw new Error(r?.error || 'Could not open the books.');
  return r.auth;
}

export async function fetchAccountants(tenantId: string): Promise<{ canDecide: boolean; firms: FirmLink[]; scopes: Scope[] }> {
  const d = await gql<any>(`query($t:UUID!){ accountantsOverview(tenantId:$t) practiceScopes }`, { t: tenantId });
  return { canDecide: !!d?.accountantsOverview?.canDecide, firms: d?.accountantsOverview?.firms || [], scopes: d?.practiceScopes || [] };
}
export const answerRequest = (t: string, linkId: string, approve: boolean, scopes?: string[]) =>
  act(`mutation($t:UUID!,$l:UUID!,$a:Boolean!,$s:[String]){ answerFirmRequest(tenantId:$t, linkId:$l, approve:$a, scopes:$s){ ok error } }`, { t, l: linkId, a: approve, s: scopes || null });
export const changeScopes = (t: string, linkId: string, scopes: string[]) =>
  act(`mutation($t:UUID!,$l:UUID!,$s:[String]!){ changeFirmScopes(tenantId:$t, linkId:$l, scopes:$s){ ok error } }`, { t, l: linkId, s: scopes });

export async function fetchBilling(tenantId: string): Promise<{ statement: BillingStatement | null; invoices: { id: string; invoiceNumber: string; customerName: string; status: string; totalAmount: number; currency: string }[] }> {
  const d = await gql<any>(`query($t:UUID!){ practiceBilling(tenantId:$t) salesInvoices(tenantId:$t, limit:200){ id invoiceNumber customerName status totalAmount currency } }`, { t: tenantId });
  return { statement: d?.practiceBilling || null, invoices: (d?.salesInvoices || []).filter((i: any) => i.status !== 'draft' && i.status !== 'cancelled') };
}
export async function payClients(tenantId: string, linkIds?: string[]): Promise<string> {
  const d = await gql<any>(`mutation($t:UUID!,$l:[UUID]){ payClientSubscriptions(tenantId:$t, linkIds:$l){ ok error paymentUrl amount invoices } }`, { t: tenantId, l: linkIds || null });
  const r = d?.payClientSubscriptions;
  if (!r?.ok || !r.paymentUrl) throw new Error(r?.error || 'Could not start the payment.');
  return r.paymentUrl;
}
export const sendInvoice = (t: string, linkId: string, invoiceId: string) =>
  act(`mutation($t:UUID!,$l:UUID!,$i:UUID!){ sendServiceInvoice(tenantId:$t, linkId:$l, invoiceId:$i){ ok error } }`, { t, l: linkId, i: invoiceId });
