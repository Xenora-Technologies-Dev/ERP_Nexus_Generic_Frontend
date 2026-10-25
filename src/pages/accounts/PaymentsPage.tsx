import { useEffect, useState } from 'react';
import { Box, Alert, CircularProgress } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable from '../../components/common/DocumentTable';

interface Payment {
  id: string;
  documentNumber: string;
  date: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  vendor: { name: string; code: string };
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Payment[]>('/accounts/payments')
      .then((res) => setPayments(res.data))
      .catch(() => setError('Failed to load payments'))
      .finally(() => setLoading(false));
  }, []);

  const columns: GridColDef[] = [
    { field: 'documentNumber', headerName: 'Number', width: 140 },
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (v) => new Date(v as string).toLocaleDateString() },
    { field: 'vendor', headerName: 'Vendor', flex: 1, valueGetter: (_, row) => (row as Payment).vendor?.name },
    { field: 'amount', headerName: 'Amount', width: 120, type: 'number' },
    { field: 'paymentMethod', headerName: 'Method', width: 130 },
    { field: 'referenceNumber', headerName: 'Reference', width: 130 },
  ];

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <PageHeader title="Payments" subtitle="Accounting view of vendor payments" />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <DocumentTable rows={payments} columns={columns} loading={loading} />
    </Box>
  );
}
