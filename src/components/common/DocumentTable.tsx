import { DataGrid, GridColDef, GridValidRowModel } from '@mui/x-data-grid';
import { Box, Chip } from '@mui/material';

interface Props {
  rows: GridValidRowModel[];
  columns: GridColDef[];
  loading?: boolean;
  onRowClick?: (id: string) => void;
}

const statusColors: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  DRAFT: 'default',
  CONFIRMED: 'info',
  PAID: 'success',
  PARTIALLY_PAID: 'warning',
  PARTIALLY_DELIVERED: 'warning',
  DELIVERED: 'success',
  INVOICED: 'info',
  CANCELLED: 'error',
  CONVERTED: 'success',
};

export function StatusChip({ status }: { status: string }) {
  return <Chip label={status} size="small" color={statusColors[status] || 'default'} />;
}

export default function DocumentTable({ rows, columns, loading, onRowClick }: Props) {
  return (
    <Box sx={{ width: '100%', bgcolor: 'background.paper', borderRadius: 2 }}>
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        autoHeight
        pageSizeOptions={[10, 25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        onRowClick={onRowClick ? (params) => onRowClick(params.id as string) : undefined}
        sx={{ border: 'none', '& .MuiDataGrid-row': { cursor: onRowClick ? 'pointer' : 'default' } }}
        disableRowSelectionOnClick
      />
    </Box>
  );
}
