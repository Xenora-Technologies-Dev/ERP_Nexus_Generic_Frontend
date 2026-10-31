import { useEffect, useState, FormEvent } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Alert, CircularProgress, Grid, IconButton, Switch, FormControlLabel,
  MenuItem,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { Edit, Delete } from '@mui/icons-material';
import { api } from '../../api/client';
import { apiError } from '../../utils/apiError';
import { EMIRATES, isValidTrn, UAE_TRN_HINT } from '../../utils/uae';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable from '../../components/common/DocumentTable';

interface Vendor {
  id: string;
  code: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  vatNumber?: string;
  emirate?: string | null;
  isForeign?: boolean;
  currency?: string;
  paymentTerms: number;
  isActive: boolean;
}

const emptyForm = {
  code: '', name: '', contactPerson: '', email: '', phone: '', address: '',
  city: '', state: '', country: '', postalCode: '', vatNumber: '', emirate: '', isForeign: false, currency: 'AED',
  paymentTerms: 30, isActive: true,
};

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchVendors = () => {
    setLoading(true);
    api.get<Vendor[]>('/vendors', { params: { search: search || undefined } })
      .then((res) => setVendors(res.data))
      .catch(() => setError('Failed to load vendors'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchVendors(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (vendor: Vendor) => {
    setEditing(vendor);
    setForm({
      code: vendor.code, name: vendor.name, contactPerson: vendor.contactPerson || '',
      email: vendor.email || '', phone: vendor.phone || '', address: vendor.address || '',
      city: vendor.city || '', state: vendor.state || '', country: vendor.country || '',
      postalCode: vendor.postalCode || '', vatNumber: vendor.vatNumber || '', emirate: vendor.emirate || '', isForeign: Boolean(vendor.isForeign), currency: vendor.currency || 'AED',
      paymentTerms: vendor.paymentTerms, isActive: vendor.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.isForeign && !form.emirate) {
      setError('Select the emirate. It is stored as the vendor’s place of supply.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        emirate: form.isForeign ? null : form.emirate,
        code: editing ? form.code : (form.code.trim() || undefined),
      };
      if (editing) {
        await api.put(`/vendors/${editing.id}`, payload);
      } else {
        await api.post('/vendors', payload);
      }
      setDialogOpen(false);
      fetchVendors();
    } catch (err: unknown) {
      setError(apiError(err, 'Failed to save vendor'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this vendor?')) return;
    try {
      await api.delete(`/vendors/${id}`);
      fetchVendors();
    } catch {
      setError('Failed to deactivate vendor');
    }
  };

  const columns: GridColDef[] = [
    { field: 'code', headerName: 'Code', width: 100 },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 150 },
    { field: 'phone', headerName: 'Phone', width: 130 },
    {
      field: 'emirate', headerName: 'Emirate', width: 150,
      valueGetter: (_, row) => EMIRATES.find((e) => e.value === (row as Vendor).emirate)?.label || ((row as Vendor).isForeign ? 'Outside UAE' : ''),
    },
    { field: 'paymentTerms', headerName: 'Payment Terms', width: 130, type: 'number' },
    {
      field: 'isActive', headerName: 'Active', width: 80,
      renderCell: ({ value }) => (value ? 'Yes' : 'No'),
    },
    {
      field: 'actions', headerName: 'Actions', width: 100, sortable: false,
      renderCell: ({ row }) => (
        <Box>
          <IconButton size="small" onClick={() => openEdit(row as Vendor)}><Edit fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><Delete fontSize="small" /></IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader title="Vendors" subtitle="Manage supplier accounts" actionLabel="Add Vendor" onAction={openCreate} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField size="small" label="Search" value={search}
          onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 200 }} />
        <Button variant="outlined" onClick={fetchVendors}>Search</Button>
      </Box>

      <DocumentTable rows={vendors} columns={columns} loading={loading} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSave}>
          <DialogTitle>{editing ? 'Edit Vendor' : 'New Vendor'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required={!!editing}
                  disabled={!!editing}
                  placeholder={editing ? undefined : 'Leave blank to auto-generate'}
                  helperText={editing ? 'Supplier ID' : 'Auto-generated as VEND-YYYY-MM001 (e.g. VEND-2026-07001) if left blank'}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required label="Name" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Contact Person" value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Email" type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Phone" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label={form.isForeign ? 'Tax / VAT ID' : 'TRN (15 digits)'} value={form.vatNumber}
                  error={Boolean(form.vatNumber) && !form.isForeign && !isValidTrn(form.vatNumber)}
                  helperText={form.isForeign
                    ? 'Foreign tax ID — the UAE TRN format does not apply'
                    : Boolean(form.vatNumber) && !isValidTrn(form.vatNumber)
                      ? `UAE TRN must be ${UAE_TRN_HINT}`
                      : UAE_TRN_HINT}
                  onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField select fullWidth required={!form.isForeign} label="Emirate" value={form.emirate} disabled={form.isForeign}
                  error={!form.isForeign && !form.emirate}
                  helperText={form.isForeign
                    ? 'Not used for parties outside the UAE'
                    : 'Required. Choose one of the seven emirates.'}
                  onChange={(e) => setForm({ ...form, emirate: e.target.value })}>
                  <MenuItem value="" disabled>Select emirate</MenuItem>
                  {EMIRATES.map((em) => <MenuItem key={em.value} value={em.value}>{em.label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel label="Outside UAE (foreign)"
                  control={<Switch checked={form.isForeign} onChange={(e) => setForm({ ...form, isForeign: e.target.checked, emirate: e.target.checked ? '' : form.emirate })} />} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Default currency" value={form.currency}
                  inputProps={{ maxLength: 3 }} helperText="ISO code; new invoices default to this (AED = base)"
                  onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Address" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label="City" value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label="State" value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label="Country" value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label="Postal Code" value={form.postalCode}
                  onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label="Payment Terms (days)" type="number" value={form.paymentTerms}
                  onChange={(e) => setForm({ ...form, paymentTerms: parseInt(e.target.value) || 0 })} />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
                  label="Active"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={20} /> : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
