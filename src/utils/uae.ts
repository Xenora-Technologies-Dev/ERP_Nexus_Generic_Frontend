export const EMIRATES = [
  { value: 'ABU_DHABI', label: 'Abu Dhabi' },
  { value: 'DUBAI', label: 'Dubai' },
  { value: 'SHARJAH', label: 'Sharjah' },
  { value: 'AJMAN', label: 'Ajman' },
  { value: 'UMM_AL_QUWAIN', label: 'Umm Al Quwain' },
  { value: 'RAS_AL_KHAIMAH', label: 'Ras Al Khaimah' },
  { value: 'FUJAIRAH', label: 'Fujairah' },
] as const;

/** UAE TRN: 15 digits starting with 100 (spaces / dashes ignored). */
export function isValidTrn(v: string): boolean {
  return /^100\d{12}$/.test(v.replace(/[\s-]/g, ''));
}

export const TAX_CODE_OPTIONS = [
  { value: 'SR', label: 'SR — Standard rated 5%' },
  { value: 'ZR', label: 'ZR — Zero rated 0%' },
  { value: 'EX', label: 'EX — Exempt' },
  { value: 'OOS', label: 'OOS — Out of scope' },
  { value: 'RC', label: 'RC — Reverse charge (purchases)' },
  { value: 'IMP', label: 'IMP — Imports via customs (purchases)' },
  { value: 'DZ', label: 'DZ — Designated zone' },
] as const;
