import { fmtMoney, money, qtyOut } from '../../utils/money';
import { useEffect, useState, FormEvent } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Alert, CircularProgress, Grid, Autocomplete, MenuItem, Typography, IconButton,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { Visibility, PictureAsPdf } from '@mui/icons-material';
import { api, displayDocumentNumber, pdfFilename } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable, { StatusChip } from '../../components/common/DocumentTable';
import DocumentDateField from '../../components/common/DocumentDateField';
import DocumentViewDialog from '../../components/common/DocumentViewDialog';
import { todayISO, formatDateDDMMYYYY } from '../../utils/date';

interface Vendor {
  id: string; name: string; code: string;
  address?: string | null; vatNumber?: string | null; phone?: string | null; email?: string | null;
}
interface PurchaseReturn {
  id: string; documentNumber: string; vendorId: string; status: string;
  total: number; debitNote?: { id: string } | null;
  purchaseInvoice?: { documentNumber: string };
}
interface NoteItem {
  description?: string | null;
  quantity: number;
  unitPrice: number;
  vatRate?: number;
  vatAmount?: number;
  total?: number;
  product?: { name: string; unit?: string };
}
interface DebitNote {
  id: string; documentNumber: string; date: string; status: string;
  vendor: Vendor; total: number; reason?: string;
  notes?: string | null;
  vatApplicable?: boolean;
  subtotal?: number;
  vatAmount?: number;
  originalInvoice?: { documentNumber: string };
  purchaseReturn?: { documentNumber: string };
  items?: NoteItem[];
}

async function downloadPdf(id: string, partyName: string, docNumber: string) {
  const res = await api.get(`/purchase/debit-notes/${id}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = pdfFilename(partyName, docNumber);
  a.click();
  URL.revokeObjectURL(url);
}

export default function DebitNotesPage() {
  const [notes, setNotes] = useState<DebitNote[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [vendorId, setVendorId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [purchaseReturnId, setPurchaseReturnId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<DebitNote | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [n, v, r] = await Promise.all([
        api.get<DebitNote[]>('/purchase/debit-notes'),
        api.get<Vendor[]>('/vendors', { params: { active: true } }),
        api.get<PurchaseReturn[]>('/purchase/returns'),
      ]);
      setNotes(n.data);
      setVendors(v.data);
      setReturns(r.data);
    } catch {
      setError('Failed to load debit notes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const resetDialog = () => {
    setVendorId('');
    setDate(todayISO());
    setPurchaseReturnId('');
    setReason('');
  };

  const filteredReturns = returns.filter(
    (r) => r.vendorId === vendorId && r.status === 'CONFIRMED' && !r.debitNote,
  );
  const selectedReturn = filteredReturns.find((r) => r.id === purchaseReturnId);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!vendorId) { setError('Vendor is required'); return; }
    if (!purchaseReturnId) { setError('Select a purchase return'); return; }
    if (!reason.trim()) { setError('Reason is required'); return; }

    setSaving(true);
    setError('');
    try {
      await api.post('/purchase/debit-notes', { vendorId, date, purchaseReturnId, reason });
      setDialogOpen(false);
      resetDialog();
      setSuccess('Debit note issued and posted to accounts');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create debit note');
    } finally {
      setSaving(false);
    }
  };

  const openView = async (doc: DebitNote) => {
    setActionId(doc.id);
    try {
      const res = await api.get<DebitNote>(`/purchase/debit-notes/${doc.id}`);
      setViewDoc(res.data);
      setViewOpen(true);
    } catch {
      setError('Failed to load debit note');
    } finally {
      setActionId(null);
    }
  };

  const handleDownload = async (doc: DebitNote) => {
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
      valueGetter: (_, row) => displayDocumentNumber((row as DebitNote).documentNumber),
    },
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (v) => formatDateDDMMYYYY(v as string) },
    { field: 'vendor', headerName: 'Vendor', flex: 1, valueGetter: (_, row) => (row as DebitNote).vendor?.name },
    {
      field: 'return', headerName: 'Return', width: 140,
      valueGetter: (_, row) => {
        const n = (row as DebitNote).purchaseReturn?.documentNumber;
        return n ? displayDocumentNumber(n) : '—';
      },
    },
    {
      field: 'invoice', headerName: 'Invoice', width: 140,
      valueGetter: (_, row) => {
        const inv = (row as DebitNote).originalInvoice?.documentNumber;
        return inv ? displayDocumentNumber(inv) : '-';
      },
    },
    { field: 'reason', headerName: 'Reason', flex: 1 },
    { field: 'total', headerName: 'Total', width: 110, type: 'number' },
    { field: 'status', headerName: 'Status', width: 120, renderCell: ({ value }) => <StatusChip status={value as string} /> },
    {
      field: 'actions', headerName: 'Actions', width: 110, sortable: false,
      renderCell: ({ row }) => {
        const doc = row as DebitNote;
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
      <PageHeader title="Debit Notes" subtitle="Issue a debit note against a posted purchase return to reverse accounts"
        actionLabel="New Debit Note" onAction={() => { resetDialog(); setDialogOpen(true); }} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <DocumentTable rows={notes} columns={columns} loading={loading} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleCreate}>
          <DialogTitle>Issue Debit Note</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <Autocomplete options={vendors} getOptionLabel={(v) => `${v.code} - ${v.name}`}
                  value={vendors.find((v) => v.id === vendorId) || null}
                  onChange={(_, v) => {
                    setVendorId(v?.id || '');
                    setPurchaseReturnId('');
                  }}
                  renderInput={(params) => <TextField {...params} required label="Vendor" />} />
              </Grid>
              <Grid item xs={12}>
                <DocumentDateField value={date} onChange={setDate} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth required select label="Purchase Return" value={purchaseReturnId}
                  onChange={(e) => setPurchaseReturnId(e.target.value)}
                  helperText="Only returns without an existing debit note">
                  <MenuItem value="">Select return</MenuItem>
                  {filteredReturns.map((r) => (
                    <MenuItem key={r.id} value={r.id}>
                      {displayDocumentNumber(r.documentNumber)}
                      {r.purchaseInvoice?.documentNumber ? ` · Inv ${displayDocumentNumber(r.purchaseInvoice.documentNumber)}` : ''}
                      {` · ${fmtMoney(r.total)}`}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              {selectedReturn && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Amount to debit: {fmtMoney(selectedReturn.total)} AED (from return)
                  </Typography>
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField fullWidth required label="Reason" value={reason}
                  onChange={(e) => setReason(e.target.value)} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving || !purchaseReturnId}>
              {saving ? <CircularProgress size={20} /> : 'Confirm Debit Note'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <DocumentViewDialog
        open={viewOpen}
        onClose={() => { setViewOpen(false); setViewDoc(null); }}
        title="Debit Note"
        busy={!!actionId}
        onDownload={viewDoc ? () => handleDownload(viewDoc) : undefined}
        extraFields={[
          ...(viewDoc?.purchaseReturn?.documentNumber
            ? [{ label: 'Purchase Return', value: displayDocumentNumber(viewDoc.purchaseReturn.documentNumber) }]
            : []),
          ...(viewDoc?.originalInvoice?.documentNumber
            ? [{ label: 'Invoice', value: displayDocumentNumber(viewDoc.originalInvoice.documentNumber) }]
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
