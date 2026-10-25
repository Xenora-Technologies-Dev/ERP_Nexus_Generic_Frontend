import { D, eqMoney, money, parseInput, sum } from '../../utils/money';
import { useEffect, useState, FormEvent, KeyboardEvent, useRef } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Alert, CircularProgress, Grid, IconButton, Table, TableHead, TableBody, TableRow,
  TableCell, TableContainer, Paper, Typography, Autocomplete,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { Add, Delete, Undo } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable from '../../components/common/DocumentTable';

interface ChartAccount { id: string; code: string; name: string; isControl?: boolean; }
interface JournalLine {
  accountId: string;
  debit: number;
  credit: number;
  description: string;
}
interface JournalEntry {
  id: string;
  documentNumber: string;
  date: string;
  description: string;
  lines: { account: ChartAccount; debit: number; credit: number }[];
}

const emptyLine = (): JournalLine => ({ accountId: '', debit: 0, credit: 0, description: '' });
const formatAed = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [lines, setLines] = useState<JournalLine[]>([emptyLine(), emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const lineCountRef = useRef(2);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [e, a] = await Promise.all([
        api.get<JournalEntry[]>('/accounts/journal'),
        api.get<ChartAccount[]>('/accounts/chart-of-accounts'),
      ]);
      setEntries(e.data);
      setAccounts(a.data);
    } catch {
      setError('Failed to load journal entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const totalDebit = money(sum(lines.map((l) => l.debit || 0)));
  const totalCredit = money(sum(lines.map((l) => l.credit || 0)));
  const diff = money(D(totalDebit).minus(totalCredit).abs());
  const isBalanced = eqMoney(totalDebit, totalCredit) && totalDebit > 0;

  const updateLine = (index: number, field: keyof JournalLine, value: string | number) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const addLine = () => {
    setLines([...lines, emptyLine()]);
    lineCountRef.current += 1;
  };

  const handleLineKeyDown = (e: KeyboardEvent, index: number, field: 'debit' | 'credit') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === lines.length - 1) addLine();
    }
    if (e.key === 'Tab' && !e.shiftKey && field === 'credit' && index === lines.length - 1) {
      addLine();
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      setError('Total debit must equal total credit');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/accounts/journal', {
        description, date,
        lines: lines.filter((l) => l.accountId).map((l) => ({
          accountId: l.accountId, debit: l.debit || 0, credit: l.credit || 0, description: l.description,
        })),
      });
      setDialogOpen(false);
      setSuccess('Journal entry created');
      setLines([emptyLine(), emptyLine()]);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create journal entry');
    } finally {
      setSaving(false);
    }
  };

  const handleReverse = async (id: string) => {
    setReversingId(id);
    setError('');
    try {
      await api.post(`/accounts/journal/${id}/reverse`);
      setSuccess('Reversal journal created');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Reversal failed');
    } finally {
      setReversingId(null);
    }
  };

  const columns: GridColDef[] = [
    { field: 'documentNumber', headerName: 'Number', width: 140 },
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (v) => new Date(v as string).toLocaleDateString('en-AE') },
    { field: 'description', headerName: 'Narration', flex: 1 },
    {
      field: 'debit', headerName: 'Debit', width: 120, type: 'number',
      valueGetter: (_, row) => money(sum((row as JournalEntry).lines.map((l) => l.debit))),
      valueFormatter: (v) => formatAed(v as number),
    },
    {
      field: 'credit', headerName: 'Credit', width: 120, type: 'number',
      valueGetter: (_, row) => money(sum((row as JournalEntry).lines.map((l) => l.credit))),
      valueFormatter: (v) => formatAed(v as number),
    },
    {
      field: 'actions', headerName: '', width: 100, sortable: false,
      renderCell: ({ row }) => (
        <IconButton size="small" title="Reverse entry" disabled={reversingId === row.id}
          onClick={() => handleReverse(row.id as string)}>
          <Undo fontSize="small" />
        </IconButton>
      ),
    },
  ];

  const postableAccounts = accounts.filter((a) => !a.isControl);

  return (
    <Box>
      <PageHeader title="Journal Entries" subtitle="Manual journal vouchers (keyboard-friendly)"
        actionLabel="New Entry"
        onAction={() => { setDescription(''); setLines([emptyLine(), emptyLine()]); setDialogOpen(true); }} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <DocumentTable rows={entries} columns={columns} loading={loading} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleCreate}>
          <DialogTitle>Manual Journal Entry</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              <Grid item xs={12} sm={8}>
                <TextField fullWidth required label="Narration" value={description}
                  onChange={(e) => setDescription(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label="Date" type="date" value={date}
                  onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
              </Grid>
            </Grid>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Account</TableCell>
                    <TableCell align="right">Debit</TableCell>
                    <TableCell align="right">Credit</TableCell>
                    <TableCell>Line Description</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lines.map((line, i) => (
                    <TableRow key={i}>
                      <TableCell sx={{ minWidth: 220 }}>
                        <Autocomplete
                          size="small"
                          options={postableAccounts}
                          getOptionLabel={(a) => `${a.code} - ${a.name}`}
                          value={postableAccounts.find((a) => a.id === line.accountId) ?? null}
                          onChange={(_, val) => updateLine(i, 'accountId', val?.id ?? '')}
                          renderInput={(params) => <TextField {...params} placeholder="Type code or name" />}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="number" value={line.debit || ''}
                          onChange={(e) => updateLine(i, 'debit', parseInput(e.target.value))}
                          onKeyDown={(e) => handleLineKeyDown(e, i, 'debit')} sx={{ width: 100 }} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="number" value={line.credit || ''}
                          onChange={(e) => updateLine(i, 'credit', parseInput(e.target.value))}
                          onKeyDown={(e) => handleLineKeyDown(e, i, 'credit')} sx={{ width: 100 }} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" fullWidth value={line.description}
                          onChange={(e) => updateLine(i, 'description', e.target.value)} />
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
            </TableContainer>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Button startIcon={<Add />} size="small" onClick={addLine}>Add Line (Enter)</Button>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2">
                  Debit: {formatAed(totalDebit)} | Credit: {formatAed(totalCredit)}
                </Typography>
                <Typography variant="body2" color={diff > 0.01 ? 'error.main' : 'success.main'} fontWeight={700}>
                  {isBalanced ? 'Balanced' : `Difference: ${formatAed(diff)}`}
                </Typography>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving || !isBalanced}>
              {saving ? <CircularProgress size={20} /> : 'Post Entry'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
