import { money } from '../../utils/money';
import { useEffect, useState, FormEvent } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Alert, CircularProgress, Grid, Autocomplete,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable, { StatusChip } from '../../components/common/DocumentTable';
import LineItemsForm, { LineItem } from '../../components/common/LineItemsForm';
import DocumentDateField from '../../components/common/DocumentDateField';
import { todayISO, formatDateDDMMYYYY } from '../../utils/date';

interface Vendor { id: string; name: string; code: string; }
interface Product { id: string; name: string; sku: string; sellingPrice: number; costPrice: number; vatRate: number; unit?: string; packing?: string | null; }
interface RFQ {
  id: string; documentNumber: string; date: string; status: string;
  vendor: Vendor;
}

export default function RFQsPage() {
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [vendorId, setVendorId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([{ productId: '', quantity: 1, unitPrice: 0, vatRate: 5 }]);
  const [vatApplicable, setVatApplicable] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [r, v, p] = await Promise.all([
        api.get<RFQ[]>('/purchase/rfqs'),
        api.get<Vendor[]>('/vendors', { params: { active: true } }),
        api.get<Product[]>('/inventory/products', { params: { active: true } }),
      ]);
      setRfqs(r.data);
      setVendors(v.data);
      setProducts(p.data.map((pr) => ({
        id: pr.id, name: pr.name, sku: pr.sku, packing: pr.packing,
        sellingPrice: money(pr.costPrice), costPrice: money(pr.costPrice), vatRate: money(pr.vatRate),
        unit: pr.unit,
      })));
    } catch {
      setError('Failed to load RFQs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/purchase/rfqs', {
        vendorId, date, notes,
        items: items.filter((i) => i.productId).map((i) => ({
          productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice,
        })),
      });
      setDialogOpen(false);
      setSuccess('RFQ created');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create RFQ');
    } finally {
      setSaving(false);
    }
  };

  const columns: GridColDef[] = [
    { field: 'documentNumber', headerName: 'Number', width: 160 },
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (v) => formatDateDDMMYYYY(v as string) },
    { field: 'vendor', headerName: 'Vendor', flex: 1, valueGetter: (_, row) => (row as RFQ).vendor?.name },
    { field: 'status', headerName: 'Status', width: 120, renderCell: ({ value }) => <StatusChip status={value as string} /> },
  ];

  return (
    <Box>
      <PageHeader title="RFQs" subtitle="Request for quotations" actionLabel="New RFQ"
        onAction={() => { setVendorId(''); setDate(todayISO()); setItems([{ productId: '', quantity: 1, unitPrice: 0, vatRate: 5 }]); setDialogOpen(true); }} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <DocumentTable rows={rfqs} columns={columns} loading={loading} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="lg" fullWidth>
        <form onSubmit={handleCreate}>
          <DialogTitle>New RFQ</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <Autocomplete options={vendors} getOptionLabel={(v) => `${v.code} - ${v.name}`}
                  value={vendors.find((v) => v.id === vendorId) || null}
                  onChange={(_, val) => setVendorId(val?.id || '')}
                  renderInput={(params) => <TextField {...params} required label="Vendor" />} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DocumentDateField value={date} onChange={setDate} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Grid>
            </Grid>
            <LineItemsForm products={products} items={items} onChange={setItems}
              vatApplicable={vatApplicable} onVatChange={setVatApplicable} priceField="costPrice" />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? <CircularProgress size={20} /> : 'Create'}</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
