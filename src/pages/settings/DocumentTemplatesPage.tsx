import { useEffect, useState } from 'react';
import {
  Box, Alert, CircularProgress, IconButton, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, Typography,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { ContentCopy, CheckCircle, Visibility } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable from '../../components/common/DocumentTable';

interface DocumentTemplate {
  id: string;
  name: string;
  documentType: string;
  htmlContent: string;
  cssContent?: string;
  isDefault: boolean;
  isActive: boolean;
}

export default function DocumentTemplatesPage() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocumentTemplate | null>(null);

  const fetchTemplates = () => {
    setLoading(true);
    api.get<DocumentTemplate[]>('/documents/templates')
      .then((res) => setTemplates(res.data))
      .catch(() => setError('Failed to load templates'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleClone = async (id: string) => {
    setActionId(id);
    try {
      await api.post(`/documents/templates/${id}/clone`);
      setSuccess('Template cloned');
      fetchTemplates();
    } catch {
      setError('Failed to clone template');
    } finally {
      setActionId(null);
    }
  };

  const handleActivate = async (id: string) => {
    setActionId(id);
    try {
      await api.post(`/documents/templates/${id}/activate`);
      setSuccess('Template activated');
      fetchTemplates();
    } catch {
      setError('Failed to activate template');
    } finally {
      setActionId(null);
    }
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 180 },
    { field: 'documentType', headerName: 'Document Type', width: 160 },
    {
      field: 'isActive', headerName: 'Status', width: 100,
      renderCell: ({ value }) => value
        ? <Chip label="Active" size="small" color="success" />
        : <Chip label="Inactive" size="small" />,
    },
    {
      field: 'isDefault', headerName: 'Default', width: 90,
      renderCell: ({ value }) => (value ? 'Yes' : 'No'),
    },
    {
      field: 'actions', headerName: 'Actions', width: 130, sortable: false,
      renderCell: ({ row }) => {
        const t = row as DocumentTemplate;
        return (
          <Box>
            <IconButton size="small" title="Preview" onClick={() => setPreview(t)}>
              <Visibility fontSize="small" />
            </IconButton>
            <IconButton size="small" title="Clone" disabled={actionId === t.id}
              onClick={() => handleClone(t.id)}>
              {actionId === t.id ? <CircularProgress size={18} /> : <ContentCopy fontSize="small" />}
            </IconButton>
            {!t.isActive && (
              <IconButton size="small" title="Activate" color="primary" disabled={actionId === t.id}
                onClick={() => handleActivate(t.id)}>
                <CheckCircle fontSize="small" />
              </IconButton>
            )}
          </Box>
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader title="Document Templates" subtitle="PDF and print templates" />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <DocumentTable rows={templates} columns={columns} loading={loading} />

      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="md" fullWidth>
        <DialogTitle>{preview?.name} — Preview</DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            Type: {preview?.documentType}
          </Typography>
          <Box
            sx={{
              border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2,
              bgcolor: 'background.paper', maxHeight: 400, overflow: 'auto',
            }}
          >
            {preview?.cssContent && <style>{preview.cssContent}</style>}
            <div dangerouslySetInnerHTML={{ __html: preview?.htmlContent || '' }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreview(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
