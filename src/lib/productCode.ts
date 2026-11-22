/** Matching what a scanner reads to a product, with no AI: barcode, SKU, our own label code, id, or exact name. Mirrors the server's lookup. */
export interface Codeable { id: string; name?: string; sku?: string; barcode?: string | null }

const LABEL_PREFIX = 'NP-';
const LABEL_LEN = 10;

/** What a printed label carries: the barcode, else the SKU, else a short code made from the product's id. */
export const labelCode = (p: Codeable) =>
  (p.barcode || '').trim() || (p.sku || '').trim() || `${LABEL_PREFIX}${p.id.replace(/-/g, '').slice(0, LABEL_LEN).toUpperCase()}`;

const digitsEqual = (a: string, b: string) => /^\d+$/.test(a) && /^\d+$/.test(b) && a.replace(/^0+/, '') === b.replace(/^0+/, '') && a.replace(/^0+/, '').length >= 6;

/** The one product the code belongs to, or null (a code that fits two products at the same step matches none: never guess). */
export function matchCode<T extends Codeable>(products: T[], code: string): T | null {
  const raw = (code || '').trim();
  if (!raw) return null;
  const low = raw.toLowerCase();
  const one = (xs: T[]) => (xs.length === 1 ? xs[0] : null);
  let step = products.filter(p => p.barcode && (p.barcode.trim().toLowerCase() === low || digitsEqual(p.barcode.trim(), raw)));
  if (step.length) return one(step);
  step = products.filter(p => p.sku && p.sku.trim().toLowerCase() === low);
  if (step.length) return one(step);
  const m = raw.match(/^NP-([0-9a-f]{6,32})$/i);
  if (m) {
    const pre = m[1].toLowerCase();
    step = products.filter(p => p.id.replace(/-/g, '').toLowerCase().startsWith(pre));
    if (step.length) return one(step);
  }
  step = products.filter(p => p.id.toLowerCase() === low);
  if (step.length) return one(step);
  step = products.filter(p => (p.name || '').trim().toLowerCase() === low);
  return step.length ? one(step) : null;
}

/** Products whose name is closest to some text, for when a scanned code is not known: a few to choose from. */
export function suggest<T extends Codeable>(products: T[], text: string, limit = 6): T[] {
  const words = (text || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 2);
  if (!words.length) return products.slice(0, limit);
  return products
    .map(p => ({ p, score: words.reduce((a, w) => a + ((p.name || '').toLowerCase().includes(w) ? 1 : 0), 0) }))
    .filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(x => x.p);
}
