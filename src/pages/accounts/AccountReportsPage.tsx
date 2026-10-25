import { useCallback, useEffect, useState } from 'react';
import {
  Box, Alert, Tabs, Tab, TextField, Button, Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell, CircularProgress,
} from '@mui/material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';

const formatAed = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type ReportTab = 'formation' | 'owner-capital' | 'owner-current' | 'drawings' | 'prepaid' | 'expense-coa' | 'fixed-assets';

export default function AccountReportsPage() {
  const [tab, setTab] = useState<ReportTab>('expense-coa');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<unknown>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let url = '';
      const params: Record<string, string> = {};
      switch (tab) {
        case 'formation': url = '/accounts/reports/formation-costs'; params.asOf = asOf; break;
        case 'owner-capital': url = '/accounts/reports/owner-capital'; params.asOf = asOf; break;
        case 'owner-current': url = '/accounts/reports/owner-current-account'; if (dateFrom) params.dateFrom = dateFrom; if (dateTo) params.dateTo = dateTo; break;
        case 'drawings': url = '/accounts/reports/owner-drawings'; if (dateFrom) params.dateFrom = dateFrom; if (dateTo) params.dateTo = dateTo; break;
        case 'prepaid': url = '/accounts/reports/prepaid-expenses'; params.asOf = asOf; break;
        case 'expense-coa': url = '/accounts/reports/expense-by-coa'; if (dateFrom) params.dateFrom = dateFrom; if (dateTo) params.dateTo = dateTo; break;
        case 'fixed-assets': url = '/accounts/reports/fixed-asset-register'; break;
      }
      const res = await api.get(url, { params });
      setData(res.data);
    } catch {
      setError('Failed to load report');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [tab, dateFrom, dateTo, asOf]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const renderBody = () => {
    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
    if (!data) return null;

    if (tab === 'expense-coa') {
      const r = data as { byCoa: { code: string; name: string; total: number; count: number }[]; bySection: { section: string; total: number }[]; grandTotal: number };
      return (
        <Box>
          <Typography variant="h6" gutterBottom>By COA Account</Typography>
          <ReportTable headers={['Code', 'Account', 'Entries', 'Total']} rows={r.byCoa.map((x) => [x.code, x.name, x.count, formatAed(x.total)])} />
          <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>By Section</Typography>
          <ReportTable headers={['Section', 'Total']} rows={r.bySection.map((x) => [x.section, formatAed(x.total)])} />
          <Typography fontWeight={700} sx={{ mt: 2 }}>Grand Total: {formatAed(r.grandTotal)}</Typography>
        </Box>
      );
    }

    if (tab === 'fixed-assets') {
      const r = data as { assets: { assetCode: string; name: string; assetType: string; purchaseValue: number; currentValue: number; status: string }[]; totalPurchaseValue: number; totalCurrentValue: number };
      return (
        <Box>
          <ReportTable headers={['Code', 'Name', 'Type', 'Cost', 'Book Value', 'Status']}
            rows={r.assets.map((a) => [a.assetCode, a.name, a.assetType, formatAed(a.purchaseValue), formatAed(a.currentValue), a.status])} />
          <Typography sx={{ mt: 2 }}>Total Cost: {formatAed(r.totalPurchaseValue)} | Book Value: {formatAed(r.totalCurrentValue)}</Typography>
        </Box>
      );
    }

    if (tab === 'formation') {
      const r = data as { accounts: { code: string; name: string; balance: number }[]; total: number };
      return (
        <Box>
          <ReportTable headers={['Code', 'Account', 'Balance']} rows={r.accounts.map((a) => [a.code, a.name, formatAed(a.balance)])} />
          <Typography fontWeight={700} sx={{ mt: 2 }}>Total Formation Costs: {formatAed(r.total)}</Typography>
        </Box>
      );
    }

    if (tab === 'prepaid') {
      const r = data as { glBalances: { code: string; name: string; balance: number }[] };
      return <ReportTable headers={['Code', 'Account', 'Balance']} rows={r.glBalances.map((a) => [a.code, a.name, formatAed(a.balance)])} />;
    }

    const ledger = data as { account?: { code: string; name: string }; entries: { date: string; documentNumber: string; description: string; debit: number; credit: number; balance: number }[]; closingBalance: number; totalDrawings?: number };
    return (
      <Box>
        {ledger.account && <Typography variant="subtitle1" fontWeight={600} gutterBottom>{ledger.account.code} — {ledger.account.name}</Typography>}
        <ReportTable headers={['Date', 'JV', 'Description', 'Debit', 'Credit', 'Balance']}
          rows={ledger.entries.map((e) => [e.date.slice(0, 10), e.documentNumber, e.description ?? '', formatAed(e.debit), formatAed(e.credit), formatAed(e.balance)])} />
        <Typography fontWeight={700} sx={{ mt: 2 }}>Closing Balance: {formatAed(ledger.closingBalance)}</Typography>
        {ledger.totalDrawings !== undefined && <Typography>Total Drawings: {formatAed(ledger.totalDrawings)}</Typography>}
      </Box>
    );
  };

  return (
    <Box>
      <PageHeader title="Accounting Reports" subtitle="Owner equity, formation costs, prepaid, expenses by COA, fixed assets" />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label="Expense by COA" value="expense-coa" />
          <Tab label="Formation Costs" value="formation" />
          <Tab label="Owner Capital" value="owner-capital" />
          <Tab label="Owner Current A/C" value="owner-current" />
          <Tab label="Owner Drawings" value="drawings" />
          <Tab label="Prepaid Expenses" value="prepaid" />
          <Tab label="Fixed Asset Register" value="fixed-assets" />
        </Tabs>
      </Paper>
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {['formation', 'owner-capital', 'prepaid'].includes(tab) && (
          <TextField size="small" label="As of" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} InputLabelProps={{ shrink: true }} />
        )}
        {!['formation', 'owner-capital', 'prepaid', 'fixed-assets'].includes(tab) && (
          <>
            <TextField size="small" label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField size="small" label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          </>
        )}
        <Button variant="contained" onClick={fetchReport}>Refresh</Button>
      </Box>
      {renderBody()}
    </Box>
  );
}

function ReportTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>{headers.map((h) => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}</TableRow>
      </TableHead>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow><TableCell colSpan={headers.length}>No data</TableCell></TableRow>
        ) : rows.map((row, i) => (
          <TableRow key={i}>{row.map((cell, j) => <TableCell key={j}>{cell}</TableCell>)}</TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
