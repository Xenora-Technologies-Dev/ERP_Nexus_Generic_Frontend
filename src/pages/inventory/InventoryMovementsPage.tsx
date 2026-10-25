import { fmtMoney } from '../../utils/money';
import { useEffect, useState, FormEvent } from 'react';
import {
  Box, TextField, Button, Alert, Grid, MenuItem, Paper,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { Search, Refresh } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable from '../../components/common/DocumentTable';

interface StockMovement {
  id: string;
  createdAt: string;
  action: string;
  movementType: string;
  productName?: string;
  productSku?: string;
  quantity: number;
  warehouseName?: string;
  customerName?: string;
  vendorName?: string;
  referenceNumber?: string;
  userName?: string;
}

const ACTION_OPTIONS = [
  '', 'DELIVERY_OUT', 'DELIVERY_REVERSAL', 'GRN_IN', 'GRN_REVERSAL', 'PURCHASE_INVOICE_IN',
  'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'OPENING_STOCK',
];

export default function InventoryMovementsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchMovements = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<StockMovement[]>('/inventory/movements', {
        params: {
          ...(search ? { search } : {}),
          ...(action ? { action } : {}),
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
        },
      });
      setMovements(res.data);
    } catch {
      setError('Failed to load inventory movements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMovements(); }, []);

  const handleFilter = (e: FormEvent) => {
    e.preventDefault();
    fetchMovements();
  };

  const columns: GridColDef[] = [
    {
      field: 'createdAt', headerName: 'Date/Time', width: 160,
      valueFormatter: (v) => new Date(v as string).toLocaleString(),
    },
    { field: 'action', headerName: 'Action', width: 140 },
    { field: 'productName', headerName: 'Product', flex: 1, minWidth: 150 },
    { field: 'productSku', headerName: 'SKU', width: 110 },
    { field: 'warehouseName', headerName: 'Warehouse', width: 130 },
    {
      field: 'quantity', headerName: 'Qty +/-', width: 100, type: 'number',
      renderCell: ({ row }) => {
        const m = row as StockMovement;
        const sign = m.movementType === 'OUT' ? '-' : '+';
        return `${sign}${fmtMoney(m.quantity)}`;
      },
    },
    {
      field: 'party', headerName: 'Customer/Vendor', width: 160,
      valueGetter: (_, row) => {
        const m = row as StockMovement;
        return m.customerName || m.vendorName || '-';
      },
    },
    { field: 'referenceNumber', headerName: 'Reference', width: 130 },
    { field: 'userName', headerName: 'User', width: 130 },
  ];

  return (
    <Box>
      <PageHeader title="Inventory Movements" subtitle="Stock in/out transaction history" />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box component="form" onSubmit={handleFilter}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4} md={3}>
              <TextField fullWidth size="small" label="Search" value={search}
                onChange={(e) => setSearch(e.target.value)} placeholder="Product, SKU, party, ref..." />
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <TextField fullWidth size="small" select label="Action" value={action}
                onChange={(e) => setAction(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {ACTION_OPTIONS.filter(Boolean).map((a) => (
                  <MenuItem key={a} value={a}>{a}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <TextField fullWidth size="small" label="From" type="date" value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <TextField fullWidth size="small" label="To" type="date" value={dateTo}
                onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <Button type="submit" variant="contained" startIcon={<Search />} sx={{ mr: 1 }}>Filter</Button>
              <Button variant="outlined" startIcon={<Refresh />} onClick={() => {
                setSearch(''); setAction(''); setDateFrom(''); setDateTo('');
                setTimeout(fetchMovements, 0);
              }}>Reset</Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      <DocumentTable rows={movements} columns={columns} loading={loading} />
    </Box>
  );
}
