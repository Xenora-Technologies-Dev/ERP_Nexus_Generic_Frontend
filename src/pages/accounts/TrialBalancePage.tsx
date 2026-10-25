import { useEffect, useState } from 'react';
import {
  Box, Alert, CircularProgress, Card, CardContent, Typography, TextField, Button,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper, Chip,
} from '@mui/material';
import { CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import { brandColors } from '../../theme';

interface TrialBalanceRow {
  code: string;
  name: string;
  accountType: string;
  debit: number;
  credit: number;
}

interface TrialBalance {
  balances: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

const formatAmt = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TrialBalancePage() {
  const [data, setData] = useState<TrialBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0]);

  const fetchTrialBalance = () => {
    setLoading(true);
    setError('');
    api.get<TrialBalance>('/accounts/trial-balance', { params: { asOf } })
      .then((res) => setData(res.data))
      .catch(() => setError('Failed to load trial balance'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTrialBalance(); }, []);

  return (
    <Box>
      <PageHeader title="Trial Balance" subtitle="Account balances as of date" />

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" label="As of Date" type="date" value={asOf}
          onChange={(e) => setAsOf(e.target.value)} InputLabelProps={{ shrink: true }} />
        <Button variant="outlined" onClick={fetchTrialBalance}>Refresh</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : data && (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Total Debit</Typography>
                <Typography variant="h6" fontWeight={700}>{formatAmt(data.totalDebit)}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Total Credit</Typography>
                <Typography variant="h6" fontWeight={700}>{formatAmt(data.totalCredit)}</Typography>
              </Box>
              <Chip
                icon={data.balanced ? <CheckCircle /> : <ErrorIcon />}
                label={data.balanced ? 'Trial Balance is Balanced' : 'Trial Balance is NOT Balanced'}
                color={data.balanced ? 'success' : 'error'}
                sx={{ fontWeight: 600 }}
              />
            </CardContent>
          </Card>

          <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: brandColors.lightGreen }}>
                  <TableCell>Code</TableCell>
                  <TableCell>Account</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Debit</TableCell>
                  <TableCell align="right">Credit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.balances.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center">No balances found</TableCell></TableRow>
                ) : data.balances.map((row) => (
                  <TableRow key={row.code}>
                    <TableCell>{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.accountType}</TableCell>
                    <TableCell align="right">{row.debit > 0 ? formatAmt(row.debit) : '-'}</TableCell>
                    <TableCell align="right">{row.credit > 0 ? formatAmt(row.credit) : '-'}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ fontWeight: 700, bgcolor: 'grey.100' }}>
                  <TableCell colSpan={3}><strong>Totals</strong></TableCell>
                  <TableCell align="right"><strong>{formatAmt(data.totalDebit)}</strong></TableCell>
                  <TableCell align="right"><strong>{formatAmt(data.totalCredit)}</strong></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
