import { useEffect, useState } from 'react';
import {
  Box, Button, Alert, Paper, Table, TableBody, TableCell, TableRow, TableHead, Typography, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControlLabel, Switch,
} from '@mui/material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import { fmtMoney, parseInput } from '../../utils/money';
import { apiError } from '../../utils/apiError';

interface Candidate { id: string; documentNumber: string; date: string; dueDate: string | null; customerName: string; currency: string; total: number; outstanding: number; eligibleFrom: string; eligible: boolean }
interface Relief {
  id: string; documentNumber: string; date: string; customerNotifiedAt: string; amount: string; vatAmount: string; currency?: string; amountAed: string; vatAmountAed: string; notes?: string | null;
  salesInvoice: { documentNumber: string; customer: { name: string; emirate: string | null } };
}
const today = () => new Date().toISOString().slice(0, 10);

/** VAT bad-debt relief (Art. 64 Federal Decree-Law 8/2017): output VAT reclaimed on supplies unpaid 6+ months after due date, written off, customer notified. */
export default function BadDebtReliefPage() {
  const [cands, setCands] = useState<Candidate[]>([]);
  const [reliefs, setReliefs] = useState<Relief[]>([]);
  const [onlyEligible, setOnlyEligible] = useState(true);
  const [sel, setSel] = useState<Candidate | null>(null);
  const [form, setForm] = useState({ date: today(), customerNotifiedAt: today(), amount: '', notes: '' });
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = async () => {
    try {
      const [c, r] = await Promise.all([api.get('/accounts/bad-debt-relief/candidates'), api.get('/accounts/bad-debt-relief')]);
      setCands(c.data); setReliefs(r.data);
    } catch (e) { setMsg({ type: 'error', text: apiError(e, 'Failed to load') }); }
  };
  useEffect(() => { load(); }, []);

  const claim = async () => {
    if (!sel) return;
    try {
      const r = await api.post('/accounts/bad-debt-relief', {
        salesInvoiceId: sel.id, date: form.date, customerNotifiedAt: form.customerNotifiedAt,
        amount: form.amount === '' ? undefined : parseInput(form.amount), notes: form.notes || undefined,
      });
      setMsg({ type: 'success', text: `${r.data.documentNumber}: VAT relief AED ${fmtMoney(r.data.vatAmountAed)} recorded (VAT 201 adjustment)` });
      setSel(null); load();
    } catch (e) { setMsg({ type: 'error', text: apiError(e, 'Failed to record relief') }); }
  };

  const shown = cands.filter((c) => !onlyEligible || c.eligible);
  return (
    <Box>
      <PageHeader title="VAT Bad-Debt Relief" subtitle="Reclaim output VAT on invoices unpaid 6 months after their due date (customer must be notified)" />
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Outstanding VAT invoices</Typography>
          <FormControlLabel control={<Switch checked={onlyEligible} onChange={(e) => setOnlyEligible(e.target.checked)} />} label="Eligible only" />
        </Box>
        <Table size="small">
          <TableHead><TableRow><TableCell>Invoice</TableCell><TableCell>Customer</TableCell><TableCell>Due</TableCell><TableCell align="right">Outstanding</TableCell><TableCell>Eligible from</TableCell><TableCell /></TableRow></TableHead>
          <TableBody>
            {shown.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.documentNumber}</TableCell>
                <TableCell>{c.customerName}</TableCell>
                <TableCell>{(c.dueDate ?? c.date).slice(0, 10)}</TableCell>
                <TableCell align="right">{c.currency} {fmtMoney(c.outstanding)}</TableCell>
                <TableCell>{c.eligible ? <Chip size="small" color="success" label="Eligible" /> : c.eligibleFrom.slice(0, 10)}</TableCell>
                <TableCell align="right"><Button size="small" disabled={!c.eligible} onClick={() => { setSel(c); setForm({ date: today(), customerNotifiedAt: today(), amount: '', notes: '' }); }}>Claim relief</Button></TableCell>
              </TableRow>
            ))}
            {!shown.length && <TableRow><TableCell colSpan={6}><Typography color="text.secondary">No invoices.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Relief claimed</Typography>
        <Table size="small">
          <TableHead><TableRow><TableCell>No.</TableCell><TableCell>Date</TableCell><TableCell>Invoice</TableCell><TableCell>Customer</TableCell><TableCell>Notified</TableCell><TableCell align="right">Written off (AED)</TableCell><TableCell align="right">VAT relief (AED)</TableCell></TableRow></TableHead>
          <TableBody>
            {reliefs.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.documentNumber}</TableCell>
                <TableCell>{r.date.slice(0, 10)}</TableCell>
                <TableCell>{r.salesInvoice.documentNumber}</TableCell>
                <TableCell>{r.salesInvoice.customer.name}</TableCell>
                <TableCell>{r.customerNotifiedAt.slice(0, 10)}</TableCell>
                <TableCell align="right">{fmtMoney(r.amountAed)}</TableCell>
                <TableCell align="right">{fmtMoney(r.vatAmountAed)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
      <Dialog open={!!sel} onClose={() => setSel(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Claim bad-debt relief · {sel?.documentNumber}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ my: 1 }}>Writes off the amount (Dr Bad debts / Dr VAT output, Cr Receivables) and reduces VAT 201 output tax for the period.</Alert>
          <TextField fullWidth margin="dense" type="date" label="Relief date" InputLabelProps={{ shrink: true }} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <TextField fullWidth margin="dense" type="date" label="Customer notified on" InputLabelProps={{ shrink: true }} value={form.customerNotifiedAt} onChange={(e) => setForm({ ...form, customerNotifiedAt: e.target.value })} />
          <TextField fullWidth margin="dense" label={`Amount incl. VAT (${sel?.currency}); blank = full ${sel ? fmtMoney(sel.outstanding) : ''}`} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <TextField fullWidth margin="dense" label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </DialogContent>
        <DialogActions><Button onClick={() => setSel(null)}>Cancel</Button><Button variant="contained" onClick={claim}>Record relief</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
