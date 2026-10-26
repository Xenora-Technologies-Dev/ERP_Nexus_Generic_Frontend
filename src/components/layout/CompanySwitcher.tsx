import { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Alert } from '@mui/material';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

interface Company { id: string; code: string; name: string }

/** Company switching and “new company” stay implemented, but are hidden for now. */
const SHOW_MULTI_COMPANY = false;

/** Active company selector. The choice is sent as X-Company-Id on every API call (see api/client). */
export default function CompanySwitcher() {
  const { hasPermission } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [current, setCurrent] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', trn: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ current: string; companies: Company[] }>('/companies')
      .then((r) => { setCompanies(r.data.companies); setCurrent(r.data.current); })
      .catch(() => undefined);
  }, []);

  const switchTo = (id: string) => {
    if (id === '__new') { setOpen(true); return; }
    localStorage.setItem('companyId', id);
    window.location.reload();
  };

  const create = async () => {
    setError('');
    try {
      const r = await api.post<Company>('/companies', { code: form.code, name: form.name, trn: form.trn || null });
      switchTo(r.data.id);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Could not create company');
    }
  };

  if (!SHOW_MULTI_COMPANY || !companies.length) return null;
  return (
    <>
      <select aria-label="Company" value={current} onChange={(e) => switchTo(e.target.value)}
        style={{ marginRight: 12, padding: '4px 8px', borderRadius: 4, border: 'none', maxWidth: 240 }}>
        {companies.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
        {hasPermission('settings.edit') && <option value="__new">+ New company…</option>}
      </select>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New company</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField fullWidth margin="dense" label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <TextField fullWidth margin="dense" label="Legal name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField fullWidth margin="dense" label="TRN (15 digits, optional)" value={form.trn} onChange={(e) => setForm({ ...form, trn: e.target.value })} />
          <Alert severity="info" sx={{ mt: 1 }}>Chart of accounts, templates and settings are copied from the current company. No business data is copied.</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={create} disabled={!form.code || !form.name}>Create</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
