import { useEffect, useState, FormEvent } from 'react';
import {
  Box, Alert, Button, Stepper, Step, StepLabel, TextField, Typography, Paper,
  FormControlLabel, Checkbox, CircularProgress, Grid, MenuItem, Divider,
} from '@mui/material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import { NumberField } from '../../components/common/LineItemsForm';

const STEPS = ['Owner Capital', 'Trade License', 'Visa Cost', 'Other Expenses', 'Review & Post'];

export default function StartupCapitalSetupPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    setupDate: new Date().toISOString().slice(0, 10),
    ownerCapital: 0,
    fundAccount: 'BANK' as 'CASH' | 'BANK',
    tradeLicenseAmount: 0,
    tradeLicenseCapitalize: false,
    visaAmount: 0,
    visaCapitalize: false,
    otherDescription: '',
    otherAmount: 0,
    otherCapitalize: false,
  });

  useEffect(() => {
    api.get<{ completed: boolean }>('/accounts/startup-setup/status')
      .then((r) => setCompleted(r.data.completed))
      .catch(() => {});
  }, []);

  const formationTotal = form.tradeLicenseAmount + form.visaAmount + form.otherAmount;
  const remaining = form.ownerCapital - formationTotal;

  const handleApply = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        setupDate: form.setupDate,
        ownerCapital: form.ownerCapital,
        fundAccount: form.fundAccount,
        bankOpeningBalance: form.ownerCapital,
        tradeLicense: { amount: form.tradeLicenseAmount, capitalizeAsAsset: form.tradeLicenseCapitalize },
        visa: { amount: form.visaAmount, capitalizeAsAsset: form.visaCapitalize },
        otherFormationExpenses: form.otherAmount > 0 ? [{
          description: form.otherDescription || 'Other formation expense',
          amount: form.otherAmount,
          capitalizeAsAsset: form.otherCapitalize,
        }] : [],
      };
      const res = await api.post<{ journalsCreated: number; fundAccount: string }>('/accounts/startup-setup', payload);
      setSuccess(
        `Startup setup complete — ${res.data.journalsCreated} journal(s) posted to ${res.data.fundAccount === 'CASH' ? 'Cash (1000)' : 'Bank (1010)'}. `
          + 'Trade license / visa / other costs were deducted from that fund.',
      );
      setCompleted(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Startup setup failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Startup Capital Setup"
        subtitle="Record owner investment, then pay establishment costs (trade license, visa, etc.) from that cash/bank"
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        <strong>How this works:</strong> Enter the capital you put into the business (Cash or Bank).
        Then enter trade license, visa, and other setup costs — they are paid from that same Cash/Bank account.
        Tick “Capitalize as asset” only if you want the cost on the balance sheet; leave unchecked to expense it (P&amp;L).
        You can also record later establishment costs under <em>Accounts → Expenses</em>.
      </Alert>

      {completed && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Startup setup is already completed. Re-running is blocked to avoid duplicate journals.
          Use Expenses for additional trade license / visa / PRO costs.
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
      </Stepper>

      <Paper sx={{ p: 3, maxWidth: 680 }}>
        <form onSubmit={handleApply}>
          <TextField fullWidth label="Setup Date" type="date" value={form.setupDate} sx={{ mb: 3 }}
            onChange={(e) => setForm({ ...form, setupDate: e.target.value })} InputLabelProps={{ shrink: true }} required />

          {activeStep === 0 && (
            <Box>
              <Typography gutterBottom fontWeight={600}>Owner capital introduced</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Journal: Dr Cash/Bank · Cr Owner Capital (3000)
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption">Amount (AED)</Typography>
                  <NumberField value={form.ownerCapital} onChange={(v) => setForm({ ...form, ownerCapital: v })} width={200} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth select label="Deposit into" value={form.fundAccount}
                    onChange={(e) => setForm({ ...form, fundAccount: e.target.value as 'CASH' | 'BANK' })}>
                    <MenuItem value="CASH">Cash (account 1000)</MenuItem>
                    <MenuItem value="BANK">Bank (account 1010)</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
            </Box>
          )}

          {activeStep === 1 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography fontWeight={600} gutterBottom>Trade license cost</Typography>
                <Typography variant="body2" color="text.secondary">
                  Paid from {form.fundAccount === 'CASH' ? 'Cash' : 'Bank'} — reduces available funds
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}><NumberField value={form.tradeLicenseAmount} onChange={(v) => setForm({ ...form, tradeLicenseAmount: v })} width={200} /></Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={<Checkbox checked={form.tradeLicenseCapitalize} onChange={(e) => setForm({ ...form, tradeLicenseCapitalize: e.target.checked })} />}
                  label="Capitalize as Asset (1511) — otherwise expense to 5310 Trade License"
                />
              </Grid>
            </Grid>
          )}

          {activeStep === 2 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography fontWeight={600} gutterBottom>Visa / immigration cost</Typography>
              </Grid>
              <Grid item xs={12} sm={6}><NumberField value={form.visaAmount} onChange={(v) => setForm({ ...form, visaAmount: v })} width={200} /></Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={<Checkbox checked={form.visaCapitalize} onChange={(e) => setForm({ ...form, visaCapitalize: e.target.checked })} />}
                  label="Capitalize as Asset (1512) — otherwise expense to 5311 Visa"
                />
              </Grid>
            </Grid>
          )}

          {activeStep === 3 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography fontWeight={600} gutterBottom>Other establishment costs</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  e.g. PRO fees, MOA notarization, establishment card — or leave blank and use Expenses later
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Description" value={form.otherDescription}
                  onChange={(e) => setForm({ ...form, otherDescription: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}><NumberField value={form.otherAmount} onChange={(v) => setForm({ ...form, otherAmount: v })} width={200} /></Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={<Checkbox checked={form.otherCapitalize} onChange={(e) => setForm({ ...form, otherCapitalize: e.target.checked })} />}
                  label="Capitalize as Formation Cost Asset (1510) — otherwise expense 5312"
                />
              </Grid>
            </Grid>
          )}

          {activeStep === 4 && (
            <Box>
              <Typography fontWeight={600} gutterBottom>Review</Typography>
              <Typography variant="body2">Owner capital: AED {form.ownerCapital.toLocaleString('en-AE', { minimumFractionDigits: 2 })} → {form.fundAccount}</Typography>
              <Typography variant="body2">Trade license: AED {form.tradeLicenseAmount.toLocaleString('en-AE', { minimumFractionDigits: 2 })} ({form.tradeLicenseCapitalize ? 'asset' : 'expense'})</Typography>
              <Typography variant="body2">Visa: AED {form.visaAmount.toLocaleString('en-AE', { minimumFractionDigits: 2 })} ({form.visaCapitalize ? 'asset' : 'expense'})</Typography>
              <Typography variant="body2">Other: AED {form.otherAmount.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</Typography>
              <Divider sx={{ my: 2 }} />
              <Typography fontWeight={700}>
                Remaining in {form.fundAccount} after setup costs: AED {remaining.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
              </Typography>
              {remaining < 0 && (
                <Alert severity="error" sx={{ mt: 2 }}>Formation costs exceed capital — go back and adjust.</Alert>
              )}
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button disabled={activeStep === 0} onClick={() => setActiveStep((s) => s - 1)}>Back</Button>
            {activeStep < STEPS.length - 1 ? (
              <Button variant="contained" onClick={() => setActiveStep((s) => s + 1)}>Next</Button>
            ) : (
              <Button type="submit" variant="contained" disabled={saving || completed || remaining < 0}>
                {saving ? <CircularProgress size={22} /> : 'Post Journals & Complete'}
              </Button>
            )}
          </Box>
        </form>
      </Paper>
    </Box>
  );
}
