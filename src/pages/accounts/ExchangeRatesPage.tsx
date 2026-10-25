import { fmtMoney, roundTo } from '../../utils/money';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Grid, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import { todayISO } from '../../utils/date';

interface Rate { id: string; currency: string; rateDate: string; rate: string; source?: string | null }
interface RevalLine {
  side: 'AR' | 'AP'; documentNumber: string; party: string; currency: string; openAmount: number;
  bookedRate: number; revaluedRate: number; gainLoss: number;
}
interface Reval { asOf: string; lines: RevalLine[]; arDelta: number; apDelta: number; netGainLoss: number }

const errMsg = (e: unknown) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Request failed';

export default function ExchangeRatesPage() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [form, setForm] = useState({ currency: 'USD', rateDate: todayISO(), rate: '', source: '' });
  const [asOf, setAsOf] = useState(todayISO());
  const [reval, setReval] = useState<Reval | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    const r = await api.get('/fx/rates');
    setRates(r.data.data);
  }, []);
  useEffect(() => { load().catch((e) => setError(errMsg(e))); }, [load]);

  const save = async () => {
    setError(''); setSuccess('');
    try {
      await api.post('/fx/rates', { ...form, rate: roundTo(form.rate, 6), source: form.source || undefined });
      setSuccess(`Saved ${form.currency} rate for ${form.rateDate}`);
      setForm({ ...form, rate: '' });
      await load();
    } catch (e) { setError(errMsg(e)); }
  };
  const preview = async () => {
    setError(''); setSuccess('');
    try { setReval((await api.get('/fx/revaluation', { params: { asOf } })).data); } catch (e) { setError(errMsg(e)); }
  };
  const post = async () => {
    setError(''); setSuccess('');
    try {
      const r = (await api.post('/fx/revaluation', { asOf })).data;
      setReval(r);
      setSuccess(r.journal ? `Posted ${r.journal.documentNumber} (auto-reversed by ${r.reversal.documentNumber})` : 'Nothing to revalue');
    } catch (e) { setError(errMsg(e)); }
  };

  return (
    <Box>
      <PageHeader title="Exchange Rates & FX Revaluation" subtitle="Base currency AED — rates are AED per 1 unit of foreign currency" />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>Add / update rate</Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={2}><TextField fullWidth label="Currency" value={form.currency} inputProps={{ maxLength: 3 }} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></Grid>
          <Grid item xs={6} sm={3}><TextField fullWidth type="date" label="Date" InputLabelProps={{ shrink: true }} value={form.rateDate} onChange={(e) => setForm({ ...form, rateDate: e.target.value })} /></Grid>
          <Grid item xs={6} sm={2}><TextField fullWidth type="number" label="AED per 1" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></Grid>
          <Grid item xs={6} sm={3}><TextField fullWidth label="Source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="e.g. CBUAE" /></Grid>
          <Grid item xs={12} sm={2}><Button fullWidth variant="contained" sx={{ height: '100%' }} disabled={!form.rate} onClick={save}>Save</Button></Grid>
        </Grid>
      </Paper>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>Unrealized FX revaluation (open invoices)</Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField type="date" label="As of" InputLabelProps={{ shrink: true }} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          <Button variant="outlined" onClick={preview}>Preview</Button>
          <Button variant="contained" onClick={post} disabled={!reval || reval.lines.length === 0}>Post with reversal</Button>
        </Box>
        {reval && (
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Side</TableCell><TableCell>Document</TableCell><TableCell>Party</TableCell><TableCell>Cur</TableCell>
                <TableCell align="right">Open</TableCell><TableCell align="right">Booked rate</TableCell><TableCell align="right">New rate</TableCell><TableCell align="right">Gain / (loss) AED</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {reval.lines.map((l) => (
                  <TableRow key={l.side + l.documentNumber}>
                    <TableCell>{l.side}</TableCell><TableCell>{l.documentNumber}</TableCell><TableCell>{l.party}</TableCell><TableCell>{l.currency}</TableCell>
                    <TableCell align="right">{fmtMoney(l.openAmount)}</TableCell><TableCell align="right">{l.bookedRate}</TableCell><TableCell align="right">{l.revaluedRate}</TableCell>
                    <TableCell align="right">{fmtMoney(l.gainLoss)}</TableCell>
                  </TableRow>
                ))}
                <TableRow><TableCell colSpan={7} sx={{ fontWeight: 700 }}>Net unrealized gain / (loss)</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>{fmtMoney(reval.netGainLoss)}</TableCell></TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>Rate history</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Currency</TableCell><TableCell align="right">AED per 1</TableCell><TableCell>Source</TableCell></TableRow></TableHead>
            <TableBody>
              {rates.map((r) => (
                <TableRow key={r.id}><TableCell>{r.rateDate.slice(0, 10)}</TableCell><TableCell>{r.currency}</TableCell><TableCell align="right">{fmtMoney(r.rate, 6)}</TableCell><TableCell>{r.source || '—'}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
