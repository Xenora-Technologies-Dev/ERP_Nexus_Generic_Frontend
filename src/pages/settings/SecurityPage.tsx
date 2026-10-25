import { useState } from 'react';
import { Box, Card, CardContent, Typography, Button, TextField, Alert, Chip } from '@mui/material';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';

const errMsg = (e: unknown) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Request failed';

/** Self-service two-factor authentication (TOTP: Google / Microsoft Authenticator). */
export default function SecurityPage() {
  const { user, refresh, setToken } = useAuth();
  const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const call = async (fn: () => Promise<{ data: { token?: string } }>, msg: string) => {
    setError(''); setOk('');
    try {
      const r = await fn();
      if (r.data?.token) setToken(r.data.token);
      await refresh(); setOk(msg); setCode(''); setPassword(''); return true;
    } catch (e) { setError(errMsg(e)); return false; }
  };

  return (
    <Box>
      <PageHeader title="My Security" subtitle="Two-factor authentication" />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}
      <Card sx={{ maxWidth: 560 }}><CardContent>
        <Typography variant="h6" gutterBottom>
          Authenticator app (TOTP) {user?.mfaEnabled ? <Chip size="small" color="success" label="Enabled" /> : <Chip size="small" label="Disabled" />}
        </Typography>
        {!user?.mfaEnabled && !setup && (
          <Button variant="contained" onClick={async () => {
            setError('');
            try { const r = await api.post('/auth/mfa/setup'); setSetup(r.data); } catch (e) { setError(errMsg(e)); }
          }}>Set up two-factor authentication</Button>
        )}
        {!user?.mfaEnabled && setup && (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Typography variant="body2">Scan this QR code with your authenticator app, then enter the 6-digit code.</Typography>
            <img src={setup.qrDataUrl} alt="MFA QR code" width={200} height={200} />
            <Typography variant="caption">Manual key: <code>{setup.secret}</code></Typography>
            <TextField label="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            <Button variant="contained" disabled={code.length !== 6}
              onClick={async () => { if (await call(() => api.post('/auth/mfa/enable', { code }), 'Two-factor authentication enabled')) setSetup(null); }}>Verify & enable</Button>
          </Box>
        )}
        {user?.mfaEnabled && (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <TextField type="password" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <TextField label="Current 6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            <Button color="error" variant="outlined" onClick={() => call(() => api.post('/auth/mfa/disable', { password, code }), 'Two-factor authentication disabled')}>Disable</Button>
          </Box>
        )}
      </CardContent></Card>
    </Box>
  );
}
