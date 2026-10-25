import { useEffect, useState } from 'react';
import {
  Box, Button, Alert, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Chip, Stack, Typography,
} from '@mui/material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import { fmtMoney, parseInput, parseIntInput } from '../../utils/money';
import { apiError } from '../../utils/apiError';

interface Run { id: string; year: number; month: number; status: 'DRAFT' | 'APPROVED' | 'PAID'; totalGross: string; totalDeductions: string; totalNet: string; gratuityProvision: string }
interface Line {
  id: string; paidDays: number; daysInPeriod: number; unpaidLeaveDays: number; basic: string; allowances: string; overtime: string; bonus: string;
  deductions: string; gross: string; net: string; gratuityAccrued: string; employee: { code: string; firstName: string; lastName: string };
}

export default function PayrollRunsPage() {
  const now = new Date();
  const [runs, setRuns] = useState<Run[]>([]);
  const [sel, setSel] = useState<(Run & { lines: Line[] }) | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = () => api.get<Run[]>('/payroll/runs').then((r) => setRuns(r.data)).catch((e) => setError(apiError(e, 'Failed to load payroll runs')));
  const open = (id: string) => api.get(`/payroll/runs/${id}`).then((r) => setSel(r.data)).catch((e) => setError(apiError(e, 'Failed to load run')));
  useEffect(() => { load(); }, []);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setError(''); setSuccess('');
    try { await fn(); setSuccess(msg); await load(); if (sel) await open(sel.id); } catch (e) { setError(apiError(e, 'Action failed')); }
  };

  const create = () => act(async () => { const r = await api.post<Run>('/payroll/runs', { year, month }); await open(r.data.id); }, 'Payroll run created');
  const editLine = (l: Line, field: 'overtime' | 'bonus' | 'deductions' | 'unpaidLeaveDays', value: string) =>
    act(() => api.put(`/payroll/runs/${sel!.id}/lines/${l.id}`, { [field]: field === 'unpaidLeaveDays' ? parseIntInput(value) : parseInput(value) }), 'Line updated');

  const downloadSif = async () => {
    setError('');
    try {
      const r = await api.get(`/payroll/runs/${sel!.id}/sif`, { responseType: 'blob' });
      const name = /filename="([^"]+)"/.exec(r.headers['content-disposition'] ?? '')?.[1] ?? 'salary.SIF';
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
    } catch (e) {
      // blob error body -> parse JSON
      const blob = (e as { response?: { data?: Blob } }).response?.data;
      if (blob instanceof Blob) {
        const j = JSON.parse(await blob.text()) as { error?: string; details?: string[] };
        setError(`${j.error ?? 'WPS file failed'}${j.details?.length ? ': ' + j.details.join('; ') : ''}`);
      } else setError('WPS file failed');
    }
  };

  const draft = sel?.status === 'DRAFT';
  return (
    <Box>
      <PageHeader title="Payroll" subtitle="Monthly payroll, WPS salary file (SIF), end-of-service provision and journals" />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
        <TextField size="small" type="number" label="Year" value={year} onChange={(e) => setYear(parseIntInput(e.target.value))} sx={{ width: 110 }} />
        <TextField size="small" type="number" label="Month" value={month} onChange={(e) => setMonth(parseIntInput(e.target.value))} sx={{ width: 90 }} />
        <Button variant="contained" onClick={create}>Create payroll run</Button>
      </Stack>
      <Paper sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead><TableRow><TableCell>Period</TableCell><TableCell>Status</TableCell><TableCell align="right">Gross</TableCell><TableCell align="right">Deductions</TableCell><TableCell align="right">Net (WPS)</TableCell><TableCell align="right">EOSB provision</TableCell></TableRow></TableHead>
          <TableBody>
            {runs.map((r) => (
              <TableRow key={r.id} hover selected={sel?.id === r.id} onClick={() => open(r.id)} sx={{ cursor: 'pointer' }}>
                <TableCell>{String(r.month).padStart(2, '0')}/{r.year}</TableCell>
                <TableCell><Chip size="small" label={r.status} color={r.status === 'PAID' ? 'success' : r.status === 'APPROVED' ? 'primary' : 'default'} /></TableCell>
                <TableCell align="right">{fmtMoney(r.totalGross)}</TableCell><TableCell align="right">{fmtMoney(r.totalDeductions)}</TableCell>
                <TableCell align="right">{fmtMoney(r.totalNet)}</TableCell><TableCell align="right">{fmtMoney(r.gratuityProvision)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {sel && (
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
            <Typography variant="h6" sx={{ flexGrow: 1 }}>Payroll {String(sel.month).padStart(2, '0')}/{sel.year} — {sel.status}</Typography>
            {draft && <Button variant="contained" onClick={() => act(() => api.post(`/payroll/runs/${sel.id}/approve`), 'Approved: salary and EOSB journals posted')}>Approve & post</Button>}
            {sel.status !== 'DRAFT' && <Button variant="outlined" onClick={downloadSif}>Download WPS SIF</Button>}
            {sel.status === 'APPROVED' && <Button variant="contained" color="success" onClick={() => act(() => api.post(`/payroll/runs/${sel.id}/pay`, {}), 'Marked paid: bank journal posted')}>Mark paid</Button>}
          </Stack>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Employee</TableCell><TableCell align="right">Days</TableCell><TableCell align="right">Unpaid leave</TableCell><TableCell align="right">Basic</TableCell>
              <TableCell align="right">Allowances</TableCell><TableCell align="right">Overtime</TableCell><TableCell align="right">Bonus</TableCell><TableCell align="right">Deductions</TableCell>
              <TableCell align="right">Gross</TableCell><TableCell align="right">Net</TableCell><TableCell align="right">EOSB accrued</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {sel.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.employee.code} {l.employee.firstName} {l.employee.lastName}</TableCell>
                  <TableCell align="right">{l.paidDays}/{l.daysInPeriod}</TableCell>
                  {(['unpaidLeaveDays'] as const).map((k) => (
                    <TableCell key={k} align="right">{draft ? <TextField size="small" type="number" defaultValue={l[k]} sx={{ width: 70 }} onBlur={(e) => e.target.value !== String(l[k]) && editLine(l, k, e.target.value)} /> : l[k]}</TableCell>
                  ))}
                  <TableCell align="right">{fmtMoney(l.basic)}</TableCell><TableCell align="right">{fmtMoney(l.allowances)}</TableCell>
                  {(['overtime', 'bonus', 'deductions'] as const).map((k) => (
                    <TableCell key={k} align="right">{draft ? <TextField size="small" type="number" defaultValue={parseInput(l[k])} sx={{ width: 100 }} onBlur={(e) => e.target.value !== String(parseInput(l[k])) && editLine(l, k, e.target.value)} /> : fmtMoney(l[k])}</TableCell>
                  ))}
                  <TableCell align="right">{fmtMoney(l.gross)}</TableCell><TableCell align="right"><b>{fmtMoney(l.net)}</b></TableCell><TableCell align="right">{fmtMoney(l.gratuityAccrued)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Alert severity="info" sx={{ mt: 2 }}>WPS file needs the company MOHRE establishment ID and bank routing code (Company Settings) and each employee's person code, routing code and UAE IBAN.</Alert>
        </Paper>
      )}
    </Box>
  );
}
