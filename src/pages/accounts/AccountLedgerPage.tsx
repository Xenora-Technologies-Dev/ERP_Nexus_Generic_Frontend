import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Alert, Skeleton, TextField, Button, Table, TableHead, TableBody, TableRow,
  TableCell, TableContainer, Paper, Typography,
} from '@mui/material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import { brandColors } from '../../theme';

interface LedgerEntry {
  date: string; narration: string; docRef: string; debit: number; credit: number; runningBalance: number;
}

interface LedgerData {
  account: { code: string; name: string; accountType: string; balance: number };
  openingBalance: number;
  closingBalance: number;
  entries: LedgerEntry[];
}

const formatAed = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AccountLedgerPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchLedger = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const res = await api.get<{ data: LedgerData }>(`/accounts/ledger/${accountId}`, {
        params: { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined },
      });
      setData(res.data.data);
    } catch {
      setError('Failed to load ledger');
    } finally {
      setLoading(false);
    }
  }, [accountId, dateFrom, dateTo]);

  useEffect(() => { fetchLedger(); }, [fetchLedger]);

  return (
    <Box>
      <PageHeader
        title={data ? `${data.account.code} — ${data.account.name}` : 'Account Ledger'}
        subtitle="General ledger drill-down"
      />

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField size="small" label="From" type="date" value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField size="small" label="To" type="date" value={dateTo}
          onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        <Button variant="outlined" onClick={fetchLedger}>Apply</Button>
        <Button variant="text" onClick={() => navigate('/accounts/chart')}>Back to COA</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? <Skeleton height={400} /> : data && (
        <>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Opening: {formatAed(data.openingBalance)} | Closing: {formatAed(data.closingBalance)}
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: brandColors.lightGreen }}>
                  <TableCell>Date</TableCell>
                  <TableCell>Narration</TableCell>
                  <TableCell>Doc Ref</TableCell>
                  <TableCell align="right">Debit</TableCell>
                  <TableCell align="right">Credit</TableCell>
                  <TableCell align="right">Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.entries.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center">No entries</TableCell></TableRow>
                ) : data.entries.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell>{new Date(e.date).toLocaleDateString('en-AE')}</TableCell>
                    <TableCell>{e.narration}</TableCell>
                    <TableCell>{e.docRef}</TableCell>
                    <TableCell align="right">{e.debit > 0 ? formatAed(e.debit) : '—'}</TableCell>
                    <TableCell align="right">{e.credit > 0 ? formatAed(e.credit) : '—'}</TableCell>
                    <TableCell align="right">{formatAed(e.runningBalance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
