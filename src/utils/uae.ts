export const EMIRATES = [
  { value: 'ABU_DHABI', label: 'Abu Dhabi' },
  { value: 'DUBAI', label: 'Dubai' },
  { value: 'SHARJAH', label: 'Sharjah' },
  { value: 'AJMAN', label: 'Ajman' },
  { value: 'UMM_AL_QUWAIN', label: 'Umm Al Quwain' },
  { value: 'RAS_AL_KHAIMAH', label: 'Ras Al Khaimah' },
  { value: 'FUJAIRAH', label: 'Fujairah' },
] as const;

/** UAE TRN: 15 digits starting with 10 (spaces and dashes ignored). Older numbers that start with 100 still pass. */
export const UAE_TRN_HINT = '15 digits starting with 10';

export function isValidTrn(v: string): boolean {
  return /^10\d{13}$/.test(v.replace(/[\s-]/g, ''));
}

/**
 * A company may issue a tax invoice only when it has a UAE TRN and the document
 * date is on or after the VAT registration date. A missing TRN, a missing date,
 * or a date that has not been reached means a plain invoice.
 */
export function isCompanyVatRegistered(
  trn: string | null | undefined,
  registrationDate: string | null | undefined,
  asOf?: string | null,
): boolean {
  if (!trn || !isValidTrn(trn)) return false;
  if (!registrationDate) return false;
  const reg = registrationDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reg)) return false;
  const daySource = asOf && /^\d{4}-\d{2}-\d{2}/.test(asOf) ? asOf : '';
  const day = (daySource || localToday()).slice(0, 10);
  return day >= reg;
}

function localToday(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Tax codes a business may use before it is VAT-registered. */
export const UNREGISTERED_TAX_CODES = ['ZR', 'EX'] as const;

export const TAX_CODE_OPTIONS = [
  { value: 'SR', label: 'SR — Standard rated 5%' },
  { value: 'ZR', label: 'ZR — Zero rated 0%' },
  { value: 'EX', label: 'EX — Exempt' },
  { value: 'OOS', label: 'OOS — Out of scope' },
  { value: 'RC', label: 'RC — Reverse charge (purchases)' },
  { value: 'IMP', label: 'IMP — Imports via customs (purchases)' },
  { value: 'DZ', label: 'DZ — Designated zone' },
] as const;
