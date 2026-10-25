import { useEffect, useState } from 'react';
import {
  Box, Tabs, Tab, TextField, Button, MenuItem, Alert, Paper, Typography,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, CircularProgress,
} from '@mui/material';
import { api } from '../../api/client';
import { apiError } from '../../utils/apiError';
import PageHeader from '../../components/common/PageHeader';
import { todayISO, formatDateDDMMYYYY } from '../../utils/date';
import { EMIRATES } from '../../utils/uae';
import { brandColors } from '../../theme';

const moneyFmt = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function emirateLabel(code?: string | null) {
  return EMIRATES.find((e) => e.value === code)?.label || '';
}

interface Party { id: string; code: string; name: string; emirate?: string | null }

interface Statement {
  title: string;
  balanceCaption: string;
  currencyNote: string;
  party: { code: string; name: string; trn?: string | null; emirate?: string; address?: string | null };
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  entries: Array<{ date: string; type: string; reference: string; description?: string; currency: string; debit: number; credit: number; balance: number }>;
}

interface Outstanding {
  title: string;
  totals: { outstandingAed: number; current: number; d1_30: number; d31_60: number; d61_90: number; d91: number };
  lines: Array<{
    side: string; partyCode: string; partyName: string; emirate: string; documentNumber: string;
    documentDate: string; dueDate: string | null; currency: string; outstanding: number; outstandingAed: number;
    daysOverdue: number; bucketLabel: string; kind: string;
  }>;
}

interface SalesReport {
  totals: { vatAed: number; totalAed: number; count: number };
  rows: Array<{
    date: string; documentNumber: string; type: string; customer: string; emirate: string; currency: string;
    vat: number; total: number; vatAed: number; totalAed: number; outstanding: number; status: string;
  }>;
}

async function download(url: string, params: Record<string, string | undefined>, filename: string) {
  const res = await api.get(url, { params, responseType: 'blob' });
  const href = URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

export default function ReportsPage() {
  const [tab, setTab] = useState(0);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [vendors, setVendors] = useState<Party[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [partyType, setPartyType] = useState<'CUSTOMER' | 'VENDOR'>('CUSTOMER');
  const [partyId, setPartyId] = useState('');
  const [dateFrom, setDateFrom] = useState(monthStartISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [statement, setStatement] = useState<Statement | null>(null);

  const [side, setSide] = useState<'ALL' | 'CUSTOMER' | 'VENDOR'>('ALL');
  const [outParty, setOutParty] = useState('');
  const [asOf, setAsOf] = useState(todayISO());
  const [outFrom, setOutFrom] = useState('');
  const [outTo, setOutTo] = useState('');
  const [outstanding, setOutstanding] = useState<Outstanding | null>(null);

  const [salesCustomer, setSalesCustomer] = useState('');
  const [sales, setSales] = useState<SalesReport | null>(null);

  useEffect(() => {
    api.get<Party[]>('/customers').then((r) => setCustomers(r.data)).catch(() => setError('Failed to load customers'));
    api.get<Party[]>('/vendors').then((r) => setVendors(r.data)).catch(() => setError('Failed to load vendors'));
  }, []);

  const parties = partyType === 'CUSTOMER' ? customers : vendors;
  const outParties = side === 'VENDOR' ? vendors : customers;

  const loadStatement = async () => {
    if (!partyId) { setError('Choose a customer or vendor'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.get<Statement>('/reports/statement', { params: { partyType, partyId, dateFrom, dateTo } });
      setStatement(res.data);
    } catch (err) { setError(apiError(err, 'Failed to load statement')); setStatement(null); }
    finally { setLoading(false); }
  };

  const loadOutstanding = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<Outstanding>('/reports/outstanding', {
        params: { side, partyId: side === 'ALL' ? undefined : outParty || undefined, asOf, dateFrom: outFrom || undefined, dateTo: outTo || undefined },
      });
      setOutstanding(res.data);
    } catch (err) { setError(apiError(err, 'Failed to load outstanding report')); setOutstanding(null); }
    finally { setLoading(false); }
  };

  const loadSales = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<SalesReport>('/reports/sales', { params: { dateFrom, dateTo, customerId: salesCustomer || undefined } });
      setSales(res.data);
    } catch (err) { setError(apiError(err, 'Failed to load sales report')); setSales(null); }
    finally { setLoading(false); }
  };

  const exportExcel = async (url: string, params: Record<string, string | undefined>, filename: string) => {
    setBusy(true); setError('');
    try { await download(url, params, filename); }
    catch (err) { setError(apiError(err, 'Excel export failed')); }
    finally { setBusy(false); }
  };

  return (
    <Box>
      <PageHeader title="Reports" subtitle="Statement of account, outstanding receivables and payables, and sales" />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Statement of Account" />
        <Tab label="Outstanding Receivables & Payables" />
        <Tab label="Sales Report" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
            <TextField select size="small" label="Statement" value={partyType} onChange={(e) => { setPartyType(e.target.value as 'CUSTOMER' | 'VENDOR'); setPartyId(''); }} sx={{ minWidth: 160 }}>
              <MenuItem value="CUSTOMER">Customer</MenuItem>
              <MenuItem value="VENDOR">Vendor</MenuItem>
            </TextField>
            <TextField select size="small" label={partyType === 'CUSTOMER' ? 'Customer' : 'Vendor'} value={partyId} onChange={(e) => setPartyId(e.target.value)} sx={{ minWidth: 260 }}>
              <MenuItem value="">Select</MenuItem>
              {parties.map((p) => <MenuItem key={p.id} value={p.id}>{p.code} — {p.name}{emirateLabel(p.emirate) ? ` (${emirateLabel(p.emirate)})` : ''}</MenuItem>)}
            </TextField>
            <TextField size="small" type="date" label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField size="small" type="date" label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            <Button variant="contained" onClick={loadStatement}>Show</Button>
            <Button variant="outlined" disabled={busy || !partyId} onClick={() => exportExcel('/reports/statement.xlsx', { partyType, partyId, dateFrom, dateTo }, 'Statement-of-Account.xlsx')}>Export Excel</Button>
          </Box>
          {loading ? <CircularProgress /> : statement && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ color: brandColors.darkGreen }}>{statement.title}</Typography>
              <Typography variant="body2">{statement.party.code} — {statement.party.name}{statement.party.trn ? ` · TRN ${statement.party.trn}` : ''}{statement.party.emirate ? ` · ${statement.party.emirate}` : ''}</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>{statement.currencyNote}</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Date', 'Type', 'Reference', 'Description', 'Currency', 'Debit (AED)', 'Credit (AED)', 'Balance (AED)'].map((h) => <TableCell key={h}>{h}</TableCell>)}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={5}>Opening balance</TableCell>
                      <TableCell /><TableCell />
                      <TableCell align="right">{moneyFmt(statement.openingBalance)}</TableCell>
                    </TableRow>
                    {statement.entries.map((e) => (
                      <TableRow key={`${e.reference}-${e.date}-${e.type}`}>
                        <TableCell>{formatDateDDMMYYYY(e.date)}</TableCell>
                        <TableCell>{e.type}</TableCell>
                        <TableCell>{e.reference}</TableCell>
                        <TableCell>{e.description}</TableCell>
                        <TableCell>{e.currency}</TableCell>
                        <TableCell align="right">{moneyFmt(e.debit)}</TableCell>
                        <TableCell align="right">{moneyFmt(e.credit)}</TableCell>
                        <TableCell align="right">{moneyFmt(e.balance)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={5} sx={{ fontWeight: 700 }}>Closing — {statement.balanceCaption}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{moneyFmt(statement.totalDebit)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{moneyFmt(statement.totalCredit)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{moneyFmt(statement.closingBalance)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
            <TextField select size="small" label="Show" value={side} onChange={(e) => { setSide(e.target.value as 'ALL' | 'CUSTOMER' | 'VENDOR'); setOutParty(''); }} sx={{ minWidth: 180 }}>
              <MenuItem value="ALL">All customers and vendors</MenuItem>
              <MenuItem value="CUSTOMER">Customers (receivables)</MenuItem>
              <MenuItem value="VENDOR">Vendors (payables)</MenuItem>
            </TextField>
            {side !== 'ALL' && (
              <TextField select size="small" label="Party" value={outParty} onChange={(e) => setOutParty(e.target.value)} sx={{ minWidth: 240 }}>
                <MenuItem value="">All</MenuItem>
                {outParties.map((p) => <MenuItem key={p.id} value={p.id}>{p.code} — {p.name}</MenuItem>)}
              </TextField>
            )}
            <TextField size="small" type="date" label="As of" value={asOf} onChange={(e) => setAsOf(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField size="small" type="date" label="Documents from" value={outFrom} onChange={(e) => setOutFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField size="small" type="date" label="Documents to" value={outTo} onChange={(e) => setOutTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            <Button variant="contained" onClick={loadOutstanding}>Show</Button>
            <Button variant="outlined" disabled={busy} onClick={() => exportExcel('/reports/outstanding.xlsx', { side, partyId: side === 'ALL' ? undefined : outParty || undefined, asOf, dateFrom: outFrom || undefined, dateTo: outTo || undefined }, 'Outstanding-Receivables-Payables.xlsx')}>Export Excel</Button>
          </Box>
          {loading ? <CircularProgress /> : outstanding && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ color: brandColors.darkGreen }}>Outstanding Receivables & Payables</Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Pending as of {formatDateDDMMYYYY(asOf)}. Total {moneyFmt(outstanding.totals.outstandingAed)} AED
                {' · '}Current {moneyFmt(outstanding.totals.current)}
                {' · '}1–30 {moneyFmt(outstanding.totals.d1_30)}
                {' · '}31–60 {moneyFmt(outstanding.totals.d31_60)}
                {' · '}61–90 {moneyFmt(outstanding.totals.d61_90)}
                {' · '}Over 90 {moneyFmt(outstanding.totals.d91)}
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Side', 'Party', 'Document', 'Date', 'Due', 'Currency', 'Outstanding', 'AED', 'Ageing'].map((h) => <TableCell key={h}>{h}</TableCell>)}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {outstanding.lines.length === 0 && <TableRow><TableCell colSpan={9}>Nothing pending for this filter.</TableCell></TableRow>}
                    {outstanding.lines.map((l) => (
                      <TableRow key={`${l.side}-${l.documentNumber}-${l.kind}`}>
                        <TableCell>{l.side === 'CUSTOMER' ? 'Customer' : 'Vendor'}</TableCell>
                        <TableCell>{l.partyCode} — {l.partyName}</TableCell>
                        <TableCell>{l.documentNumber}</TableCell>
                        <TableCell>{formatDateDDMMYYYY(l.documentDate)}</TableCell>
                        <TableCell>{l.dueDate ? formatDateDDMMYYYY(l.dueDate) : ''}</TableCell>
                        <TableCell>{l.currency}</TableCell>
                        <TableCell align="right">{moneyFmt(l.outstanding)}</TableCell>
                        <TableCell align="right">{moneyFmt(l.outstandingAed)}</TableCell>
                        <TableCell>{l.bucketLabel}{l.daysOverdue ? ` (${l.daysOverdue}d)` : ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Box>
      )}

      {tab === 2 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
            <TextField size="small" type="date" label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField size="small" type="date" label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField select size="small" label="Customer" value={salesCustomer} onChange={(e) => setSalesCustomer(e.target.value)} sx={{ minWidth: 240 }}>
              <MenuItem value="">All customers</MenuItem>
              {customers.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </TextField>
            <Button variant="contained" onClick={loadSales}>Show</Button>
            <Button variant="outlined" disabled={busy} onClick={() => exportExcel('/reports/sales.xlsx', { dateFrom, dateTo, customerId: salesCustomer || undefined }, 'Sales-Report.xlsx')}>Export Excel</Button>
          </Box>
          {loading ? <CircularProgress /> : sales && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ color: brandColors.darkGreen }}>Sales Report</Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>{sales.totals.count} documents · VAT {moneyFmt(sales.totals.vatAed)} AED · Total {moneyFmt(sales.totals.totalAed)} AED</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Date', 'Document', 'Type', 'Customer', 'Emirate', 'Currency', 'VAT', 'Total', 'Total AED', 'Outstanding', 'Status'].map((h) => <TableCell key={h}>{h}</TableCell>)}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sales.rows.map((r) => (
                      <TableRow key={`${r.type}-${r.documentNumber}`}>
                        <TableCell>{formatDateDDMMYYYY(r.date)}</TableCell>
                        <TableCell>{r.documentNumber}</TableCell>
                        <TableCell>{r.type}</TableCell>
                        <TableCell>{r.customer}</TableCell>
                        <TableCell>{r.emirate}</TableCell>
                        <TableCell>{r.currency}</TableCell>
                        <TableCell align="right">{moneyFmt(r.vat)}</TableCell>
                        <TableCell align="right">{moneyFmt(r.total)}</TableCell>
                        <TableCell align="right">{moneyFmt(r.totalAed)}</TableCell>
                        <TableCell align="right">{moneyFmt(r.outstanding)}</TableCell>
                        <TableCell>{r.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Box>
      )}
    </Box>
  );
}
