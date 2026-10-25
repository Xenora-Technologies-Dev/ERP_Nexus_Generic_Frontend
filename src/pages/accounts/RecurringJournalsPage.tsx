import { parseInput } from '../../utils/money';
import { useCallback, useEffect, useState, FormEvent } from 'react';
import {
  Box, Alert, Skeleton, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper,
  Chip, MenuItem, Switch, FormControlLabel, IconButton,
} from '@mui/material';
import { Add, Delete, PlayArrow } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import { brandColors } from '../../theme';

interface ChartAccount { id: string; code: string; name: string; }
interface RecurringLine { accountId: string; debit: number; credit: number; description: string; }
interface RecurringJournal {
  id: string; name: string; frequency: string; nextRunDate: string; endDate?: string;
  isActive: boolean; lastRunAt?: string; lines: RecurringLine[];
}

const FREQS = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'];
const emptyLine = (): RecurringLine => ({ accountId: '', debit: 0, credit: 0, description: '' });

export default function RecurringJournalsPage() {
  const [journals, setJournals] = useState<RecurringJournal[]>([]);
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', frequency: 'MONTHLY', nextRunDate: new Date().toISOString().split('T')[0], endDate: '', isActive: true,
  });
  const [lines, setLines] = useState<RecurringLine[]>([emptyLine(), emptyLine()]);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [j, a] = await Promise.all([
        api.get<{ data: RecurringJournal[] }>('/accounts/recurring-journals', { params: { pageSize: 100 } }),
        api.get<ChartAccount[]>('/accounts/chart-of-accounts'),
      ]);
      setJournals(j.data.data);
      setAccounts(a.data);
    } catch {
      setError('Failed to load recurring journals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditId(null);
    setForm({ name: '', frequency: 'MONTHLY', nextRunDate: new Date().toISOString().split('T')[0], endDate: '', isActive: true });
    setLines([emptyLine(), emptyLine()]);
    setDialogOpen(true);
  };

  const openEdit = (j: RecurringJournal) => {
    setEditId(j.id);
    setForm({
      name: j.name, frequency: j.frequency,
      nextRunDate: j.nextRunDate.split('T')[0],
      endDate: j.endDate?.split('T')[0] ?? '', isActive: j.isActive,
    });
    setLines(j.lines.length >= 2 ? j.lines : [emptyLine(), emptyLine()]);
    setDialogOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, endDate: form.endDate || undefined, lines: lines.filter((l) => l.accountId) };
      if (editId) await api.put(`/accounts/recurring-journals/${editId}`, payload);
      else await api.post('/accounts/recurring-journals', payload);
      setDialogOpen(false);
      setSuccess('Saved successfully');
      fetchData();
    } catch {
      setError('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (j: RecurringJournal) => {
    await api.put(`/accounts/recurring-journals/${j.id}`, { isActive: !j.isActive });
    fetchData();
  };

  const runNow = async () => {
    try {
      const res = await api.post<{ data: { processed: number } }>('/accounts/recurring-journals/process');
      setSuccess(`Processed ${res.data.data.processed} journal(s)`);
      fetchData();
    } catch {
      setError('Process failed');
    }
  };

  return (
    <Box>
      <PageHeader title="Recurring Journals" subtitle="Automated periodic journal entries"
        actionLabel="New Recurring Journal" onAction={openCreate} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Box sx={{ mb: 2 }}>
        <Button variant="outlined" startIcon={<PlayArrow />} onClick={runNow}>Run Now</Button>
      </Box>

      {loading ? <Skeleton height={300} /> : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: brandColors.lightGreen }}>
                <TableCell>Name</TableCell>
                <TableCell>Frequency</TableCell>
                <TableCell>Next Run</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Run</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {journals.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center">No recurring journals</TableCell></TableRow>
              ) : journals.map((j) => (
                <TableRow key={j.id}>
                  <TableCell>{j.name}</TableCell>
                  <TableCell>{j.frequency}</TableCell>
                  <TableCell>{new Date(j.nextRunDate).toLocaleDateString('en-AE')}</TableCell>
                  <TableCell>
                    <Chip label={j.isActive ? 'Active' : 'Paused'} color={j.isActive ? 'success' : 'default'} size="small" />
                  </TableCell>
                  <TableCell>{j.lastRunAt ? new Date(j.lastRunAt).toLocaleDateString('en-AE') : '—'}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => openEdit(j)}>Edit</Button>
                    <Button size="small" onClick={() => toggleActive(j)}>{j.isActive ? 'Pause' : 'Activate'}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSave}>
          <DialogTitle>{editId ? 'Edit' : 'New'} Recurring Journal</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <TextField select label="Frequency" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                {FREQS.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
              </TextField>
              <TextField label="Next Run Date" type="date" value={form.nextRunDate}
                onChange={(e) => setForm({ ...form, nextRunDate: e.target.value })} InputLabelProps={{ shrink: true }} />
              <TextField label="End Date (optional)" type="date" value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })} InputLabelProps={{ shrink: true }} />
              <FormControlLabel control={<Switch checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />} label="Active" />
            </Box>
            <Table size="small" sx={{ mt: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Account</TableCell>
                  <TableCell>Debit</TableCell>
                  <TableCell>Credit</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((line, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <TextField select size="small" fullWidth value={line.accountId}
                        onChange={(e) => { const u = [...lines]; u[i] = { ...u[i], accountId: e.target.value }; setLines(u); }}>
                        <MenuItem value="">Select</MenuItem>
                        {accounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.code} - {a.name}</MenuItem>)}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <TextField size="small" type="number" value={line.debit}
                        onChange={(e) => { const u = [...lines]; u[i] = { ...u[i], debit: parseInput(e.target.value) }; setLines(u); }} />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" type="number" value={line.credit}
                        onChange={(e) => { const u = [...lines]; u[i] = { ...u[i], credit: parseInput(e.target.value) }; setLines(u); }} />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" value={line.description}
                        onChange={(e) => { const u = [...lines]; u[i] = { ...u[i], description: e.target.value }; setLines(u); }} />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => setLines(lines.filter((_, idx) => idx !== i))} disabled={lines.length <= 2}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button startIcon={<Add />} size="small" sx={{ mt: 1 }} onClick={() => setLines([...lines, emptyLine()])}>Add Line</Button>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>Save</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
