import { useEffect, useState } from 'react';
import {
  Box, Button, Alert, Paper, Table, TableBody, TableCell, TableRow, TableHead, Typography, Chip, MenuItem, TextField, Stack,
} from '@mui/material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import { apiError } from '../../utils/apiError';

interface Doc { id: string; documentNumber: string; date: string; status: string; customer?: { name: string } }
interface Submission { id: string; documentType: string; documentId: string; documentNumber: string; status: string; provider: string; aspReference: string | null; messages: string[]; createdAt: string }

const color = (s: string) => (s === 'ACCEPTED' ? 'success' : s === 'REJECTED' || s === 'VALIDATION_FAILED' ? 'error' : 'default');

export default function EInvoicingPage() {
  const [kind, setKind] = useState<'invoice' | 'credit-note'>('invoice');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const load = async () => {
    try {
      const [d, s] = await Promise.all([
        api.get(kind === 'invoice' ? '/sales/invoices' : '/sales/credit-notes'),
        api.get('/einvoice/submissions'),
      ]);
      const list: Doc[] = Array.isArray(d.data) ? d.data : d.data.items ?? d.data.data ?? [];
      setDocs(list.filter((x) => !['DRAFT', 'CANCELLED'].includes(x.status)));
      setSubs(s.data);
    } catch (e) { setMsg({ type: 'error', text: apiError(e, 'Request failed') }); }
  };
  useEffect(() => { load(); }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const latest = (id: string) => subs.find((s) => s.documentId === id);
  const validate = async (d: Doc) => {
    try {
      const r = await api.get(`/einvoice/${kind}/${d.id}/validate`);
      setMsg(r.data.valid ? { type: 'success', text: `${d.documentNumber}: valid PINT AE document` } : { type: 'error', text: `${d.documentNumber}: ${r.data.errors.join(' | ')}` });
    } catch (e) { setMsg({ type: 'error', text: apiError(e, 'Request failed') }); }
  };
  const download = async (d: Doc) => {
    try {
      const r = await api.get(`/einvoice/${kind}/${d.id}/xml`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement('a'); a.href = url; a.download = `${d.documentNumber}.xml`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setMsg({ type: 'error', text: apiError(e, 'Request failed') }); }
  };
  const submit = async (d: Doc) => {
    try {
      const r = await api.post(`/einvoice/${kind}/${d.id}/submit`);
      setMsg({ type: r.data.status === 'ACCEPTED' ? 'success' : 'error', text: `${d.documentNumber}: ${r.data.status} ${r.data.aspReference ?? ''} ${(r.data.messages ?? []).join(' | ')}` });
      load();
    } catch (e) { setMsg({ type: 'error', text: apiError(e, 'Request failed') }); }
  };

  return (
    <Box>
      <PageHeader title="E-Invoicing (PINT AE)" subtitle="Generate, validate and submit UBL e-invoices through your Accredited Service Provider" />
      <Alert severity="info" sx={{ mb: 2 }}>The ASP connection is set on the server (EINVOICE_ASP). The default is a mock provider that does not send anything externally.</Alert>
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField select size="small" label="Document type" value={kind} onChange={(e) => setKind(e.target.value as 'invoice' | 'credit-note')} sx={{ mb: 2, minWidth: 200 }}>
          <MenuItem value="invoice">Tax invoices</MenuItem>
          <MenuItem value="credit-note">Credit notes</MenuItem>
        </TextField>
        <Table size="small">
          <TableHead><TableRow><TableCell>Number</TableCell><TableCell>Date</TableCell><TableCell>Customer</TableCell><TableCell>E-invoice</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
          <TableBody>
            {docs.map((d) => {
              const s = latest(d.id);
              return (
                <TableRow key={d.id}>
                  <TableCell>{d.documentNumber}</TableCell>
                  <TableCell>{d.date?.slice(0, 10)}</TableCell>
                  <TableCell>{d.customer?.name}</TableCell>
                  <TableCell>{s ? <Chip size="small" color={color(s.status)} label={`${s.status}${s.aspReference ? ` · ${s.aspReference}` : ''}`} /> : <Chip size="small" label="Not submitted" />}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" onClick={() => validate(d)}>Validate</Button>
                      <Button size="small" onClick={() => download(d)}>XML</Button>
                      <Button size="small" variant="contained" disabled={s?.status === 'ACCEPTED' || s?.status === 'SUBMITTED'} onClick={() => submit(d)}>Submit</Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {docs.length === 0 && <TableRow><TableCell colSpan={5}><Typography color="text.secondary">No posted documents.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Submission log</Typography>
        <Table size="small">
          <TableHead><TableRow><TableCell>When</TableCell><TableCell>Document</TableCell><TableCell>Status</TableCell><TableCell>Provider</TableCell><TableCell>Messages</TableCell></TableRow></TableHead>
          <TableBody>
            {subs.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{new Date(s.createdAt).toLocaleString()}</TableCell>
                <TableCell>{s.documentNumber}</TableCell>
                <TableCell><Chip size="small" color={color(s.status)} label={s.status} /></TableCell>
                <TableCell>{s.provider}</TableCell>
                <TableCell>{(s.messages ?? []).join(' | ')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
