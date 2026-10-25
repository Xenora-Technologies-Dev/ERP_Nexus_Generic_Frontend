import { money, qtyOut } from '../../utils/money';
import { useEffect, useState, FormEvent } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Alert, CircularProgress, Grid, Autocomplete, IconButton,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { CheckCircle, Cancel, Delete, Visibility, PictureAsPdf, Print } from '@mui/icons-material';
import { api, displayDocumentNumber, pdfFilename } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable, { StatusChip } from '../../components/common/DocumentTable';
import LineItemsForm, { LineItem } from '../../components/common/LineItemsForm';
import DocumentDateField from '../../components/common/DocumentDateField';
import DocumentViewDialog from '../../components/common/DocumentViewDialog';
import { todayISO, formatDateDDMMYYYY } from '../../utils/date';

interface Vendor {
  id: string; name: string; code: string;
  address?: string | null; vatNumber?: string | null;
  phone?: string | null; email?: string | null;
}
interface Product { id: string; name: string; sku: string; sellingPrice: number; costPrice: number; vatRate: number; unit?: string; }
interface PurchaseOrderItem {
  id: string; productId: string; quantity: number; unitPrice: number; vatRate: number;
  vatAmount?: number; total: number; description?: string;
  product?: Product;
}
interface PurchaseOrder {
  id: string;
  documentNumber: string;
  date: string;
  status: string;
  vendorId: string;
  vendor: Vendor;
  total: number;
  subtotal?: number;
  vatAmount?: number;
  discount?: number;
  vatApplicable?: boolean;
  reference?: string | null;
  notes?: string | null;
  items?: PurchaseOrderItem[];
}

async function fetchPoPdfBlob(id: string) {
  const res = await api.get(`/purchase/orders/${id}/pdf`, { responseType: 'blob' });
  return new Blob([res.data], { type: 'application/pdf' });
}

const downloadPdf = async (id: string, docNumber: string, partyName: string) => {
  const blob = await fetchPoPdfBlob(id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = pdfFilename(partyName, docNumber);
  a.click();
  URL.revokeObjectURL(url);
};

const printPdf = async (id: string) => {
  const blob = await fetchPoPdfBlob(id);
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) {
    URL.revokeObjectURL(url);
    throw new Error('Popup blocked — allow popups to print');
  }
  const revoke = () => URL.revokeObjectURL(url);
  w.addEventListener('load', () => {
    try { w.focus(); w.print(); } catch { /* ignore */ }
  });
  // Fallback if load already fired
  setTimeout(() => {
    try { w.print(); } catch { /* ignore */ }
  }, 500);
  setTimeout(revoke, 60_000);
};

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [vendorId, setVendorId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [reference, setReference] = useState('');
  const [items, setItems] = useState<LineItem[]>([{ productId: '', quantity: 1, unitPrice: 0, vatRate: 5 }]);
  const [vatApplicable, setVatApplicable] = useState(true);
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [o, v, p] = await Promise.all([
        api.get<PurchaseOrder[]>('/purchase/orders'),
        api.get<Vendor[]>('/vendors', { params: { active: true } }),
        api.get<Product[]>('/inventory/products', { params: { active: true } }),
      ]);
      setOrders(o.data);
      setVendors(v.data);
      setProducts(p.data.map((pr) => ({
        id: pr.id, name: pr.name, sku: pr.sku,
        sellingPrice: money(pr.costPrice), costPrice: money(pr.costPrice), vatRate: money(pr.vatRate),
        unit: pr.unit,
      })));
    } catch {
      setError('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openView = async (order: PurchaseOrder) => {
    setActionId(order.id);
    try {
      const res = await api.get<PurchaseOrder>(`/purchase/orders/${order.id}`);
      setViewOrder(res.data);
      setViewOpen(true);
    } catch {
      setError('Failed to load purchase order');
    } finally {
      setActionId(null);
    }
  };

  const handleDownload = async (order: PurchaseOrder) => {
    setPdfBusy(true);
    setActionId(order.id);
    try {
      await downloadPdf(order.id, displayDocumentNumber(order.documentNumber), order.vendor?.name || 'Vendor');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error
        || (err as { message?: string })?.message;
      setError(msg || 'Failed to download PDF');
    } finally {
      setPdfBusy(false);
      setActionId(null);
    }
  };

  const handlePrint = async (order: PurchaseOrder) => {
    setPdfBusy(true);
    setActionId(order.id);
    try {
      await printPdf(order.id);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message;
      setError(msg || 'Failed to print PDF');
    } finally {
      setPdfBusy(false);
      setActionId(null);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/purchase/orders', {
        vendorId, date, reference: reference || null, vatApplicable, notes, discount,
        items: items.filter((i) => i.productId).map((i) => ({
          productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: i.vatRate, taxCode: i.taxCode || undefined,
        })),
      });
      setDialogOpen(false);
      setReference('');
      setSuccess('Purchase order created');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create order');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (order: PurchaseOrder) => {
    setActionId(order.id);
    try {
      await api.post(`/purchase/orders/${order.id}/approve`);
      setSuccess('Purchase order approved');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to approve order');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (order: PurchaseOrder) => {
    if (!window.confirm(`Reject order ${order.documentNumber}?`)) return;
    setActionId(order.id);
    try {
      await api.post(`/purchase/orders/${order.id}/reject`);
      setSuccess('Purchase order rejected');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to reject order');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (order: PurchaseOrder) => {
    if (!window.confirm(`Delete order ${order.documentNumber}?`)) return;
    setActionId(order.id);
    try {
      await api.delete(`/purchase/orders/${order.id}`);
      setSuccess('Purchase order deleted');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to delete order');
    } finally {
      setActionId(null);
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'documentNumber', headerName: 'Number', width: 160,
      valueGetter: (_, row) => displayDocumentNumber((row as PurchaseOrder).documentNumber),
    },
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (v) => formatDateDDMMYYYY(v as string) },
    { field: 'vendor', headerName: 'Vendor', flex: 1, valueGetter: (_, row) => (row as PurchaseOrder).vendor?.name },
    { field: 'reference', headerName: 'Reference', width: 120, valueGetter: (_, row) => (row as PurchaseOrder).reference || '-' },
    { field: 'total', headerName: 'Total', width: 110, type: 'number' },
    { field: 'status', headerName: 'Status', width: 120, renderCell: ({ value }) => <StatusChip status={value as string} /> },
    {
      field: 'actions', headerName: 'Actions', width: 200, sortable: false,
      renderCell: ({ row }) => {
        const order = row as PurchaseOrder;
        const busy = actionId === order.id;
        return (
          <Box>
            <IconButton size="small" title="View" disabled={busy} onClick={() => openView(order)}>
              {busy ? <CircularProgress size={16} /> : <Visibility fontSize="small" />}
            </IconButton>
            <IconButton size="small" title="Download PDF" disabled={busy} onClick={() => handleDownload(order)}>
              <PictureAsPdf fontSize="small" color="error" />
            </IconButton>
            <IconButton size="small" title="Print" disabled={busy} onClick={() => handlePrint(order)}>
              <Print fontSize="small" />
            </IconButton>
            {order.status === 'DRAFT' && (
              <>
                <IconButton size="small" title="Approve" color="primary" disabled={busy} onClick={() => handleApprove(order)}>
                  <CheckCircle fontSize="small" />
                </IconButton>
                <IconButton size="small" title="Reject" color="error" disabled={busy} onClick={() => handleReject(order)}>
                  <Cancel fontSize="small" />
                </IconButton>
              </>
            )}
            {['DRAFT', 'CANCELLED'].includes(order.status) && (
              <IconButton size="small" title="Delete" color="error" disabled={busy} onClick={() => handleDelete(order)}>
                <Delete fontSize="small" />
              </IconButton>
            )}
          </Box>
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader title="Purchase Orders" subtitle="Supplier purchase orders" actionLabel="New Order"
        onAction={() => {
          setVendorId('');
          setDate(todayISO());
          setReference('');
          setDiscount(0);
          setNotes('');
          setItems([{ productId: '', quantity: 1, unitPrice: 0, vatRate: 5 }]);
          setDialogOpen(true);
        }} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <DocumentTable rows={orders} columns={columns} loading={loading} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="lg" fullWidth>
        <form onSubmit={handleCreate}>
          <DialogTitle>New Purchase Order</DialogTitle>
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
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Reference" value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  helperText="Shown on Purchase Invoice when created from this PO" />
              </Grid>
            </Grid>
            <LineItemsForm products={products} items={items} onChange={setItems}
              vatApplicable={vatApplicable} onVatChange={setVatApplicable} priceField="costPrice"
              showDiscount discount={discount} onDiscountChange={setDiscount} />
            <TextField fullWidth label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} sx={{ mt: 2 }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? <CircularProgress size={20} /> : 'Create'}</Button>
          </DialogActions>
        </form>
      </Dialog>

      <DocumentViewDialog
        open={viewOpen}
        onClose={() => { setViewOpen(false); setViewOrder(null); }}
        title="Purchase Order"
        busy={pdfBusy}
        onDownload={viewOrder ? () => handleDownload(viewOrder) : undefined}
        onPrint={viewOrder ? () => handlePrint(viewOrder) : undefined}
        document={viewOrder ? {
          documentNumber: displayDocumentNumber(viewOrder.documentNumber),
          date: viewOrder.date,
          status: viewOrder.status,
          reference: viewOrder.reference,
          notes: viewOrder.notes,
          partyName: viewOrder.vendor?.name,
          partyLabel: 'Supplier',
          partyAddress: viewOrder.vendor?.address,
          partyVatNumber: viewOrder.vendor?.vatNumber,
          partyPhone: viewOrder.vendor?.phone,
          partyEmail: viewOrder.vendor?.email,
          vatApplicable: viewOrder.vatApplicable,
          subtotal: viewOrder.subtotal != null ? money(viewOrder.subtotal) : undefined,
          vatAmount: viewOrder.vatAmount != null ? money(viewOrder.vatAmount) : undefined,
          discount: viewOrder.discount != null ? money(viewOrder.discount) : undefined,
          total: money(viewOrder.total),
          items: (viewOrder.items || []).map((i) => ({
            description: i.description || i.product?.name,
            quantity: qtyOut(i.quantity),
            unit: i.product?.unit,
            unitPrice: money(i.unitPrice),
            vatRate: money(i.vatRate),
            taxCode: (i as { taxCode?: string | null }).taxCode || undefined,
            vatAmount: i.vatAmount != null ? money(i.vatAmount) : undefined,
            total: money(i.total),
            product: i.product,
          })),
        } : null}
      />
    </Box>
  );
}
