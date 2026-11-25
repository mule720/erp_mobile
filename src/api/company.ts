import { gql } from './graphql';

/** The company's own details for the top of a receipt or document: the same logo, name, address, contact, TPIN and registration number the web prints. */
export interface CompanyProfile {
  name: string; logo: string | null; address: string; city: string; country: string; phone: string; email: string; tpin: string; registrationNumber: string;
}

let cached: Promise<CompanyProfile | null> | null = null;

export function getCompanyProfile(tenantId: string): Promise<CompanyProfile | null> {
  if (!tenantId) return Promise.resolve(null);
  if (!cached) {
    cached = gql<any>(`query($id:UUID!){ tenant(id:$id){ name email phone address city country taxId registrationNumber logoUrl } }`, { id: tenantId })
      .then((d) => {
        const t = d?.tenant;
        return t ? { name: t.name || '', logo: t.logoUrl || null, address: t.address || '', city: t.city || '', country: t.country || '', phone: t.phone || '',
                     email: t.email || '', tpin: t.taxId || '', registrationNumber: t.registrationNumber || '' } as CompanyProfile : null;
      })
      .catch(() => { cached = null; return null; });
  }
  return cached;
}

/** The address, contact and id lines under the company name; empty ones left out. */
export function companyLines(c: CompanyProfile): string[] {
  return [
    [c.address, c.city, c.country].filter(Boolean).join(', '),
    [c.phone && `Tel ${c.phone}`, c.email].filter(Boolean).join('  ·  '),
    [c.tpin && `TPIN ${c.tpin}`, c.registrationNumber && `Reg. ${c.registrationNumber}`].filter(Boolean).join('  ·  '),
  ].filter(Boolean);
}
