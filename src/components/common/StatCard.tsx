import { Card, CardContent, Typography, Box } from '@mui/material';
import { brandColors } from '../../theme';

interface Props {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
}

export default function StatCard({ title, value, icon, color = brandColors.darkGreen }: Props) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>{title}</Typography>
            <Typography variant="h5" fontWeight={700} color={color}>{value}</Typography>
          </Box>
          {icon && <Box sx={{ color, opacity: 0.7 }}>{icon}</Box>}
        </Box>
      </CardContent>
    </Card>
  );
}
