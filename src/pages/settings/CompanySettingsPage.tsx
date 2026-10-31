import { money } from '../../utils/money';
import { useEffect, useState, FormEvent, ChangeEvent } from 'react';
import {
  Box, Card, CardContent, TextField, Button, Alert, CircularProgress, Grid,
  Typography, Divider, MenuItem,
} from '@mui/material';
import { Save, Upload, Delete, Business } from '@mui/icons-material';
import { api, getLogoUrl } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import { EMIRATES, isValidTrn, UAE_TRN_HINT } from '../../utils/uae';

interface CompanySettings {
  id?: string;
  companyName: string;
  tradeLicenseNumber: string;
  vatRegistrationNumber: string;
  wpsEmployerId?: string | null;
  wpsBankRoutingCode?: string | null;
  emirate?: string;
  vatRegistrationDate?: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  bankName: string;
  bankAccountNumber: string;
  bankIban: string;
  bankSwiftCode: string;
  defaultCurrency: string;
  timezone: string;
  financialYearStart: number;
  quotationPrefix: string;
  proformaPrefix: string;
  salesOrderPrefix: string;
  deliveryNotePrefix: string;
  salesInvoicePrefix: string;
  creditNotePrefix: string;
  purchaseOrderPrefix: string;
  grnPrefix: string;
  purchaseInvoicePrefix: string;
  debitNotePrefix: string;
  salesReturnPrefix: string;
  purchaseReturnPrefix: string;
  receiptPrefix: string;
  paymentPrefix: string;
  journalPrefix: string;
  expensePrefix: string;
  documentNumberFormat: string;
  documentSequencePadding: number;
  documentSequenceReset: string;
  salesEmail?: string;
  salesEmailSecondary?: string;
  purchaseEmail?: string;
  purchaseEmailSecondary?: string;
  accountsEmail?: string;
  accountsEmailSecondary?: string;
  logoUrl?: string | null;
  defaultLogoUrl?: string;
}

const emptySettings: CompanySettings = {
  companyName: '', tradeLicenseNumber: '', vatRegistrationNumber: '', emirate: '', vatRegistrationDate: '', address: '',
  city: '', state: '', country: 'UAE', postalCode: '', phone: '', email: '', website: '',
  bankName: '', bankAccountNumber: '', bankIban: '', bankSwiftCode: '',
  defaultCurrency: 'AED', timezone: 'Asia/Dubai', financialYearStart: 1,
  quotationPrefix: 'QT', proformaPrefix: 'PFI', salesOrderPrefix: 'SO', deliveryNotePrefix: 'DN',
  salesInvoicePrefix: 'SI', creditNotePrefix: 'CRN', purchaseOrderPrefix: 'PO',
  grnPrefix: 'GRN', purchaseInvoicePrefix: 'PI', debitNotePrefix: 'DBN',
  salesReturnPrefix: 'SR', purchaseReturnPrefix: 'PR',
  receiptPrefix: 'RV', paymentPrefix: 'PV', journalPrefix: 'JV', expensePrefix: 'EXP',
  documentNumberFormat: '{PREFIX}-{YYYY}-{SEQ}', documentSequencePadding: 5, documentSequenceReset: 'NEVER',
  salesEmail: '', salesEmailSecondary: '', purchaseEmail: '',
  purchaseEmailSecondary: '', accountsEmail: '', accountsEmailSecondary: '',
};

const CURRENCIES = ['AED', 'USD', 'EUR', 'GBP', 'SAR'];
const TIMEZONES = ['Asia/Dubai', 'Asia/Riyadh', 'Asia/Kolkata', 'Europe/London', 'America/New_York'];

export default function CompanySettingsPage() {
  const [form, setForm] = useState<CompanySettings>(emptySettings);
  const [logoPreview, setLogoPreview] = useState('/default-logo.png');
  const [hasCustomLogo, setHasCustomLogo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchSettings = () => {
    setLoading(true);
    api.get<CompanySettings>('/company')
      .then((res) => {
        const cleaned = Object.fromEntries(
          Object.entries(res.data).map(([k, v]) => [k, v === null ? '' : v]),
        ) as CompanySettings;
        setForm({ ...emptySettings, ...cleaned });
        const isDefault = !res.data.logoUrl || res.data.logoUrl === '/default-logo.png';
        setHasCustomLogo(!isDefault);
        setLogoPreview(isDefault ? '/default-logo.png' : getLogoUrl(res.data.logoUrl));
      })
      .catch(() => setError('Failed to load company settings'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const {
      id: _id, logoUrl: _logoUrl, defaultLogoUrl: _defaultLogoUrl, ...payload
    } = form;
    try {
      await api.put('/company', payload);
      setSuccess('Settings saved successfully');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string; details?: { path: string; message: string }[] } } })
        ?.response?.data;
      const detailMsg = data?.details?.map((d) => `${d.path}: ${d.message}`).join('; ');
      setError(detailMsg || data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('logo', file);
    try {
      const res = await api.post<CompanySettings>('/company/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setHasCustomLogo(true);
      setLogoPreview(getLogoUrl(res.data.logoUrl));
      setSuccess('Logo uploaded successfully');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to upload logo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRevertLogo = async () => {
    setUploading(true);
    try {
      await api.delete('/company/logo');
      setHasCustomLogo(false);
      setLogoPreview('/default-logo.png');
      setSuccess('Reverted to default logo');
    } catch {
      setError('Failed to revert logo');
    } finally {
      setUploading(false);
    }
  };

  const update = (field: keyof CompanySettings, value: string | number) => {
    setForm({ ...form, [field]: value });
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <PageHeader title="Company Settings" subtitle="Company profile, banking and document prefixes" />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Box component="form" onSubmit={handleSave}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  <Business sx={{ mr: 1, verticalAlign: 'middle' }} />Company Logo
                </Typography>
                <Box sx={{ textAlign: 'center', mb: 2 }}>
                  <Box sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 2, mb: 2 }}>
                    <img src={logoPreview} alt="Company Logo"
                      style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain' }} />
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    {hasCustomLogo ? 'Uploaded logo' : 'Default logo'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Button component="label" variant="outlined" size="small" startIcon={<Upload />} disabled={uploading}>
                      Upload Logo
                      <input type="file" hidden accept="image/png,image/jpeg,image/jpg" onChange={handleLogoUpload} />
                    </Button>
                    {hasCustomLogo && (
                      <Button variant="outlined" size="small" color="error" startIcon={<Delete />}
                        onClick={handleRevertLogo} disabled={uploading}>
                        Use Default
                      </Button>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>Company Details</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Only company name is required. Other fields are optional — leave blank to use system defaults or omit from documents.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth required label="Company Name (Official)" value={form.companyName}
                      onChange={(e) => update('companyName', e.target.value)}
                      helperText="Required. Appears on all documents (e.g. ACME TRADING L.L.C)" />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Trade License" value={form.tradeLicenseNumber}
                      onChange={(e) => update('tradeLicenseNumber', e.target.value)} />
                    <TextField fullWidth label="WPS employer ID (MOHRE, 13 digits)" value={form.wpsEmployerId || ''} sx={{ mt: 2 }}
                      onChange={(e) => update('wpsEmployerId', e.target.value)} />
                    <TextField fullWidth label="WPS bank routing code (9 digits)" value={form.wpsBankRoutingCode || ''} sx={{ mt: 2 }}
                      onChange={(e) => update('wpsBankRoutingCode', e.target.value)} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="TRN (VAT Registration)" value={form.vatRegistrationNumber}
                      error={Boolean(form.vatRegistrationNumber) && !isValidTrn(form.vatRegistrationNumber)}
                      helperText={Boolean(form.vatRegistrationNumber) && !isValidTrn(form.vatRegistrationNumber)
                        ? `TRN must be ${UAE_TRN_HINT}`
                        : `${UAE_TRN_HINT}. Leave blank if the company is not VAT-registered.`}
                      onChange={(e) => update('vatRegistrationNumber', e.target.value)} />
                    <TextField select fullWidth label="Emirate of establishment" value={form.emirate || ''} sx={{ mt: 2 }}
                      helperText="Default place of supply for VAT 201 boxes 1a-1g"
                      onChange={(e) => update('emirate', e.target.value)}>
                      <MenuItem value="">—</MenuItem>
                      {EMIRATES.map((em) => <MenuItem key={em.value} value={em.value}>{em.label}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth label="VAT Registration Date" type="date"
                      value={form.vatRegistrationDate ? form.vatRegistrationDate.split('T')[0] : ''}
                      onChange={(e) => update('vatRegistrationDate', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      helperText="Tax invoices dated before this will be rejected" />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Phone" value={form.phone}
                      onChange={(e) => update('phone', e.target.value)} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Email" type="email" value={form.email}
                      onChange={(e) => update('email', e.target.value)} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Website" value={form.website}
                      onChange={(e) => update('website', e.target.value)} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Address" value={form.address}
                      onChange={(e) => update('address', e.target.value)}
                      helperText="Shown exactly as entered on all invoices and documents"
                      multiline minRows={2} />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField fullWidth label="City" value={form.city}
                      onChange={(e) => update('city', e.target.value)} />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField fullWidth label="State" value={form.state}
                      onChange={(e) => update('state', e.target.value)} />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField fullWidth label="Country" value={form.country}
                      onChange={(e) => update('country', e.target.value)} />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField fullWidth label="Postal Code" value={form.postalCode}
                      onChange={(e) => update('postalCode', e.target.value)}
                      helperText="Optional — leave blank to omit from documents" />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>Bank Details</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Shown on invoices/PDFs. To post payments from a specific bank in Accounts, add ledger accounts under
                  Chart of Accounts (e.g. 1011 Emirates NBD, 1012 ADCB), then choose them on Payment / Receipt vouchers.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Bank Name" value={form.bankName}
                      onChange={(e) => update('bankName', e.target.value)} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Account Number" value={form.bankAccountNumber}
                      onChange={(e) => update('bankAccountNumber', e.target.value)} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="IBAN" value={form.bankIban}
                      onChange={(e) => update('bankIban', e.target.value)} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="SWIFT Code" value={form.bankSwiftCode}
                      onChange={(e) => update('bankSwiftCode', e.target.value)} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>Department Emails</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Sales Email" type="email" value={form.salesEmail || ''}
                      onChange={(e) => update('salesEmail', e.target.value)} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Sales Email Secondary" type="email" value={form.salesEmailSecondary || ''}
                      onChange={(e) => update('salesEmailSecondary', e.target.value)} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Purchase Email" type="email" value={form.purchaseEmail || ''}
                      onChange={(e) => update('purchaseEmail', e.target.value)} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Purchase Email Secondary" type="email" value={form.purchaseEmailSecondary || ''}
                      onChange={(e) => update('purchaseEmailSecondary', e.target.value)} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Accounts Email" type="email" value={form.accountsEmail || ''}
                      onChange={(e) => update('accountsEmail', e.target.value)} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Accounts Email Secondary" type="email" value={form.accountsEmailSecondary || ''}
                      onChange={(e) => update('accountsEmailSecondary', e.target.value)} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>Regional Settings</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField fullWidth select label="Currency" value={form.defaultCurrency}
                      onChange={(e) => update('defaultCurrency', e.target.value)}>
                      {CURRENCIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField fullWidth select label="Timezone" value={form.timezone}
                      onChange={(e) => update('timezone', e.target.value)}>
                      {TIMEZONES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField fullWidth select label="Financial Year Start" value={form.financialYearStart}
                      onChange={(e) => update('financialYearStart', parseInt(e.target.value))}>
                      {Array.from({ length: 12 }, (_, i) => (
                        <MenuItem key={i + 1} value={i + 1}>
                          {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} gutterBottom>Document Numbering</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Numbers are generated from the format below. Tokens: {'{PREFIX}'} {'{YYYY}'} {'{YY}'} {'{MM}'} {'{SEQ}'}.
                  Issued numbers are never changed; new settings apply to new documents only.
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" label="Number format"
                      value={form.documentNumberFormat}
                      helperText="e.g. {PREFIX}-{YYYY}-{SEQ} → SI-2026-00001"
                      onChange={(e) => update('documentNumberFormat', e.target.value)} />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField fullWidth size="small" type="number" label="Sequence digits"
                      value={form.documentSequencePadding}
                      inputProps={{ min: 1, max: 12 }}
                      onChange={(e) => update('documentSequencePadding', money(e.target.value))} />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField fullWidth size="small" select SelectProps={{ native: true }} label="Sequence reset"
                      value={form.documentSequenceReset}
                      onChange={(e) => update('documentSequenceReset', e.target.value)}>
                      <option value="NEVER">Never (continuous)</option>
                      <option value="YEARLY">Every calendar year</option>
                    </TextField>
                  </Grid>
                </Grid>
                <Grid container spacing={2}>
                  {([
                    ['quotationPrefix', 'Quotation'], ['proformaPrefix', 'Proforma Invoice'], ['salesOrderPrefix', 'Sales Order'],
                    ['deliveryNotePrefix', 'Delivery Note'], ['salesInvoicePrefix', 'Sales Invoice'],
                    ['purchaseInvoicePrefix', 'Purchase Invoice'], ['expensePrefix', 'Expense'],
                    ['creditNotePrefix', 'Credit Note'], ['salesReturnPrefix', 'Sales Return'],
                    ['purchaseOrderPrefix', 'Purchase Order'],
                    ['grnPrefix', 'GRN'],
                    ['debitNotePrefix', 'Debit Note'], ['purchaseReturnPrefix', 'Purchase Return'],
                    ['receiptPrefix', 'Receipt'],
                    ['paymentPrefix', 'Payment'], ['journalPrefix', 'Journal'],
                  ] as [keyof CompanySettings, string][]).map(([key, label]) => (
                    <Grid item xs={6} sm={4} md={3} key={key}>
                      <TextField fullWidth size="small" label={label}
                        value={form[key] as string}
                        onChange={(e) => update(key, e.target.value)} />
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>

            <Button type="submit" variant="contained" size="large" startIcon={<Save />}
              disabled={saving}>
              {saving ? <CircularProgress size={20} /> : 'Save Settings'}
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
