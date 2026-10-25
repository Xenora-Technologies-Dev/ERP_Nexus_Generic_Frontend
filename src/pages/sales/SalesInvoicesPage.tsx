import { D, fmtMoney, lineNet, money, previewDocument, qtyOut } from '../../utils/money';
import { useEffect, useState, FormEvent } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Alert, CircularProgress, Grid, IconButton, Checkbox, FormControlLabel, Typography,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper, Autocomplete,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { CheckCircle, PictureAsPdf, Visibility, Edit, Delete } from '@mui/icons-material';
import { api, displayDocumentNumber, pdfFilename } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable, { StatusChip } from '../../components/common/DocumentTable';
import DocumentViewDialog from '../../components/common/DocumentViewDialog';
import LineItemsForm, { LineItem, NumberField } from '../../components/common/LineItemsForm';
import DocumentDateField from '../../components/common/DocumentDateField';
import { todayISO, toInputDate, formatDateDDMMYYYY } from '../../utils/date';

function dueDateFromCreditDays(invoiceDateIso: string, creditDays?: number | null): string {
  const days = qtyOut(creditDays || 0);
  if (days <= 0 || !invoiceDateIso) return '';
  const [y, m, d] = invoiceDateIso.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}


interface Customer { id: string; name: string; code: string; address?: string | null; vatNumber?: string | null; phone?: string | null; email?: string | null; creditDays?: number; currency?: string; }
interface Product {
  id: string; name: string; sku: string; sellingPrice: number; vatRate: number; unit?: string; countryOfOrigin?: string | null;
}
interface DeliveryNote {
  id: string; documentNumber: string; date: string; status: string;
  customer: Customer; salesOrderNumber?: string; isInvoiced?: boolean;
}
interface InvoiceItem {
  id?: string;
  productId: string; description: string; quantity: number;
  unitPrice: number; vatRate: number; vatAmount: number; total: number; unit?: string;
  product?: { name?: string; unit?: string };
}
interface InvoicePreview {
  customer: Customer;
  deliveryNoteIds: string[];
  reference?: string;
  remarks?: string;
  vatApplicable: boolean;
  discount: number;
  notes?: string;
  items: InvoiceItem[];
  subtotal: number;
  vatAmount: number;
  total: number;
}
interface SalesInvoice {
  id: string; documentNumber: string; date: string; status: string;
  reference?: string | null; customer: Customer; total: number;
  vatApplicable: boolean; subtotal?: number; vatAmount?: number; discount?: number;
  remarks?: string; notes?: string; dueDate?: string | null;
  paidAmount?: number; creditedAmount?: number;
  items?: InvoiceItem[];
}

const downloadPdf = async (id: string, partyName: string, docNumber: string, customerCopy = false) => {
  const res = await api.get(`/sales/invoices/${id}/pdf`, {
    responseType: 'blob',
    params: customerCopy ? { copy: 'customer' } : undefined,
  });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  const base = pdfFilename(partyName, docNumber).replace(/\.pdf$/i, '');
  a.download = customerCopy ? `${base}_CustomerCopy.pdf` : `${base}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};

const downloadInvoiceWithCustomerCopyPrompt = async (id: string, partyName: string, docNumber: string) => {
  await downloadPdf(id, partyName, docNumber, false);
  if (window.confirm('Do you want Customer Copy?')) {
    await downloadPdf(id, partyName, docNumber, true);
  }
};

export default function SalesInvoicesPage() {
  const { user } = useAuth();
  const isAdmin = !!user?.permissions?.includes('system.admin');
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<SalesInvoice | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<SalesInvoice | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerDns, setCustomerDns] = useState<DeliveryNote[]>([]);
  const [loadingDns, setLoadingDns] = useState(false);
  const [selectedDnIds, setSelectedDnIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [editDiscount, setEditDiscount] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [currency, setCurrency] = useState('AED');
  const [fxRate, setFxRate] = useState('');
  const [editVat, setEditVat] = useState(true);

  // Edit-form state
  const [editReference, setEditReference] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [editDocumentNumber, setEditDocumentNumber] = useState('');
  const [editDate, setEditDate] = useState(todayISO());
  const [editDueDate, setEditDueDate] = useState('');
  const [editItems, setEditItems] = useState<LineItem[]>([]);
  const [editFormDiscount, setEditFormDiscount] = useState(0);
  const [editFormNotes, setEditFormNotes] = useState('');
  const [editFormVat, setEditFormVat] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<SalesInvoice | null>(null);
  const [deleteRemarks, setDeleteRemarks] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const inv = await api.get<SalesInvoice[]>('/sales/invoices');
      setInvoices(inv.data);
    } catch {
      setError('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, []);

  const loadCustomers = async () => {
    const res = await api.get<Customer[]>('/customers', { params: { active: true } });
    setCustomers(res.data);
  };

  const loadCustomerDns = async (customerId: string) => {
    setLoadingDns(true);
    setSelectedDnIds([]);
    setPreview(null);
    try {
      const res = await api.get<DeliveryNote[]>('/sales/delivery-notes', {
        params: { customerId, uninvoiced: true },
      });
      setCustomerDns(res.data);
    } catch {
      setError('Failed to load delivery notes');
      setCustomerDns([]);
    } finally {
      setLoadingDns(false);
    }
  };

  const openCreate = async () => {
    setSelectedCustomer(null);
    setCustomerDns([]);
    setSelectedDnIds([]);
    setPreview(null);
    setDueDate('');
    setInvoiceDate(todayISO());
    setCreateOpen(true);
    await loadCustomers();
  };

  const onCustomerSelect = (customer: Customer | null) => {
    setSelectedCustomer(customer);
    setCurrency(customer?.currency || 'AED');
    setSelectedDnIds([]);
    setPreview(null);
    if (customer) {
      loadCustomerDns(customer.id);
      setDueDate(dueDateFromCreditDays(invoiceDate, customer.creditDays));
    } else {
      setCustomerDns([]);
      setDueDate('');
    }
  };

  const toggleDn = (id: string) => {
    setSelectedDnIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    setPreview(null);
  };

  const handlePreview = async () => {
    if (selectedDnIds.length === 0) {
      setError('Select at least one delivery note');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.post<InvoicePreview>('/sales/invoices/preview', {
        deliveryNoteIds: selectedDnIds,
      });
      setPreview(res.data);
      setEditDiscount(res.data.discount);
      setEditNotes(res.data.notes || '');
      setEditVat(res.data.vatApplicable);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to preview invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      await api.post('/sales/invoices/from-delivery-notes', {
        deliveryNoteIds: selectedDnIds,
        vatApplicable: editVat,
        discount: editDiscount,
        notes: editNotes,
        currency,
        exchangeRate: currency !== 'AED' && fxRate ? money(fxRate) : undefined,
        date: invoiceDate,
        dueDate: dueDate || undefined,
      });
      setCreateOpen(false);
      setSuccess('Invoice created successfully');
      fetchInvoices();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  };

  const openView = async (inv: SalesInvoice) => {
    setActionId(inv.id);
    try {
      const res = await api.get<SalesInvoice>(`/sales/invoices/${inv.id}`);
      setViewInvoice(res.data);
      setViewOpen(true);
    } catch {
      setError('Failed to load invoice');
    } finally {
      setActionId(null);
    }
  };

  const openEdit = async (inv: SalesInvoice) => {
    if (inv.status === 'CANCELLED') {
      setError('Cancelled invoices cannot be edited');
      return;
    }
    setActionId(inv.id);
    try {
      const [invRes, prodRes] = await Promise.all([
        api.get<SalesInvoice>(`/sales/invoices/${inv.id}`),
        products.length
          ? Promise.resolve({ data: products })
          : api.get<Product[]>('/inventory/products', { params: { active: true } }),
      ]);
      if (!products.length) setProducts(prodRes.data);
      const full = invRes.data;
      setEditingInvoice(full);
      setEditDocumentNumber(full.documentNumber || '');
      setEditReference(full.reference || '');
      setEditRemarks(full.remarks || '');
      setEditDate(toInputDate(full.date));
      setEditDueDate(full.dueDate ? toInputDate(full.dueDate) : dueDateFromCreditDays(toInputDate(full.date), full.customer?.creditDays));
      setEditFormDiscount(money(full.discount ?? 0));
      setEditFormNotes(full.notes || '');
      setEditFormVat(full.vatApplicable);
      setEditItems((full.items || []).map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.product?.name || i.description,
        description: i.description,
        quantity: qtyOut(i.quantity),
        unitPrice: money(i.unitPrice),
        vatRate: money(i.vatRate),
        taxCode: (i as { taxCode?: string | null }).taxCode || undefined,
        unit: i.unit || i.product?.unit,
      })));
      setEditOpen(true);
    } catch {
      setError('Failed to load invoice for editing');
    } finally {
      setActionId(null);
    }
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;
    const items = editItems.filter((i) => i.productId);
    if (!items.length) {
      setError('Add at least one line item');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.put(`/sales/invoices/${editingInvoice.id}`, {
        documentNumber: editDocumentNumber.trim() || undefined,
        reference: editReference || null,
        remarks: editRemarks || null,
        notes: editFormNotes,
        date: editDate,
        dueDate: editDueDate || null,
        vatApplicable: editFormVat,
        discount: editFormDiscount,
        items: items.map((i) => ({
          id: i.id,
          productId: i.productId,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          vatRate: i.vatRate,
          taxCode: i.taxCode || undefined,
        })),
      });
      setSuccess(
        editingInvoice.status === 'DRAFT'
          ? 'Invoice updated'
          : 'Invoice updated — accounts journal resynced',
      );
      setEditOpen(false);
      setEditingInvoice(null);
      fetchInvoices();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to update invoice');
    } finally {
      setSaving(false);
    }
  };

  const canDeleteInvoice = (inv: SalesInvoice) =>
    ['DRAFT', 'CONFIRMED'].includes(inv.status) && !(D(inv.paidAmount).gt(0));

  const handleDeleteInvoice = async () => {
    if (!deleteTarget) return;
    if (deleteRemarks.trim().length < 3) {
      setError('Deletion remarks are required');
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/sales/invoices/${deleteTarget.id}`, { data: { remarks: deleteRemarks.trim() } });
      setSuccess(`Invoice ${displayDocumentNumber(deleteTarget.documentNumber)} deleted`);
      setDeleteTarget(null);
      setDeleteRemarks('');
      fetchInvoices();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to delete invoice');
    } finally {
      setDeleting(false);
    }
  };

  const handleConfirmInvoice = async (id: string) => {
    setActionId(id);
    try {
      await api.post(`/sales/invoices/${id}/confirm`);
      setSuccess('Invoice confirmed and posted to accounts');
      fetchInvoices();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to confirm invoice');
    } finally {
      setActionId(null);
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'documentNumber', headerName: 'Invoice No', width: 200,
      valueGetter: (_, row) => {
        const inv = row as SalesInvoice;
        return displayDocumentNumber(inv.documentNumber);
      },
    },
    { field: 'reference', headerName: 'Reference', width: 120, valueGetter: (_, row) => (row as SalesInvoice).reference || '-' },
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (v) => formatDateDDMMYYYY(v as string) },
    { field: 'dueDate', headerName: 'Due Date', width: 110, valueFormatter: (v) => (v ? formatDateDDMMYYYY(v as string) : '—') },
    { field: 'customer', headerName: 'Customer', flex: 1, valueGetter: (_, row) => (row as SalesInvoice).customer?.name },
    { field: 'total', headerName: 'Total', width: 110, type: 'number' },
    { field: 'status', headerName: 'Status', width: 130, renderCell: ({ value }) => <StatusChip status={value as string} /> },
    {
      field: 'actions', headerName: 'Actions', width: 200, sortable: false,
      renderCell: ({ row }) => {
        const inv = row as SalesInvoice;
        const busy = actionId === inv.id;
        return (
          <Box>
            {inv.status === 'DRAFT' && (
              <IconButton size="small" title="Confirm & Post to Accounts" disabled={busy}
                onClick={() => handleConfirmInvoice(inv.id)}>
                {busy ? <CircularProgress size={18} /> : <CheckCircle fontSize="small" color="primary" />}
              </IconButton>
            )}
            {inv.status !== 'CANCELLED' && (
              <IconButton size="small" title="Edit invoice" disabled={busy} onClick={() => openEdit(inv)}>
                <Edit fontSize="small" />
              </IconButton>
            )}
            <IconButton size="small" title="View" disabled={busy} onClick={() => openView(inv)}>
              {busy ? <CircularProgress size={16} /> : <Visibility fontSize="small" />}
            </IconButton>
            <IconButton size="small" title="Download PDF" onClick={async () => {
              setActionId(inv.id);
              try { await downloadInvoiceWithCustomerCopyPrompt(inv.id, inv.customer.name, inv.documentNumber); }
              catch { setError('PDF download failed'); }
              finally { setActionId(null); }
            }}>
              <PictureAsPdf fontSize="small" color="error" />
            </IconButton>
            {canDeleteInvoice(inv) && (
              <IconButton size="small" title="Delete invoice" disabled={busy}
                onClick={() => { setDeleteTarget(inv); setDeleteRemarks(''); }}>
                <Delete fontSize="small" color="error" />
              </IconButton>
            )}
          </Box>
        );
      },
    },
  ];

  const displayPreview = preview ? {
    ...preview,
    discount: editDiscount,
    notes: editNotes,
    vatApplicable: editVat,
    ...(({ vatAmount, total }) => ({ vatAmount, total }))(previewDocument(preview.items, editVat, editDiscount)),
  } : null;

  return (
    <Box>
      <PageHeader title="Sales Invoices" subtitle="Create invoices from delivery notes"
        actionLabel="Create from DNs" onAction={openCreate} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <DocumentTable rows={invoices} columns={columns} loading={loading} />

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Create Invoice from Delivery Notes</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={customers}
            getOptionLabel={(c) => `${c.code} - ${c.name}`}
            value={selectedCustomer}
            onChange={(_, v) => onCustomerSelect(v)}
            renderInput={(params) => <TextField {...params} label="Search & Select Customer" required sx={{ mt: 1, mb: 2 }} />}
          />

          {selectedCustomer && (
            <>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Uninvoiced Delivery Notes for {selectedCustomer.name}
              </Typography>
              {loadingDns ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" />
                        <TableCell>DN Number</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>SO Ref</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {customerDns.length === 0 ? (
                        <TableRow><TableCell colSpan={5} align="center">No uninvoiced delivery notes for this customer</TableCell></TableRow>
                      ) : customerDns.map((dn) => (
                        <TableRow key={dn.id} hover selected={selectedDnIds.includes(dn.id)}>
                          <TableCell padding="checkbox">
                            <Checkbox checked={selectedDnIds.includes(dn.id)} onChange={() => toggleDn(dn.id)} />
                          </TableCell>
                          <TableCell>{displayDocumentNumber(dn.documentNumber)}</TableCell>
                          <TableCell>{formatDateDDMMYYYY(dn.date)}</TableCell>
                          <TableCell>{dn.salesOrderNumber || '-'}</TableCell>
                          <TableCell><StatusChip status={dn.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <Button variant="outlined" onClick={handlePreview} disabled={selectedDnIds.length === 0 || saving} sx={{ mb: 2 }}>
                {saving ? <CircularProgress size={18} /> : 'Preview Invoice'}
              </Button>
            </>
          )}

          {displayPreview && (
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                {editVat ? 'TAX INVOICE' : 'INVOICE'}
              </Typography>
              {!editVat && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  This invoice is outside the VAT system and will not appear in VAT reports.
                </Alert>
              )}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                {displayPreview.reference && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">Reference</Typography>
                    <Typography>{displayPreview.reference}</Typography>
                  </Grid>
                )}
                <Grid item xs={12} sm={6}>
                  <DocumentDateField value={invoiceDate} onChange={(v) => { setInvoiceDate(v); if (selectedCustomer && D(selectedCustomer.creditDays).gt(0)) setDueDate(dueDateFromCreditDays(v, selectedCustomer.creditDays)); }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  {D(selectedCustomer?.creditDays).gt(0) && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Credit days: <strong>{selectedCustomer?.creditDays}</strong></Typography>
                  )}
                  <DocumentDateField
                    label="Due Date"
                    value={dueDate}
                    onChange={setDueDate}
                    required={false}
                    helperText={D(selectedCustomer?.creditDays).gt(0) ? `Auto from credit days (${selectedCustomer?.creditDays}) — editable` : 'DD/MM/YYYY — optional'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControlLabel control={<Checkbox checked={editVat} onChange={(e) => setEditVat(e.target.checked)} disabled={!isAdmin} />} label="VAT Applicable" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">Discount:</Typography>
                    <NumberField value={editDiscount} onChange={setEditDiscount} width={100} />
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth label="Notes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField fullWidth label="Currency" value={currency} inputProps={{ maxLength: 3 }}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())} helperText="AED = base" />
                </Grid>
                {currency !== 'AED' && (
                  <Grid item xs={6} sm={3}>
                    <TextField fullWidth label="Rate (AED per 1)" type="number" value={fxRate}
                      onChange={(e) => setFxRate(e.target.value)} helperText="Blank = rate table" />
                  </Grid>
                )}
              </Grid>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Description</TableCell><TableCell align="center">UOM</TableCell>
                      <TableCell align="right">Qty</TableCell><TableCell align="right">Price</TableCell>
                      <TableCell align="right">Value</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayPreview.items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell align="center">{item.unit || '-'}</TableCell>
                        <TableCell align="right">{fmtMoney(item.quantity)}</TableCell>
                        <TableCell align="right">{fmtMoney(item.unitPrice)}</TableCell>
                        <TableCell align="right">{fmtMoney(lineNet(item))}</TableCell>
                        <TableCell align="right">{fmtMoney(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ textAlign: 'right' }}>
                <Typography>Subtotal: {fmtMoney(displayPreview.subtotal)}</Typography>
                {displayPreview.vatApplicable && <Typography>VAT: {fmtMoney(displayPreview.vatAmount)}</Typography>}
                {editDiscount > 0 && <Typography>Discount: -{fmtMoney(editDiscount)}</Typography>}
                <Typography variant="subtitle1" fontWeight={700}>Total: {fmtMoney(displayPreview.total)}</Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!preview || saving} onClick={handleConfirm}>
            {saving ? <CircularProgress size={20} /> : 'Confirm & Create Invoice'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => { setEditOpen(false); setEditingInvoice(null); }} maxWidth="lg" fullWidth>
        <form onSubmit={handleSaveEdit}>
          <DialogTitle>
            Edit Invoice {editingInvoice ? displayDocumentNumber(editingInvoice.documentNumber) : ''}
            {editingInvoice && editingInvoice.status !== 'DRAFT' && (
              <Typography variant="caption" display="block" color="text.secondary">
                Posted invoice — saving will reverse and repost the accounts journal
              </Typography>
            )}
          </DialogTitle>
          <DialogContent>
            {editingInvoice && (
              <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
                Customer: {editingInvoice.customer?.name}
                {D(editingInvoice.paidAmount).gt(0) && (
                  <> · Paid: {fmtMoney(editingInvoice.paidAmount)}</>
                )}
                {D(editingInvoice.creditedAmount).gt(0) && (
                  <> · Credited: {fmtMoney(editingInvoice.creditedAmount)}</>
                )}
              </Alert>
            )}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Invoice Number"
                  value={editDocumentNumber}
                  onChange={(e) => setEditDocumentNumber(e.target.value)}
                  helperText="Editable for draft, confirmed, and paid invoices — must be unique"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DocumentDateField value={editDate} onChange={setEditDate} />
              </Grid>
              <Grid item xs={12} sm={6}>
                {D(editingInvoice?.customer?.creditDays).gt(0) && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Credit days: <strong>{editingInvoice?.customer?.creditDays}</strong></Typography>
                )}
                <DocumentDateField
                  label="Due Date"
                  value={editDueDate}
                  onChange={setEditDueDate}
                  required={false}
                  helperText={D(editingInvoice?.customer?.creditDays).gt(0) ? `Credit days: ${editingInvoice?.customer?.creditDays}` : 'DD/MM/YYYY — optional'}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Reference" value={editReference}
                  onChange={(e) => setEditReference(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Remarks" value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Notes" value={editFormNotes}
                  onChange={(e) => setEditFormNotes(e.target.value)} />
              </Grid>
            </Grid>
            <LineItemsForm
              products={products}
              items={editItems}
              onChange={setEditItems}
              vatApplicable={editFormVat}
              onVatChange={(v) => { if (isAdmin || editingInvoice?.status === 'DRAFT') setEditFormVat(v); }}
              showDiscount
              discount={editFormDiscount}
              onDiscountChange={setEditFormDiscount}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setEditOpen(false); setEditingInvoice(null); }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={20} /> : 'Save & Sync Accounts'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <DocumentViewDialog
        open={viewOpen}
        onClose={() => { setViewOpen(false); setViewInvoice(null); }}
        title="Sales Invoice"
        extraFields={[
          ...(viewInvoice?.dueDate ? [{ label: 'Due Date', value: formatDateDDMMYYYY(viewInvoice.dueDate) }] : []),
          ...(D(viewInvoice?.customer?.creditDays).gt(0) ? [{ label: 'Credit Days', value: String(viewInvoice?.customer?.creditDays) }] : []),
        ]}
        document={viewInvoice ? {
          documentNumber: displayDocumentNumber(viewInvoice.documentNumber),
          date: viewInvoice.date,
          status: viewInvoice.status,
          reference: viewInvoice.reference,
          remarks: viewInvoice.remarks,
          notes: viewInvoice.notes,
          partyName: viewInvoice.customer?.name,
          partyLabel: 'Customer',
          partyAddress: viewInvoice.customer?.address,
          partyVatNumber: viewInvoice.customer?.vatNumber,
          partyPhone: viewInvoice.customer?.phone,
          partyEmail: viewInvoice.customer?.email,
          vatApplicable: viewInvoice.vatApplicable,
          subtotal: viewInvoice.subtotal,
          vatAmount: viewInvoice.vatAmount,
          discount: viewInvoice.discount,
          total: viewInvoice.total,
          items: (viewInvoice.items || []).map((i) => ({
            description: i.description || i.product?.name,
            quantity: qtyOut(i.quantity),
            unit: i.unit || i.product?.unit,
            unitPrice: money(i.unitPrice),
            vatAmount: money(i.vatAmount),
            total: money(i.total),
            product: i.product,
          })),
        } : null}
      />

      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete invoice {deleteTarget ? displayDocumentNumber(deleteTarget.documentNumber) : ''}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This removes the invoice and its accounting journals from the system. Delivery notes are unlinked so they can be invoiced again. Paid invoices cannot be deleted.
          </Typography>
          <TextField fullWidth required multiline minRows={3} label="Remarks (mandatory)"
            value={deleteRemarks} onChange={(e) => setDeleteRemarks(e.target.value)}
            helperText="Recorded in the audit trail" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
          <Button color="error" variant="contained" disabled={deleting || deleteRemarks.trim().length < 3}
            onClick={() => void handleDeleteInvoice()}>
            {deleting ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
