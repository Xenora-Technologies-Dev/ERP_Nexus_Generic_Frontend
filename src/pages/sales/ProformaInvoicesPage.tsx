import { useEffect, useState, FormEvent } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Alert, CircularProgress, Grid, Autocomplete, IconButton,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { SwapHoriz, Visibility, PictureAsPdf } from '@mui/icons-material';
import { api, displayDocumentNumber, pdfFilename } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable, { StatusChip } from '../../components/common/DocumentTable';
import LineItemsForm, { LineItem } from '../../components/common/LineItemsForm';
import DocumentDateField from '../../components/common/DocumentDateField';
import DocumentViewDialog from '../../components/common/DocumentViewDialog';
import { money, qtyOut } from '../../utils/money';
import { todayISO, formatDateDDMMYYYY } from '../../utils/date';

interface Customer { id: string; name: string; code: string; address?: string | null; vatNumber?: string | null; phone?: string | null; email?: string | null; }
interface Product { id: string; name: string; sku: string; sellingPrice: number; vatRate: number; unit?: string; packing?: string | null; }
interface Line {
  description?: string; quantity: number; unitPrice: number; vatRate: number;
  vatAmount?: number; total: number; product?: Product;
}
interface Proforma {
  id: string; documentNumber: string; date: string; status: string;
  customer: Customer; total: number; subtotal?: number; vatAmount?: number;
  vatApplicable: boolean; notes?: string | null; items?: Line[];
}

export default function ProformaInvoicesPage() {
  const [rows, setRows] = useState<Proforma[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [validUntil, setValidUntil] = useState('');
  const [items, setItems] = useState<LineItem[]>([{ productId: '', quantity: 1, unitPrice: 0, vatRate: 5 }]);
  const [vatApplicable, setVatApplicable] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<Proforma | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [q, c, p] = await Promise.all([
        api.get<Proforma[]>('/sales/proformas'),
        api.get<Customer[]>('/customers', { params: { active: true } }),
        api.get<Product[]>('/inventory/products', { params: { active: true } }),
      ]);
      setRows(q.data);
      setCustomers(c.data);
      setProducts(p.data.map((pr) => ({
        id: pr.id, name: pr.name, sku: pr.sku,
        sellingPrice: money(pr.sellingPrice), vatRate: money(pr.vatRate), unit: pr.unit, packing: pr.packing,
      })));
    } catch {
      setError('Failed to load proforma invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setCustomerId('');
    setDate(todayISO());
    setValidUntil('');
    setNotes('');
    setVatApplicable(true);
    setItems([{ productId: '', quantity: 1, unitPrice: 0, vatRate: 5 }]);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!customerId || items.every((i) => !i.productId)) {
      setError('Select customer and at least one product');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/sales/proformas', {
        customerId, date, validUntil: validUntil || null, vatApplicable, notes,
        items: items.filter((i) => i.productId).map((i) => ({
          productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: i.vatRate, taxCode: i.taxCode || undefined,
        })),
      });
      setDialogOpen(false);
      setSuccess('Proforma invoice created');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create proforma invoice');
    } finally {
      setSaving(false);
    }
  };

  const convertToOrder = async (id: string) => {
    setConverting(id);
    setError('');
    try {
      await api.post(`/sales/proformas/${id}/convert-to-order`);
      setSuccess('Converted to sales order');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to convert');
    } finally {
      setConverting(null);
    }
  };

  const openView = async (row: Proforma) => {
    try {
      const res = await api.get<Proforma>(`/sales/proformas/${row.id}`);
      setViewDoc(res.data);
      setViewOpen(true);
    } catch {
      setError('Failed to load proforma invoice');
    }
  };

  const downloadPdf = async (row: Proforma) => {
    try {
      const res = await api.get(`/sales/proformas/${row.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfFilename(row.customer?.name || 'Customer', row.documentNumber);
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download proforma PDF');
    }
  };

  const columns: GridColDef[] = [
    { field: 'documentNumber', headerName: 'Number', width: 160, valueGetter: (_, row) => displayDocumentNumber((row as Proforma).documentNumber) },
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (v) => formatDateDDMMYYYY(v as string) },
    { field: 'customer', headerName: 'Customer', flex: 1, valueGetter: (_, row) => (row as Proforma).customer?.name },
    { field: 'total', headerName: 'Total', width: 110, type: 'number' },
    { field: 'status', headerName: 'Status', width: 120, renderCell: ({ value }) => <StatusChip status={value as string} /> },
    {
      field: 'actions', headerName: 'Actions', width: 150, sortable: false,
      renderCell: ({ row }) => {
        const q = row as Proforma;
        return (
          <Box>
            <IconButton size="small" title="View" onClick={() => openView(q)}><Visibility fontSize="small" /></IconButton>
            <IconButton size="small" title="Download PDF" onClick={() => downloadPdf(q)}>
              <PictureAsPdf fontSize="small" color="error" />
            </IconButton>
            {q.status !== 'CONVERTED' && q.status !== 'CANCELLED' && (
              <IconButton size="small" title="Convert to Order" disabled={converting === q.id} onClick={() => convertToOrder(q.id)}>
                {converting === q.id ? <CircularProgress size={18} /> : <SwapHoriz fontSize="small" />}
              </IconButton>
            )}
          </Box>
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader title="Proforma Invoices" subtitle="Create a proforma invoice. It is not a tax invoice and does not post stock or accounts."
        actionLabel="New Proforma"
        onAction={() => { resetForm(); setDialogOpen(true); }} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <DocumentTable rows={rows} columns={columns} loading={loading} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="lg" fullWidth>
        <form onSubmit={handleCreate}>
          <DialogTitle>New Proforma Invoice</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              <Grid item xs={12} sm={4}>
                <Autocomplete
                  options={customers}
                  getOptionLabel={(c) => `${c.code} - ${c.name}`}
                  value={customers.find((c) => c.id === customerId) || null}
                  onChange={(_, v) => setCustomerId(v?.id || '')}
                  renderInput={(params) => <TextField {...params} required label="Customer" />}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <DocumentDateField value={date} onChange={setDate} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth type="date" label="Valid until" value={validUntil} InputLabelProps={{ shrink: true }}
                  onChange={(e) => setValidUntil(e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Notes" multiline rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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

      <DocumentViewDialog
        open={viewOpen}
        onClose={() => { setViewOpen(false); setViewDoc(null); }}
        title="Proforma Invoice"
        onDownload={viewDoc ? () => downloadPdf(viewDoc) : undefined}
        document={viewDoc ? {
          documentNumber: displayDocumentNumber(viewDoc.documentNumber),
          date: viewDoc.date,
          status: viewDoc.status,
          notes: viewDoc.notes,
          partyName: viewDoc.customer?.name,
          partyLabel: 'Customer',
          partyAddress: viewDoc.customer?.address,
          partyVatNumber: viewDoc.customer?.vatNumber,
          partyPhone: viewDoc.customer?.phone,
          partyEmail: viewDoc.customer?.email,
          vatApplicable: viewDoc.vatApplicable,
          subtotal: viewDoc.subtotal != null ? money(viewDoc.subtotal) : undefined,
          vatAmount: viewDoc.vatAmount != null ? money(viewDoc.vatAmount) : undefined,
          total: money(viewDoc.total),
          items: (viewDoc.items || []).map((i) => ({
            description: i.description || i.product?.name,
            quantity: qtyOut(i.quantity),
            unit: i.product?.unit,
            unitPrice: money(i.unitPrice),
            vatRate: money(i.vatRate),
            vatAmount: i.vatAmount != null ? money(i.vatAmount) : undefined,
            total: money(i.total),
            product: i.product,
          })),
        } : null}
      />
    </Box>
  );
}
