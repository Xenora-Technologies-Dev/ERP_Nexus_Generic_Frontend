import { money } from '../utils/money';
import { useEffect, useState } from 'react';
import {
  Box, Grid, Typography, Card, CardContent, Alert, CircularProgress, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from '@mui/material';
import {
  People, Store, Inventory, TrendingUp, TrendingDown, AccountBalance, PendingActions,
} from '@mui/icons-material';
import { api } from '../api/client';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import { StatusChip } from '../components/common/DocumentTable';
import { brandColors } from '../theme';

interface DashboardStats {
  totalCustomers: number;
  totalVendors: number;
  totalProducts: number;
  totalSales: number;
  totalPurchases: number;
  totalReceivables: number;
  totalPayables: number;
  pendingOrders: number;
}

interface RecentSale {
  id: string;
  documentNumber: string;
  customer: { name: string };
  total: number;
  status: string;
  date: string;
}

interface RecentPurchase {
  id: string;
  documentNumber: string;
  vendor: { name: string };
  total: number;
  status: string;
  date: string;
}

interface CreditAgeingItem {
  customerName: string;
  customerCode: string;
  outstanding: number;
  ageing: { current: number; days31to60: number; days61to90: number; over90: number; total: number };
}

interface DashboardData {
  stats: DashboardStats;
  recentSales: RecentSale[];
  recentPurchases: RecentPurchase[];
  creditAgeing: CreditAgeingItem[];
}

const formatCurrency = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<DashboardData>('/dashboard')
      .then((res) => setData(res.data))
      .catch(() => setError('Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !data) {
    return <Alert severity="error">{error || 'No data available'}</Alert>;
  }

  const { stats, recentSales, recentPurchases, creditAgeing } = data;

  return (
    <Box>
      <PageHeader title="Dashboard" subtitle="Overview of your business" />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <StatCard title="Customers" value={stats.totalCustomers} icon={<People />} />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <StatCard title="Vendors" value={stats.totalVendors} icon={<Store />} />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <StatCard title="Products" value={stats.totalProducts} icon={<Inventory />} />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <StatCard title="Pending Orders" value={stats.pendingOrders} icon={<PendingActions />} color="#e65100" />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <StatCard title="Total Sales" value={formatCurrency(stats.totalSales)} icon={<TrendingUp />} color={brandColors.brightGreen} />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <StatCard title="Total Purchases" value={formatCurrency(stats.totalPurchases)} icon={<TrendingDown />} />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <StatCard title="Receivables" value={formatCurrency(stats.totalReceivables)} icon={<AccountBalance />} color="#1565c0" />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <StatCard title="Payables" value={formatCurrency(stats.totalPayables)} icon={<AccountBalance />} color="#c62828" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>Recent Sales</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Document</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentSales.length === 0 ? (
                      <TableRow><TableCell colSpan={4} align="center">No recent sales</TableCell></TableRow>
                    ) : recentSales.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.documentNumber}</TableCell>
                        <TableCell>{s.customer?.name}</TableCell>
                        <TableCell align="right">{formatCurrency(money(s.total))}</TableCell>
                        <TableCell><StatusChip status={s.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>Recent Purchases</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Document</TableCell>
                      <TableCell>Vendor</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentPurchases.length === 0 ? (
                      <TableRow><TableCell colSpan={4} align="center">No recent purchases</TableCell></TableRow>
                    ) : recentPurchases.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.documentNumber}</TableCell>
                        <TableCell>{p.vendor?.name}</TableCell>
                        <TableCell align="right">{formatCurrency(money(p.total))}</TableCell>
                        <TableCell><StatusChip status={p.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} gutterBottom>Credit Ageing (Top 10)</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Customer</TableCell>
                      <TableCell align="right">0-30</TableCell>
                      <TableCell align="right">31-60</TableCell>
                      <TableCell align="right">61-90</TableCell>
                      <TableCell align="right">90+</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {creditAgeing.filter((c) => c.outstanding > 0).length === 0 ? (
                      <TableRow><TableCell colSpan={6} align="center">No outstanding balances</TableCell></TableRow>
                    ) : creditAgeing.filter((c) => c.outstanding > 0).map((c) => (
                      <TableRow key={c.customerCode}>
                        <TableCell>{c.customerName}</TableCell>
                        <TableCell align="right">{formatCurrency(c.ageing.current)}</TableCell>
                        <TableCell align="right">{formatCurrency(c.ageing.days31to60)}</TableCell>
                        <TableCell align="right">{formatCurrency(c.ageing.days61to90)}</TableCell>
                        <TableCell align="right">{formatCurrency(c.ageing.over90)}</TableCell>
                        <TableCell align="right"><strong>{formatCurrency(c.ageing.total)}</strong></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
