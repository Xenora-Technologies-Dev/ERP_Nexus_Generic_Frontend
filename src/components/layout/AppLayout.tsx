import { useState, FormEvent } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Badge, Menu, MenuItem, Avatar,
  useMediaQuery, useTheme, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Alert,
} from '@mui/material';
import { Menu as MenuIcon, Notifications as NotifIcon, Logout, Person, LockReset } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import CompanySwitcher from './CompanySwitcher';
import Sidebar, { DRAWER_WIDTH } from './Sidebar';
import { api } from '../../api/client';
import { useEffect } from 'react';
import { APP_VERSION, APP_NAME } from '../../theme';

export default function AppLayout() {
  const { user, logout, changePassword } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (user?.mustChangePassword) setPasswordOpen(true);
  }, [user?.mustChangePassword]);

  useEffect(() => {
    api.get('/notifications/unread-count').then((res) => setUnreadCount(res.data.count)).catch(() => {});
  }, []);

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess('');
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (newPassword.length < 10) {
      setPasswordError('New password must be at least 10 characters with upper, lower, digit and symbol');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setPasswordError(msg || 'Failed to update password');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', width: { md: `calc(100% - ${DRAWER_WIDTH}px)` } }}>
        <AppBar position="sticky" elevation={1}>
          <Toolbar>
            {isMobile && (
              <IconButton color="inherit" edge="start" onClick={() => setDrawerOpen(true)} sx={{ mr: 1 }}>
                <MenuIcon />
              </IconButton>
            )}
            <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
              {APP_NAME}
              <Typography component="span" variant="caption" sx={{ ml: 1, opacity: 0.8 }}>v{APP_VERSION}</Typography>
            </Typography>
            <CompanySwitcher />
            <IconButton color="inherit" onClick={() => navigate('/notifications')}>
              <Badge badgeContent={unreadCount} color="error"><NotifIcon /></Badge>
            </IconButton>
            <IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', fontSize: 14 }}>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </Avatar>
            </IconButton>
            <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
              <MenuItem disabled>
                <Person sx={{ mr: 1 }} />
                {user?.firstName} {user?.lastName} ({user?.username || user?.role})
              </MenuItem>
              <MenuItem onClick={() => { setAnchorEl(null); resetPasswordForm(); setPasswordOpen(true); }}>
                <LockReset sx={{ mr: 1 }} />Change Password
              </MenuItem>
              <MenuItem onClick={() => { setAnchorEl(null); navigate('/settings/security'); }}><Person sx={{ mr: 1 }} />My Security (MFA)</MenuItem>
              <MenuItem onClick={() => { logout(); navigate('/login'); }}><Logout sx={{ mr: 1 }} />Logout</MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, sm: 3 }, bgcolor: 'background.default' }}>
          <Outlet />
        </Box>
      </Box>

      <Dialog open={passwordOpen} onClose={() => { if (!user?.mustChangePassword) setPasswordOpen(false); }} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={handleChangePassword}>
          <DialogTitle>Change Password</DialogTitle>
          <DialogContent>
            {passwordError && <Alert severity="error" sx={{ mb: 2 }}>{passwordError}</Alert>}
            {passwordSuccess && <Alert severity="success" sx={{ mb: 2 }}>{passwordSuccess}</Alert>}
            <TextField
              fullWidth type="password" label="Current Password" value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password"
              sx={{ mt: 1, mb: 2 }}
            />
            <TextField
              fullWidth type="password" label="New Password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} required autoComplete="new-password"
              helperText="At least 8 characters" sx={{ mb: 2 }}
            />
            <TextField
              fullWidth type="password" label="Confirm New Password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPasswordOpen(false)}>Close</Button>
            <Button type="submit" variant="contained" disabled={passwordSaving}>
              {passwordSaving ? 'Saving...' : 'Update Password'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
