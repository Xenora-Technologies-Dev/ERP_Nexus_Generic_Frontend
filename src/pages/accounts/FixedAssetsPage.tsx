import { useEffect, useState, FormEvent } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Alert, CircularProgress, Grid, MenuItem, Typography,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { Add } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable from '../../components/common/DocumentTable';
import { NumberField } from '../../components/common/LineItemsForm';

interface CoaOption { id: string; code: string; name: string; accountType: string; }
interface AssetTypeOption { value: string; label: string; }

interface FixedAsset {
  id: string;
  assetCode: string;
  name: string;
  assetType: string;
  purchaseDate: string;
  supplier?: string;
  purchaseValue: number;
  currentValue: number;
  usefulLifeMonths?: number;
  location?: string;
  status: string;
  coaAccount: { code: string; name: string };
}

const formatAed = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FixedAssetsPage() {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [coaAccounts, setCoaAccounts] = useState<CoaOption[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', assetType: 'FURNITURE', purchaseDate: new Date().toISOString().slice(0, 10),
    supplier: '', invoiceReference: '', purchaseValue: 0, usefulLifeMonths: 60,
    residualValue: 0, location: '', coaAccountId: '', paymentMethod: 'BANK_TRANSFER', notes: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [a, coa, meta] = await Promise.all([
        api.get<FixedAsset[]>('/accounts/fixed-assets'),
        api.get<CoaOption[]>('/accounts/chart-of-accounts'),
        api.get<{ assetTypes: AssetTypeOption[] }>('/accounts/fixed-assets/meta'),
      ]);
      setAssets(a.data);
      setCoaAccounts(coa.data.filter((a) => {
        const n = parseInt(a.code, 10);
        return n >= 1501 && n <= 1504;
      }));
      setAssetTypes(meta.data.assetTypes);
    } catch {
      setError('Failed to load fixed assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/accounts/fixed-assets', form);
      setDialogOpen(false);
      setSuccess('Fixed asset registered and journal posted');
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create fixed asset');
    } finally {
      setSaving(false);
    }
  };

  const cols: GridColDef[] = [
    { field: 'assetCode', headerName: 'Code', width: 120 },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 140 },
    { field: 'assetType', headerName: 'Type', width: 130 },
    { field: 'purchaseDate', headerName: 'Purchased', width: 110, valueFormatter: (v) => new Date(v as string).toLocaleDateString() },
    { field: 'coaAccount', headerName: 'GL Account', width: 160, valueGetter: (_, r) => `${(r as FixedAsset).coaAccount.code} ${(r as FixedAsset).coaAccount.name}` },
    { field: 'purchaseValue', headerName: 'Cost', width: 110, valueFormatter: (v) => formatAed(v as number) },
    { field: 'currentValue', headerName: 'Book Value', width: 110, valueFormatter: (v) => formatAed(v as number) },
    { field: 'status', headerName: 'Status', width: 100 },
  ];

  return (
    <Box>
      <PageHeader title="Fixed Assets" subtitle="Asset register with automatic GL posting" actionLabel="Register Asset" onAction={() => setDialogOpen(true)} />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      <DocumentTable rows={assets} columns={cols} loading={loading} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>Register Fixed Asset</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required label="Asset Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required select label="Asset Type" value={form.assetType} onChange={(e) => setForm({ ...form, assetType: e.target.value })}>
                  {assetTypes.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required select label="GL Asset Account" value={form.coaAccountId} onChange={(e) => setForm({ ...form, coaAccountId: e.target.value })}>
                  <MenuItem value="">Select</MenuItem>
                  {coaAccounts.map((c) => <MenuItem key={c.id} value={c.id}>{c.code} — {c.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required label="Purchase Date" type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>Purchase Value (AED)</Typography>
                <NumberField value={form.purchaseValue} onChange={(v) => setForm({ ...form, purchaseValue: v })} width={160} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Useful Life (months)" type="number" value={form.usefulLifeMonths} onChange={(e) => setForm({ ...form, usefulLifeMonths: parseInt(e.target.value, 10) || 0 })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Supplier" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Invoice Reference" value={form.invoiceReference} onChange={(e) => setForm({ ...form, invoiceReference: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth select label="Payment" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                  <MenuItem value="BANK_TRANSFER">Bank</MenuItem>
                  <MenuItem value="CASH">Cash</MenuItem>
                  <MenuItem value="ACCOUNTS_PAYABLE">Accounts Payable</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving || !form.coaAccountId} startIcon={saving ? <CircularProgress size={18} /> : <Add />}>
              Register & Post Journal
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
