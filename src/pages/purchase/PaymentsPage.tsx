import { D, fmtMoney, money, outstanding, parseInput, sum } from '../../utils/money';
import { useEffect, useState, FormEvent } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Alert, CircularProgress, Grid, Autocomplete, MenuItem, IconButton,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { Visibility, PictureAsPdf } from '@mui/icons-material';
import { api, displayDocumentNumber, pdfFilename } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable from '../../components/common/DocumentTable';
import DocumentDateField from '../../components/common/DocumentDateField';
import DocumentViewDialog from '../../components/common/DocumentViewDialog';
import { todayISO, formatDateDDMMYYYY } from '../../utils/date';

interface Vendor {
  id: string; name: string; code: string;
  address?: string | null; vatNumber?: string | null;
  phone?: string | null; email?: string | null;
}
interface PurchaseInvoice {
  id: string; documentNumber: string; vendorId: string; total: number; paidAmount: number; debitedAmount?: number;
}
interface Payment {
  id: string; documentNumber: string; date: string; amount: number;
  paymentMethod: string; referenceNumber?: string | null; notes?: string | null;
  preparedBy?: string | null; approvedBy?: string | null; status?: string;
  paymentAccountId?: string | null;
  paymentAccount?: { id: string; code: string; name: string } | null;
  vendor: Vendor; purchaseInvoice?: { documentNumber: string } | null;
}

interface FundAccount { id: string; code: string; name: string; }

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD'];

async function fetchPaymentPdfBlob(id: string) {
  const res = await api.get(`/purchase/payments/${id}/pdf`, { responseType: 'blob' });
  return new Blob([res.data], { type: 'application/pdf' });
}

const downloadPdf = async (id: string, docNumber: string, partyName: string) => {
  const blob = await fetchPaymentPdfBlob(id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = pdfFilename(partyName, docNumber);
  a.click();
  URL.revokeObjectURL(url);
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [fundAccounts, setFundAccounts] = useState<FundAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewPayment, setViewPayment] = useState<Payment | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  // Optional split of one receipt/payment across several invoices (same currency)
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const allocTotal = money(sum(Object.values(alloc)));
  const [form, setForm] = useState({
    vendorId: '', purchaseInvoiceId: '', date: todayISO(),
    amount: 0, paymentMethod: 'BANK_TRANSFER', paymentAccountId: '', referenceNumber: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [p, v, inv, funds] = await Promise.all([
        api.get<Payment[]>('/purchase/payments'),
        api.get<Vendor[]>('/vendors', { params: { active: true } }),
        api.get<PurchaseInvoice[]>('/purchase/invoices'),
        api.get<FundAccount[]>('/accounts/fund-accounts'),
      ]);
      setPayments(p.data);
      setVendors(v.data);
      setInvoices(inv.data);
      setFundAccounts(funds.data);
    } catch {
      setError('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openView = async (payment: Payment) => {
    setActionId(payment.id);
    try {
      const res = await api.get<Payment>(`/purchase/payments/${payment.id}`);
      setViewPayment(res.data);
      setViewOpen(true);
    } catch {
      setError('Failed to load payment');
    } finally {
      setActionId(null);
    }
  };

  const handlePdf = async (payment: Payment) => {
    setActionId(payment.id);
    try {
      await downloadPdf(payment.id, payment.documentNumber, payment.vendor?.name || 'Vendor');
    } catch {
      setError('Failed to download PDF');
    } finally {
      setActionId(null);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const allocations = Object.entries(alloc).filter(([, v]) => v > 0).map(([invoiceId, amount]) => ({ invoiceId, amount }));
      await api.post('/purchase/payments', {
        ...form,
        purchaseInvoiceId: allocations.length ? undefined : form.purchaseInvoiceId || undefined,
        allocations: allocations.length ? allocations : undefined,
        paymentAccountId: form.paymentAccountId || undefined,
        amount: money(D(form.amount).lt(allocTotal) ? allocTotal : form.amount),
      });
      setAlloc({});
      setDialogOpen(false);
      setSuccess('Payment created');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create payment');
    } finally {
      setSaving(false);
    }
  };

  const vendorInvoices = invoices.filter((i) => i.vendorId === form.vendorId);

  const columns: GridColDef[] = [
    {
      field: 'documentNumber', headerName: 'Number', width: 140,
      valueGetter: (_, row) => displayDocumentNumber((row as Payment).documentNumber),
    },
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (v) => formatDateDDMMYYYY(v as string) },
    { field: 'vendor', headerName: 'Vendor', flex: 1, valueGetter: (_, row) => (row as Payment).vendor?.name },
    {
      field: 'invoice', headerName: 'Invoice', width: 140,
      valueGetter: (_, row) => {
        const inv = (row as Payment).purchaseInvoice?.documentNumber;
        return inv ? displayDocumentNumber(inv) : '-';
      },
    },
    { field: 'amount', headerName: 'Amount', width: 110, type: 'number' },
    { field: 'paymentMethod', headerName: 'Method', width: 120 },
    {
      field: 'actions', headerName: 'Actions', width: 100, sortable: false,
      renderCell: ({ row }) => {
        const payment = row as Payment;
        const busy = actionId === payment.id;
        return (
          <Box>
            <IconButton size="small" title="View" disabled={busy} onClick={() => openView(payment)}>
              {busy ? <CircularProgress size={16} /> : <Visibility fontSize="small" />}
            </IconButton>
            <IconButton size="small" title="Download PDF" disabled={busy} onClick={() => handlePdf(payment)}>
              <PictureAsPdf fontSize="small" color="error" />
            </IconButton>
          </Box>
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader title="Payments" subtitle="Vendor payments" actionLabel="New Payment"
        onAction={() => {
          setForm({
            vendorId: '', purchaseInvoiceId: '', date: todayISO(),
            amount: 0, paymentMethod: 'BANK_TRANSFER', paymentAccountId: '', referenceNumber: '', notes: '',
          });
          setDialogOpen(true);
        }} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <DocumentTable rows={payments} columns={columns} loading={loading} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleCreate}>
          <DialogTitle>New Payment</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <Autocomplete options={vendors} getOptionLabel={(v) => `${v.code} - ${v.name}`}
                  value={vendors.find((v) => v.id === form.vendorId) || null}
                  onChange={(_, val) => setForm({ ...form, vendorId: val?.id || '', purchaseInvoiceId: '' })}
                  renderInput={(params) => <TextField {...params} required label="Vendor" />} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth select label="Purchase Invoice" value={form.purchaseInvoiceId}
                  onChange={(e) => setForm({ ...form, purchaseInvoiceId: e.target.value })}>
                  <MenuItem value="">None</MenuItem>
                  {vendorInvoices.map((i) => (
                    <MenuItem key={i.id} value={i.id}>
                      {displayDocumentNumber(i.documentNumber)} (Balance: {fmtMoney(outstanding(i.total, i.paidAmount, i.debitedAmount))})
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              {!form.purchaseInvoiceId && vendorInvoices.length > 1 && (
                <Grid item xs={12}>
                  <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                    <Box sx={{ fontSize: 13, mb: 1, color: 'text.secondary' }}>
                      Split across invoices (optional; same currency). Leave blank to auto-allocate oldest first.
                    </Box>
                    {vendorInvoices.map((i) => (
                      <Box key={i.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Box sx={{ flex: 1, fontSize: 13 }}>
                          {displayDocumentNumber(i.documentNumber)} · balance {fmtMoney(outstanding(i.total, i.paidAmount, i.debitedAmount))}
                        </Box>
                        <TextField size="small" type="number" sx={{ width: 130 }} value={alloc[i.id] ?? ''}
                          onChange={(e) => setAlloc({ ...alloc, [i.id]: parseInput(e.target.value) })} />
                      </Box>
                    ))}
                    {allocTotal > 0 && <Box sx={{ fontSize: 13, textAlign: 'right' }}>Allocated: {fmtMoney(allocTotal)}</Box>}
                  </Box>
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required label="Amount" type="number" value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: parseInput(e.target.value) })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth select label="Payment Method" value={form.paymentMethod}
                  onChange={(e) => {
                    const method = e.target.value;
                    const preferCash = method === 'CASH';
                    const match = fundAccounts.find((a) => preferCash ? a.code === '1000' : a.code === '1010')
                      || fundAccounts[0];
                    setForm({
                      ...form,
                      paymentMethod: method,
                      paymentAccountId: match?.id || '',
                    });
                  }}>
                  {PAYMENT_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth select label="Paid From (Cash / Bank)" value={form.paymentAccountId}
                  onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}
                  helperText="Add more banks in Chart of Accounts (e.g. 1011 Emirates NBD)">
                  <MenuItem value="">Default by method</MenuItem>
                  {fundAccounts.map((a) => (
                    <MenuItem key={a.id} value={a.id}>{a.code} — {a.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <DocumentDateField value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Reference Number" value={form.referenceNumber}
                  onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Remarks" value={form.notes} multiline minRows={2}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? <CircularProgress size={20} /> : 'Create'}</Button>
          </DialogActions>
        </form>
      </Dialog>

      <DocumentViewDialog
        open={viewOpen}
        onClose={() => { setViewOpen(false); setViewPayment(null); }}
        title="Payment Voucher"
        variant="voucher"
        document={viewPayment ? {
          documentNumber: displayDocumentNumber(viewPayment.documentNumber),
          date: viewPayment.date,
          status: viewPayment.status || 'CONFIRMED',
          partyName: viewPayment.vendor?.name,
          partyLabel: 'Supplier',
          partyAddress: viewPayment.vendor?.address,
          partyVatNumber: viewPayment.vendor?.vatNumber,
          partyPhone: viewPayment.vendor?.phone,
          partyEmail: viewPayment.vendor?.email,
          remarks: viewPayment.notes,
          vatApplicable: false,
          total: money(viewPayment.amount),
          items: [{
            description: viewPayment.purchaseInvoice
              ? `Being payment against ${displayDocumentNumber(viewPayment.purchaseInvoice.documentNumber)}`
              : 'Being payment to vendor',
            quantity: 1,
            unitPrice: money(viewPayment.amount),
            total: money(viewPayment.amount),
          }],
        } : null}
        extraFields={viewPayment ? [
          { label: 'Payment Method', value: viewPayment.paymentMethod },
          ...(viewPayment.paymentAccount
            ? [{ label: 'Paid From', value: `${viewPayment.paymentAccount.code} — ${viewPayment.paymentAccount.name}` }]
            : []),
          ...(viewPayment.referenceNumber ? [{ label: 'Reference', value: viewPayment.referenceNumber }] : []),
          ...(viewPayment.purchaseInvoice
            ? [{ label: 'Invoice Ref', value: displayDocumentNumber(viewPayment.purchaseInvoice.documentNumber) }]
            : []),
        ] : undefined}
        onDownload={viewPayment
          ? () => downloadPdf(viewPayment.id, viewPayment.documentNumber, viewPayment.vendor?.name || 'Vendor')
          : undefined}
        busy={!!actionId}
      />
    </Box>
  );
}
