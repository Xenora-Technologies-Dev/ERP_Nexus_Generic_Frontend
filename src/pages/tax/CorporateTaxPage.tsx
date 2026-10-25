import { useEffect, useState } from 'react';
import {
  Box, Button, Alert, Paper, Grid, TextField, Table, TableBody, TableCell, TableRow, TableHead, Typography, Chip, FormControlLabel, Checkbox,
} from '@mui/material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import { fmtMoney, parseInput } from '../../utils/money';
import { apiError } from '../../utils/apiError';

interface Computation {
  revenue: number; accountingProfit: number; addBacks: { label: string; amount: number }[]; deductions: { label: string; amount: number }[];
  taxableBeforeLosses: number; smallBusinessReliefEligible: boolean; smallBusinessRelief: boolean; lossBroughtForward: number; lossUtilised: number;
  lossCarriedForward: number; taxableIncome: number; taxPayable: number; effectiveRate: number; dueDate: string; warnings: string[];
}
interface Ret { id: string; periodStart: string; periodEnd: string; status: string; taxableIncome: string; taxPayable: string; dueDate: string }

const FIELDS: [string, string][] = [
  ['entertainmentExpense', 'Client entertainment (total)'], ['finesPenalties', 'Fines & penalties'], ['nonQualifyingDonations', 'Non-qualifying donations'],
  ['otherAddBacks', 'Other non-deductible'], ['exemptDividends', 'Exempt dividends'], ['exemptCapitalGains', 'Participation-exemption gains'],
  ['otherDeductions', 'Other deductions'], ['netInterestExpense', 'Net interest expense'], ['taxEbitda', 'Tax EBITDA'],
];

export default function CorporateTaxPage() {
  const y = new Date().getFullYear();
  const [periodStart, setStart] = useState(`${y}-01-01`);
  const [periodEnd, setEnd] = useState(`${y}-12-31`);
  const [inputs, setInputs] = useState<Record<string, number>>({});
  const [sbr, setSbr] = useState(false);
  const [calc, setCalc] = useState<Computation | null>(null);
  const [returns, setReturns] = useState<Ret[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const body = () => ({ periodStart, periodEnd, inputs: { ...inputs, electSmallBusinessRelief: sbr } });
  const loadReturns = () => api.get<Ret[]>('/tax/corporate').then((r) => setReturns(r.data)).catch(() => undefined);
  const preview = () => api.post<Computation>('/tax/corporate/preview', body()).then((r) => { setCalc(r.data); setError(''); }).catch((e) => setError(apiError(e, 'Preview failed')));
  useEffect(() => { loadReturns(); }, []);

  const save = async () => {
    try { await api.post('/tax/corporate', body()); setSuccess('Draft return saved'); loadReturns(); } catch (e) { setError(apiError(e, 'Save failed')); }
  };
  const finalize = async (id: string) => {
    try { await api.post(`/tax/corporate/${id}/finalize`); setSuccess('Return finalized; tax accrued to 2450'); loadReturns(); } catch (e) { setError(apiError(e, 'Finalize failed')); }
  };

  return (
    <Box>
      <PageHeader title="Corporate Tax" subtitle="UAE CT (FDL 47/2022): 0% to AED 375,000, 9% above; Small Business Relief; loss relief (75%)" />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}><TextField fullWidth size="small" type="date" label="Period start" value={periodStart} onChange={(e) => setStart(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
          <Grid item xs={6} sm={3}><TextField fullWidth size="small" type="date" label="Period end" value={periodEnd} onChange={(e) => setEnd(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
          <Grid item xs={12} sm={6}><FormControlLabel control={<Checkbox checked={sbr} onChange={(e) => setSbr(e.target.checked)} />} label="Elect Small Business Relief (revenue ≤ AED 3m)" /></Grid>
          {FIELDS.map(([k, label]) => (
            <Grid item xs={6} sm={4} key={k}>
              <TextField fullWidth size="small" type="number" label={label} value={inputs[k] ?? ''} onChange={(e) => setInputs({ ...inputs, [k]: parseInput(e.target.value) })} />
            </Grid>
          ))}
        </Grid>
        <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
          <Button variant="outlined" onClick={preview}>Compute from books</Button>
          <Button variant="contained" onClick={save} disabled={!calc}>Save draft return</Button>
        </Box>
      </Paper>

      {calc && (
        <Paper sx={{ p: 2, mb: 2 }}>
          {calc.warnings.map((w) => <Alert key={w} severity="warning" sx={{ mb: 1 }}>{w}</Alert>)}
          <Table size="small"><TableBody>
            <TableRow><TableCell>Revenue (for SBR test)</TableCell><TableCell align="right">{fmtMoney(calc.revenue)}</TableCell></TableRow>
            <TableRow><TableCell>Accounting net profit</TableCell><TableCell align="right">{fmtMoney(calc.accountingProfit)}</TableCell></TableRow>
            {calc.addBacks.filter((a) => a.amount).map((a) => <TableRow key={a.label}><TableCell>+ {a.label}</TableCell><TableCell align="right">{fmtMoney(a.amount)}</TableCell></TableRow>)}
            {calc.deductions.filter((a) => a.amount).map((a) => <TableRow key={a.label}><TableCell>− {a.label}</TableCell><TableCell align="right">{fmtMoney(a.amount)}</TableCell></TableRow>)}
            <TableRow><TableCell>Taxable income before losses</TableCell><TableCell align="right">{fmtMoney(calc.taxableBeforeLosses)}</TableCell></TableRow>
            <TableRow><TableCell>Tax losses brought forward / used</TableCell><TableCell align="right">{fmtMoney(calc.lossBroughtForward)} / {fmtMoney(calc.lossUtilised)}</TableCell></TableRow>
            <TableRow><TableCell>Small Business Relief</TableCell><TableCell align="right">{calc.smallBusinessRelief ? 'Applied' : calc.smallBusinessReliefEligible ? 'Eligible (not elected)' : 'Not eligible'}</TableCell></TableRow>
            <TableRow><TableCell><b>Taxable income</b></TableCell><TableCell align="right"><b>{fmtMoney(calc.taxableIncome)}</b></TableCell></TableRow>
            <TableRow><TableCell><b>Corporate tax payable</b> (effective {calc.effectiveRate}%)</TableCell><TableCell align="right"><b>{fmtMoney(calc.taxPayable)}</b></TableCell></TableRow>
            <TableRow><TableCell>Losses carried forward</TableCell><TableCell align="right">{fmtMoney(calc.lossCarriedForward)}</TableCell></TableRow>
            <TableRow><TableCell>Return & payment due</TableCell><TableCell align="right">{calc.dueDate.slice(0, 10)}</TableCell></TableRow>
          </TableBody></Table>
          <Typography variant="caption" color="text.secondary">Not covered: Qualifying Free Zone Person regime, transfer pricing, tax groups, foreign tax credits.</Typography>
        </Paper>
      )}

      <Paper>
        <Table size="small">
          <TableHead><TableRow><TableCell>Period</TableCell><TableCell>Status</TableCell><TableCell align="right">Taxable income</TableCell><TableCell align="right">Tax</TableCell><TableCell>Due</TableCell><TableCell /></TableRow></TableHead>
          <TableBody>
            {returns.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.periodStart.slice(0, 10)} → {r.periodEnd.slice(0, 10)}</TableCell>
                <TableCell><Chip size="small" label={r.status} color={r.status === 'FINALIZED' ? 'success' : 'default'} /></TableCell>
                <TableCell align="right">{fmtMoney(r.taxableIncome)}</TableCell><TableCell align="right">{fmtMoney(r.taxPayable)}</TableCell>
                <TableCell>{r.dueDate.slice(0, 10)}</TableCell>
                <TableCell>{r.status === 'DRAFT' && <Button size="small" onClick={() => finalize(r.id)}>Finalize</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
