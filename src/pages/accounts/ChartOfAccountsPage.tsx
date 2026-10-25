import { useCallback, useEffect, useMemo, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Alert, CircularProgress, Chip, TextField, Accordion, AccordionSummary,
  AccordionDetails, Typography, Table, TableBody, TableRow, TableCell, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, MenuItem, FormControlLabel,
  Switch, Grid,
} from '@mui/material';
import { ExpandMore, Lock, OpenInNew, Edit, MenuBook } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';

interface ChartAccount {
  id: string;
  code: string;
  name: string;
  accountType: string;
  accountGroup?: string;
  isControl?: boolean;
  isActive: boolean;
  balance?: number;
}

interface CoaMeta {
  accountTypes: string[];
  accountGroups: string[];
  defaultGroupByType: Record<string, string>;
  suggestedCodeRanges: { range: string; accountType: string; hint: string }[];
}

const VAT_ACCOUNT_CODES = new Set(['1300', '2200']);

const GROUP_LABELS: Record<string, string> = {
  CURRENT_ASSETS: 'Current Assets',
  OTHER_ASSETS: 'Formation & Other Assets',
  FIXED_ASSETS: 'Fixed Assets',
  CURRENT_LIABILITIES: 'Current Liabilities',
  LONG_TERM_LIABILITIES: 'Long-term Liabilities',
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  COGS: 'Cost of Goods Sold',
  OPERATING_EXPENSES: 'Operating Expenses',
  OTHER_INCOME: 'Other Income',
  OTHER_EXPENSES: 'Other Expenses',
};

const GROUP_ORDER = [...Object.keys(GROUP_LABELS), 'OTHER_ASSETS'].filter((v, i, a) => a.indexOf(v) === i);

const TYPE_LABELS: Record<string, string> = {
  ASSET: 'Asset',
  LIABILITY: 'Liability',
  EQUITY: 'Equity',
  INCOME: 'Income',
  EXPENSE: 'Expense',
};

const emptyForm = () => ({
  code: '',
  name: '',
  accountType: 'EXPENSE',
  accountGroup: 'OPERATING_EXPENSES',
  currency: 'AED',
  isActive: true,
});

const formatAed = (n: number) => n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [meta, setMeta] = useState<CoaMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<ChartAccount | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const loadAccounts = useCallback(() => {
    return api.get<{ data: ChartAccount[] }>('/accounts/chart-of-accounts', { params: { withBalances: true } })
      .then((res) => setAccounts(res.data.data));
  }, []);

  useEffect(() => {
    Promise.all([
      loadAccounts(),
      api.get<CoaMeta>('/accounts/chart-of-accounts/meta'),
    ])
      .then(([, metaRes]) => setMeta(metaRes.data))
      .catch(() => setError('Failed to load chart of accounts'))
      .finally(() => setLoading(false));
  }, [loadAccounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => a.code.includes(q) || a.name.toLowerCase().includes(q));
  }, [accounts, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, ChartAccount[]>();
    for (const a of filtered) {
      const group = a.accountGroup ?? a.accountType;
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(a);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      group: g,
      label: GROUP_LABELS[g] ?? g,
      accounts: map.get(g)!.sort((x, y) => x.code.localeCompare(y.code)),
    }));
  }, [filtered]);

  const openCreate = () => {
    setEditAccount(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (account: ChartAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditAccount(account);
    setForm({
      code: account.code,
      name: account.name,
      accountType: account.accountType,
      accountGroup: account.accountGroup ?? 'OPERATING_EXPENSES',
      currency: 'AED',
      isActive: account.isActive,
    });
    setDialogOpen(true);
  };

  const handleTypeChange = (accountType: string) => {
    const defaultGroup = meta?.defaultGroupByType[accountType] ?? 'OPERATING_EXPENSES';
    setForm((f) => ({ ...f, accountType, accountGroup: defaultGroup }));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (editAccount) {
        await api.put(`/accounts/chart-of-accounts/${editAccount.id}`, {
          name: form.name,
          accountGroup: form.accountGroup,
          currency: form.currency,
          isActive: form.isActive,
        });
        setSuccess(`Account ${editAccount.code} updated.`);
      } else {
        await api.post('/accounts/chart-of-accounts', form);
        setSuccess(`Account ${form.code} — ${form.name} created. Post journal entries from Journal Entries.`);
      }
      setDialogOpen(false);
      await loadAccounts();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to save account';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <PageHeader
        title="Chart of Accounts"
        subtitle="Add ledger accounts, view balances, drill down to account ledger"
        actionLabel="Add Account"
        onAction={openCreate}
      >
        <Button variant="outlined" startIcon={<MenuBook />} onClick={() => navigate('/accounts/journal')}>
          Journal Entries
        </Button>
      </PageHeader>

      {error && !dialogOpen && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>How to add accounts and post entries</Typography>
        <Typography variant="body2" component="div">
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li><strong>Add Account</strong> — pick a unique numeric code (e.g. 5301 Office Rent, 1501 Delivery Van). System codes 1000–5200 are reserved.</li>
            <li><strong>Journal Entries</strong> — debit and credit the new account (control accounts AR/AP/VAT/Inventory are blocked for manual posting).</li>
            <li><strong>Automatic entries</strong> — sales/purchase invoices, receipts, and payments post to control accounts automatically.</li>
            <li>Click any account row to open its <strong>General Ledger</strong> drill-down.</li>
          </ol>
        </Typography>
      </Alert>

      <TextField
        size="small"
        label="Search by code or name"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 3, maxWidth: 360 }}
        fullWidth
      />

      {grouped.length === 0 ? (
        <Alert severity="info">No accounts match your search.</Alert>
      ) : grouped.map(({ group, label, accounts: groupAccounts }) => (
        <Accordion key={group} defaultExpanded disableGutters sx={{ mb: 1, border: '1px solid', borderColor: 'divider' }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography fontWeight={600}>{label}</Typography>
            <Chip label={groupAccounts.length} size="small" sx={{ ml: 2 }} />
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Table size="small">
              <TableBody>
                {groupAccounts.map((a) => (
                  <TableRow key={a.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/accounts/ledger/${a.id}`)}>
                    <TableCell width={80}>{a.code}</TableCell>
                    <TableCell>
                      {a.name}
                      {VAT_ACCOUNT_CODES.has(a.code) && (
                        <Chip label="VAT Account" size="small" color="info" sx={{ ml: 1 }} />
                      )}
                      {a.isControl && (
                        <Tooltip title="System control account — posted via invoices/receipts, not manual journal">
                          <Lock fontSize="inherit" sx={{ ml: 1, verticalAlign: 'middle', opacity: 0.6 }} />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {formatAed(a.balance ?? 0)}
                    </TableCell>
                    <TableCell width={88} align="right">
                      <IconButton size="small" title="Edit account" onClick={(e) => openEdit(a, e)}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigate(`/accounts/ledger/${a.id}`); }}>
                        <OpenInNew fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AccordionDetails>
        </Accordion>
      ))}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSave}>
          <DialogTitle>{editAccount ? `Edit Account ${editAccount.code}` : 'Add Account'}</DialogTitle>
          <DialogContent>
            {error && dialogOpen && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              {!editAccount && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Account Code"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, '') })}
                    required
                    fullWidth
                    helperText="Numeric only, must be unique (e.g. 5301)"
                  />
                </Grid>
              )}
              <Grid item xs={12} sm={editAccount ? 12 : 6}>
                <TextField
                  label="Account Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  fullWidth
                />
              </Grid>
              {!editAccount && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Account Type"
                    value={form.accountType}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    fullWidth
                  >
                    {(meta?.accountTypes ?? Object.keys(TYPE_LABELS)).map((t) => (
                      <MenuItem key={t} value={t}>{TYPE_LABELS[t] ?? t}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Account Group"
                  value={form.accountGroup}
                  onChange={(e) => setForm({ ...form, accountGroup: e.target.value })}
                  fullWidth
                >
                  {(meta?.accountGroups ?? GROUP_ORDER).map((g) => (
                    <MenuItem key={g} value={g}>{GROUP_LABELS[g] ?? g}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Currency"
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })}
                  fullWidth
                  inputProps={{ maxLength: 3 }}
                />
              </Grid>
              {editAccount && (
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.isActive}
                        onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                        disabled={editAccount.isControl}
                      />
                    }
                    label={editAccount.isControl ? 'Active (control accounts cannot be deactivated)' : 'Active'}
                  />
                </Grid>
              )}
              {!editAccount && meta?.suggestedCodeRanges && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Suggested code ranges:{' '}
                    {meta.suggestedCodeRanges.map((r) => `${r.range} (${r.hint})`).join(' · ')}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Saving…' : editAccount ? 'Update' : 'Create Account'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
