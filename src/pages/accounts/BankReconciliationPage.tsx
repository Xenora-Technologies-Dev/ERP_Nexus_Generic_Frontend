import { D, money } from '../../utils/money';
import { useCallback, useEffect, useState } from 'react';
import {
  Box, Alert, Skeleton, Grid, Paper, Typography, Chip, Button, List, ListItemButton,
  ListItemText, Divider, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { PictureAsPdf } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';

interface ChartAccount { id: string; code: string; name: string; }
interface StatementLine {
  id: string; txDate: string; description: string; debit: number; credit: number; status: string;
}
interface JournalLineMatch {
  id: string; documentNumber: string; date: string; description?: string; amount: number;
}
interface ReconcileData {
  statement: { id: string; closingBalance: number; account: ChartAccount };
  statementLines: StatementLine[];
  unmatchedJournalLines: JournalLineMatch[];
  runningBookBalance: number;
  statementClosingBalance: number;
  unreconciledDifference: number;
}

const formatAed = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const statusColor: Record<string, 'default' | 'success' | 'warning'> = {
  UNMATCHED: 'default', MATCHED: 'success', MANUALLY_CLEARED: 'warning',
};

export default function BankReconciliationPage() {
  const [statements, setStatements] = useState<Array<{ id: string; statementDate: string; account: ChartAccount }>>([]);
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [data, setData] = useState<ReconcileData | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ accountId: '', statementDate: '', openingBalance: '', closingBalance: '', csvText: '' });

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const [stmts, accts] = await Promise.all([
        api.get<{ data: typeof statements }>('/accounts/bank-statements'),
        api.get<ChartAccount[]>('/accounts/chart-of-accounts'),
      ]);
      setStatements(stmts.data.data);
      setAccounts(accts.data.filter((a) => a.code === '1000' || a.code === '1010'));
      if (stmts.data.data.length && !selectedId) setSelectedId(stmts.data.data[0].id);
    } catch {
      setError('Failed to load bank statements');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const fetchReconcile = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const res = await api.get<{ data: ReconcileData }>(`/accounts/bank-statements/${id}/reconcile`);
      setData(res.data.data);
    } catch {
      setError('Failed to load reconciliation data');
    }
  }, []);

  useEffect(() => { fetchLists(); }, [fetchLists]);
  useEffect(() => { if (selectedId) fetchReconcile(selectedId); }, [selectedId, fetchReconcile]);

  const handleMatch = async (journalLineId: string) => {
    if (!selectedLineId || !selectedId) return;
    try {
      await api.post(`/accounts/bank-statements/${selectedId}/match`, {
        statementLineId: selectedLineId, journalLineId,
      });
      setSelectedLineId(null);
      fetchReconcile(selectedId);
    } catch {
      setError('Match failed');
    }
  };

  const handleAutoMatch = async () => {
    if (!selectedId) return;
    try {
      await api.post(`/accounts/bank-statements/${selectedId}/auto-match`);
      fetchReconcile(selectedId);
    } catch {
      setError('Auto-match failed');
    }
  };

  const handleUpload = async () => {
    try {
      const formData = new FormData();
      formData.append('accountId', uploadForm.accountId);
      formData.append('statementDate', uploadForm.statementDate);
      formData.append('openingBalance', uploadForm.openingBalance);
      formData.append('closingBalance', uploadForm.closingBalance);
      formData.append('csvText', uploadForm.csvText);
      await api.post('/accounts/bank-statements', formData);
      setUploadOpen(false);
      fetchLists();
    } catch {
      setError('Upload failed');
    }
  };

  const diff = data?.unreconciledDifference ?? 0;

  return (
    <Box>
      <PageHeader title="Bank Reconciliation" subtitle="Match bank statements to GL entries"
        actionLabel="Upload Statement" onAction={() => setUploadOpen(true)} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField select size="small" label="Statement" value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)} sx={{ minWidth: 220 }}>
          {statements.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.account?.code} — {new Date(s.statementDate).toLocaleDateString('en-AE')}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="outlined" onClick={handleAutoMatch} disabled={!selectedId}>Auto-match</Button>
      </Box>

      {loading ? <Skeleton height={400} /> : data && (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {[
              ['Statement Balance', data.statementClosingBalance],
              ['Book Balance', data.runningBookBalance],
              ['Difference', diff],
            ].map(([label, val]) => (
              <Grid item xs={12} sm={4} key={label as string}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">{label as string}</Typography>
                  <Typography variant="h6" fontWeight={700}
                    color={label === 'Difference' && diff !== 0 ? 'error.main' : 'text.primary'}>
                    {formatAed(val as number)}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 1, maxHeight: 520, overflow: 'auto' }}>
                <Typography variant="subtitle2" sx={{ px: 1, py: 1 }}>Bank Statement Lines</Typography>
                <List dense>
                  {data.statementLines.map((line) => (
                    <ListItemButton
                      key={line.id}
                      selected={selectedLineId === line.id}
                      onClick={() => setSelectedLineId(line.id)}
                    >
                      <ListItemText
                        primary={line.description}
                        secondary={`${new Date(line.txDate).toLocaleDateString('en-AE')} · ${formatAed(money(D(line.debit).minus(D(line.credit))))}`}
                      />
                      <Chip label={line.status} size="small" color={statusColor[line.status] ?? 'default'} />
                    </ListItemButton>
                  ))}
                </List>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 1, maxHeight: 520, overflow: 'auto' }}>
                <Typography variant="subtitle2" sx={{ px: 1, py: 1 }}>
                  Unmatched GL Entries {selectedLineId ? '(click to match)' : ''}
                </Typography>
                <List dense>
                  {data.unmatchedJournalLines.map((jl) => (
                    <ListItemButton
                      key={jl.id}
                      disabled={!selectedLineId}
                      onClick={() => handleMatch(jl.id)}
                    >
                      <ListItemText
                        primary={jl.description || jl.documentNumber}
                        secondary={`${new Date(jl.date).toLocaleDateString('en-AE')} · ${formatAed(jl.amount)}`}
                      />
                    </ListItemButton>
                  ))}
                  {data.unmatchedJournalLines.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No unmatched entries</Typography>
                  )}
                </List>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}

      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Upload Bank Statement (CSV)</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField select label="Bank Account" value={uploadForm.accountId}
            onChange={(e) => setUploadForm({ ...uploadForm, accountId: e.target.value })}>
            {accounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.code} - {a.name}</MenuItem>)}
          </TextField>
          <TextField label="Statement Date" type="date" value={uploadForm.statementDate}
            onChange={(e) => setUploadForm({ ...uploadForm, statementDate: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField label="Opening Balance" type="number" value={uploadForm.openingBalance}
            onChange={(e) => setUploadForm({ ...uploadForm, openingBalance: e.target.value })} />
          <TextField label="Closing Balance" type="number" value={uploadForm.closingBalance}
            onChange={(e) => setUploadForm({ ...uploadForm, closingBalance: e.target.value })} />
          <TextField label="CSV Content" multiline rows={8} placeholder="Date,Description,Debit,Credit"
            value={uploadForm.csvText} onChange={(e) => setUploadForm({ ...uploadForm, csvText: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpload}>Upload</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
