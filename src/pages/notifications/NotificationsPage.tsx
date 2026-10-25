import { useEffect, useState } from 'react';
import {
  Box, Alert, CircularProgress, Card, CardContent, Typography, Button,
  List, ListItem, ListItemText, ListItemButton, Chip, Divider,
} from '@mui/material';
import { MarkEmailRead, Notifications as NotifIcon } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import { brandColors } from '../../theme';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marking, setMarking] = useState(false);

  const fetchNotifications = () => {
    setLoading(true);
    api.get<Notification[]>('/notifications')
      .then((res) => setNotifications(res.data))
      .catch(() => setError('Failed to load notifications'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotifications(); }, []);

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    } catch {
      setError('Failed to mark notification as read');
    }
  };

  const markAllRead = async () => {
    setMarking(true);
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      setError('Failed to mark all as read');
    } finally {
      setMarking(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <PageHeader title="Notifications" subtitle={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}>
        {unreadCount > 0 && (
          <Button variant="outlined" startIcon={<MarkEmailRead />} onClick={markAllRead} disabled={marking}>
            Mark All Read
          </Button>
        )}
      </PageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Card>
        <CardContent sx={{ p: 0 }}>
          {notifications.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <NotifIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">No notifications</Typography>
            </Box>
          ) : (
            <List disablePadding>
              {notifications.map((n, i) => (
                <Box key={n.id}>
                  <ListItem
                    disablePadding
                    secondaryAction={
                      !n.isRead && (
                        <Button size="small" onClick={() => markRead(n.id)}>Mark Read</Button>
                      )
                    }
                  >
                    <ListItemButton onClick={() => !n.isRead && markRead(n.id)}
                      sx={{ bgcolor: n.isRead ? 'transparent' : brandColors.lightGreen, py: 2 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Typography fontWeight={n.isRead ? 400 : 700}>{n.title}</Typography>
                            {!n.isRead && <Chip label="New" size="small" color="primary" />}
                            <Chip label={n.type} size="small" variant="outlined" />
                          </Box>
                        }
                        secondary={
                          <>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{n.message}</Typography>
                            <Typography variant="caption" color="text.disabled">
                              {new Date(n.createdAt).toLocaleString()}
                            </Typography>
                          </>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                  {i < notifications.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
