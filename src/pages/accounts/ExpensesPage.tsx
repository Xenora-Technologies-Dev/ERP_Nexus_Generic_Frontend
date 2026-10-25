import { parseInput } from '../../utils/money';
import { useEffect, useState, FormEvent } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Alert, CircularProgress, Grid, FormControlLabel, Checkbox, Typography, Card, CardContent,
  MenuItem, Tabs, Tab,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { Add } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import DocumentTable from '../../components/common/DocumentTable';
import { NumberField } from '../../components/common/LineItemsForm';

interface ExpenseSection {
  id: string;
  name: string;
  description?: string;
  subSections: { id: string; name: string; defaultCoaAccount?: { id: string; code: string; name: string } }[];
}

interface CoaAccount { id: string; code: string; name: string; accountType: string; }

interface ExpenseEntry {
  id: string;
  documentNumber: string;
  date: string;
  description: string;
  amount: number;
  vatApplicable: boolean;
  vatAmount: number;
  total: number;
  paymentMethod: string;
  capitalizeAsAsset?: boolean;
  isPrepaid?: boolean;
  section: { name: string };
  subSection?: { name: string } | null;
  coaAccount?: { code: string; name: string } | null;
}

interface ExpenseSummaryResponse {
  bySection: { section: string; total: number; subSections: Record<string, number> }[];
  byCoa: { code: string; name: string; total: number }[];
}

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OWNER_PERSONAL'];

export default function ExpensesPage() {
  const [tab, setTab] = useState(0);
  const [sections, setSections] = useState<ExpenseSection[]>([]);
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [summary, setSummary] = useState<ExpenseSummaryResponse>({ bySection: [], byCoa: [] });
  const [coaAccounts, setCoaAccounts] = useState<CoaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterSectionId, setFilterSectionId] = useState('');

  const [entryForm, setEntryForm] = useState({
    sectionId: '', subSectionId: '', coaAccountId: '', date: new Date().toISOString().slice(0, 10),
    description: '', amount: 0, vatApplicable: false, taxCode: 'OOS', vatRate: 5,
    paymentMethod: 'CASH', referenceNumber: '', notes: '',
    capitalizeAsAsset: false, isPrepaid: false,
    prepaidStartDate: '', prepaidEndDate: '',
  });
  const [sectionForm, setSectionForm] = useState({ name: '', description: '', subSectionName: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        ...(filterSectionId ? { sectionId: filterSectionId } : {}),
      };
      const [sec, ent, sum, coa] = await Promise.all([
        api.get<ExpenseSection[]>('/expenses/sections'),
        api.get<ExpenseEntry[]>('/expenses/entries', { params }),
        api.get<ExpenseSummaryResponse>('/expenses/summary', { params: { dateFrom, dateTo } }),
        api.get<CoaAccount[]>('/accounts/chart-of-accounts'),
      ]);
      setSections(sec.data);
      setEntries(ent.data);
      setSummary(sum.data);
      setCoaAccounts(coa.data.filter((a) => a.accountType === 'EXPENSE' || a.accountType === 'ASSET'));
    } catch {
      setError('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const selectedSection = sections.find((s) => s.id === entryForm.sectionId);
  const selectedSub = selectedSection?.subSections.find((s) => s.id === entryForm.subSectionId);

  useEffect(() => {
    if (selectedSub?.defaultCoaAccount?.id) {
      setEntryForm((f) => ({ ...f, coaAccountId: selectedSub.defaultCoaAccount!.id }));
    }
  }, [entryForm.subSectionId, selectedSub?.defaultCoaAccount?.id]);

  const handleCreateEntry = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/expenses/entries', {
        ...entryForm,
        subSectionId: entryForm.subSectionId || null,
      });
      setDialogOpen(false);
      setSuccess('Expense entry created and posted to journal');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create entry');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSection = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post<ExpenseSection>('/expenses/sections', {
        name: sectionForm.name,
        description: sectionForm.description,
      });
      if (sectionForm.subSectionName) {
        await api.post(`/expenses/sections/${res.data.id}/subsections`, { name: sectionForm.subSectionName });
      }
      setSectionDialogOpen(false);
      setSectionForm({ name: '', description: '', subSectionName: '' });
      setSuccess('Section created');
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to create section');
    } finally {
      setSaving(false);
    }
  };

  const entryCols: GridColDef[] = [
    { field: 'documentNumber', headerName: 'Number', width: 120 },
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (v) => new Date(v as string).toLocaleDateString() },
    { field: 'section', headerName: 'Section', width: 130, valueGetter: (_, row) => (row as ExpenseEntry).section?.name },
    { field: 'subSection', headerName: 'Sub-section', width: 130, valueGetter: (_, row) => (row as ExpenseEntry).subSection?.name || '-' },
    { field: 'coaAccount', headerName: 'COA', width: 140, valueGetter: (_, row) => (row as ExpenseEntry).coaAccount ? `${(row as ExpenseEntry).coaAccount!.code}` : '—' },
    { field: 'description', headerName: 'Description', flex: 1, minWidth: 150 },
    { field: 'amount', headerName: 'Amount', width: 100, type: 'number' },
    { field: 'total', headerName: 'Total', width: 100, type: 'number' },
    { field: 'paymentMethod', headerName: 'Payment', width: 110 },
  ];

  return (
    <Box>
      <PageHeader
        title="Expenses"
        subtitle="Track business expenses by section"
        actionLabel={tab === 0 ? 'New Entry' : 'New Section'}
        onAction={() => tab === 0 ? setDialogOpen(true) : setSectionDialogOpen(true)}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <TextField fullWidth size="small" label="From" type="date" value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField fullWidth size="small" label="To" type="date" value={dateTo}
            onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField fullWidth size="small" select label="Section" value={filterSectionId}
            onChange={(e) => setFilterSectionId(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            {sections.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Button variant="contained" onClick={fetchData} sx={{ mt: { xs: 0, sm: 0.5 } }}>Apply Filter</Button>
        </Grid>
      </Grid>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Entries" />
        <Tab label="Summary" />
        <Tab label="Sections" />
      </Tabs>

      {tab === 0 && <DocumentTable rows={entries} columns={entryCols} loading={loading} />}

      {tab === 1 && (
        <Grid container spacing={2}>
          <Grid item xs={12}><Typography variant="h6" fontWeight={600}>By Section</Typography></Grid>
          {summary.bySection.length === 0 ? (
            <Grid item xs={12}><Typography color="text.secondary">No expense data for selected period</Typography></Grid>
          ) : summary.bySection.map((s) => (
            <Grid item xs={12} sm={6} md={4} key={s.section}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={600}>{s.section}</Typography>
                  <Typography variant="h5" color="primary" sx={{ my: 1 }}>
                    {s.total.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                  </Typography>
                  {Object.entries(s.subSections).map(([name, amt]) => (
                    <Box key={name} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">{name}</Typography>
                      <Typography variant="body2">{amt.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          ))}
          <Grid item xs={12} sx={{ mt: 2 }}><Typography variant="h6" fontWeight={600}>By COA Account</Typography></Grid>
          {summary.byCoa.map((c) => (
            <Grid item xs={12} sm={6} md={4} key={c.code}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="body2" color="text.secondary">{c.code}</Typography>
                  <Typography fontWeight={600}>{c.name}</Typography>
                  <Typography variant="h6" color="primary">{c.total.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {tab === 2 && (
        <Grid container spacing={2}>
          {sections.map((s) => (
            <Grid item xs={12} sm={6} md={4} key={s.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={600}>{s.name}</Typography>
                  {s.description && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{s.description}</Typography>}
                  {s.subSections.map((sub) => (
                    <Typography key={sub.id} variant="body2">
                      • {sub.name}{sub.defaultCoaAccount ? ` → ${sub.defaultCoaAccount.code}` : ''}
                    </Typography>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleCreateEntry}>
          <DialogTitle>New Expense Entry</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField fullWidth required select label="COA Account" value={entryForm.coaAccountId}
                  onChange={(e) => setEntryForm({ ...entryForm, coaAccountId: e.target.value })}>
                  <MenuItem value="">Select account</MenuItem>
                  {coaAccounts.map((a) => (
                    <MenuItem key={a.id} value={a.id}>{a.code} — {a.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required select label="Section" value={entryForm.sectionId}
                  onChange={(e) => setEntryForm({ ...entryForm, sectionId: e.target.value, subSectionId: '', coaAccountId: '' })}>
                  <MenuItem value="">Select</MenuItem>
                  {sections.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth select label="Sub-section" value={entryForm.subSectionId}
                  onChange={(e) => setEntryForm({ ...entryForm, subSectionId: e.target.value })}
                  disabled={!selectedSection?.subSections.length}>
                  <MenuItem value="">None</MenuItem>
                  {selectedSection?.subSections.map((sub) => (
                    <MenuItem key={sub.id} value={sub.id}>{sub.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required label="Date" type="date" value={entryForm.date}
                  onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={<Checkbox checked={entryForm.capitalizeAsAsset}
                    onChange={(e) => setEntryForm({ ...entryForm, capitalizeAsAsset: e.target.checked, isPrepaid: e.target.checked ? false : entryForm.isPrepaid })} />}
                  label="Capitalize as Asset (formation cost)"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={<Checkbox checked={entryForm.isPrepaid}
                    onChange={(e) => setEntryForm({ ...entryForm, isPrepaid: e.target.checked, capitalizeAsAsset: e.target.checked ? false : entryForm.capitalizeAsAsset })} />}
                  label="Prepaid expense"
                />
              </Grid>
              {entryForm.isPrepaid && (
                <>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth required label="Prepaid Start" type="date" value={entryForm.prepaidStartDate}
                      onChange={(e) => setEntryForm({ ...entryForm, prepaidStartDate: e.target.value })} InputLabelProps={{ shrink: true }} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth required label="Prepaid End" type="date" value={entryForm.prepaidEndDate}
                      onChange={(e) => setEntryForm({ ...entryForm, prepaidEndDate: e.target.value })} InputLabelProps={{ shrink: true }} />
                  </Grid>
                </>
              )}
              <Grid item xs={12} sm={6}>
                <TextField fullWidth select label="Payment Method" value={entryForm.paymentMethod}
                  onChange={(e) => setEntryForm({ ...entryForm, paymentMethod: e.target.value })}>
                  {PAYMENT_METHODS.map((m) => <MenuItem key={m} value={m}>{m.replace('_', ' ')}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth required label="Description" value={entryForm.description}
                  onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2">Amount:</Typography>
                  <NumberField value={entryForm.amount} onChange={(v) => setEntryForm({ ...entryForm, amount: v })} width={120} />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth select label="Tax code" value={entryForm.taxCode}
                  SelectProps={{ native: true }}
                  onChange={(e) => setEntryForm({ ...entryForm, taxCode: e.target.value, vatApplicable: ['SR', 'BLOCKED'].includes(e.target.value) })}>
                  <option value="OOS">OOS — out of scope / no VAT</option>
                  <option value="SR">SR — standard rated, VAT recoverable</option>
                  <option value="BLOCKED">BLOCKED — VAT paid, not recoverable</option>
                  <option value="ZR">ZR — zero rated</option>
                  <option value="EX">EX — exempt</option>
                </TextField>
              </Grid>
              {entryForm.vatApplicable && (
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="VAT %" type="number" value={entryForm.vatRate}
                    onChange={(e) => setEntryForm({ ...entryForm, vatRate: parseInput(e.target.value) })} />
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Reference" value={entryForm.referenceNumber}
                  onChange={(e) => setEntryForm({ ...entryForm, referenceNumber: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Notes" value={entryForm.notes}
                  onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={20} /> : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={sectionDialogOpen} onClose={() => setSectionDialogOpen(false)} maxWidth="xs" fullWidth>
        <form onSubmit={handleCreateSection}>
          <DialogTitle>New Expense Section</DialogTitle>
          <DialogContent>
            <TextField fullWidth required label="Section Name" value={sectionForm.name} sx={{ mt: 1, mb: 2 }}
              onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })} />
            <TextField fullWidth label="Description" value={sectionForm.description} sx={{ mb: 2 }}
              onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })} />
            <TextField fullWidth label="Initial Sub-section (optional)" value={sectionForm.subSectionName}
              onChange={(e) => setSectionForm({ ...sectionForm, subSectionName: e.target.value })} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSectionDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving} startIcon={<Add />}>
              {saving ? <CircularProgress size={20} /> : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
