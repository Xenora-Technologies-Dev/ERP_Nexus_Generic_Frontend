import { D, fmtMoney, money, previewDocument, qtyOut } from '../../utils/money';
import { useEffect, useState, FormEvent } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Alert, CircularProgress, Grid, Autocomplete, MenuItem, Typography,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper, IconButton,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { Visibility, PictureAsPdf } from '@mui/icons-material';
import { api, displayDocumentNumber, pdfFilename } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable, { StatusChip } from '../../components/common/DocumentTable';
import { NumberField } from '../../components/common/LineItemsForm';
import DocumentDateField from '../../components/common/DocumentDateField';
import DocumentViewDialog from '../../components/common/DocumentViewDialog';
import { todayISO, formatDateDDMMYYYY } from '../../utils/date';

interface Vendor {
  id: string; name: string; code: string;
  address?: string | null; vatNumber?: string | null; phone?: string | null; email?: string | null;
}
interface PurchaseInvoice {
  id: string; documentNumber: string; vendorId: string; status: string;
}
interface InvoiceLine {
  id: string;
  description?: string | null;
  quantity: number;
  availableQty: number;
  unitPrice: number;
  vatRate: number;
  product?: { name: string; unit?: string };
}
interface AdjustLine {
  purchaseInvoiceItemId: string;
  productName: string;
  unit?: string;
  availableQty: number;
  invoicedQty: number;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}
interface ReturnItem {
  description?: string | null;
  quantity: number;
  unitPrice: number;
  vatRate?: number;
  vatAmount?: number;
  total?: number;
  product?: { name: string; unit?: string };
}
interface PurchaseReturn {
  id: string; documentNumber: string; date: string; status: string;
  vendor: Vendor; total: number; reason?: string;
  notes?: string | null;
  vatApplicable?: boolean;
  subtotal?: number;
  vatAmount?: number;
  purchaseInvoice?: { documentNumber: string };
  debitNote?: { documentNumber: string } | null;
  items?: ReturnItem[];
}

function lineAmount(qty: number, unitPrice: number, vatRate: number, vatApplicable: boolean) {
  const c = previewDocument([{ quantity: qty, unitPrice, vatRate }], vatApplicable).lines[0];
  return { subtotal: c.net, vatAmount: c.vat, total: c.total };
}

async function downloadPdf(id: string, partyName: string, docNumber: string) {
  const res = await api.get(`/purchase/returns/${id}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = pdfFilename(partyName, docNumber);
  a.click();
  URL.revokeObjectURL(url);
}

export default function PurchaseReturnsPage() {
  const [rows, setRows] = useState<PurchaseReturn[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [vendorId, setVendorId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [purchaseInvoiceId, setPurchaseInvoiceId] = useState('');
  const [reason, setReason] = useState('');
  const [vatApplicable, setVatApplicable] = useState(true);
  const [adjustLines, setAdjustLines] = useState<AdjustLine[]>([]);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<PurchaseReturn | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [r, v, inv] = await Promise.all([
        api.get<PurchaseReturn[]>('/purchase/returns'),
        api.get<Vendor[]>('/vendors', { params: { active: true } }),
        api.get<PurchaseInvoice[]>('/purchase/invoices'),
      ]);
      setRows(r.data);
      setVendors(v.data);
      setInvoices(inv.data);
    } catch {
      setError('Failed to load purchase returns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const resetDialog = () => {
    setVendorId('');
    setDate(todayISO());
    setPurchaseInvoiceId('');
    setReason('');
    setAdjustLines([]);
    setVatApplicable(true);
  };

  const loadInvoiceLines = async (invoiceId: string) => {
    if (!invoiceId) {
      setAdjustLines([]);
      return;
    }
    setLoadingInvoice(true);
    setError('');
    try {
      const res = await api.get<{ vatApplicable: boolean; items: InvoiceLine[] }>(`/purchase/invoices/${invoiceId}`);
      setVatApplicable(res.data.vatApplicable);
      const lines = (res.data.items || [])
        .map((i) => {
          const available = qtyOut(i.availableQty ?? 0);
          return {
            purchaseInvoiceItemId: i.id,
            productName: i.product?.name || i.description || 'Item',
            unit: i.product?.unit,
            availableQty: available,
            invoicedQty: qtyOut(i.quantity),
            quantity: available,
            unitPrice: money(i.unitPrice),
            vatRate: money(i.vatRate),
          };
        })
        .filter((l) => l.availableQty > 0);
      setAdjustLines(lines);
      if (lines.length === 0) setError('No remaining quantity to return on this invoice');
    } catch {
      setError('Failed to load invoice lines');
      setAdjustLines([]);
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!vendorId) { setError('Vendor is required'); return; }
    if (!purchaseInvoiceId) { setError('Select a confirmed invoice'); return; }
    const items = adjustLines.filter((l) => l.quantity > 0);
    if (items.length === 0) { setError('Enter return quantity for at least one item'); return; }

    setSaving(true);
    setError('');
    try {
      await api.post('/purchase/returns', {
        vendorId,
        date,
        purchaseInvoiceId,
        reason,
        items: items.map((l) => ({ purchaseInvoiceItemId: l.purchaseInvoiceItemId, quantity: l.quantity })),
      });
      setDialogOpen(false);
      resetDialog();
      setSuccess('Purchase return posted — inventory issued out. Issue a debit note to reverse accounts.');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create purchase return');
    } finally {
      setSaving(false);
    }
  };

  const filteredInvoices = invoices.filter(
    (i) => i.vendorId === vendorId && ['CONFIRMED', 'PARTIALLY_PAID', 'PAID'].includes(i.status),
  );

  const totals = adjustLines.reduce(
    (acc, l) => {
      if (l.quantity <= 0) return acc;
      const a = lineAmount(l.quantity, l.unitPrice, l.vatRate, vatApplicable);
      return { subtotal: money(D(acc.subtotal).plus(a.subtotal)), vatAmount: money(D(acc.vatAmount).plus(a.vatAmount)), total: money(D(acc.total).plus(a.total)) };
    },
    { subtotal: 0, vatAmount: 0, total: 0 },
  );

  const openView = async (doc: PurchaseReturn) => {
    setActionId(doc.id);
    try {
      const res = await api.get<PurchaseReturn>(`/purchase/returns/${doc.id}`);
      setViewDoc(res.data);
      setViewOpen(true);
    } catch {
      setError('Failed to load purchase return');
    } finally {
      setActionId(null);
    }
  };

  const handleDownload = async (doc: PurchaseReturn) => {
    setActionId(doc.id);
    try {
      await downloadPdf(doc.id, doc.vendor?.name || 'Vendor', displayDocumentNumber(doc.documentNumber));
    } catch {
      setError('PDF download failed');
    } finally {
      setActionId(null);
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'documentNumber', headerName: 'Number', width: 150,
      valueGetter: (_, row) => displayDocumentNumber((row as PurchaseReturn).documentNumber),
    },
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (v) => formatDateDDMMYYYY(v as string) },
    { field: 'vendor', headerName: 'Vendor', flex: 1, valueGetter: (_, row) => (row as PurchaseReturn).vendor?.name },
    {
      field: 'invoice', headerName: 'Invoice', width: 140,
      valueGetter: (_, row) => {
        const inv = (row as PurchaseReturn).purchaseInvoice?.documentNumber;
        return inv ? displayDocumentNumber(inv) : '-';
      },
    },
    {
      field: 'debitNote', headerName: 'Debit Note', width: 140,
      valueGetter: (_, row) => {
        const dn = (row as PurchaseReturn).debitNote?.documentNumber;
        return dn ? displayDocumentNumber(dn) : '—';
      },
    },
    { field: 'total', headerName: 'Total', width: 110, type: 'number' },
    { field: 'status', headerName: 'Status', width: 120, renderCell: ({ value }) => <StatusChip status={value as string} /> },
    {
      field: 'actions', headerName: 'Actions', width: 110, sortable: false,
      renderCell: ({ row }) => {
        const doc = row as PurchaseReturn;
        const busy = actionId === doc.id;
        return (
          <Box>
            <IconButton size="small" title="View" disabled={busy} onClick={() => void openView(doc)}>
              {busy ? <CircularProgress size={16} /> : <Visibility fontSize="small" />}
            </IconButton>
            <IconButton size="small" title="Download PDF" disabled={busy} onClick={() => void handleDownload(doc)}>
              <PictureAsPdf fontSize="small" color="error" />
            </IconButton>
          </Box>
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader title="Purchase Returns" subtitle="Return goods to vendors from confirmed invoices (inventory out). Debit note is issued separately."
        actionLabel="New Purchase Return" onAction={() => { resetDialog(); setDialogOpen(true); }} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <DocumentTable rows={rows} columns={columns} loading={loading} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="lg" fullWidth>
        <form onSubmit={handleCreate}>
          <DialogTitle>New Purchase Return</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <Autocomplete options={vendors} getOptionLabel={(v) => `${v.code} - ${v.name}`}
                  value={vendors.find((v) => v.id === vendorId) || null}
                  onChange={(_, v) => {
                    setVendorId(v?.id || '');
                    setPurchaseInvoiceId('');
                    setAdjustLines([]);
                  }}
                  renderInput={(params) => <TextField {...params} required label="Vendor" />} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DocumentDateField value={date} onChange={setDate} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required select label="Confirmed Invoice" value={purchaseInvoiceId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setPurchaseInvoiceId(id);
                    void loadInvoiceLines(id);
                  }}>
                  <MenuItem value="">Select invoice</MenuItem>
                  {filteredInvoices.map((i) => (
                    <MenuItem key={i.id} value={i.id}>{displayDocumentNumber(i.documentNumber)}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Reason" value={reason}
                  onChange={(e) => setReason(e.target.value)} />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" sx={{ mb: 1 }}>Return quantities (default full remaining qty)</Typography>
            {loadingInvoice ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} /></Box>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell align="center">UOM</TableCell>
                      <TableCell align="right">Invoiced Qty</TableCell>
                      <TableCell align="right">Available</TableCell>
                      <TableCell align="right">Return Qty</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {adjustLines.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <Typography variant="body2" color="text.secondary">Select an invoice to load items</Typography>
                        </TableCell>
                      </TableRow>
                    ) : adjustLines.map((l, i) => {
                      const amt = lineAmount(l.quantity, l.unitPrice, l.vatRate, vatApplicable);
                      return (
                        <TableRow key={l.purchaseInvoiceItemId}>
                          <TableCell>{l.productName}</TableCell>
                          <TableCell align="center">{l.unit || '-'}</TableCell>
                          <TableCell align="right">{fmtMoney(l.invoicedQty)}</TableCell>
                          <TableCell align="right">{fmtMoney(l.availableQty)}</TableCell>
                          <TableCell align="right">
                            <NumberField
                              value={l.quantity}
                              onChange={(v) => {
                                const updated = [...adjustLines];
                                updated[i] = { ...updated[i], quantity: Math.min(Math.max(0, v), l.availableQty) };
                                setAdjustLines(updated);
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">{fmtMoney(amt.total)}</TableCell>
                        </TableRow>
                      );
                    })}
                    {adjustLines.some((l) => l.quantity > 0) && (
                      <TableRow>
                        <TableCell colSpan={4} />
                        <TableCell align="right">
                          <Typography variant="body2">Subtotal</Typography>
                          {vatApplicable && <Typography variant="body2">VAT</Typography>}
                          <Typography variant="subtitle2">Total</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">{fmtMoney(totals.subtotal)}</Typography>
                          {vatApplicable && <Typography variant="body2">{fmtMoney(totals.vatAmount)}</Typography>}
                          <Typography variant="subtitle2">{fmtMoney(totals.total)}</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving || adjustLines.every((l) => l.quantity <= 0)}>
              {saving ? <CircularProgress size={20} /> : 'Submit Return'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <DocumentViewDialog
        open={viewOpen}
        onClose={() => { setViewOpen(false); setViewDoc(null); }}
        title="Purchase Return"
        busy={!!actionId}
        onDownload={viewDoc ? () => handleDownload(viewDoc) : undefined}
        extraFields={[
          ...(viewDoc?.purchaseInvoice?.documentNumber
            ? [{ label: 'Invoice', value: displayDocumentNumber(viewDoc.purchaseInvoice.documentNumber) }]
            : []),
          ...(viewDoc?.debitNote?.documentNumber
            ? [{ label: 'Debit Note', value: displayDocumentNumber(viewDoc.debitNote.documentNumber) }]
            : []),
          ...(viewDoc?.reason ? [{ label: 'Reason', value: viewDoc.reason }] : []),
        ]}
        document={viewDoc ? {
          documentNumber: displayDocumentNumber(viewDoc.documentNumber),
          date: viewDoc.date,
          status: viewDoc.status,
          notes: viewDoc.notes,
          partyName: viewDoc.vendor?.name,
          partyLabel: 'Supplier',
          partyAddress: viewDoc.vendor?.address,
          partyVatNumber: viewDoc.vendor?.vatNumber,
          partyPhone: viewDoc.vendor?.phone,
          partyEmail: viewDoc.vendor?.email,
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
            vatAmount: money(i.vatAmount),
            total: money(i.total),
            product: i.product,
          })),
        } : null}
      />
    </Box>
  );
}
