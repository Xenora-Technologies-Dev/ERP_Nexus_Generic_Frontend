import { useEffect, useState } from 'react';
import {
  Box, TextField, Autocomplete, Alert, CircularProgress, Typography,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper, Grid, Card, CardContent, Button, Chip, Stack,
} from '@mui/material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import { apiError } from '../../utils/apiError';

interface Party { id: string; code: string; name: string; }

interface LedgerEntry {
  date: string;
  type: string;
  reference: string;
  description?: string;
  dr: number;
  cr: number;
  balance: number;
  currency?: string;
  exchangeRate?: number;
  fcDebit?: number;
  fcCredit?: number;
}

interface LedgerData {
  customer?: Party;
  vendor?: Party | null;
  entries: LedgerEntry[];
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  balancesByCurrency?: { currency: string; balance: number }[];
}

const formatCurrency = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LedgersPage() {
  const [partyType, setPartyType] = useState<'customer' | 'vendor'>('customer');
  const [customers, setCustomers] = useState<Party[]>([]);
  const [vendors, setVendors] = useState<Party[]>([]);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [ledger, setLedger] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Party[]>('/customers', { params: { active: true } }),
      api.get<Party[]>('/vendors', { params: { active: true } }),
    ]).then(([c, v]) => {
      setCustomers(c.data);
      setVendors(v.data);
    }).catch(() => setError('Failed to load parties'));
  }, []);

  const fetchLedger = async (party: Party) => {
    setLoading(true);
    setError('');
    setLedger(null);
    try {
      const endpoint = partyType === 'customer'
        ? `/accounts/customer-ledger/${party.id}`
        : `/accounts/vendor-ledger/${party.id}`;
      const res = await api.get<LedgerData>(endpoint);
      setLedger(res.data);
    } catch (e) {
      setError(apiError(e, 'Failed to load ledger'));
    } finally {
      setLoading(false);
    }
  };

  const handlePartySelect = (party: Party | null) => {
    setSelectedParty(party);
    if (party) fetchLedger(party);
    else setLedger(null);
  };

  const parties = partyType === 'customer' ? customers : vendors;
  const day = (d: string) => d.slice(0, 10);
  const shown = (ledger?.entries ?? []).filter((e) => (!from || day(e.date) >= from) && (!to || day(e.date) <= to));
  const firstShown = shown[0] ? ledger!.entries.indexOf(shown[0]) : -1;
  const opening = firstShown > 0 ? ledger!.entries[firstShown - 1].balance : 0;
  const multiCurrency = (ledger?.entries ?? []).some((e) => e.currency && e.currency !== 'AED');

  const exportCsv = () => {
    if (!ledger) return;
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Date', 'Type', 'Reference', 'Description', 'Currency', 'FC Dr', 'FC Cr', 'Rate', 'Dr (AED)', 'Cr (AED)', 'Balance (AED)'],
      ...shown.map((e) => [day(e.date), e.type, e.reference, e.description ?? '', e.currency ?? 'AED', e.fcDebit ?? '', e.fcCredit ?? '', e.exchangeRate ?? 1, e.dr, e.cr, e.balance])];
    const blob = new Blob([rows.map((r) => r.map(q).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${partyType}-ledger-${selectedParty?.code ?? ''}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <Box>
      <PageHeader title="Ledgers" subtitle="Customer and vendor account ledgers" />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <TextField fullWidth select label="Party Type" value={partyType}
            onChange={(e) => {
              setPartyType(e.target.value as 'customer' | 'vendor');
              setSelectedParty(null);
              setLedger(null);
            }}
            SelectProps={{ native: true }}>
            <option value="customer">Customer</option>
            <option value="vendor">Vendor</option>
          </TextField>
        </Grid>
        <Grid item xs={12} sm={8}>
          <Autocomplete
            options={parties}
            getOptionLabel={(p) => `${p.code} - ${p.name}`}
            value={selectedParty}
            onChange={(_, v) => handlePartySelect(v)}
            renderInput={(params) => (
              <TextField {...params} label={partyType === 'customer' ? 'Select Customer' : 'Select Vendor'} />
            )}
          />
        </Grid>
      </Grid>

      {ledger && (
        <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
          <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
          <Button onClick={exportCsv}>Export CSV</Button>
          {(ledger.balancesByCurrency ?? []).map((b) => <Chip key={b.currency} label={`Open ${b.currency}: ${formatCurrency(b.balance)}`} />)}
        </Stack>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      )}

      {ledger && !loading && (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">Closing Balance</Typography>
                  <Typography variant="h5" fontWeight={700} color={ledger.closingBalance >= 0 ? 'primary' : 'error'}>
                    {formatCurrency(ledger.closingBalance)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">Total Debit (Dr)</Typography>
                  <Typography variant="h6">{formatCurrency(ledger.totalDebit)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">Total Credit (Cr)</Typography>
                  <Typography variant="h6">{formatCurrency(ledger.totalCredit)}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Reference</TableCell>
                  <TableCell>Description</TableCell>
                  {multiCurrency && <TableCell align="right">Doc amount</TableCell>}
                  <TableCell align="right">Dr (AED)</TableCell>
                  <TableCell align="right">Cr (AED)</TableCell>
                  <TableCell align="right">Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(from || to) && shown.length > 0 && (
                  <TableRow><TableCell colSpan={multiCurrency ? 7 : 6}><em>Opening balance</em></TableCell><TableCell align="right"><strong>{formatCurrency(opening)}</strong></TableCell></TableRow>
                )}
                {shown.length === 0 ? (
                  <TableRow><TableCell colSpan={8} align="center">No transactions</TableCell></TableRow>
                ) : shown.map((e, i) => (
                  <TableRow key={i} hover>
                    <TableCell>{new Date(e.date).toLocaleDateString()}</TableCell>
                    <TableCell>{e.type}</TableCell>
                    <TableCell>{e.reference}</TableCell>
                    <TableCell>{e.description || '-'}</TableCell>
                    {multiCurrency && <TableCell align="right">{e.currency && e.currency !== 'AED' ? `${e.currency} ${formatCurrency((e.fcDebit || 0) + (e.fcCredit || 0))} @ ${e.exchangeRate}` : '-'}</TableCell>}
                    <TableCell align="right">{e.dr > 0 ? formatCurrency(e.dr) : '-'}</TableCell>
                    <TableCell align="right">{e.cr > 0 ? formatCurrency(e.cr) : '-'}</TableCell>
                    <TableCell align="right"><strong>{formatCurrency(e.balance)}</strong></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {!selectedParty && !loading && (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          Select a {partyType} to view their ledger
        </Typography>
      )}
    </Box>
  );
}
