import { useEffect, useMemo, useState } from 'react';
import {
  Box, Tabs, Tab, Card, CardContent, Button, Table, TableHead, TableRow, TableCell, TableBody, Chip,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Checkbox,
  FormControlLabel, Switch, Tooltip, Typography,
} from '@mui/material';
import { Add, Edit, LockOpen, Key, PhonelinkLock, Delete } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';

interface Role { id: string; name: string; description?: string | null; isSystem: boolean; userCount: number; permissions: string[] }
interface Permission { id: string; code: string; name: string; module: string }
interface UserRow {
  id: string; username: string; email: string; firstName: string; lastName: string; isActive: boolean;
  roleId: string; role: { id: string; name: string }; lockedUntil?: string | null; lastLoginAt?: string | null;
  totpEnabled: boolean; mustChangePassword: boolean;
}

const errMsg = (e: unknown) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Request failed';

export default function UsersRolesPage() {
  const [tab, setTab] = useState(0);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userDlg, setUserDlg] = useState<Partial<UserRow> & { password?: string } | null>(null);
  const [roleDlg, setRoleDlg] = useState<Partial<Role> | null>(null);
  const [pwDlg, setPwDlg] = useState<{ user: UserRow; password: string } | null>(null);

  const load = async () => {
    try {
      const [u, r, p] = await Promise.all([api.get('/users'), api.get('/users/roles'), api.get('/users/permissions')]);
      setUsers(u.data); setRoles(r.data); setPerms(p.data);
    } catch (e) { setError(errMsg(e)); }
  };
  useEffect(() => { load(); }, []);

  const modules = useMemo(() => {
    const m = new Map<string, Permission[]>();
    perms.forEach((p) => m.set(p.module, [...(m.get(p.module) || []), p]));
    return [...m.entries()];
  }, [perms]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setError(''); setSuccess('');
    try { await fn(); setSuccess(ok); await load(); return true; } catch (e) { setError(errMsg(e)); return false; }
  };

  const saveUser = async () => {
    if (!userDlg) return;
    const ok = userDlg.id
      ? await run(() => api.put(`/users/${userDlg.id}`, {
        email: userDlg.email, firstName: userDlg.firstName, lastName: userDlg.lastName, roleId: userDlg.roleId, isActive: userDlg.isActive,
      }), 'User updated')
      : await run(() => api.post('/users', {
        username: userDlg.username, email: userDlg.email, firstName: userDlg.firstName, lastName: userDlg.lastName || '',
        roleId: userDlg.roleId, password: userDlg.password, mustChangePassword: true,
      }), 'User created');
    if (ok) setUserDlg(null);
  };

  const saveRole = async () => {
    if (!roleDlg) return;
    const body = { name: roleDlg.name, description: roleDlg.description, permissions: roleDlg.permissions || [] };
    const ok = roleDlg.id ? await run(() => api.put(`/users/roles/${roleDlg.id}`, body), 'Role updated')
      : await run(() => api.post('/users/roles', body), 'Role created');
    if (ok) setRoleDlg(null);
  };

  const togglePerm = (code: string) => setRoleDlg((r) => r && ({
    ...r, permissions: r.permissions?.includes(code) ? r.permissions.filter((c) => c !== code) : [...(r.permissions || []), code],
  }));

  return (
    <Box>
      <PageHeader title="Users & Roles" subtitle="Manage user accounts, roles and the permission matrix" />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Users (${users.length})`} />
        <Tab label={`Roles (${roles.length})`} />
        <Tab label="Permission matrix" />
      </Tabs>

      {tab === 0 && (
        <Card><CardContent>
          <Button startIcon={<Add />} variant="contained" sx={{ mb: 2 }}
            onClick={() => setUserDlg({ isActive: true, roleId: roles.find((r) => !r.isSystem)?.id })}>New user</Button>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Username</TableCell><TableCell>Name</TableCell><TableCell>Email</TableCell><TableCell>Role</TableCell>
              <TableCell>Status</TableCell><TableCell>MFA</TableCell><TableCell>Last login</TableCell><TableCell align="right">Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {users.map((u) => {
                const locked = u.lockedUntil && new Date(u.lockedUntil) > new Date();
                return (
                  <TableRow key={u.id}>
                    <TableCell>{u.username}</TableCell>
                    <TableCell>{u.firstName} {u.lastName}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.role.name}</TableCell>
                    <TableCell>
                      <Chip size="small" label={u.isActive ? 'Active' : 'Inactive'} color={u.isActive ? 'success' : 'default'} />
                      {locked && <Chip size="small" label="Locked" color="error" sx={{ ml: 0.5 }} />}
                    </TableCell>
                    <TableCell>{u.totpEnabled ? <Chip size="small" label="On" color="primary" /> : '—'}</TableCell>
                    <TableCell>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => setUserDlg(u)}><Edit fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Reset password"><IconButton size="small" onClick={() => setPwDlg({ user: u, password: '' })}><Key fontSize="small" /></IconButton></Tooltip>
                      {locked && <Tooltip title="Unlock"><IconButton size="small" onClick={() => run(() => api.post(`/users/${u.id}/unlock`), 'User unlocked')}><LockOpen fontSize="small" /></IconButton></Tooltip>}
                      {u.totpEnabled && <Tooltip title="Reset MFA"><IconButton size="small" onClick={() => window.confirm(`Reset MFA for ${u.username}?`) && run(() => api.post(`/users/${u.id}/reset-mfa`), 'MFA reset')}><PhonelinkLock fontSize="small" /></IconButton></Tooltip>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      {tab === 1 && (
        <Card><CardContent>
          <Button startIcon={<Add />} variant="contained" sx={{ mb: 2 }} onClick={() => setRoleDlg({ permissions: [] })}>New role</Button>
          <Table size="small">
            <TableHead><TableRow><TableCell>Role</TableCell><TableCell>Description</TableCell><TableCell>Users</TableCell><TableCell>Permissions</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name} {r.isSystem && <Chip size="small" label="system" sx={{ ml: 0.5 }} />}</TableCell>
                  <TableCell>{r.description}</TableCell>
                  <TableCell>{r.userCount}</TableCell>
                  <TableCell>{r.permissions.includes('system.admin') ? 'All (system.admin)' : r.permissions.length}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setRoleDlg(r)}><Edit fontSize="small" /></IconButton>
                    {!r.isSystem && <IconButton size="small" disabled={r.userCount > 0}
                      onClick={() => window.confirm(`Delete role ${r.name}?`) && run(() => api.delete(`/users/roles/${r.id}`), 'Role deleted')}><Delete fontSize="small" /></IconButton>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      {tab === 2 && (
        <Card><CardContent sx={{ overflowX: 'auto' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Read-only overview. Edit a role to change its permissions.</Typography>
          <Table size="small">
            <TableHead><TableRow><TableCell>Permission</TableCell>{roles.map((r) => <TableCell key={r.id} align="center">{r.name}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {modules.map(([mod, list]) => [
                <TableRow key={mod}><TableCell colSpan={roles.length + 1} sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>{mod}</TableCell></TableRow>,
                ...list.map((p) => (
                  <TableRow key={p.code}>
                    <TableCell>{p.name} <Typography component="span" variant="caption" color="text.secondary">({p.code})</Typography></TableCell>
                    {roles.map((r) => <TableCell key={r.id} align="center">{r.permissions.includes(p.code) || r.permissions.includes('system.admin') ? '✓' : ''}</TableCell>)}
                  </TableRow>
                )),
              ])}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      <Dialog open={!!userDlg} onClose={() => setUserDlg(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{userDlg?.id ? `Edit ${userDlg.username}` : 'New user'}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
          {!userDlg?.id && <TextField label="Username" value={userDlg?.username || ''} onChange={(e) => setUserDlg({ ...userDlg, username: e.target.value })} />}
          <TextField label="Email" value={userDlg?.email || ''} onChange={(e) => setUserDlg({ ...userDlg, email: e.target.value })} />
          <TextField label="First name" value={userDlg?.firstName || ''} onChange={(e) => setUserDlg({ ...userDlg, firstName: e.target.value })} />
          <TextField label="Last name" value={userDlg?.lastName || ''} onChange={(e) => setUserDlg({ ...userDlg, lastName: e.target.value })} />
          <TextField select label="Role" value={userDlg?.roleId || ''} onChange={(e) => setUserDlg({ ...userDlg, roleId: e.target.value })}>
            {roles.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
          </TextField>
          {!userDlg?.id && <TextField label="Initial password" type="password" value={userDlg?.password || ''}
            helperText="10+ chars with upper, lower, digit and symbol. User must change it at first login."
            onChange={(e) => setUserDlg({ ...userDlg, password: e.target.value })} />}
          {userDlg?.id && <FormControlLabel control={<Switch checked={!!userDlg.isActive} onChange={(e) => setUserDlg({ ...userDlg, isActive: e.target.checked })} />} label="Active" />}
        </DialogContent>
        <DialogActions><Button onClick={() => setUserDlg(null)}>Cancel</Button><Button variant="contained" onClick={saveUser}>Save</Button></DialogActions>
      </Dialog>

      <Dialog open={!!pwDlg} onClose={() => setPwDlg(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reset password — {pwDlg?.user.username}</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <TextField fullWidth type="password" label="New password" value={pwDlg?.password || ''} onChange={(e) => pwDlg && setPwDlg({ ...pwDlg, password: e.target.value })}
            helperText="User will be asked to change it at next login; all sessions are signed out." />
        </DialogContent>
        <DialogActions><Button onClick={() => setPwDlg(null)}>Cancel</Button>
          <Button variant="contained" onClick={async () => { if (pwDlg && await run(() => api.post(`/users/${pwDlg.user.id}/reset-password`, { password: pwDlg.password, mustChangePassword: true }), 'Password reset')) setPwDlg(null); }}>Reset</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!roleDlg} onClose={() => setRoleDlg(null)} maxWidth="md" fullWidth>
        <DialogTitle>{roleDlg?.id ? `Edit role ${roleDlg.name}` : 'New role'}</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 2, mb: 2 }}>
            <TextField label="Name" value={roleDlg?.name || ''} disabled={roleDlg?.isSystem} onChange={(e) => setRoleDlg({ ...roleDlg, name: e.target.value })} />
            <TextField label="Description" value={roleDlg?.description || ''} onChange={(e) => setRoleDlg({ ...roleDlg, description: e.target.value })} />
          </Box>
          {modules.map(([mod, list]) => (
            <Box key={mod} sx={{ mb: 1 }}>
              <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>{mod}</Typography>
              {list.map((p) => (
                <FormControlLabel key={p.code} sx={{ mr: 3 }}
                  control={<Checkbox size="small" checked={!!roleDlg?.permissions?.includes(p.code)} onChange={() => togglePerm(p.code)}
                    disabled={roleDlg?.isSystem && p.code === 'system.admin'} />}
                  label={<Typography variant="body2">{p.name}</Typography>} />
              ))}
            </Box>
          ))}
        </DialogContent>
        <DialogActions><Button onClick={() => setRoleDlg(null)}>Cancel</Button><Button variant="contained" onClick={saveRole}>Save</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
