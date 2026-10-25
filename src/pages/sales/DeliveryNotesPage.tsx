import { fmtMoney, money, qtyOut, sum } from '../../utils/money';
import { useEffect, useState, FormEvent } from 'react';
import {
  Box, Alert, CircularProgress, IconButton, Link, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, TextField, Grid, MenuItem, Table, TableHead, TableBody, TableRow,
  TableCell, TableContainer, Paper, Typography, Autocomplete, Chip,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { Visibility, PictureAsPdf, Print, CheckCircle, Delete, Edit, Add } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { api, displayDocumentNumber, pdfFilename } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable, { StatusChip } from '../../components/common/DocumentTable';
import { NumberField } from '../../components/common/LineItemsForm';
import DocumentDateField from '../../components/common/DocumentDateField';
import DocumentViewDialog from '../../components/common/DocumentViewDialog';
import { formatDateDDMMYYYY, toInputDate, todayISO } from '../../utils/date';

interface Warehouse { id: string; name: string; code: string; }
interface Customer {
  id: string; name: string; code: string;
  address?: string | null; vatNumber?: string | null; phone?: string | null; email?: string | null;
}
interface StockItem { warehouseId: string; quantity: number; }
interface Product {
  id: string; name: string; sku: string; sellingPrice: number; vatRate: number;
  unit?: string; countryOfOrigin?: string | null; stockItems?: StockItem[];
}

interface DnItem {
  id: string;
  salesOrderItemId?: string | null;
  productId: string;
  description?: string | null;
  orderedQty?: number;
  quantity: number;
  unitPrice?: number;
  unit?: string | null;
  product?: { name?: string; unit?: string };
}

interface DeliveryNote {
  id: string;
  documentNumber: string;
  date: string;
  status: string;
  customer: {
    name: string;
    address?: string | null;
    vatNumber?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  salesOrderId?: string | null;
  salesOrderNumber?: string | null;
  warehouseId?: string | null;
  vehicleNumber?: string | null;
  driverName?: string | null;
  receivedBy?: string | null;
  checkedBy?: string | null;
  notes?: string | null;
  isInvoiced?: boolean;
  total?: number;
  items?: DnItem[];
}

interface EditLine {
  id?: string;
  productId?: string;
  productName: string;
  unit?: string;
  orderedQty: number;
  remaining: number;
  quantity: number;
  unitPrice?: number;
}

interface DirectLine {
  productId: string;
  productName?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
}

interface SoLine {
  id: string;
  quantity: number;
  deliveredQty?: number;
  remainingQty?: number;
  product?: { name?: string; unit?: string };
  description?: string | null;
}

async function fetchDnPdfBlob(id: string, customerCopy = false) {
  const res = await api.get(`/sales/delivery-notes/${id}/pdf`, {
    responseType: 'blob',
    params: customerCopy ? { copy: 'customer' } : undefined,
  });
  return new Blob([res.data], { type: 'application/pdf' });
}

const downloadPdf = async (id: string, docNumber: string, partyName: string, customerCopy = false) => {
  const blob = await fetchDnPdfBlob(id, customerCopy);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = customerCopy
    ? pdfFilename(partyName, docNumber).replace(/\.pdf$/i, '_CustomerCopy.pdf')
    : pdfFilename(partyName, docNumber);
  a.click();
  URL.revokeObjectURL(url);
};

const printPdf = async (id: string) => {
  const blob = await fetchDnPdfBlob(id);
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) {
    URL.revokeObjectURL(url);
    throw new Error('Popup blocked — allow popups to print');
  }
  w.addEventListener('load', () => {
    try { w.focus(); w.print(); } catch { /* ignore */ }
  });
  setTimeout(() => {
    try { w.print(); } catch { /* ignore */ }
  }, 500);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

const downloadDnWithCustomerCopyPrompt = async (id: string, docNumber: string, partyName: string) => {
  await downloadPdf(id, docNumber, partyName, false);
  if (window.confirm('Do you want Customer Copy?')) {
    await downloadPdf(id, docNumber, partyName, true);
  }
};

function productLabel(p: Product) {
  const base = `${p.sku} - ${p.name}`;
  return p.countryOfOrigin ? `${base} (${p.countryOfOrigin})` : base;
}

function stockOnHand(product: Product | undefined, warehouseId?: string) {
  if (!product?.stockItems?.length) return 0;
  const items = warehouseId
    ? product.stockItems.filter((s) => s.warehouseId === warehouseId)
    : product.stockItems;
  return money(sum(items.map((s) => s.quantity)));
}

export default function DeliveryNotesPage() {
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewNote, setViewNote] = useState<DeliveryNote | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<DeliveryNote | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editVehicle, setEditVehicle] = useState('');
  const [editDriver, setEditDriver] = useState('');
  const [editWarehouseId, setEditWarehouseId] = useState('');
  const [editReceivedBy, setEditReceivedBy] = useState('');
  const [editCheckedBy, setEditCheckedBy] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editLines, setEditLines] = useState<EditLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [createDate, setCreateDate] = useState(todayISO());
  const [createVehicle, setCreateVehicle] = useState('');
  const [createDriver, setCreateDriver] = useState('');
  const [createWarehouseId, setCreateWarehouseId] = useState('');
  const [createReceivedBy, setCreateReceivedBy] = useState('');
  const [createCheckedBy, setCreateCheckedBy] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [directLines, setDirectLines] = useState<DirectLine[]>([{ productId: '', quantity: 1, unitPrice: 0 }]);

  const qtyEditable = editingNote?.status === 'DRAFT';
  const isDirectEdit = !!editingNote && !editingNote.salesOrderId;

  const loadLookups = async () => {
    const [c, p] = await Promise.all([
      customers.length ? Promise.resolve({ data: customers }) : api.get<Customer[]>('/customers', { params: { active: true } }),
      api.get<Product[]>('/inventory/products', { params: { active: true } }),
    ]);
    if (!customers.length) setCustomers(c.data);
    setProducts(p.data.map((pr) => ({
      ...pr,
      sellingPrice: money(pr.sellingPrice),
      vatRate: money(pr.vatRate),
    })));
  };

  const fetchNotes = () => {
    setLoading(true);
    Promise.all([
      api.get<DeliveryNote[]>('/sales/delivery-notes'),
      api.get<Warehouse[]>('/inventory/warehouses'),
    ])
      .then(([n, w]) => {
        setNotes(n.data);
        setWarehouses(w.data);
      })
      .catch(() => setError('Failed to load delivery notes'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotes(); }, []);

  const resetCreate = () => {
    setCustomerId('');
    setCreateDate(todayISO());
    setCreateVehicle('');
    setCreateDriver('');
    setCreateWarehouseId('');
    setCreateReceivedBy('');
    setCreateCheckedBy('');
    setCreateNotes('');
    setDirectLines([{ productId: '', quantity: 1, unitPrice: 0 }]);
  };

  const openCreate = async () => {
    setError('');
    resetCreate();
    try {
      await loadLookups();
      setCreateOpen(true);
    } catch {
      setError('Failed to load customers and products');
    }
  };

  const openView = async (note: DeliveryNote) => {
    setActionId(note.id);
    try {
      const res = await api.get<DeliveryNote>(`/sales/delivery-notes/${note.id}`);
      setViewNote(res.data);
      setViewOpen(true);
    } catch {
      setError('Failed to load delivery note');
    } finally {
      setActionId(null);
    }
  };

  const openEdit = async (note: DeliveryNote) => {
    setActionId(note.id);
    setError('');
    try {
      const res = await api.get<DeliveryNote>(`/sales/delivery-notes/${note.id}`);
      const full = res.data;
      setEditingNote(full);
      setEditDate(toInputDate(full.date));
      setEditVehicle(full.vehicleNumber || '');
      setEditDriver(full.driverName || '');
      setEditWarehouseId(full.warehouseId || '');
      setEditReceivedBy(full.receivedBy || '');
      setEditCheckedBy(full.checkedBy || '');
      setEditNotes(full.notes || '');

      let remainingBySoItem = new Map<string, number>();
      if (full.salesOrderId) {
        const soRes = await api.get<{ items: SoLine[] }>(`/sales/orders/${full.salesOrderId}`);
        remainingBySoItem = new Map(
          (soRes.data.items || []).map((i) => [i.id, qtyOut(i.remainingQty ?? 0)]),
        );
      }

      setEditLines((full.items || []).map((i) => {
        const current = qtyOut(i.quantity);
        const soRemaining = i.salesOrderItemId
          ? (remainingBySoItem.get(i.salesOrderItemId) ?? 0)
          : 0;
        return {
          id: i.id,
          productId: i.productId,
          productName: i.product?.name || i.description || 'Item',
          unit: i.unit || i.product?.unit || undefined,
          orderedQty: qtyOut(i.orderedQty ?? i.quantity),
          remaining: full.salesOrderId ? soRemaining + current : current,
          quantity: current,
          unitPrice: money(i.unitPrice ?? 0),
        };
      }));
      if (!full.salesOrderId) await loadLookups();
      setEditOpen(true);
    } catch {
      setError('Failed to load delivery note for edit');
    } finally {
      setActionId(null);
    }
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditingNote(null);
    setEditLines([]);
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;
    const items = editLines.filter((l) => l.quantity > 0 && (isDirectEdit ? l.productId : true));
    if (items.length === 0) { setError('Deliver quantity must be greater than zero'); return; }
    if (isDirectEdit && qtyEditable && items.some((l) => !l.productId)) {
      setError('Select a product for every line');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await api.put(`/sales/delivery-notes/${editingNote.id}`, {
        date: editDate,
        vehicleNumber: editVehicle,
        driverName: editDriver,
        receivedBy: editReceivedBy,
        checkedBy: editCheckedBy,
        notes: editNotes,
        ...(qtyEditable ? {
          warehouseId: editWarehouseId || null,
          items: isDirectEdit
            ? items.map((l) => ({
                productId: l.productId,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                unit: l.unit,
              }))
            : items.map((l) => ({ id: l.id, quantity: l.quantity })),
        } : {}),
      });
      setSuccess('Delivery note updated');
      closeEdit();
      fetchNotes();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to update delivery note');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!customerId) { setError('Customer is required'); return; }
    const items = directLines.filter((l) => l.productId && l.quantity > 0);
    if (items.length === 0) { setError('Add at least one product with quantity'); return; }

    setSaving(true);
    setError('');
    try {
      await api.post('/sales/delivery-notes', {
        customerId,
        date: createDate,
        warehouseId: createWarehouseId || undefined,
        vehicleNumber: createVehicle,
        driverName: createDriver,
        receivedBy: createReceivedBy,
        checkedBy: createCheckedBy,
        notes: createNotes,
        items: items.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          unit: l.unit,
        })),
      });
      setSuccess('Direct delivery note created as draft — confirm to deduct inventory');
      setCreateOpen(false);
      resetCreate();
      fetchNotes();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create delivery note');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (note: DeliveryNote) => {
    setPdfBusy(true);
    setActionId(note.id);
    try {
      await downloadDnWithCustomerCopyPrompt(
        note.id,
        displayDocumentNumber(note.documentNumber),
        note.customer?.name || 'Customer',
      );
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message;
      setError(msg || 'Failed to download PDF');
    } finally {
      setPdfBusy(false);
      setActionId(null);
    }
  };

  const handlePrint = async (note: DeliveryNote) => {
    setPdfBusy(true);
    setActionId(note.id);
    try {
      await printPdf(note.id);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message;
      setError(msg || 'Failed to print PDF');
    } finally {
      setPdfBusy(false);
      setActionId(null);
    }
  };

  const handleConfirm = async (note: DeliveryNote) => {
    setActionId(note.id);
    try {
      await api.post(`/sales/delivery-notes/${note.id}/confirm`);
      setSuccess('Delivery note confirmed — inventory updated');
      fetchNotes();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to confirm delivery note');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (note: DeliveryNote) => {
    if (note.status === 'CONFIRMED') {
      const reason = window.prompt(`delivery note ${note.documentNumber} is confirmed and cannot be deleted. Enter a reason to REVERSE it (stock is restored, document kept as CANCELLED):`);
      if (!reason) return;
      try {
        await api.post(`/sales/delivery-notes/${note.id}/reverse`, { reason });
        window.location.reload();
      } catch (e: unknown) {
        window.alert((e as { response?: { data?: { error?: string } } }).response?.data?.error || 'Reversal failed');
      }
      return;
    }
    if (!window.confirm(`Delete delivery note ${note.documentNumber}?`)) return;
    setActionId(note.id);
    try {
      await api.delete(`/sales/delivery-notes/${note.id}`);
      setSuccess('Delivery note deleted');
      fetchNotes();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to delete delivery note');
    } finally {
      setActionId(null);
    }
  };

  const columns: GridColDef[] = [
    { field: 'documentNumber', headerName: 'Number', width: 160, valueGetter: (_, row) => displayDocumentNumber((row as DeliveryNote).documentNumber) },
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (v) => formatDateDDMMYYYY(v as string) },
    { field: 'customer', headerName: 'Customer', flex: 1, valueGetter: (_, row) => (row as DeliveryNote).customer?.name },
    {
      field: 'salesOrderNumber', headerName: 'SO Number', width: 130,
      renderCell: ({ row }) => {
        const dn = row as DeliveryNote;
        if (!dn.salesOrderNumber) {
          return <Chip size="small" label="Direct" variant="outlined" color="info" />;
        }
        return dn.salesOrderId ? (
          <Link component={RouterLink} to="/sales/orders" underline="hover">{dn.salesOrderNumber}</Link>
        ) : dn.salesOrderNumber;
      },
    },
    { field: 'vehicleNumber', headerName: 'Vehicle', width: 110 },
    { field: 'driverName', headerName: 'Driver', width: 120 },
    { field: 'status', headerName: 'Status', width: 120, renderCell: ({ value }) => <StatusChip status={value as string} /> },
    {
      field: 'actions', headerName: 'Actions', width: 230, sortable: false,
      renderCell: ({ row }) => {
        const note = row as DeliveryNote;
        const busy = actionId === note.id;
        const canEdit = !note.isInvoiced && note.status !== 'INVOICED';
        return (
          <Box>
            <IconButton size="small" title="View" disabled={busy} onClick={() => openView(note)}>
              {busy ? <CircularProgress size={16} /> : <Visibility fontSize="small" />}
            </IconButton>
            {canEdit && (
              <IconButton size="small" title="Edit" disabled={busy} onClick={() => openEdit(note)}>
                <Edit fontSize="small" />
              </IconButton>
            )}
            <IconButton size="small" title="Download PDF" disabled={busy} onClick={() => handleDownload(note)}>
              <PictureAsPdf fontSize="small" color="error" />
            </IconButton>
            <IconButton size="small" title="Print" disabled={busy} onClick={() => handlePrint(note)}>
              <Print fontSize="small" />
            </IconButton>
            {note.status === 'DRAFT' && (
              <IconButton size="small" title="Confirm" color="primary" disabled={busy} onClick={() => handleConfirm(note)}>
                <CheckCircle fontSize="small" />
              </IconButton>
            )}
            {note.status !== 'INVOICED' && (
              <IconButton size="small" title="Delete" color="error" disabled={busy} onClick={() => handleDelete(note)}>
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
      <PageHeader
        title="Delivery Notes"
        subtitle="Goods delivery records — from sales orders or created directly"
        actionLabel="Direct Delivery Note"
        onAction={openCreate}
      />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      <DocumentTable rows={notes} columns={columns} loading={loading} />

      <Dialog open={createOpen} onClose={() => { setCreateOpen(false); resetCreate(); }} maxWidth="lg" fullWidth>
        <form onSubmit={handleCreate}>
          <DialogTitle>New Direct Delivery Note</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: 0.5 }}>
              Deliver goods without a sales order. Confirming this note deducts stock from the selected warehouse (or the default warehouse).
            </Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
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
                <DocumentDateField label="Delivery Date" value={createDate} onChange={setCreateDate} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Vehicle Number" value={createVehicle}
                  onChange={(e) => setCreateVehicle(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Driver Name" value={createDriver}
                  onChange={(e) => setCreateDriver(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth select label="Warehouse" value={createWarehouseId}
                  onChange={(e) => setCreateWarehouseId(e.target.value)}
                  helperText="Optional — stock posts to this warehouse (or default) on confirm">
                  <MenuItem value="">None (use default on confirm)</MenuItem>
                  {warehouses.map((w) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Received By" value={createReceivedBy}
                  onChange={(e) => setCreateReceivedBy(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Checked By" value={createCheckedBy}
                  onChange={(e) => setCreateCheckedBy(e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Notes" value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)} />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" sx={{ mb: 1 }}>Items to deliver</Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell align="center">UOM</TableCell>
                    <TableCell align="right">Stock on hand</TableCell>
                    <TableCell align="right">Deliver Qty</TableCell>
                    <TableCell align="right">Unit Price</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {directLines.map((line, i) => {
                    const product = products.find((p) => p.id === line.productId);
                    const onHand = stockOnHand(product, createWarehouseId || undefined);
                    const overStock = line.quantity > onHand;
                    return (
                      <TableRow key={i}>
                        <TableCell sx={{ minWidth: 240 }}>
                          <Autocomplete
                            size="small"
                            options={products}
                            getOptionLabel={productLabel}
                            value={product || null}
                            onChange={(_, v) => {
                              const updated = [...directLines];
                              updated[i] = {
                                ...updated[i],
                                productId: v?.id || '',
                                productName: v?.name,
                                unit: v?.unit,
                                unitPrice: money(v?.sellingPrice ?? 0),
                              };
                              setDirectLines(updated);
                            }}
                            renderInput={(params) => <TextField {...params} placeholder="Select product" />}
                          />
                        </TableCell>
                        <TableCell align="center">{product?.unit || line.unit || '-'}</TableCell>
                        <TableCell align="right" sx={{ color: overStock ? 'warning.main' : undefined }}>
                          {fmtMoney(onHand)}
                        </TableCell>
                        <TableCell align="right">
                          <NumberField
                            value={line.quantity}
                            onChange={(v) => {
                              const updated = [...directLines];
                              updated[i] = { ...updated[i], quantity: Math.max(0, v) };
                              setDirectLines(updated);
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <NumberField
                            value={line.unitPrice}
                            onChange={(v) => {
                              const updated = [...directLines];
                              updated[i] = { ...updated[i], unitPrice: Math.max(0, v) };
                              setDirectLines(updated);
                            }}
                            width={100}
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={directLines.length === 1}
                            onClick={() => setDirectLines(directLines.filter((_, idx) => idx !== i))}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Button
              startIcon={<Add />}
              size="small"
              onClick={() => setDirectLines([...directLines, { productId: '', quantity: 1, unitPrice: 0 }])}
            >
              Add Line
            </Button>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setCreateOpen(false); resetCreate(); }}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving || !customerId || directLines.every((l) => !l.productId || l.quantity <= 0)}
            >
              {saving ? <CircularProgress size={20} /> : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={editOpen} onClose={closeEdit} maxWidth={isDirectEdit ? 'lg' : 'md'} fullWidth>
        <form onSubmit={handleUpdate}>
          <DialogTitle>
            Edit Delivery Note — {editingNote ? displayDocumentNumber(editingNote.documentNumber) : ''}
            {isDirectEdit ? ' (Direct)' : ''}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <DocumentDateField label="Delivery Date" value={editDate} onChange={setEditDate} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Vehicle Number" value={editVehicle}
                  onChange={(e) => setEditVehicle(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Driver Name" value={editDriver}
                  onChange={(e) => setEditDriver(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth select label="Warehouse" value={editWarehouseId}
                  disabled={!qtyEditable}
                  onChange={(e) => setEditWarehouseId(e.target.value)}
                  helperText={qtyEditable ? 'Optional — stock posts on confirm' : 'Warehouse locked after confirm'}>
                  <MenuItem value="">None (use default on confirm)</MenuItem>
                  {warehouses.map((w) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Received By" value={editReceivedBy}
                  onChange={(e) => setEditReceivedBy(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Checked By" value={editCheckedBy}
                  onChange={(e) => setEditCheckedBy(e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Notes" value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)} />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {isDirectEdit ? 'Items to deliver' : 'Delivery Quantities'}
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell align="center">UOM</TableCell>
                    {isDirectEdit ? (
                      <>
                        <TableCell align="right">Stock on hand</TableCell>
                        <TableCell align="right">Deliver Qty</TableCell>
                        <TableCell align="right">Unit Price</TableCell>
                        {qtyEditable && <TableCell />}
                      </>
                    ) : (
                      <>
                        <TableCell align="right">Ordered Qty</TableCell>
                        <TableCell align="right">Available</TableCell>
                        <TableCell align="right">Deliver Qty</TableCell>
                      </>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {editLines.map((l, i) => {
                    const product = products.find((p) => p.id === l.productId);
                    const onHand = stockOnHand(product, editWarehouseId || undefined);
                    return (
                      <TableRow key={l.id || i}>
                        <TableCell sx={{ minWidth: isDirectEdit && qtyEditable ? 240 : undefined }}>
                          {isDirectEdit && qtyEditable ? (
                            <Autocomplete
                              size="small"
                              options={products}
                              getOptionLabel={productLabel}
                              value={product || null}
                              onChange={(_, v) => {
                                const updated = [...editLines];
                                updated[i] = {
                                  ...updated[i],
                                  productId: v?.id || '',
                                  productName: v?.name || '',
                                  unit: v?.unit,
                                  unitPrice: money(v?.sellingPrice ?? updated[i].unitPrice ?? 0),
                                };
                                setEditLines(updated);
                              }}
                              renderInput={(params) => <TextField {...params} placeholder="Select product" />}
                            />
                          ) : (
                            l.productName
                          )}
                        </TableCell>
                        <TableCell align="center">{l.unit || product?.unit || '-'}</TableCell>
                        {isDirectEdit ? (
                          <>
                            <TableCell align="right">{fmtMoney(onHand)}</TableCell>
                            <TableCell align="right">
                              {qtyEditable ? (
                                <NumberField
                                  value={l.quantity}
                                  onChange={(v) => {
                                    const updated = [...editLines];
                                    updated[i] = { ...updated[i], quantity: Math.max(0, v) };
                                    setEditLines(updated);
                                  }}
                                />
                              ) : (
                                fmtMoney(l.quantity)
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {qtyEditable ? (
                                <NumberField
                                  value={l.unitPrice ?? 0}
                                  onChange={(v) => {
                                    const updated = [...editLines];
                                    updated[i] = { ...updated[i], unitPrice: Math.max(0, v) };
                                    setEditLines(updated);
                                  }}
                                  width={100}
                                />
                              ) : (
                                fmtMoney(l.unitPrice ?? 0)
                              )}
                            </TableCell>
                            {qtyEditable && (
                              <TableCell>
                                <IconButton
                                  size="small"
                                  color="error"
                                  disabled={editLines.length === 1}
                                  onClick={() => setEditLines(editLines.filter((_, idx) => idx !== i))}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </TableCell>
                            )}
                          </>
                        ) : (
                          <>
                            <TableCell align="right">{fmtMoney(l.orderedQty)}</TableCell>
                            <TableCell align="right">{fmtMoney(l.remaining)}</TableCell>
                            <TableCell align="right">
                              {qtyEditable ? (
                                <NumberField
                                  value={l.quantity}
                                  onChange={(v) => {
                                    const updated = [...editLines];
                                    updated[i] = { ...updated[i], quantity: Math.min(Math.max(0, v), l.remaining) };
                                    setEditLines(updated);
                                  }}
                                />
                              ) : (
                                fmtMoney(l.quantity)
                              )}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {isDirectEdit && qtyEditable && (
              <Button
                startIcon={<Add />}
                size="small"
                onClick={() => setEditLines([...editLines, {
                  productId: '', productName: '', orderedQty: 0, remaining: 0, quantity: 1, unitPrice: 0,
                }])}
              >
                Add Line
              </Button>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeEdit}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving || editLines.every((l) => l.quantity <= 0)}>
              {saving ? <CircularProgress size={20} /> : 'Update'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <DocumentViewDialog
        open={viewOpen}
        onClose={() => { setViewOpen(false); setViewNote(null); }}
        title="Delivery Note"
        variant="qtyOnly"
        busy={pdfBusy}
        onDownload={viewNote ? () => handleDownload(viewNote) : undefined}
        onPrint={viewNote ? () => handlePrint(viewNote) : undefined}
        document={viewNote ? {
          documentNumber: displayDocumentNumber(viewNote.documentNumber),
          date: viewNote.date,
          status: viewNote.status,
          partyName: viewNote.customer?.name,
          partyLabel: 'Customer',
          partyAddress: viewNote.customer?.address,
          partyVatNumber: viewNote.customer?.vatNumber,
          partyPhone: viewNote.customer?.phone,
          partyEmail: viewNote.customer?.email,
          items: (viewNote.items || []).map((i) => ({
            description: i.description || i.product?.name,
            quantity: qtyOut(i.quantity),
            unit: i.unit || i.product?.unit,
            product: i.product,
          })),
        } : null}
        extraFields={[
          ...(viewNote && !viewNote.salesOrderNumber ? [{ label: 'Type', value: 'Direct delivery' }] : []),
          ...(viewNote?.salesOrderNumber ? [{ label: 'Sales Order', value: viewNote.salesOrderNumber }] : []),
          ...(viewNote?.warehouseId ? [{
            label: 'Warehouse',
            value: warehouses.find((w) => w.id === viewNote.warehouseId)?.name || viewNote.warehouseId,
          }] : []),
          ...(viewNote?.vehicleNumber ? [{ label: 'Vehicle', value: viewNote.vehicleNumber }] : []),
          ...(viewNote?.driverName ? [{ label: 'Driver', value: viewNote.driverName }] : []),
        ]}
      />
    </Box>
  );
}
