import { useCallback, useEffect, useState } from 'react';
import {
  Box, Alert, Skeleton, TextField, MenuItem, Table, TableHead, TableBody, TableRow,
  TableCell, TableContainer, Paper, Chip, Collapse, IconButton, Button,
} from '@mui/material';
import { KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import { brandColors } from '../../theme';

interface AuditEntry {
  id: string;
  createdAt: string;
  userEmail?: string;
  action: string;
  entityType: string;
  entityId?: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
  details?: string;
  user?: { firstName: string; lastName: string; email: string };
}

const ENTITY_TYPES = [
  '', 'JournalEntry', 'SalesInvoice', 'PurchaseInvoice', 'Payment', 'Receipt',
  'SalesReturn', 'PurchaseReturn', 'CreditNote', 'DebitNote',
  'AccountingPeriod', 'RecurringJournal', 'BankStatement',
];

function ChangeRow({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const hasChanges = entry.changes && Object.keys(entry.changes).length > 0;

  return (
    <>
      <TableRow hover>
        <TableCell>
          {hasChanges && (
            <IconButton size="small" onClick={() => setOpen(!open)}>
              {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
            </IconButton>
          )}
        </TableCell>
        <TableCell>{new Date(entry.createdAt).toLocaleString('en-AE')}</TableCell>
        <TableCell>{entry.userEmail || entry.user?.email || '—'}</TableCell>
        <TableCell><Chip label={entry.action} size="small" /></TableCell>
        <TableCell>{entry.entityType}</TableCell>
        <TableCell>{entry.entityId?.slice(0, 8) ?? '—'}</TableCell>
        <TableCell sx={{ maxWidth: 360, whiteSpace: 'normal' }}>{entry.details || '—'}</TableCell>
      </TableRow>
      {hasChanges && (
        <TableRow>
          <TableCell colSpan={7} sx={{ py: 0 }}>
            <Collapse in={open}>
              <Box sx={{ py: 2, pl: 4 }}>
                {Object.entries(entry.changes!).map(([field, val]) => (
                  <Box key={field} sx={{ mb: 1, fontFamily: 'monospace', fontSize: 12 }}>
                    <strong>{field}:</strong> {JSON.stringify(val.before)} → {JSON.stringify(val.after)}
                  </Box>
                ))}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function AuditTrailPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entityType, setEntityType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: AuditEntry[] }>('/audit-log', {
        params: {
          entityType: entityType || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          pageSize: 100,
        },
      });
      setEntries(res.data.data);
    } catch {
      setError('Failed to load audit trail (admin access required)');
    } finally {
      setLoading(false);
    }
  }, [entityType, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <Box>
      <PageHeader title="Audit Trail" subtitle="Read-only log of financial data changes" />

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField select size="small" label="Entity Type" value={entityType}
          onChange={(e) => setEntityType(e.target.value)} sx={{ minWidth: 180 }}>
          {ENTITY_TYPES.map((t) => <MenuItem key={t} value={t}>{t || 'All'}</MenuItem>)}
        </TextField>
        <TextField size="small" label="From" type="date" value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField size="small" label="To" type="date" value={dateTo}
          onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        <Button variant="outlined" onClick={fetchLogs}>Filter</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? <Skeleton height={400} /> : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: brandColors.lightGreen }}>
                <TableCell width={40} />
                <TableCell>Date/Time</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell>ID</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center">No audit entries</TableCell></TableRow>
              ) : entries.map((e) => <ChangeRow key={e.id} entry={e} />)}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
