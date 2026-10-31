import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert, CircularProgress,
  InputAdornment, IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff, Login as LoginIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { APP_NAME, brandColors } from '../theme';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totp, setTotp] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password, mfaRequired ? totp : undefined);
      navigate('/');
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string; mfaRequired?: boolean } } })?.response;
      const data = response?.data;
      if (data?.mfaRequired) setMfaRequired(true);
      if (!response) {
        setError('Cannot reach the API. Confirm the site was built with VITE_API_URL set to the Render API, ending in /api.');
      } else {
        setError(data?.mfaRequired && !totp ? 'Enter the 6-digit code from your authenticator app' : data?.error || 'Invalid username or password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: 'background.default', p: 2,
    }}>
      <Card sx={{ maxWidth: 420, width: '100%' }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <img src="/default-logo.png" alt="Logo" style={{ maxWidth: 160, maxHeight: 70, marginBottom: 12 }} />
            <Typography variant="h5" fontWeight={700} color={brandColors.darkGreen}>{APP_NAME}</Typography>
            <Typography variant="body2" color="text.secondary">Sign in with your username and password</Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth label="Username" type="text" value={username}
              onChange={(e) => setUsername(e.target.value)} required autoComplete="username"
              autoFocus sx={{ mb: 2 }}
            />
            <TextField
              fullWidth label="Password" type={showPassword ? 'text' : 'password'}
              value={password} onChange={(e) => setPassword(e.target.value)} required
              autoComplete="current-password" sx={{ mb: 3 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" aria-label="toggle password visibility">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {mfaRequired && (
              <TextField
                fullWidth label="Authenticator code" value={totp} autoFocus
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code' }} sx={{ mb: 3 }}
              />
            )}
            <Button
              type="submit" variant="contained" fullWidth size="large"
              disabled={loading} startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
