import { useEffect, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField, Alert, Table, TableBody,
  TableCell, TableHead, TableRow, Paper, IconButton, Tooltip,
} from '@mui/material';
import { Edit, Calculate } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import { fmtMoney, parseInput, parseIntInput, sum } from '../../utils/money';
import { apiError } from '../../utils/apiError';

interface Employee {
  id: string; code: string; firstName: string; lastName: string; designation?: string | null; department?: string | null;
  emiratesId?: string | null; laborPersonCode?: string | null; bankRoutingCode?: string | null; iban?: string | null;
  joiningDate: string; leavingDate?: string | null; unpaidLeaveDays: number;
  basicSalary: number | string; housingAllowance: number | string; transportAllowance: number | string; otherAllowance: number | string; isActive: boolean;
}
interface Gratuity { years: number; dailyWage: number; first5: number; beyond5: number; cap: number; amount: number; serviceDays: number }

const empty = {
  code: '', firstName: '', lastName: '', designation: '', department: '', emiratesId: '', laborPersonCode: '', bankRoutingCode: '', iban: '',
  joiningDate: new Date().toISOString().slice(0, 10), leavingDate: '', unpaidLeaveDays: 0,
  basicSalary: 0, housingAllowance: 0, transportAllowance: 0, otherAllowance: 0,
};

export default function EmployeesPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [grat, setGrat] = useState<{ emp: Employee; g: Gratuity; asOf: string } | null>(null);

  const load = () => api.get<Employee[]>('/payroll/employees').then((r) => setRows(r.data)).catch((e) => setError(apiError(e, 'Failed to load employees')));
  useEffect(() => { load(); }, []);

  const edit = (e?: Employee) => {
    setEditing(e ?? null); setError('');
    setForm(e ? {
      code: e.code, firstName: e.firstName, lastName: e.lastName, designation: e.designation ?? '', department: e.department ?? '',
      emiratesId: e.emiratesId ?? '', laborPersonCode: e.laborPersonCode ?? '', bankRoutingCode: e.bankRoutingCode ?? '', iban: e.iban ?? '',
      joiningDate: e.joiningDate.slice(0, 10), leavingDate: e.leavingDate?.slice(0, 10) ?? '', unpaidLeaveDays: e.unpaidLeaveDays,
      basicSalary: parseInput(String(e.basicSalary)), housingAllowance: parseInput(String(e.housingAllowance)),
      transportAllowance: parseInput(String(e.transportAllowance)), otherAllowance: parseInput(String(e.otherAllowance)),
    } : empty);
    setOpen(true);
  };

  const save = async () => {
    setError('');
    const body = { ...form, leavingDate: form.leavingDate || null };
    try {
      if (editing) await api.put(`/payroll/employees/${editing.id}`, body);
      else await api.post('/payroll/employees', body);
      setOpen(false); load();
    } catch (e) { setError(apiError(e, 'Save failed')); }
  };

  const showGratuity = async (emp: Employee, asOf = new Date().toISOString().slice(0, 10)) => {
    const r = await api.get<Gratuity>(`/payroll/employees/${emp.id}/gratuity`, { params: { asOf } });
    setGrat({ emp, g: r.data, asOf });
  };

  const f = (k: keyof typeof empty, label: string, type: 'text' | 'date' | 'number' = 'text', sm = 6) => (
    <Grid item xs={12} sm={sm}>
      <TextField fullWidth size="small" label={label} type={type} value={form[k]} InputLabelProps={type === 'date' ? { shrink: true } : undefined}
        onChange={(e) => setForm({ ...form, [k]: type === 'number' ? (k === 'unpaidLeaveDays' ? parseIntInput(e.target.value) : parseInput(e.target.value)) : e.target.value })} />
    </Grid>
  );

  return (
    <Box>
      <PageHeader title="Employees" subtitle="WPS details, salary structure and end-of-service gratuity" actionLabel="Add employee" onAction={() => edit()} />
      {error && !open && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>Code</TableCell><TableCell>Name</TableCell><TableCell>Designation</TableCell><TableCell>Joined</TableCell>
            <TableCell align="right">Basic</TableCell><TableCell align="right">Allowances</TableCell><TableCell>WPS ready</TableCell><TableCell />
          </TableRow></TableHead>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.code}</TableCell>
                <TableCell>{e.firstName} {e.lastName}</TableCell>
                <TableCell>{e.designation ?? ''}</TableCell>
                <TableCell>{e.joiningDate.slice(0, 10)}{e.leavingDate ? ` → ${e.leavingDate.slice(0, 10)}` : ''}</TableCell>
                <TableCell align="right">{fmtMoney(e.basicSalary)}</TableCell>
                <TableCell align="right">{fmtMoney(sum([e.housingAllowance, e.transportAllowance, e.otherAllowance]))}</TableCell>
                <TableCell>{e.laborPersonCode && e.bankRoutingCode && e.iban ? 'Yes' : 'Missing data'}</TableCell>
                <TableCell>
                  <Tooltip title="Edit"><IconButton size="small" onClick={() => edit(e)}><Edit fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="Gratuity"><IconButton size="small" onClick={() => showGratuity(e)}><Calculate fontSize="small" /></IconButton></Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? `Edit ${editing.code}` : 'New employee'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            {f('code', 'Employee code', 'text', 4)}{f('firstName', 'First name', 'text', 4)}{f('lastName', 'Last name', 'text', 4)}
            {f('designation', 'Designation')}{f('department', 'Department')}
            {f('emiratesId', 'Emirates ID (784-YYYY-NNNNNNN-C)', 'text', 4)}{f('laborPersonCode', 'MOHRE person code (14 digits)', 'text', 4)}{f('bankRoutingCode', 'Bank routing code (9 digits)', 'text', 4)}
            {f('iban', 'IBAN (AE…)', 'text', 12)}
            {f('joiningDate', 'Joining date', 'date', 4)}{f('leavingDate', 'Leaving date', 'date', 4)}{f('unpaidLeaveDays', 'Unpaid leave days (total)', 'number', 4)}
            {f('basicSalary', 'Basic salary (monthly)', 'number', 3)}{f('housingAllowance', 'Housing', 'number', 3)}{f('transportAllowance', 'Transport', 'number', 3)}{f('otherAllowance', 'Other', 'number', 3)}
          </Grid>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={save}>Save</Button></DialogActions>
      </Dialog>

      <Dialog open={!!grat} onClose={() => setGrat(null)} maxWidth="xs" fullWidth>
        <DialogTitle>End-of-service gratuity — {grat?.emp.code}</DialogTitle>
        <DialogContent>
          <TextField fullWidth size="small" type="date" label="As of" value={grat?.asOf ?? ''} sx={{ mt: 1, mb: 2 }} InputLabelProps={{ shrink: true }}
            onChange={(e) => grat && showGratuity(grat.emp, e.target.value)} />
          {grat && (
            <Table size="small"><TableBody>
              <TableRow><TableCell>Service</TableCell><TableCell align="right">{grat.g.serviceDays} days ({grat.g.years} yrs)</TableCell></TableRow>
              <TableRow><TableCell>Daily basic wage</TableCell><TableCell align="right">{fmtMoney(grat.g.dailyWage)}</TableCell></TableRow>
              <TableRow><TableCell>First 5 years (21 days/yr)</TableCell><TableCell align="right">{fmtMoney(grat.g.first5)}</TableCell></TableRow>
              <TableRow><TableCell>Beyond 5 years (30 days/yr)</TableCell><TableCell align="right">{fmtMoney(grat.g.beyond5)}</TableCell></TableRow>
              <TableRow><TableCell>Cap (2 years basic)</TableCell><TableCell align="right">{fmtMoney(grat.g.cap)}</TableCell></TableRow>
              <TableRow><TableCell><b>Gratuity</b></TableCell><TableCell align="right"><b>{fmtMoney(grat.g.amount)}</b></TableCell></TableRow>
            </TableBody></Table>
          )}
          <Alert severity="info" sx={{ mt: 2 }}>Federal Decree-Law 33/2021 Art. 51: nil below one year of service; unpaid leave excluded.</Alert>
        </DialogContent>
        <DialogActions><Button onClick={() => setGrat(null)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
