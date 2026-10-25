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

interface Customer {
  id: string; name: string; code: string;
  address?: string | null; vatNumber?: string | null; phone?: string | null; email?: string | null;
}
interface SalesReturn {
  id: string; documentNumber: string; customerId: string; status: string;
  total: number; creditNote?: { id: string } | null;
  salesInvoice?: { documentNumber: string };
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
interface CreditNote {
  id: string; documentNumber: string; date: string; status: string;
  customer: Customer; total: number; reason?: string;
  notes?: string | null;
  vatApplicable?: boolean;
  subtotal?: number;
  vatAmount?: number;
  originalInvoice?: { documentNumber: string };
  salesReturn?: { documentNumber: string };
  items?: NoteItem[];
}

async function downloadPdf(id: string, partyName: string, docNumber: string) {
  const res = await api.get(`/sales/credit-notes/${id}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = pdfFilename(partyName, docNumber);
  a.click();
  URL.revokeObjectURL(url);
}

export default function CreditNotesPage() {
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [salesReturnId, setSalesReturnId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<CreditNote | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [n, c, r] = await Promise.all([
        api.get<CreditNote[]>('/sales/credit-notes'),
        api.get<Customer[]>('/customers', { params: { active: true } }),
        api.get<SalesReturn[]>('/sales/returns'),
      ]);
      setNotes(n.data);
      setCustomers(c.data);
      setReturns(r.data);
    } catch {
      setError('Failed to load credit notes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const resetDialog = () => {
    setCustomerId('');
    setDate(todayISO());
    setSalesReturnId('');
    setReason('');
  };

  const filteredReturns = returns.filter(
    (r) => r.customerId === customerId && r.status === 'CONFIRMED' && !r.creditNote,
  );
  const selectedReturn = filteredReturns.find((r) => r.id === salesReturnId);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!customerId) { setError('Customer is required'); return; }
    if (!salesReturnId) { setError('Select a sales return'); return; }
    if (!reason.trim()) { setError('Reason is required'); return; }

    setSaving(true);
    setError('');
    try {
      await api.post('/sales/credit-notes', { customerId, date, salesReturnId, reason });
      setDialogOpen(false);
      resetDialog();
      setSuccess('Credit note issued and posted to accounts');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create credit note');
    } finally {
      setSaving(false);
    }
  };

  const openView = async (doc: CreditNote) => {
    setActionId(doc.id);
    try {
      const res = await api.get<CreditNote>(`/sales/credit-notes/${doc.id}`);
      setViewDoc(res.data);
      setViewOpen(true);
    } catch {
      setError('Failed to load credit note');
    } finally {
      setActionId(null);
    }
  };

  const handleDownload = async (doc: CreditNote) => {
    setActionId(doc.id);
    try {
      await downloadPdf(doc.id, doc.customer?.name || 'Customer', displayDocumentNumber(doc.documentNumber));
    } catch {
      setError('PDF download failed');
    } finally {
      setActionId(null);
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'documentNumber', headerName: 'Number', width: 150,
      valueGetter: (_, row) => displayDocumentNumber((row as CreditNote).documentNumber),
    },
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (v) => formatDateDDMMYYYY(v as string) },
    { field: 'customer', headerName: 'Customer', flex: 1, valueGetter: (_, row) => (row as CreditNote).customer?.name },
    {
      field: 'return', headerName: 'Return', width: 140,
      valueGetter: (_, row) => {
        const n = (row as CreditNote).salesReturn?.documentNumber;
        return n ? displayDocumentNumber(n) : '—';
      },
    },
    {
      field: 'invoice', headerName: 'Invoice', width: 140,
      valueGetter: (_, row) => {
        const inv = (row as CreditNote).originalInvoice?.documentNumber;
        return inv ? displayDocumentNumber(inv) : '-';
      },
    },
    { field: 'reason', headerName: 'Reason', flex: 1 },
    { field: 'total', headerName: 'Total', width: 110, type: 'number' },
    { field: 'status', headerName: 'Status', width: 120, renderCell: ({ value }) => <StatusChip status={value as string} /> },
    {
      field: 'actions', headerName: 'Actions', width: 110, sortable: false,
      renderCell: ({ row }) => {
        const doc = row as CreditNote;
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
      <PageHeader title="Credit Notes" subtitle="Issue a credit note against a posted sales return to reverse accounts"
        actionLabel="New Credit Note" onAction={() => { resetDialog(); setDialogOpen(true); }} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <DocumentTable rows={notes} columns={columns} loading={loading} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleCreate}>
          <DialogTitle>Issue Credit Note</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <Autocomplete options={customers} getOptionLabel={(c) => `${c.code} - ${c.name}`}
                  value={customers.find((c) => c.id === customerId) || null}
                  onChange={(_, v) => {
                    setCustomerId(v?.id || '');
                    setSalesReturnId('');
                  }}
                  renderInput={(params) => <TextField {...params} required label="Customer" />} />
              </Grid>
              <Grid item xs={12}>
                <DocumentDateField value={date} onChange={setDate} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth required select label="Sales Return" value={salesReturnId}
                  onChange={(e) => setSalesReturnId(e.target.value)}
                  helperText="Only returns without an existing credit note">
                  <MenuItem value="">Select return</MenuItem>
                  {filteredReturns.map((r) => (
                    <MenuItem key={r.id} value={r.id}>
                      {displayDocumentNumber(r.documentNumber)}
                      {r.salesInvoice?.documentNumber ? ` · Inv ${displayDocumentNumber(r.salesInvoice.documentNumber)}` : ''}
                      {` · ${fmtMoney(r.total)}`}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              {selectedReturn && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Amount to credit: {fmtMoney(selectedReturn.total)} AED (from return)
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
            <Button type="submit" variant="contained" disabled={saving || !salesReturnId}>
              {saving ? <CircularProgress size={20} /> : 'Confirm Credit Note'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <DocumentViewDialog
        open={viewOpen}
        onClose={() => { setViewOpen(false); setViewDoc(null); }}
        title="Credit Note"
        busy={!!actionId}
        onDownload={viewDoc ? () => handleDownload(viewDoc) : undefined}
        extraFields={[
          ...(viewDoc?.salesReturn?.documentNumber
            ? [{ label: 'Sales Return', value: displayDocumentNumber(viewDoc.salesReturn.documentNumber) }]
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
            vatAmount: money(i.vatAmount),
            total: money(i.total),
            product: i.product,
          })),
        } : null}
      />
    </Box>
  );
}
