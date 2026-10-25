import { useEffect, useState } from 'react';
import { Box, TextField, MenuItem, Chip, Alert } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable from '../../components/common/DocumentTable';
import { fmtMoney } from '../../utils/money';

interface BatchRow {
  id: string; batchNumber: string; expiryDate: string | null; quantity: number; warehouse: string | null;
  daysToExpiry: number | null; status: 'OK' | 'EXPIRING' | 'EXPIRED' | 'NO_EXPIRY';
  product: { sku: string; name: string } | null;
}

const colour = { OK: 'success', EXPIRING: 'warning', EXPIRED: 'error', NO_EXPIRY: 'default' } as const;

/** Batch / lot stock with expiry status (issues are picked FEFO automatically). */
export default function BatchesPage() {
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [within, setWithin] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get<BatchRow[]>('/inventory/batches', { params: within ? { withinDays: within } : {} })
      .then((r) => { setRows(r.data); setError(''); })
      .catch(() => setError('Failed to load batches'))
      .finally(() => setLoading(false));
  }, [within]);

  const columns: GridColDef[] = [
    { field: 'sku', headerName: 'SKU', width: 120, valueGetter: (_, r) => (r as BatchRow).product?.sku ?? '' },
    { field: 'name', headerName: 'Product', flex: 1, valueGetter: (_, r) => (r as BatchRow).product?.name ?? '' },
    { field: 'batchNumber', headerName: 'Batch / Lot', width: 150 },
    { field: 'warehouse', headerName: 'Warehouse', width: 150 },
    { field: 'expiryDate', headerName: 'Expiry', width: 120, valueGetter: (_, r) => (r as BatchRow).expiryDate?.slice(0, 10) ?? '-' },
    { field: 'daysToExpiry', headerName: 'Days left', width: 100, valueGetter: (_, r) => (r as BatchRow).daysToExpiry ?? '-' },
    { field: 'quantity', headerName: 'Qty', width: 100, align: 'right', valueGetter: (_, r) => fmtMoney((r as BatchRow).quantity) },
    { field: 'status', headerName: 'Status', width: 130, renderCell: (p) => <Chip size="small" label={p.value} color={colour[p.value as BatchRow['status']]} /> },
  ];

  return (
    <Box>
      <PageHeader title="Batches & Expiry" subtitle="Lot stock by expiry; deliveries issue the earliest-expiring unexpired lot first (FEFO)" />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <TextField select size="small" label="Show" value={within} onChange={(e) => setWithin(e.target.value)} sx={{ mb: 2, minWidth: 220 }}>
        <MenuItem value="">All batches in stock</MenuItem>
        <MenuItem value="0">Expired</MenuItem>
        <MenuItem value="30">Expiring within 30 days</MenuItem>
        <MenuItem value="90">Expiring within 90 days</MenuItem>
      </TextField>
      <DocumentTable rows={rows} columns={columns} loading={loading} />
    </Box>
  );
}
