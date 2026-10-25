import { fmtMoney, money, parseInput } from '../../utils/money';
import { useEffect, useState, FormEvent, SyntheticEvent } from 'react';
import {
  Box, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Button, Alert, CircularProgress, Grid, IconButton, Typography, Table, TableHead,
  TableBody, TableRow, TableCell, TableContainer, Paper, Divider,
  MenuItem,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { Edit, Visibility } from '@mui/icons-material';
import { api } from '../../api/client';
import { TAX_CODE_OPTIONS } from '../../utils/uae';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable from '../../components/common/DocumentTable';

interface Category { id: string; name: string; }
interface Warehouse { id: string; name: string; code: string; address?: string; isActive: boolean; }
interface Product {
  id: string; sku: string; name: string; description?: string; categoryId?: string;
  unit: string; costPrice: number; sellingPrice: number; vatRate: number; taxCode?: string | null;
  countryOfOrigin?: string | null; isActive: boolean; category?: Category; trackBatches?: boolean;
}
interface StockItem {
  id: string; quantity: number;
  product: { name: string; sku: string };
  warehouse: { name: string; code: string };
}
interface HistoryItem {
  type: 'SALE' | 'PURCHASE';
  documentNumber: string;
  partyName: string;
  date: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

const emptyProduct = {
  sku: '', name: '', description: '', categoryId: '', unit: 'PCS',
  costPrice: 0, sellingPrice: 0, vatRate: 5, taxCode: 'SR', countryOfOrigin: '', isActive: true, trackBatches: false,
};

export default function InventoryPage() {
  const [tab, setTab] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'product' | 'category' | 'warehouse'>('product');
  const [editing, setEditing] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [categoryName, setCategoryName] = useState('');
  const [warehouseForm, setWarehouseForm] = useState({ name: '', code: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [viewHistory, setViewHistory] = useState<{ sales: HistoryItem[]; purchases: HistoryItem[] } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyMonths, setHistoryMonths] = useState(12);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [p, c, w, s] = await Promise.all([
        api.get<Product[]>('/inventory/products'),
        api.get<Category[]>('/inventory/categories'),
        api.get<Warehouse[]>('/inventory/warehouses'),
        api.get<StockItem[]>('/inventory/stock'),
      ]);
      setProducts(p.data);
      setCategories(c.data);
      setWarehouses(w.data);
      setStock(s.data);
    } catch {
      setError('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (productId: string, months: number) => {
    setHistoryLoading(true);
    try {
      const res = await api.get<{ sales: HistoryItem[]; purchases: HistoryItem[] }>(
        `/inventory/products/${productId}/history`, { params: { months } }
      );
      setViewHistory(res.data);
    } catch {
      setError('Failed to load product history');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openProductDialog = (product?: Product) => {
    setDialogType('product');
    setEditing(product || null);
    if (product) {
      setProductForm({
        sku: product.sku, name: product.name, description: product.description || '',
        categoryId: product.categoryId || '', unit: product.unit,
        costPrice: money(product.costPrice), sellingPrice: money(product.sellingPrice),
        vatRate: money(product.vatRate), taxCode: product.taxCode || 'SR', countryOfOrigin: product.countryOfOrigin || '',
        isActive: product.isActive, trackBatches: !!product.trackBatches,
      });
    } else {
      setProductForm(emptyProduct);
    }
    setDialogOpen(true);
  };

  const openProductView = async (product: Product) => {
    setViewProduct(product);
    setHistoryMonths(12);
    await fetchHistory(product.id, 12);
  };

  const openCategoryDialog = () => {
    setDialogType('category');
    setCategoryName('');
    setDialogOpen(true);
  };

  const openWarehouseDialog = () => {
    setDialogType('warehouse');
    setWarehouseForm({ name: '', code: '', address: '' });
    setDialogOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (dialogType === 'product') {
        const payload = {
          ...productForm,
          categoryId: productForm.categoryId || null,
          countryOfOrigin: productForm.countryOfOrigin || null,
          sku: productForm.sku || undefined,
        };
        if (!editing && !payload.categoryId) {
          setError('Category is required for new products (SKU auto-generated)');
          setSaving(false);
          return;
        }
        if (editing) {
          await api.put(`/inventory/products/${editing.id}`, payload);
        } else {
          await api.post('/inventory/products', payload);
        }
      } else if (dialogType === 'category') {
        await api.post('/inventory/categories', { name: categoryName });
      } else {
        await api.post('/inventory/warehouses', warehouseForm);
      }
      setDialogOpen(false);
      fetchAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleTabChange = (_: SyntheticEvent, v: number) => setTab(v);

  const getAction = () => {
    if (tab === 0) return { label: 'Add Product', action: () => openProductDialog() };
    if (tab === 1) return { label: 'Add Category', action: openCategoryDialog };
    if (tab === 2) return { label: 'Add Warehouse', action: openWarehouseDialog };
    return null;
  };

  const action = getAction();

  const recentHistory = viewHistory ? [
    ...viewHistory.sales.map((h) => ({ ...h, type: 'SALE' as const })),
    ...viewHistory.purchases.map((h) => ({ ...h, type: 'PURCHASE' as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5) : [];

  const productCols: GridColDef[] = [
    { field: 'sku', headerName: 'SKU', width: 110 },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'category', headerName: 'Category', width: 130, valueGetter: (_, row) => (row as Product).category?.name || '-' },
    { field: 'countryOfOrigin', headerName: 'Origin', width: 100, valueGetter: (_, row) => (row as Product).countryOfOrigin || '-' },
    { field: 'sellingPrice', headerName: 'Sell Price', width: 100, type: 'number' },
    { field: 'costPrice', headerName: 'Cost Price', width: 100, type: 'number' },
    {
      field: 'actions', headerName: '', width: 90, sortable: false,
      renderCell: ({ row }) => (
        <Box>
          <IconButton size="small" onClick={() => openProductView(row as Product)} title="View">
            <Visibility fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => openProductDialog(row as Product)} title="Edit">
            <Edit fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  const categoryCols: GridColDef[] = [
    { field: 'name', headerName: 'Category Name', flex: 1 },
  ];

  const warehouseCols: GridColDef[] = [
    { field: 'code', headerName: 'Code', width: 100 },
    { field: 'name', headerName: 'Name', flex: 1 },
    { field: 'address', headerName: 'Address', flex: 1 },
  ];

  const stockCols: GridColDef[] = [
    { field: 'sku', headerName: 'SKU', width: 110, valueGetter: (_, row) => (row as StockItem).product.sku },
    { field: 'product', headerName: 'Product', flex: 1, valueGetter: (_, row) => (row as StockItem).product.name },
    { field: 'warehouse', headerName: 'Warehouse', width: 150, valueGetter: (_, row) => (row as StockItem).warehouse.name },
    { field: 'quantity', headerName: 'Qty', width: 100, type: 'number' },
  ];

  return (
    <Box>
      <PageHeader
        title="Inventory"
        subtitle="Products, categories, warehouses and stock"
        actionLabel={action?.label}
        onAction={action?.action}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
        <Tab label="Products" />
        <Tab label="Categories" />
        <Tab label="Warehouses" />
        <Tab label="Stock Levels" />
      </Tabs>

      {tab === 0 && <DocumentTable rows={products} columns={productCols} loading={loading} />}
      {tab === 1 && <DocumentTable rows={categories} columns={categoryCols} loading={loading} />}
      {tab === 2 && <DocumentTable rows={warehouses} columns={warehouseCols} loading={loading} />}
      {tab === 3 && <DocumentTable rows={stock} columns={stockCols} loading={loading} />}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSave}>
          <DialogTitle>
            {dialogType === 'product' ? (editing ? 'Edit Product' : 'New Product') :
              dialogType === 'category' ? 'New Category' : 'New Warehouse'}
          </DialogTitle>
          <DialogContent>
            {dialogType === 'product' && (
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="SKU" value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    helperText={editing ? 'SKU' : 'Leave blank to auto-generate from category'}
                    disabled={!!editing} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth required label="Name" value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth label="Description" value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth required={!editing} select label="Category" value={productForm.categoryId}
                    onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                    SelectProps={{ native: true }}>
                    <option value="">Select category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Unit" value={productForm.unit}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Country of Origin" value={productForm.countryOfOrigin}
                    onChange={(e) => setProductForm({ ...productForm, countryOfOrigin: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth select label="Batch / expiry tracking" value={productForm.trackBatches ? 'yes' : 'no'}
                    SelectProps={{ native: true }}
                    onChange={(e) => setProductForm({ ...productForm, trackBatches: e.target.value === 'yes' })}>
                    <option value="no">Not tracked</option>
                    <option value="yes">Track batches + expiry (FEFO)</option>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Cost Price" type="number" value={productForm.costPrice}
                    onChange={(e) => setProductForm({ ...productForm, costPrice: parseInput(e.target.value) })} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Selling Price" type="number" value={productForm.sellingPrice}
                    onChange={(e) => setProductForm({ ...productForm, sellingPrice: parseInput(e.target.value) })} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="VAT %" type="number" value={productForm.vatRate}
                    onChange={(e) => setProductForm({ ...productForm, vatRate: parseInput(e.target.value) })} />
                </Grid>
                <Grid item xs={12} sm={8}>
                  <TextField select fullWidth label="Default UAE tax code" value={productForm.taxCode}
                    helperText="Applied to invoice lines unless the document overrides it"
                    onChange={(e) => setProductForm({ ...productForm, taxCode: e.target.value })}>
                    {TAX_CODE_OPTIONS.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                  </TextField>
                </Grid>
              </Grid>
            )}
            {dialogType === 'category' && (
              <TextField fullWidth required label="Category Name" value={categoryName} sx={{ mt: 1 }}
                onChange={(e) => setCategoryName(e.target.value)} />
            )}
            {dialogType === 'warehouse' && (
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth required label="Code" value={warehouseForm.code}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth required label="Name" value={warehouseForm.name}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth label="Address" value={warehouseForm.address}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })} />
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={20} /> : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={!!viewProduct} onClose={() => { setViewProduct(null); setViewHistory(null); }} maxWidth="md" fullWidth>
        <DialogTitle>Product Details — {viewProduct?.sku}</DialogTitle>
        <DialogContent>
          {viewProduct && (
            <>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Name</Typography><Typography>{viewProduct.name}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Category</Typography><Typography>{viewProduct.category?.name || '-'}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Unit</Typography><Typography>{viewProduct.unit}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Country of Origin</Typography><Typography>{viewProduct.countryOfOrigin || '-'}</Typography></Grid>
                <Grid item xs={4}><Typography variant="caption" color="text.secondary">Cost</Typography><Typography>{fmtMoney(viewProduct.costPrice)}</Typography></Grid>
                <Grid item xs={4}><Typography variant="caption" color="text.secondary">Sell Price</Typography><Typography>{fmtMoney(viewProduct.sellingPrice)}</Typography></Grid>
                <Grid item xs={4}><Typography variant="caption" color="text.secondary">VAT %</Typography><Typography>{viewProduct.vatRate}%</Typography></Grid>
                {viewProduct.description && (
                  <Grid item xs={12}><Typography variant="caption" color="text.secondary">Description</Typography><Typography>{viewProduct.description}</Typography></Grid>
                )}
              </Grid>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>Recent Sales & Purchases</Typography>
                <Button size="small" onClick={() => setHistoryModalOpen(true)}>View More</Button>
              </Box>
              {historyLoading ? <CircularProgress size={24} /> : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Document</TableCell>
                        <TableCell>Party</TableCell>
                        <TableCell align="right">Qty</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentHistory.length === 0 ? (
                        <TableRow><TableCell colSpan={6} align="center">No history</TableCell></TableRow>
                      ) : recentHistory.map((h, i) => (
                        <TableRow key={i}>
                          <TableCell>{new Date(h.date).toLocaleDateString()}</TableCell>
                          <TableCell>{h.type}</TableCell>
                          <TableCell>{h.documentNumber}</TableCell>
                          <TableCell>{h.partyName}</TableCell>
                          <TableCell align="right">{fmtMoney(h.quantity)}</TableCell>
                          <TableCell align="right">{fmtMoney(h.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setViewProduct(null); setViewHistory(null); }}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={historyModalOpen} onClose={() => setHistoryModalOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Full Product History — {viewProduct?.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
            <TextField size="small" select label="Period (months)" value={historyMonths}
              onChange={(e) => {
                const m = parseInt(e.target.value);
                setHistoryMonths(m);
                if (viewProduct) fetchHistory(viewProduct.id, m);
              }}
              SelectProps={{ native: true }} sx={{ width: 160 }}>
              {[3, 6, 12, 24, 36].map((m) => <option key={m} value={m}>{m} months</option>)}
            </TextField>
          </Box>
          {historyLoading ? <CircularProgress /> : viewHistory && (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Document</TableCell>
                    <TableCell>Party</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Unit Price</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[
                    ...viewHistory.sales.map((h) => ({ ...h, type: 'SALE' as const })),
                    ...viewHistory.purchases.map((h) => ({ ...h, type: 'PURCHASE' as const })),
                  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((h, i) => (
                    <TableRow key={i}>
                      <TableCell>{new Date(h.date).toLocaleDateString()}</TableCell>
                      <TableCell>{h.type}</TableCell>
                      <TableCell>{h.documentNumber}</TableCell>
                      <TableCell>{h.partyName}</TableCell>
                      <TableCell align="right">{fmtMoney(h.quantity)}</TableCell>
                      <TableCell align="right">{fmtMoney(h.unitPrice)}</TableCell>
                      <TableCell align="right">{fmtMoney(h.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
