import { D, fmtMoney, money, pos, qtyOut } from '../../utils/money';
import { useEffect, useState, FormEvent } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Alert, CircularProgress, Grid, Autocomplete, IconButton, Table, TableHead,
  TableBody, TableRow, TableCell, TableContainer, Paper, Typography,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { Visibility, Edit, Delete, PictureAsPdf, LocalShipping, CheckCircle, Cancel } from '@mui/icons-material';
import { api, displayDocumentNumber } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable, { StatusChip } from '../../components/common/DocumentTable';
import LineItemsForm, { LineItem, NumberField } from '../../components/common/LineItemsForm';
import DocumentDateField from '../../components/common/DocumentDateField';
import { todayISO, toInputDate, formatDateDDMMYYYY } from '../../utils/date';
import DocumentViewDialog from '../../components/common/DocumentViewDialog';

interface Customer { id: string; name: string; code: string; address?: string | null; vatNumber?: string | null; phone?: string | null; email?: string | null; }
interface Product {
  id: string; name: string; sku: string; sellingPrice: number;
  costPrice?: number; vatRate: number; unit?: string; countryOfOrigin?: string | null;
}
interface Warehouse { id: string; name: string; code: string; }
interface SalesOrderItem {
  id: string; productId: string; quantity: number; deliveredQty: number;
  unitPrice: number; vatRate: number; vatAmount?: number; total: number; costPrice?: number;
  description?: string; product?: Product;
}
interface SalesOrder {
  id: string; documentNumber: string; date: string; status: string;
  reference?: string | null; remarks?: string | null; discount?: number;
  customer: Customer; total: number; subtotal?: number; vatAmount?: number;
  vatApplicable: boolean; notes?: string; items?: SalesOrderItem[];
  deliveryNotes?: { id: string }[];
  hasRemaining?: boolean;
}

const downloadPdf = async (id: string, docNumber: string) => {
  const res = await api.get(`/sales/orders/${id}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${docNumber}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [viewOrder, setViewOrder] = useState<SalesOrder | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [discount, setDiscount] = useState(0);
  const [items, setItems] = useState<LineItem[]>([{ productId: '', quantity: 1, unitPrice: 0, vatRate: 5 }]);
  const [vatApplicable, setVatApplicable] = useState(true);
  const [notes, setNotes] = useState('');
  const [deliveryForm, setDeliveryForm] = useState({
    date: todayISO(), vehicleNumber: '', driverName: '', receivedBy: '', checkedBy: '', warehouseId: '', notes: '',
  });
  const [deliveryItems, setDeliveryItems] = useState<{
    salesOrderItemId: string;
    quantity: number;
    productName: string;
    unit?: string;
    orderedQty: number;
    remaining: number;
  }[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [o, c, p, w] = await Promise.all([
        api.get<SalesOrder[]>('/sales/orders'),
        api.get<Customer[]>('/customers', { params: { active: true } }),
        api.get<Product[]>('/inventory/products', { params: { active: true } }),
        api.get<Warehouse[]>('/inventory/warehouses'),
      ]);
      setOrders(o.data);
      setCustomers(c.data);
      setProducts(p.data.map((pr) => ({
        id: pr.id, name: pr.name, sku: pr.sku,
        sellingPrice: money(pr.sellingPrice), costPrice: money(pr.costPrice),
        vatRate: money(pr.vatRate), unit: pr.unit, countryOfOrigin: pr.countryOfOrigin,
      })));
      setWarehouses(w.data);
    } catch {
      setError('Failed to load sales orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setCustomerId('');
    setDate(todayISO());
    setReference('');
    setRemarks('');
    setDiscount(0);
    setItems([{ productId: '', quantity: 1, unitPrice: 0, vatRate: 5 }]);
    setVatApplicable(true);
    setNotes('');
    setEditingOrder(null);
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = async (order: SalesOrder) => {
    setActionId(order.id);
    try {
      const res = await api.get<SalesOrder>(`/sales/orders/${order.id}`);
      const full = res.data;
      setEditingOrder(full);
      setCustomerId(full.customer.id);
      setDate(toInputDate(full.date));
      setReference(full.reference || '');
      setRemarks(full.remarks || '');
      setDiscount(money(full.discount ?? 0));
      setVatApplicable(full.vatApplicable);
      setNotes(full.notes || '');
      setItems((full.items || []).map((i) => ({
        productId: i.productId,
        productName: i.product?.name,
        quantity: qtyOut(i.quantity),
        unitPrice: money(i.unitPrice),
        vatRate: money(i.vatRate),
        taxCode: (i as { taxCode?: string | null }).taxCode || undefined,
        unit: i.product?.unit,
        costPrice: money(i.costPrice ?? i.product?.costPrice ?? 0),
      })));
      setFormOpen(true);
    } catch {
      setError('Failed to load order details');
    } finally {
      setActionId(null);
    }
  };

  const openView = async (order: SalesOrder) => {
    setActionId(order.id);
    try {
      const res = await api.get<SalesOrder>(`/sales/orders/${order.id}`);
      setViewOrder(res.data);
      setViewOpen(true);
    } catch {
      setError('Failed to load order details');
    } finally {
      setActionId(null);
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      customerId, date, reference: reference || null, remarks: remarks || null,
      vatApplicable, discount, notes,
      items: items.filter((i) => i.productId).map((i) => ({
        productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: i.vatRate, taxCode: i.taxCode || undefined,
      })),
    };
    try {
      if (editingOrder) {
        await api.put(`/sales/orders/${editingOrder.id}`, payload);
        setSuccess('Sales order updated');
      } else {
        await api.post('/sales/orders', payload);
        setSuccess('Sales order created');
      }
      setFormOpen(false);
      resetForm();
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (order: SalesOrder) => {
    if (!window.confirm(`Delete order ${order.documentNumber}?`)) return;
    setActionId(order.id);
    try {
      await api.delete(`/sales/orders/${order.id}`);
      setSuccess('Order deleted');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to delete order');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (order: SalesOrder) => {
    if (!window.confirm(`Reject order ${order.documentNumber}?`)) return;
    setActionId(order.id);
    try {
      await api.post(`/sales/orders/${order.id}/reject`);
      setSuccess('Order rejected');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to reject order');
    } finally {
      setActionId(null);
    }
  };

  const handleApprove = async (order: SalesOrder) => {
    setActionId(order.id);
    try {
      await api.post(`/sales/orders/${order.id}/approve`);
      setSuccess('Order approved');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to approve order');
    } finally {
      setActionId(null);
    }
  };

  const handlePdf = async (order: SalesOrder) => {
    setActionId(order.id);
    try {
      await downloadPdf(order.id, order.documentNumber);
    } catch {
      setError('Failed to download PDF');
    } finally {
      setActionId(null);
    }
  };

  const openDelivery = async (order: SalesOrder) => {
    setActionId(order.id);
    try {
      const res = await api.get<SalesOrder>(`/sales/orders/${order.id}`);
      const full = res.data;
      setSelectedOrder(full);
      setDeliveryForm({ date: todayISO(), vehicleNumber: '', driverName: '', receivedBy: '', checkedBy: '', warehouseId: '', notes: '' });
      setDeliveryItems((full.items || []).map((i) => {
        const remaining = qtyOut(
          (i as SalesOrderItem & { remainingQty?: number }).remainingQty
          ?? qtyOut(pos(D(i.quantity).minus(D(i.deliveredQty)))),
        );
        return {
          salesOrderItemId: i.id,
          quantity: remaining,
          productName: i.product?.name || i.description || 'Item',
          unit: i.product?.unit,
          orderedQty: qtyOut(i.quantity),
          remaining,
        };
      }).filter((d) => d.remaining > 0));
      if ((full.items || []).every((i) => {
        const rem = qtyOut(
          (i as SalesOrderItem & { remainingQty?: number }).remainingQty
          ?? qtyOut(pos(D(i.quantity).minus(D(i.deliveredQty)))),
        );
        return rem <= 0;
      })) {
        setError('No remaining quantity to deliver on this order');
        return;
      }
      setDeliveryOpen(true);
    } catch {
      setError('Failed to load order for delivery');
    } finally {
      setActionId(null);
    }
  };

  const handleConvertDelivery = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    const items = deliveryItems.filter((d) => d.quantity > 0);
    if (items.length === 0) { setError('Enter deliver quantity for at least one item'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post(`/sales/orders/${selectedOrder.id}/convert-to-delivery`, {
        ...deliveryForm,
        warehouseId: deliveryForm.warehouseId || undefined,
        items: items.map((d) => ({
          salesOrderItemId: d.salesOrderItemId,
          quantity: d.quantity,
        })),
      });
      setDeliveryOpen(false);
      setSuccess('Delivery note created');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create delivery note');
    } finally {
      setSaving(false);
    }
  };

  const canEdit = (status: string) => status === 'DRAFT';
  const canDelete = (status: string) => ['DRAFT', 'CANCELLED'].includes(status);
  const canApprove = (status: string) => status === 'DRAFT';
  /** Show truck only while approved/partial and qty remains (confirmed + draft DNs counted). */
  const canDeliver = (order: SalesOrder) => {
    if (order.status === 'DELIVERED') return false;
    if (!['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(order.status)) return false;
    if (order.hasRemaining === false) return false;
    if (order.items?.length) {
      return order.items.some((i) => {
        const remaining = qtyOut(
          (i as SalesOrderItem & { remainingQty?: number }).remainingQty
          ?? qtyOut(pos(D(i.quantity).minus(D(i.deliveredQty)))),
        );
        return remaining > 0;
      });
    }
    return true;
  };

  const columns: GridColDef[] = [
    {
      field: 'documentNumber', headerName: 'Number', width: 160,
      valueGetter: (_, row) => displayDocumentNumber((row as SalesOrder).documentNumber),
    },
    { field: 'reference', headerName: 'Reference', width: 120, valueGetter: (_, row) => (row as SalesOrder).reference || '-' },
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (v) => formatDateDDMMYYYY(v as string) },
    { field: 'customer', headerName: 'Customer', flex: 1, valueGetter: (_, row) => (row as SalesOrder).customer?.name },
    { field: 'total', headerName: 'Total', width: 110, type: 'number' },
    { field: 'status', headerName: 'Status', width: 150, renderCell: ({ value }) => <StatusChip status={value as string} /> },
    {
      field: 'actions', headerName: 'Actions', width: 220, sortable: false,
      renderCell: ({ row }) => {
        const order = row as SalesOrder;
        const busy = actionId === order.id;
        return (
          <Box>
            <IconButton size="small" title="View" disabled={busy} onClick={() => openView(order)}>
              {busy ? <CircularProgress size={16} /> : <Visibility fontSize="small" />}
            </IconButton>
            {canApprove(order.status) && (
              <>
                <IconButton size="small" title="Approve" color="primary" onClick={() => handleApprove(order)}>
                  <CheckCircle fontSize="small" />
                </IconButton>
                <IconButton size="small" title="Reject" color="error" onClick={() => handleReject(order)}>
                  <Cancel fontSize="small" />
                </IconButton>
              </>
            )}
            {canEdit(order.status) && (
              <IconButton size="small" title="Edit" onClick={() => openEdit(order)}>
                <Edit fontSize="small" />
              </IconButton>
            )}
            {canDelete(order.status) && (
              <IconButton size="small" title="Delete" color="error" onClick={() => handleDelete(order)}>
                <Delete fontSize="small" />
              </IconButton>
            )}
            <IconButton size="small" title="Download PDF" onClick={() => handlePdf(order)}>
              <PictureAsPdf fontSize="small" color="error" />
            </IconButton>
            {canDeliver(order) && (
              <IconButton size="small" title="Convert to DN" onClick={() => openDelivery(order)}>
                <LocalShipping fontSize="small" color="primary" />
              </IconButton>
            )}
          </Box>
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader title="Sales Orders" subtitle="Manage sales orders" actionLabel="New Order" onAction={openCreate} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <DocumentTable rows={orders} columns={columns} loading={loading} />

      <Dialog open={formOpen} onClose={() => { setFormOpen(false); resetForm(); }} maxWidth="lg" fullWidth>
        <form onSubmit={handleSave}>
          <DialogTitle>{editingOrder ? 'Edit Sales Order' : 'New Sales Order'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <Autocomplete options={customers} getOptionLabel={(c) => `${c.code} - ${c.name}`}
                  value={customers.find((c) => c.id === customerId) || null}
                  onChange={(_, v) => setCustomerId(v?.id || '')}
                  renderInput={(params) => <TextField {...params} required label="Customer" />} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DocumentDateField value={date} onChange={setDate} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Reference" value={reference}
                  onChange={(e) => setReference(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Remarks" value={remarks}
                  onChange={(e) => setRemarks(e.target.value)} />
              </Grid>
            </Grid>
            <LineItemsForm products={products} items={items} onChange={setItems}
              vatApplicable={vatApplicable} onVatChange={setVatApplicable}
              showCost showDiscount discount={discount} onDiscountChange={setDiscount} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setFormOpen(false); resetForm(); }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={20} /> : editingOrder ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={deliveryOpen} onClose={() => setDeliveryOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleConvertDelivery}>
          <DialogTitle>Convert to Delivery Note — {selectedOrder?.documentNumber}</DialogTitle>
          <DialogContent>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Delivery Quantities</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Order stays available until all items are fully delivered. Available qty is reduced by prior deliveries.
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell align="center">UOM</TableCell>
                    <TableCell align="right">Ordered Qty</TableCell>
                    <TableCell align="right">Available</TableCell>
                    <TableCell align="right">Deliver Qty</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deliveryItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary">
                          No remaining quantity on this sales order
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : deliveryItems.map((d, i) => (
                    <TableRow key={d.salesOrderItemId}>
                      <TableCell>{d.productName}</TableCell>
                      <TableCell align="center">{d.unit || '-'}</TableCell>
                      <TableCell align="right">{fmtMoney(d.orderedQty)}</TableCell>
                      <TableCell align="right">{fmtMoney(d.remaining)}</TableCell>
                      <TableCell align="right">
                        <NumberField
                          value={d.quantity}
                          onChange={(v) => {
                            const updated = [...deliveryItems];
                            updated[i] = { ...updated[i], quantity: Math.min(Math.max(0, v), d.remaining) };
                            setDeliveryItems(updated);
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <DocumentDateField
                  label="Delivery Date"
                  value={deliveryForm.date}
                  onChange={(v) => setDeliveryForm({ ...deliveryForm, date: v })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Vehicle Number" value={deliveryForm.vehicleNumber}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, vehicleNumber: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Driver Name" value={deliveryForm.driverName}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, driverName: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth select label="Warehouse (optional)" value={deliveryForm.warehouseId}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, warehouseId: e.target.value })}
                  helperText="Optional — on confirm, stock posts to selected or default warehouse"
                  SelectProps={{ native: true }}>
                  <option value="">None (use default on confirm)</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Received By" value={deliveryForm.receivedBy}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, receivedBy: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Checked By" value={deliveryForm.checkedBy}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, checkedBy: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Notes" value={deliveryForm.notes}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeliveryOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving || deliveryItems.every((d) => d.quantity <= 0)}>
              {saving ? <CircularProgress size={20} /> : 'Create Delivery Note'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <DocumentViewDialog
        open={viewOpen}
        onClose={() => { setViewOpen(false); setViewOrder(null); }}
        title="Sales Order"
        document={viewOrder ? {
          documentNumber: displayDocumentNumber(viewOrder.documentNumber),
          date: viewOrder.date,
          status: viewOrder.status,
          reference: viewOrder.reference,
          remarks: viewOrder.remarks,
          notes: viewOrder.notes,
          partyName: viewOrder.customer?.name,
          partyLabel: 'Customer',
          partyAddress: viewOrder.customer?.address,
          partyVatNumber: viewOrder.customer?.vatNumber,
          partyPhone: viewOrder.customer?.phone,
          partyEmail: viewOrder.customer?.email,
          vatApplicable: viewOrder.vatApplicable,
          subtotal: viewOrder.subtotal,
          vatAmount: viewOrder.vatAmount,
          discount: viewOrder.discount,
          total: viewOrder.total,
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
