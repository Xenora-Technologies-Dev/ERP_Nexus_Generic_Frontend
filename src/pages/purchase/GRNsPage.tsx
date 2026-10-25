import { D, fmtMoney, money, pos, qtyOut } from '../../utils/money';
import { useEffect, useState, FormEvent } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Alert, CircularProgress, Grid, Autocomplete, MenuItem, IconButton,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper, Typography,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { CheckCircle, Delete, Visibility, PictureAsPdf, Print, Edit } from '@mui/icons-material';
import { api, displayDocumentNumber, pdfFilename } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable, { StatusChip } from '../../components/common/DocumentTable';
import { NumberField } from '../../components/common/LineItemsForm';
import DocumentDateField from '../../components/common/DocumentDateField';
import DocumentViewDialog from '../../components/common/DocumentViewDialog';
import { todayISO, formatDateDDMMYYYY, toInputDate } from '../../utils/date';

interface Vendor {
  id: string; name: string; code: string;
  address?: string | null; vatNumber?: string | null;
  phone?: string | null; email?: string | null;
}
interface Warehouse { id: string; name: string; code: string; }
interface PurchaseOrder {
  id: string;
  documentNumber: string;
  vendorId: string;
  status: string;
  hasRemaining?: boolean;
}
interface PoLine {
  id: string;
  productId: string;
  description?: string | null;
  quantity: number;
  receivedQty: number;
  remainingQty: number;
  unitPrice: number;
  product?: { name: string; sku: string; unit?: string };
}
interface ReceiveLine {
  id?: string;
  purchaseOrderItemId: string;
  productId: string;
  productName: string;
  unit?: string;
  orderedQty: number;
  remaining: number;
  acceptedQty: number;
  unitPrice: number;
  batchNumber?: string;
  expiryDate?: string;
}
interface GRNItem {
  id: string;
  productId: string;
  purchaseOrderItemId?: string | null;
  description?: string | null;
  quantity: number;
  acceptedQty: number;
  unitPrice: number;
  product?: { name: string; sku: string; unit?: string };
}
interface GRN {
  id: string;
  documentNumber: string;
  date: string;
  status: string;
  vendor: Vendor;
  vendorId?: string;
  warehouseId?: string | null;
  warehouse?: Warehouse;
  vehicleNumber?: string | null;
  driverName?: string | null;
  receivedBy?: string | null;
  checkedBy?: string | null;
  notes?: string | null;
  isInvoiced?: boolean;
  purchaseOrderId?: string | null;
  purchaseOrder?: { id: string; documentNumber: string } | null;
  items?: GRNItem[];
}

async function fetchGrnPdfBlob(id: string) {
  const res = await api.get(`/purchase/grns/${id}/pdf`, { responseType: 'blob' });
  return new Blob([res.data], { type: 'application/pdf' });
}

const downloadPdf = async (id: string, docNumber: string, partyName: string) => {
  const blob = await fetchGrnPdfBlob(id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = pdfFilename(partyName, docNumber);
  a.click();
  URL.revokeObjectURL(url);
};

const printPdf = async (id: string) => {
  const blob = await fetchGrnPdfBlob(id);
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

export default function GRNsPage() {
  const [grns, setGrns] = useState<GRN[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGrn, setEditingGrn] = useState<GRN | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewGrn, setViewGrn] = useState<GRN | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [vendorId, setVendorId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [checkedBy, setCheckedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [receiveLines, setReceiveLines] = useState<ReceiveLine[]>([]);
  const [loadingPo, setLoadingPo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const isEditing = !!editingGrn;
  const qtyEditable = !isEditing || editingGrn.status === 'DRAFT';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [g, v, w, o] = await Promise.all([
        api.get<GRN[]>('/purchase/grns'),
        api.get<Vendor[]>('/vendors', { params: { active: true } }),
        api.get<Warehouse[]>('/inventory/warehouses'),
        api.get<PurchaseOrder[]>('/purchase/orders'),
      ]);
      setGrns(g.data);
      setVendors(v.data);
      setWarehouses(w.data);
      setOrders(o.data);
    } catch {
      setError('Failed to load GRNs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const resetDialog = () => {
    setEditingGrn(null);
    setVendorId('');
    setDate(todayISO());
    setPurchaseOrderId('');
    setWarehouseId('');
    setVehicleNumber('');
    setDriverName('');
    setReceivedBy('');
    setCheckedBy('');
    setNotes('');
    setReceiveLines([]);
  };

  const openCreate = () => {
    resetDialog();
    setDialogOpen(true);
  };

  const openEdit = async (grn: GRN) => {
    setActionId(grn.id);
    setError('');
    try {
      const res = await api.get<GRN>(`/purchase/grns/${grn.id}`);
      const full = res.data;
      setEditingGrn(full);
      setVendorId(full.vendorId || full.vendor?.id || '');
      setDate(toInputDate(full.date));
      setPurchaseOrderId(full.purchaseOrderId || full.purchaseOrder?.id || '');
      setWarehouseId(full.warehouseId || full.warehouse?.id || '');
      setVehicleNumber(full.vehicleNumber || '');
      setDriverName(full.driverName || '');
      setReceivedBy(full.receivedBy || '');
      setCheckedBy(full.checkedBy || '');
      setNotes(full.notes || '');

      let remainingByPoItem = new Map<string, number>();
      if (full.purchaseOrderId || full.purchaseOrder?.id) {
        const poId = full.purchaseOrderId || full.purchaseOrder!.id;
        const poRes = await api.get<{ items: PoLine[] }>(`/purchase/orders/${poId}`);
        remainingByPoItem = new Map(
          (poRes.data.items || []).map((i) => [
            i.id,
            qtyOut(i.remainingQty ?? qtyOut(pos(D(i.quantity).minus(D(i.receivedQty))))),
          ]),
        );
      }

      setReceiveLines((full.items || []).map((i) => {
        const current = qtyOut(i.acceptedQty ?? i.quantity);
        const poRemaining = i.purchaseOrderItemId
          ? (remainingByPoItem.get(i.purchaseOrderItemId) ?? 0)
          : 0;
        return {
          id: i.id,
          purchaseOrderItemId: i.purchaseOrderItemId || '',
          productId: i.productId,
          productName: i.product?.name || i.description || 'Item',
          unit: i.product?.unit,
          orderedQty: qtyOut(i.quantity),
          remaining: poRemaining + current,
          acceptedQty: current,
          unitPrice: money(i.unitPrice),
        };
      }));
      setDialogOpen(true);
    } catch {
      setError('Failed to load GRN for edit');
    } finally {
      setActionId(null);
    }
  };

  const openView = async (grn: GRN) => {
    setActionId(grn.id);
    try {
      const res = await api.get<GRN>(`/purchase/grns/${grn.id}`);
      setViewGrn(res.data);
      setViewOpen(true);
    } catch {
      setError('Failed to load GRN');
    } finally {
      setActionId(null);
    }
  };

  const handleDownload = async (grn: GRN) => {
    setPdfBusy(true);
    setActionId(grn.id);
    try {
      await downloadPdf(grn.id, displayDocumentNumber(grn.documentNumber), grn.vendor?.name || 'Vendor');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error
        || (err as { message?: string })?.message;
      setError(msg || 'Failed to download PDF');
    } finally {
      setPdfBusy(false);
      setActionId(null);
    }
  };

  const handlePrint = async (grn: GRN) => {
    setPdfBusy(true);
    setActionId(grn.id);
    try {
      await printPdf(grn.id);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message;
      setError(msg || 'Failed to print PDF');
    } finally {
      setPdfBusy(false);
      setActionId(null);
    }
  };

  const loadPoLines = async (poId: string) => {
    if (!poId) {
      setReceiveLines([]);
      return;
    }
    setLoadingPo(true);
    setError('');
    try {
      const res = await api.get<{ items: PoLine[] }>(`/purchase/orders/${poId}`);
      const lines = (res.data.items || [])
        .map((i) => {
          const remaining = qtyOut(i.remainingQty ?? qtyOut(pos(D(i.quantity).minus(D(i.receivedQty)))));
          return {
            purchaseOrderItemId: i.id,
            productId: i.productId,
            productName: i.product?.name || i.description || 'Item',
            unit: i.product?.unit,
            orderedQty: qtyOut(i.quantity),
            remaining,
            acceptedQty: remaining,
            unitPrice: money(i.unitPrice),
          };
        })
        .filter((l) => l.remaining > 0);
      setReceiveLines(lines);
      if (lines.length === 0) setError('No remaining quantity on this purchase order');
    } catch {
      setError('Failed to load purchase order lines');
      setReceiveLines([]);
    } finally {
      setLoadingPo(false);
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!vendorId) { setError('Vendor is required'); return; }
    if (!warehouseId) { setError('Warehouse is required for stock updates'); return; }
    const items = receiveLines.filter((l) => l.acceptedQty > 0);
    if (items.length === 0) { setError('Enter receive quantity for at least one item'); return; }

    setSaving(true);
    setError('');
    try {
      if (editingGrn) {
        await api.put(`/purchase/grns/${editingGrn.id}`, {
          date,
          warehouseId: qtyEditable ? warehouseId : undefined,
          vehicleNumber,
          driverName,
          receivedBy,
          checkedBy,
          notes,
          ...(qtyEditable ? {
            items: items.map((l) => ({
              id: l.id,
              acceptedQty: l.acceptedQty,
            })),
          } : {}),
        });
        setSuccess('GRN updated');
      } else {
        if (!purchaseOrderId) { setError('Select a purchase order'); setSaving(false); return; }
        await api.post('/purchase/grns', {
          vendorId,
          date,
          purchaseOrderId,
          warehouseId: warehouseId || undefined,
          vehicleNumber,
          driverName,
          receivedBy,
          checkedBy,
          notes,
          items: items.map((l) => ({
            purchaseOrderItemId: l.purchaseOrderItemId,
            productId: l.productId,
            quantity: l.orderedQty,
            acceptedQty: l.acceptedQty,
            unitPrice: l.unitPrice,
            batchNumber: l.batchNumber || undefined,
            expiryDate: l.expiryDate || undefined,
          })),
        });
        setSuccess('GRN created');
      }
      setDialogOpen(false);
      resetDialog();
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || (editingGrn ? 'Failed to update GRN' : 'Failed to create GRN'));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async (grn: GRN) => {
    setActionId(grn.id);
    try {
      await api.post(`/purchase/grns/${grn.id}/confirm`);
      setSuccess(grn.warehouse ? 'GRN confirmed — stock updated' : 'GRN confirmed — stock updated (default warehouse)');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to confirm GRN');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (grn: GRN) => {
    if (grn.status === 'CONFIRMED') {
      const reason = window.prompt(`GRN ${grn.documentNumber} is confirmed and cannot be deleted. Enter a reason to REVERSE it (stock is restored, document kept as CANCELLED):`);
      if (!reason) return;
      try {
        await api.post(`/purchase/grns/${grn.id}/reverse`, { reason });
        window.location.reload();
      } catch (e: unknown) {
        window.alert((e as { response?: { data?: { error?: string } } }).response?.data?.error || 'Reversal failed');
      }
      return;
    }
    if (!window.confirm(`Delete GRN ${grn.documentNumber}?`)) return;
    setActionId(grn.id);
    try {
      await api.delete(`/purchase/grns/${grn.id}`);
      setSuccess('GRN deleted');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to delete GRN');
    } finally {
      setActionId(null);
    }
  };

  const vendorOrders = orders.filter(
    (o) =>
      o.vendorId === vendorId
      && ['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(o.status)
      && o.hasRemaining !== false,
  );

  const columns: GridColDef[] = [
    { field: 'documentNumber', headerName: 'Number', width: 160, valueGetter: (_, row) => displayDocumentNumber((row as GRN).documentNumber) },
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (v) => formatDateDDMMYYYY(v as string) },
    { field: 'vendor', headerName: 'Vendor', flex: 1, valueGetter: (_, row) => (row as GRN).vendor?.name },
    { field: 'warehouse', headerName: 'Warehouse', width: 130, valueGetter: (_, row) => (row as GRN).warehouse?.name || '-' },
    { field: 'vehicleNumber', headerName: 'Vehicle', width: 110 },
    { field: 'driverName', headerName: 'Driver', width: 120 },
    { field: 'status', headerName: 'Status', width: 120, renderCell: ({ value }) => <StatusChip status={value as string} /> },
    {
      field: 'actions', headerName: 'Actions', width: 230, sortable: false,
      renderCell: ({ row }) => {
        const grn = row as GRN;
        const busy = actionId === grn.id;
        const canEdit = !grn.isInvoiced;
        return (
          <Box>
            <IconButton size="small" title="View" disabled={busy} onClick={() => openView(grn)}>
              {busy ? <CircularProgress size={16} /> : <Visibility fontSize="small" />}
            </IconButton>
            {canEdit && (
              <IconButton size="small" title="Edit" disabled={busy} onClick={() => openEdit(grn)}>
                <Edit fontSize="small" />
              </IconButton>
            )}
            <IconButton size="small" title="Download PDF" disabled={busy} onClick={() => handleDownload(grn)}>
              <PictureAsPdf fontSize="small" color="error" />
            </IconButton>
            <IconButton size="small" title="Print" disabled={busy} onClick={() => handlePrint(grn)}>
              <Print fontSize="small" />
            </IconButton>
            {grn.status === 'DRAFT' && (
              <IconButton size="small" title="Confirm" color="primary" disabled={busy} onClick={() => handleConfirm(grn)}>
                <CheckCircle fontSize="small" />
              </IconButton>
            )}
            <IconButton size="small" title="Delete" color="error" disabled={busy} onClick={() => handleDelete(grn)}>
              <Delete fontSize="small" />
            </IconButton>
          </Box>
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader title="GRN" subtitle="Goods received notes" actionLabel="New GRN"
        onAction={openCreate} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <DocumentTable rows={grns} columns={columns} loading={loading} />

      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); resetDialog(); }} maxWidth="lg" fullWidth>
        <form onSubmit={handleSave}>
          <DialogTitle>{isEditing ? `Edit GRN — ${displayDocumentNumber(editingGrn!.documentNumber)}` : 'New GRN'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  options={
                    editingGrn?.vendor && !vendors.some((v) => v.id === editingGrn.vendor.id)
                      ? [editingGrn.vendor as Vendor, ...vendors]
                      : vendors
                  }
                  getOptionLabel={(v) => `${v.code} - ${v.name}`}
                  value={
                    (editingGrn?.vendor && vendorId === editingGrn.vendor.id
                      ? editingGrn.vendor as Vendor
                      : null)
                    || vendors.find((v) => v.id === vendorId)
                    || null
                  }
                  onChange={(_, val) => {
                    if (isEditing) return;
                    setVendorId(val?.id || '');
                    setPurchaseOrderId('');
                    setReceiveLines([]);
                  }}
                  disabled={isEditing}
                  renderInput={(params) => <TextField {...params} required label="Vendor" />} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DocumentDateField label="Goods Received Date" value={date} onChange={setDate} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required select label="Purchase Order" value={purchaseOrderId}
                  disabled={isEditing}
                  onChange={(e) => {
                    const id = e.target.value;
                    setPurchaseOrderId(id);
                    void loadPoLines(id);
                  }}
                  helperText={isEditing ? undefined : 'PO remains available until all items are fully received'}>
                  <MenuItem value="">Select PO</MenuItem>
                  {isEditing && editingGrn?.purchaseOrder ? (
                    <MenuItem value={editingGrn.purchaseOrder.id}>
                      {displayDocumentNumber(editingGrn.purchaseOrder.documentNumber)}
                    </MenuItem>
                  ) : (
                    vendorOrders.map((o) => (
                      <MenuItem key={o.id} value={o.id}>{displayDocumentNumber(o.documentNumber)}</MenuItem>
                    ))
                  )}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required select label="Warehouse" value={warehouseId}
                  disabled={!qtyEditable}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  helperText={qtyEditable ? 'Required — stock levels update when GRN is confirmed' : 'Warehouse locked after confirm'}>
                  <MenuItem value="">Select warehouse</MenuItem>
                  {warehouses.map((w) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Vehicle Number" value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Driver Name" value={driverName}
                  onChange={(e) => setDriverName(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Received By" value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Checked By" value={checkedBy}
                  onChange={(e) => setCheckedBy(e.target.value)} />
              </Grid>
              {isEditing && (
                <Grid item xs={12}>
                  <TextField fullWidth label="Notes" value={notes}
                    onChange={(e) => setNotes(e.target.value)} />
                </Grid>
              )}
            </Grid>

            <Typography variant="subtitle2" sx={{ mb: 1 }}>Receive Quantities</Typography>
            {loadingPo ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} /></Box>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell align="center">UOM</TableCell>
                      <TableCell align="right">Ordered Qty</TableCell>
                      <TableCell align="right">Available</TableCell>
                      <TableCell align="right">Receive Qty</TableCell>
                      <TableCell>Batch / Lot</TableCell>
                      <TableCell>Expiry</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {receiveLines.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <Typography variant="body2" color="text.secondary">
                            Select a purchase order to load remaining items
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : receiveLines.map((l, i) => (
                      <TableRow key={l.id || l.purchaseOrderItemId}>
                        <TableCell>{l.productName}</TableCell>
                        <TableCell align="center">{l.unit || '-'}</TableCell>
                        <TableCell align="right">{fmtMoney(l.orderedQty)}</TableCell>
                        <TableCell align="right">{fmtMoney(l.remaining)}</TableCell>
                        <TableCell align="right">
                          {qtyEditable ? (
                            <NumberField
                              value={l.acceptedQty}
                              onChange={(v) => {
                                const updated = [...receiveLines];
                                updated[i] = { ...updated[i], acceptedQty: Math.min(Math.max(0, v), l.remaining) };
                                setReceiveLines(updated);
                              }}
                            />
                          ) : (
                            fmtMoney(l.acceptedQty)
                          )}
                        </TableCell>
                        <TableCell>
                          <TextField size="small" placeholder="Batch no." value={l.batchNumber ?? ''} disabled={!!l.id}
                            onChange={(e) => { const u = [...receiveLines]; u[i] = { ...u[i], batchNumber: e.target.value }; setReceiveLines(u); }} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type="date" value={l.expiryDate ?? ''} disabled={!!l.id}
                            onChange={(e) => { const u = [...receiveLines]; u[i] = { ...u[i], expiryDate: e.target.value }; setReceiveLines(u); }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setDialogOpen(false); resetDialog(); }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving || receiveLines.every((l) => l.acceptedQty <= 0)}>
              {saving ? <CircularProgress size={20} /> : isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <DocumentViewDialog
        open={viewOpen}
        onClose={() => { setViewOpen(false); setViewGrn(null); }}
        title="Goods Received Note"
        variant="qtyOnly"
        busy={pdfBusy}
        onDownload={viewGrn ? () => handleDownload(viewGrn) : undefined}
        onPrint={viewGrn ? () => handlePrint(viewGrn) : undefined}
        document={viewGrn ? {
          documentNumber: displayDocumentNumber(viewGrn.documentNumber),
          date: viewGrn.date,
          status: viewGrn.status,
          notes: viewGrn.notes,
          partyName: viewGrn.vendor?.name,
          partyLabel: 'Supplier',
          partyAddress: viewGrn.vendor?.address,
          partyVatNumber: viewGrn.vendor?.vatNumber,
          partyPhone: viewGrn.vendor?.phone,
          partyEmail: viewGrn.vendor?.email,
          items: (viewGrn.items || []).map((i) => ({
            description: i.description || i.product?.name,
            quantity: qtyOut(i.acceptedQty ?? i.quantity),
            unit: i.product?.unit,
            product: i.product,
          })),
        } : null}
        extraFields={[
          ...(viewGrn?.purchaseOrder?.documentNumber
            ? [{ label: 'Purchase Order', value: displayDocumentNumber(viewGrn.purchaseOrder.documentNumber) }]
            : []),
          ...(viewGrn?.warehouse?.name ? [{ label: 'Warehouse', value: viewGrn.warehouse.name }] : []),
          ...(viewGrn?.vehicleNumber ? [{ label: 'Vehicle', value: viewGrn.vehicleNumber }] : []),
          ...(viewGrn?.driverName ? [{ label: 'Driver', value: viewGrn.driverName }] : []),
          ...(viewGrn?.receivedBy ? [{ label: 'Received By', value: viewGrn.receivedBy }] : []),
          ...(viewGrn?.checkedBy ? [{ label: 'Checked By', value: viewGrn.checkedBy }] : []),
        ]}
      />
    </Box>
  );
}
