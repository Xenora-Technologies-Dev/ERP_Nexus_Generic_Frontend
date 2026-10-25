/** Extract a readable message from an axios error. */
export function apiError(err: unknown, fallback: string): string {
  const d = (err as { response?: { data?: { error?: string; details?: Array<string | { message?: string }> } } })?.response?.data;
  if (!d?.error) return fallback;
  const parts = (d.details ?? []).map((x) => (typeof x === 'string' ? x : x.message)).filter((x): x is string => Boolean(x));
  return parts.length ? `${d.error}: ${parts.join('; ')}` : d.error;
}
