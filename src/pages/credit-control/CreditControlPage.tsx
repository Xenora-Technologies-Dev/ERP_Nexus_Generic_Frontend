import { D, money, sum } from '../../utils/money';
import { useEffect, useState } from 'react';
import {
  Box, Alert, CircularProgress, Card, CardContent, Typography, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper,
} from '@mui/material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import { brandColors } from '../../theme';

interface AgeingBucket {
  current: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  total: number;
}

interface CustomerAgeing {
  customerId: string;
  customerCode: string;
  customerName: string;
  creditLimit: number;
  creditDays: number;
  outstanding: number;
  ageing: AgeingBucket;
}

const formatAmt = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CreditControlPage() {
  const [data, setData] = useState<CustomerAgeing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<CustomerAgeing[]>('/credit-control/ageing')
      .then((res) => setData(res.data))
      .catch(() => setError('Failed to load ageing analysis'))
      .finally(() => setLoading(false));
  }, []);

  const totals = data.reduce(
    (acc, c) => ({
      current: money(D(acc.current).plus(c.ageing.current)),
      days31to60: money(D(acc.days31to60).plus(c.ageing.days31to60)),
      days61to90: money(D(acc.days61to90).plus(c.ageing.days61to90)),
      over90: money(D(acc.over90).plus(c.ageing.over90)),
      total: money(D(acc.total).plus(c.ageing.total)),
      outstanding: money(D(acc.outstanding).plus(c.outstanding)),
    }),
    { current: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0, outstanding: 0 }
  );

  const overdueCount = data.filter((c) => sum([c.ageing.days31to60, c.ageing.days61to90, c.ageing.over90]).gt(0)).length;

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <PageHeader title="Credit Control" subtitle="Customer ageing analysis" />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Card sx={{ flex: '1 1 180px' }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">Total Outstanding</Typography>
            <Typography variant="h6" fontWeight={700} color={brandColors.darkGreen}>{formatAmt(totals.outstanding)}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 180px' }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">0-30 Days</Typography>
            <Typography variant="h6" fontWeight={700} color="success.main">{formatAmt(totals.current)}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 180px' }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">31-60 Days</Typography>
            <Typography variant="h6" fontWeight={700} color="warning.main">{formatAmt(totals.days31to60)}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 180px' }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">61-90 Days</Typography>
            <Typography variant="h6" fontWeight={700} color="error.main">{formatAmt(totals.days61to90)}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 180px' }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">90+ Days</Typography>
            <Typography variant="h6" fontWeight={700} color="error.dark">{formatAmt(totals.over90)}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 180px' }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">Overdue Customers</Typography>
            <Typography variant="h6" fontWeight={700}>{overdueCount}</Typography>
          </CardContent>
        </Card>
      </Box>

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: brandColors.lightGreen }}>
              <TableCell>Code</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell align="right">Credit Limit</TableCell>
              <TableCell align="right">Outstanding</TableCell>
              <TableCell align="right">0-30</TableCell>
              <TableCell align="right">31-60</TableCell>
              <TableCell align="right">61-90</TableCell>
              <TableCell align="right">90+</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.filter((c) => c.outstanding > 0).length === 0 ? (
              <TableRow><TableCell colSpan={10} align="center">No outstanding balances</TableCell></TableRow>
            ) : data.filter((c) => c.outstanding > 0).map((c) => {
              const overLimit = c.outstanding > c.creditLimit;
              const hasOverdue = c.ageing.over90 > 0;
              return (
                <TableRow key={c.customerId} sx={{ bgcolor: hasOverdue ? 'error.50' : undefined }}>
                  <TableCell>{c.customerCode}</TableCell>
                  <TableCell>{c.customerName}</TableCell>
                  <TableCell align="right">{formatAmt(c.creditLimit)}</TableCell>
                  <TableCell align="right">{formatAmt(c.outstanding)}</TableCell>
                  <TableCell align="right">{formatAmt(c.ageing.current)}</TableCell>
                  <TableCell align="right">{formatAmt(c.ageing.days31to60)}</TableCell>
                  <TableCell align="right">{formatAmt(c.ageing.days61to90)}</TableCell>
                  <TableCell align="right">{formatAmt(c.ageing.over90)}</TableCell>
                  <TableCell align="right"><strong>{formatAmt(c.ageing.total)}</strong></TableCell>
                  <TableCell>
                    {overLimit && <Chip label="Over Limit" size="small" color="error" sx={{ mr: 0.5 }} />}
                    {hasOverdue && <Chip label="90+ Overdue" size="small" color="warning" />}
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow sx={{ fontWeight: 700, bgcolor: 'grey.100' }}>
              <TableCell colSpan={4}><strong>Totals</strong></TableCell>
              <TableCell align="right"><strong>{formatAmt(totals.current)}</strong></TableCell>
              <TableCell align="right"><strong>{formatAmt(totals.days31to60)}</strong></TableCell>
              <TableCell align="right"><strong>{formatAmt(totals.days61to90)}</strong></TableCell>
              <TableCell align="right"><strong>{formatAmt(totals.over90)}</strong></TableCell>
              <TableCell align="right"><strong>{formatAmt(totals.total)}</strong></TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
