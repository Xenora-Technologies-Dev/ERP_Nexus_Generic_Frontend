import { useEffect, useState, FormEvent } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Alert, CircularProgress, Grid, IconButton, Switch, FormControlLabel, MenuItem, Chip,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { Edit, Delete } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable from '../../components/common/DocumentTable';

interface DocumentNote {
  id: string;
  documentType: string;
  title: string;
  content: string;
  isDefault: boolean;
}

const DOCUMENT_TYPES = [
  'SALES_QUOTATION', 'SALES_ORDER', 'DELIVERY_NOTE', 'SALES_INVOICE',
  'CREDIT_NOTE', 'SALES_RETURN', 'PURCHASE_ORDER', 'GRN', 'PURCHASE_INVOICE',
  'DEBIT_NOTE', 'PURCHASE_RETURN',
];

const emptyForm = { documentType: 'SALES_INVOICE', title: '', content: '', isDefault: false };

export default function DocumentNotesPage() {
  const [notes, setNotes] = useState<DocumentNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentNote | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('');

  const fetchNotes = () => {
    setLoading(true);
    api.get<DocumentNote[]>('/documents/notes', { params: { documentType: filterType || undefined } })
      .then((res) => setNotes(res.data))
      .catch(() => setError('Failed to load notes'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotes(); }, [filterType]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (note: DocumentNote) => {
    setEditing(note);
    setForm({ documentType: note.documentType, title: note.title, content: note.content, isDefault: note.isDefault });
    setDialogOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.put(`/documents/notes/${editing.id}`, form);
      } else {
        await api.post('/documents/notes', form);
      }
      setDialogOpen(false);
      setSuccess('Note saved');
      fetchNotes();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this note?')) return;
    try {
      await api.delete(`/documents/notes/${id}`);
      setSuccess('Note deleted');
      fetchNotes();
    } catch {
      setError('Failed to delete note');
    }
  };

  const columns: GridColDef[] = [
    { field: 'documentType', headerName: 'Document Type', width: 160 },
    { field: 'title', headerName: 'Title', flex: 1, minWidth: 150 },
    {
      field: 'content', headerName: 'Content', flex: 2, minWidth: 200,
      renderCell: ({ value }) => (
        <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value as string}</Box>
      ),
    },
    {
      field: 'isDefault', headerName: 'Default', width: 90,
      renderCell: ({ value }) => value ? <Chip label="Default" size="small" color="primary" /> : null,
    },
    {
      field: 'actions', headerName: '', width: 90, sortable: false,
      renderCell: ({ row }) => (
        <Box>
          <IconButton size="small" onClick={() => openEdit(row as DocumentNote)}><Edit fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><Delete fontSize="small" /></IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader title="Document Notes" subtitle="Default notes per document type" actionLabel="Add Note" onAction={openCreate} />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Box sx={{ mb: 2 }}>
        <TextField size="small" select label="Filter by Type" value={filterType}
          onChange={(e) => setFilterType(e.target.value)} sx={{ minWidth: 200 }}>
          <MenuItem value="">All Types</MenuItem>
          {DOCUMENT_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
      </Box>

      <DocumentTable rows={notes} columns={columns} loading={loading} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSave}>
          <DialogTitle>{editing ? 'Edit Note' : 'New Note'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField fullWidth required select label="Document Type" value={form.documentType}
                  onChange={(e) => setForm({ ...form, documentType: e.target.value })}>
                  {DOCUMENT_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth required label="Title" value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth required label="Content" multiline rows={4} value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={<Switch checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />}
                  label="Set as default for this document type"
                />
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
