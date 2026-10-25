import { money } from '../../utils/money';
import { useEffect, useState, FormEvent } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Alert, CircularProgress, Grid, Autocomplete, IconButton,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { SwapHoriz } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable, { StatusChip } from '../../components/common/DocumentTable';
import LineItemsForm, { LineItem } from '../../components/common/LineItemsForm';
import DocumentDateField from '../../components/common/DocumentDateField';
import { todayISO, formatDateDDMMYYYY } from '../../utils/date';

interface Customer { id: string; name: string; code: string; }
interface Product { id: string; name: string; sku: string; sellingPrice: number; vatRate: number; unit?: string; }
interface Quotation {
  id: string; documentNumber: string; date: string; status: string;
  customer: Customer; total: number; vatApplicable: boolean;
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [items, setItems] = useState<LineItem[]>([{ productId: '', quantity: 1, unitPrice: 0, vatRate: 5 }]);
  const [vatApplicable, setVatApplicable] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [q, c, p] = await Promise.all([
        api.get<Quotation[]>('/sales/quotations'),
        api.get<Customer[]>('/customers', { params: { active: true } }),
        api.get<Product[]>('/inventory/products', { params: { active: true } }),
      ]);
      setQuotations(q.data);
      setCustomers(c.data);
      setProducts(p.data.map((pr) => ({
        id: pr.id, name: pr.name, sku: pr.sku,
        sellingPrice: money(pr.sellingPrice), vatRate: money(pr.vatRate), unit: pr.unit,
      })));
    } catch {
      setError('Failed to load quotations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!customerId || items.every((i) => !i.productId)) {
      setError('Select customer and at least one product');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/sales/quotations', {
        customerId, date, vatApplicable, notes,
        items: items.filter((i) => i.productId).map((i) => ({
          productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: i.vatRate, taxCode: i.taxCode || undefined,
        })),
      });
      setDialogOpen(false);
      setSuccess('Quotation created');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create quotation');
    } finally {
      setSaving(false);
    }
  };

  const convertToOrder = async (id: string) => {
    setConverting(id);
    setError('');
    try {
      await api.post(`/sales/quotations/${id}/convert-to-order`);
      setSuccess('Converted to sales order');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to convert');
    } finally {
      setConverting(null);
    }
  };

  const columns: GridColDef[] = [
    { field: 'documentNumber', headerName: 'Number', width: 140 },
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (v) => formatDateDDMMYYYY(v as string) },
    { field: 'customer', headerName: 'Customer', flex: 1, valueGetter: (_, row) => (row as Quotation).customer?.name },
    { field: 'total', headerName: 'Total', width: 110, type: 'number' },
    { field: 'status', headerName: 'Status', width: 120, renderCell: ({ value }) => <StatusChip status={value as string} /> },
    {
      field: 'actions', headerName: 'Actions', width: 80, sortable: false,
      renderCell: ({ row }) => {
        const q = row as Quotation;
        if (q.status === 'CONVERTED') return null;
        return (
          <IconButton size="small" title="Convert to Order" disabled={converting === q.id}
            onClick={() => convertToOrder(q.id)}>
            {converting === q.id ? <CircularProgress size={18} /> : <SwapHoriz fontSize="small" />}
          </IconButton>
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader title="Quotations" subtitle="Sales quotations" actionLabel="New Quotation"
        onAction={() => { setCustomerId(''); setDate(todayISO()); setItems([{ productId: '', quantity: 1, unitPrice: 0, vatRate: 5 }]); setDialogOpen(true); }} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <DocumentTable rows={quotations} columns={columns} loading={loading} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="lg" fullWidth>
        <form onSubmit={handleCreate}>
          <DialogTitle>New Quotation</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  options={customers}
                  getOptionLabel={(c) => `${c.code} - ${c.name}`}
                  value={customers.find((c) => c.id === customerId) || null}
                  onChange={(_, v) => setCustomerId(v?.id || '')}
                  renderInput={(params) => <TextField {...params} required label="Customer" />}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DocumentDateField value={date} onChange={setDate} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Notes" multiline rows={2} value={notes}
                  onChange={(e) => setNotes(e.target.value)} />
              </Grid>
            </Grid>
            <LineItemsForm products={products} items={items} onChange={setItems}
              vatApplicable={vatApplicable} onVatChange={setVatApplicable} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={20} /> : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
