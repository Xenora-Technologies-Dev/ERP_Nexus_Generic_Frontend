import { useEffect, useState } from 'react';
import { Box, Alert, CircularProgress } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable from '../../components/common/DocumentTable';

interface Receipt {
  id: string;
  documentNumber: string;
  date: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  customer: { name: string; code: string };
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Receipt[]>('/accounts/receipts')
      .then((res) => setReceipts(res.data))
      .catch(() => setError('Failed to load receipts'))
      .finally(() => setLoading(false));
  }, []);

  const columns: GridColDef[] = [
    { field: 'documentNumber', headerName: 'Number', width: 140 },
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (v) => new Date(v as string).toLocaleDateString() },
    { field: 'customer', headerName: 'Customer', flex: 1, valueGetter: (_, row) => (row as Receipt).customer?.name },
    { field: 'amount', headerName: 'Amount', width: 120, type: 'number' },
    { field: 'paymentMethod', headerName: 'Method', width: 130 },
    { field: 'referenceNumber', headerName: 'Reference', width: 130 },
  ];

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <PageHeader title="Receipts" subtitle="Accounting view of customer receipts" />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <DocumentTable rows={receipts} columns={columns} loading={loading} />
    </Box>
  );
}
