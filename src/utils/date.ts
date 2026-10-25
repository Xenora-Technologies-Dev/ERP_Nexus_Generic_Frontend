/** Today's date as YYYY-MM-DD (local calendar day). */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Convert API/ISO date to YYYY-MM-DD for date inputs. */
export function toInputDate(value?: string | Date | null): string {
  if (!value) return todayISO();
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return todayISO();
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return todayISO();
  return toInputDate(d);
}

/** Display date as DD/MM/YYYY. */
export function formatDateDDMMYYYY(value?: string | Date | null): string {
  if (!value) return '-';
  const iso = toInputDate(value);
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '-';
  return `${d}/${m}/${y}`;
}
