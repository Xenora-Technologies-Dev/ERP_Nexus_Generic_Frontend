import { D, fmtMoney, lineNet, money, previewDocument, qtyOut } from '../../utils/money';
import { useEffect, useState, FormEvent } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Alert, CircularProgress, Grid, IconButton, Checkbox, FormControlLabel, Typography,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper, Autocomplete,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { CheckCircle, PictureAsPdf, Edit, Delete } from '@mui/icons-material';
import { api, displayDocumentNumber, pdfFilename } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable, { StatusChip } from '../../components/common/DocumentTable';
import LineItemsForm, { LineItem, NumberField } from '../../components/common/LineItemsForm';
import DocumentDateField from '../../components/common/DocumentDateField';
import { todayISO, toInputDate, formatDateDDMMYYYY } from '../../utils/date';

interface Vendor { id: string; name: string; code: string; currency?: string; }
interface Product {
  id: string; name: string; sku: string; sellingPrice: number; costPrice?: number; vatRate: number; unit?: string; countryOfOrigin?: string | null;
}
interface GRN {
  id: string; documentNumber: string; date: string; status: string;
  vendor: Vendor; isInvoiced?: boolean; purchaseOrderId?: string;
}
interface InvoiceItem {
  id?: string;
  productId?: string;
  description: string; quantity: number; unitPrice: number;
  vatRate: number; vatAmount: number; total: number; unit?: string;
  product?: { name?: string; unit?: string };
}
interface InvoicePreview {
  vendor: Vendor;
  grnIds: string[];
  vatApplicable: boolean;
  discount: number;
  notes?: string;
  reference?: string;
  items: InvoiceItem[];
  subtotal: number;
  vatAmount: number;
  total: number;
}
interface PurchaseInvoice {
  id: string; documentNumber: string; date: string; status: string;
  vendor: Vendor; total: number; vatApplicable: boolean; discount?: number;
  reference?: string | null; notes?: string; dueDate?: string | null;
  paidAmount?: number; debitedAmount?: number;
  items?: InvoiceItem[];
}

const downloadPdf = async (id: string, partyName: string, docNumber: string) => {
  const res = await api.get(`/purchase/invoices/${id}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = pdfFilename(partyName, docNumber);
  a.click();
  URL.revokeObjectURL(url);
};

export default function PurchaseInvoicesPage() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<PurchaseInvoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorGrns, setVendorGrns] = useState<GRN[]>([]);
  const [loadingGrns, setLoadingGrns] = useState(false);
  const [selectedGrnIds, setSelectedGrnIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [editDiscount, setEditDiscount] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [currency, setCurrency] = useState('AED');
  const [fxRate, setFxRate] = useState('');
  const [editVat, setEditVat] = useState(true);

  const [editReference, setEditReference] = useState('');
  const [editDocumentNumber, setEditDocumentNumber] = useState('');
  const [editDate, setEditDate] = useState(todayISO());
  const [editDueDate, setEditDueDate] = useState('');
  const [editItems, setEditItems] = useState<LineItem[]>([]);
  const [editFormDiscount, setEditFormDiscount] = useState(0);
  const [editFormNotes, setEditFormNotes] = useState('');
  const [editFormVat, setEditFormVat] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseInvoice | null>(null);
  const [deleteRemarks, setDeleteRemarks] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const inv = await api.get<PurchaseInvoice[]>('/purchase/invoices');
      setInvoices(inv.data);
    } catch {
      setError('Failed to load purchase invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, []);

  const loadVendors = async () => {
    const res = await api.get<Vendor[]>('/vendors', { params: { active: true } });
    setVendors(res.data);
  };

  const loadVendorGrns = async (vendorId: string) => {
    setLoadingGrns(true);
    setSelectedGrnIds([]);
    setPreview(null);
    try {
      const res = await api.get<GRN[]>('/purchase/grns', { params: { vendorId, uninvoiced: true } });
      setVendorGrns(res.data);
    } catch {
      setError('Failed to load GRNs');
      setVendorGrns([]);
    } finally {
      setLoadingGrns(false);
    }
  };

  const openCreate = async () => {
    setSelectedVendor(null);
    setVendorGrns([]);
    setSelectedGrnIds([]);
    setPreview(null);
    setDueDate('');
    setInvoiceDate(todayISO());
    setCreateOpen(true);
    await loadVendors();
  };

  const onVendorSelect = (vendor: Vendor | null) => {
    setSelectedVendor(vendor);
    setCurrency(vendor?.currency || 'AED');
    setSelectedGrnIds([]);
    setPreview(null);
    if (vendor) loadVendorGrns(vendor.id);
    else setVendorGrns([]);
  };

  const toggleGrn = (id: string) => {
    setSelectedGrnIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    setPreview(null);
  };

  const handlePreview = async () => {
    if (selectedGrnIds.length === 0) {
      setError('Select at least one GRN');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.post<InvoicePreview>('/purchase/invoices/preview', { grnIds: selectedGrnIds });
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
      await api.post('/purchase/invoices/from-grns', {
        grnIds: selectedGrnIds,
        vatApplicable: editVat,
        discount: editDiscount,
        notes: editNotes,
        currency,
        exchangeRate: currency !== 'AED' && fxRate ? money(fxRate) : undefined,
        date: invoiceDate,
        dueDate: dueDate || undefined,
      });
      setCreateOpen(false);
      setSuccess('Purchase invoice created');
      fetchInvoices();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  };

  const canDeleteInvoice = (inv: PurchaseInvoice) =>
    ['DRAFT', 'CONFIRMED'].includes(inv.status) && !(D(inv.paidAmount).gt(0));

  const handleDeleteInvoice = async () => {
    if (!deleteTarget) return;
    if (deleteRemarks.trim().length < 3) {
      setError('Deletion remarks are required');
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/purchase/invoices/${deleteTarget.id}`, { data: { remarks: deleteRemarks.trim() } });
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
      await api.post(`/purchase/invoices/${id}/confirm`);
      setSuccess('Invoice confirmed');
      fetchInvoices();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to confirm');
    } finally {
      setActionId(null);
    }
  };

  const openEdit = async (inv: PurchaseInvoice) => {
    if (inv.status === 'CANCELLED') {
      setError('Cancelled invoices cannot be edited');
      return;
    }
    setActionId(inv.id);
    try {
      const [invRes, prodRes] = await Promise.all([
        api.get<PurchaseInvoice>(`/purchase/invoices/${inv.id}`),
        products.length
          ? Promise.resolve({ data: products })
          : api.get<Product[]>('/inventory/products', { params: { active: true } }),
      ]);
      if (!products.length) setProducts(prodRes.data);
      const full = invRes.data;
      setEditingInvoice(full);
      setEditDocumentNumber(full.documentNumber || '');
      setEditReference(full.reference || '');
      setEditDate(toInputDate(full.date));
      setEditDueDate(full.dueDate ? toInputDate(full.dueDate) : '');
      setEditFormDiscount(money(full.discount ?? 0));
      setEditFormNotes(full.notes || '');
      setEditFormVat(full.vatApplicable);
      setEditItems((full.items || []).map((i) => ({
        id: i.id,
        productId: i.productId || '',
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
      await api.put(`/purchase/invoices/${editingInvoice.id}`, {
        documentNumber: editDocumentNumber.trim() || undefined,
        reference: editReference || null,
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

  const columns: GridColDef[] = [
    {
      field: 'documentNumber', headerName: 'Invoice No', width: 200,
      valueGetter: (_, row) => {
        const inv = row as PurchaseInvoice;
        return displayDocumentNumber(inv.documentNumber);
      },
    },
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (v) => formatDateDDMMYYYY(v as string) },
    { field: 'vendor', headerName: 'Vendor', flex: 1, valueGetter: (_, row) => (row as PurchaseInvoice).vendor?.name },
    { field: 'reference', headerName: 'Reference', width: 120, valueGetter: (_, row) => (row as PurchaseInvoice).reference || '-' },
    { field: 'total', headerName: 'Total', width: 110, type: 'number' },
    { field: 'vatApplicable', headerName: 'VAT', width: 70, renderCell: ({ value }) => (value ? 'Yes' : 'No') },
    { field: 'status', headerName: 'Status', width: 130, renderCell: ({ value }) => <StatusChip status={value as string} /> },
    {
      field: 'actions', headerName: 'Actions', width: 180, sortable: false,
      renderCell: ({ row }) => {
        const inv = row as PurchaseInvoice;
        return (
          <Box>
            {inv.status === 'DRAFT' && (
              <IconButton size="small" title="Confirm" disabled={actionId === inv.id}
                onClick={() => handleConfirmInvoice(inv.id)}>
                {actionId === inv.id ? <CircularProgress size={18} /> : <CheckCircle fontSize="small" color="primary" />}
              </IconButton>
            )}
            {inv.status !== 'CANCELLED' && (
              <IconButton size="small" title="Edit invoice" disabled={actionId === inv.id}
                onClick={() => openEdit(inv)}>
                <Edit fontSize="small" />
              </IconButton>
            )}
            <IconButton size="small" title="Download PDF" disabled={actionId === inv.id}
              onClick={async () => {
                setActionId(inv.id);
                try { await downloadPdf(inv.id, inv.vendor.name, inv.documentNumber); }
                catch { setError('PDF download failed'); }
                finally { setActionId(null); }
              }}>
              <PictureAsPdf fontSize="small" color="error" />
            </IconButton>
            {canDeleteInvoice(inv) && (
              <IconButton size="small" title="Delete invoice" disabled={actionId === inv.id}
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
    ...(({ vatAmount, total }) => ({ vatAmount, total }))(previewDocument(preview.items, editVat, editDiscount)),
  } : null;

  return (
    <Box>
      <PageHeader title="Purchase Invoices" subtitle="Create invoices from GRNs"
        actionLabel="Create from GRNs" onAction={openCreate} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <DocumentTable rows={invoices} columns={columns} loading={loading} />

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Create Purchase Invoice from GRNs</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={vendors}
            getOptionLabel={(v) => `${v.code} - ${v.name}`}
            value={selectedVendor}
            onChange={(_, val) => onVendorSelect(val)}
            renderInput={(params) => <TextField {...params} label="Search & Select Vendor" required sx={{ mt: 1, mb: 2 }} />}
          />

          {selectedVendor && (
            <>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Uninvoiced GRNs for {selectedVendor.name}
              </Typography>
              {loadingGrns ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" />
                        <TableCell>GRN Number</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {vendorGrns.length === 0 ? (
                        <TableRow><TableCell colSpan={4} align="center">No uninvoiced GRNs for this vendor</TableCell></TableRow>
                      ) : vendorGrns.map((grn) => (
                        <TableRow key={grn.id} hover selected={selectedGrnIds.includes(grn.id)}>
                          <TableCell padding="checkbox">
                            <Checkbox checked={selectedGrnIds.includes(grn.id)} onChange={() => toggleGrn(grn.id)} />
                          </TableCell>
                          <TableCell>{grn.documentNumber}</TableCell>
                          <TableCell>{formatDateDDMMYYYY(grn.date)}</TableCell>
                          <TableCell><StatusChip status={grn.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <Button variant="outlined" onClick={handlePreview} disabled={selectedGrnIds.length === 0 || saving} sx={{ mb: 2 }}>
                {saving ? <CircularProgress size={18} /> : 'Preview Invoice'}
              </Button>
            </>
          )}

          {displayPreview && (
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                Purchase Invoice
              </Typography>
              {displayPreview.reference && (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Reference: {displayPreview.reference}
                </Typography>
              )}
              {!editVat && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  This invoice is outside the VAT system and will not appear in VAT reports.
                </Alert>
              )}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6}>
                  <DocumentDateField value={invoiceDate} onChange={setInvoiceDate} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DocumentDateField
                    label="Due Date"
                    value={dueDate}
                    onChange={setDueDate}
                    required={false}
                    helperText="DD/MM/YYYY — optional"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControlLabel control={<Checkbox checked={editVat} onChange={(e) => setEditVat(e.target.checked)} />} label="VAT Applicable" />
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
                Vendor: {editingInvoice.vendor?.name}
                {D(editingInvoice.paidAmount).gt(0) && (
                  <> · Paid: {fmtMoney(editingInvoice.paidAmount)}</>
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
                  helperText="Any alphanumeric invoice number (unique); editable for draft, confirmed, and paid"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DocumentDateField value={editDate} onChange={setEditDate} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DocumentDateField
                  label="Due Date"
                  value={editDueDate}
                  onChange={setEditDueDate}
                  required={false}
                  helperText="DD/MM/YYYY — optional"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Reference" value={editReference}
                  onChange={(e) => setEditReference(e.target.value)} />
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
              onVatChange={setEditFormVat}
              priceField="costPrice"
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

      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete invoice {deleteTarget ? displayDocumentNumber(deleteTarget.documentNumber) : ''}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This removes the invoice and its accounting journals. Confirmed stock from this invoice is reversed. Paid invoices cannot be deleted.
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
