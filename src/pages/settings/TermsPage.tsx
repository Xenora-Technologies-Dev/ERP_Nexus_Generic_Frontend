import { useEffect, useState, FormEvent } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Alert, CircularProgress, Grid, IconButton, MenuItem, Chip,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { Edit, Delete, CheckCircle } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable from '../../components/common/DocumentTable';

interface Terms {
  id: string;
  name: string;
  documentType?: string | null;
  content: string;
  isActive: boolean;
}

const DOCUMENT_TYPES = [
  '', 'SALES_QUOTATION', 'SALES_ORDER', 'DELIVERY_NOTE', 'SALES_INVOICE',
  'CREDIT_NOTE', 'SALES_RETURN', 'PURCHASE_ORDER', 'GRN', 'PURCHASE_INVOICE',
  'DEBIT_NOTE', 'PURCHASE_RETURN',
];

const emptyForm = { name: '', documentType: '', content: '', isActive: false };

export default function TermsPage() {
  const [terms, setTerms] = useState<Terms[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Terms | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchTerms = () => {
    setLoading(true);
    api.get<Terms[]>('/documents/terms')
      .then((res) => setTerms(res.data))
      .catch(() => setError('Failed to load terms'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTerms(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (term: Terms) => {
    setEditing(term);
    setForm({
      name: term.name, documentType: term.documentType || '',
      content: term.content, isActive: term.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, documentType: form.documentType || null };
      if (editing) {
        await api.put(`/documents/terms/${editing.id}`, payload);
      } else {
        await api.post('/documents/terms', payload);
      }
      setDialogOpen(false);
      setSuccess('Terms saved');
      fetchTerms();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to save terms');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (id: string) => {
    setActionId(id);
    try {
      await api.post(`/documents/terms/${id}/activate`);
      setSuccess('Terms activated');
      fetchTerms();
    } catch {
      setError('Failed to activate terms');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete these terms?')) return;
    try {
      await api.delete(`/documents/terms/${id}`);
      setSuccess('Terms deleted');
      fetchTerms();
    } catch {
      setError('Failed to delete terms');
    }
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'documentType', headerName: 'Document Type', width: 160, valueFormatter: (v) => (v as string) || 'All' },
    {
      field: 'content', headerName: 'Content', flex: 2, minWidth: 200,
      renderCell: ({ value }) => (
        <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value as string}</Box>
      ),
    },
    {
      field: 'isActive', headerName: 'Status', width: 100,
      renderCell: ({ value }) => value
        ? <Chip label="Active" size="small" color="success" />
        : <Chip label="Inactive" size="small" />,
    },
    {
      field: 'actions', headerName: '', width: 120, sortable: false,
      renderCell: ({ row }) => {
        const t = row as Terms;
        return (
          <Box>
            <IconButton size="small" onClick={() => openEdit(t)}><Edit fontSize="small" /></IconButton>
            {!t.isActive && (
              <IconButton size="small" color="primary" title="Activate" disabled={actionId === t.id}
                onClick={() => handleActivate(t.id)}>
                <CheckCircle fontSize="small" />
              </IconButton>
            )}
            <IconButton size="small" color="error" onClick={() => handleDelete(t.id)}><Delete fontSize="small" /></IconButton>
          </Box>
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader title="Terms & Conditions" subtitle="Document terms and conditions" actionLabel="Add Terms" onAction={openCreate} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <DocumentTable rows={terms} columns={columns} loading={loading} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSave}>
          <DialogTitle>{editing ? 'Edit Terms' : 'New Terms'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField fullWidth required label="Name" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth select label="Document Type (optional)" value={form.documentType}
                  onChange={(e) => setForm({ ...form, documentType: e.target.value })}>
                  {DOCUMENT_TYPES.map((t) => (
                    <MenuItem key={t || 'all'} value={t}>{t || 'All Documents'}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth required label="Content" multiline rows={6} value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? <CircularProgress size={20} /> : 'Save'}</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
