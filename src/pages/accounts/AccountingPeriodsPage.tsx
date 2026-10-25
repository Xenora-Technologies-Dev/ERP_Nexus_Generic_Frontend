import { useCallback, useEffect, useState } from 'react';
import {
  Box, Alert, Skeleton, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper, Chip,
} from '@mui/material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import { brandColors } from '../../theme';

interface Period {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED' | 'LOCKED';
  closedBy?: string;
  closedAt?: string;
}

const statusColor: Record<string, 'success' | 'warning' | 'error'> = {
  OPEN: 'success',
  CLOSED: 'warning',
  LOCKED: 'error',
};

export default function AccountingPeriodsPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState<Period | null>(null);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);

  const fetchPeriods = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: Period[] }>('/accounts/periods', { params: { pageSize: 100 } });
      setPeriods(res.data.data);
    } catch {
      setError('Failed to load accounting periods');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPeriods(); }, [fetchPeriods]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post('/accounts/periods', form);
      setDialogOpen(false);
      setForm({ name: '', startDate: '', endDate: '' });
      fetchPeriods();
    } catch {
      setError('Failed to create period');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    if (!closeTarget) return;
    setSaving(true);
    try {
      await api.patch(`/accounts/periods/${closeTarget.id}/close`);
      setCloseTarget(null);
      fetchPeriods();
    } catch {
      setError('Failed to close period');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Accounting Periods"
        subtitle="Manage period open/close status"
        actionLabel="New Period"
        onAction={() => setDialogOpen(true)}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Skeleton variant="rounded" height={300} />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: brandColors.lightGreen }}>
                <TableCell>Period</TableCell>
                <TableCell>Start</TableCell>
                <TableCell>End</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Closed By</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {periods.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center">No periods defined</TableCell></TableRow>
              ) : periods.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{new Date(p.startDate).toLocaleDateString('en-AE')}</TableCell>
                  <TableCell>{new Date(p.endDate).toLocaleDateString('en-AE')}</TableCell>
                  <TableCell><Chip label={p.status} color={statusColor[p.status]} size="small" /></TableCell>
                  <TableCell>{p.closedBy ?? '—'}</TableCell>
                  <TableCell align="right">
                    {p.status === 'OPEN' && (
                      <Button size="small" color="warning" onClick={() => setCloseTarget(p)}>Close Period</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Accounting Period</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="Start Date" type="date" value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField label="End Date" type="date" value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })} InputLabelProps={{ shrink: true }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!closeTarget} onClose={() => setCloseTarget(null)}>
        <DialogTitle>Close Period</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1 }}>
            This will prevent editing of all entries dated in this period. This cannot be undone.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseTarget(null)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleClose} disabled={saving}>Close Period</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
