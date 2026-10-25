import { Box, Typography, Button } from '@mui/material';
import { Add } from '@mui/icons-material';

interface Props {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, actionLabel, onAction, children }: Props) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
      <Box>
        <Typography variant="h5" fontWeight={700}>{title}</Typography>
        {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        {children}
        {actionLabel && onAction && (
          <Button variant="contained" startIcon={<Add />} onClick={onAction}>{actionLabel}</Button>
        )}
      </Box>
    </Box>
  );
}
