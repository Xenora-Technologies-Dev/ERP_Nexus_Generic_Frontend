import { createTheme } from '@mui/material/styles';

export const brandColors = {
  darkGreen: '#2d5a27',
  brightGreen: '#4caf50',
  goldenTan: '#c9a227',
  lightGreen: '#e8f5e9',
  darkText: '#1a1a1a',
};

export const theme = createTheme({
  palette: {
    primary: { main: brandColors.darkGreen, light: brandColors.brightGreen, dark: '#1b3a17' },
    secondary: { main: brandColors.goldenTan, light: '#e6c84d', dark: '#9a7b1a' },
    success: { main: brandColors.brightGreen },
    background: { default: '#f5f7f5', paper: '#ffffff' },
  },
  typography: {
    fontFamily: '"Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } },
    MuiCard: { styleOverrides: { root: { boxShadow: '0 2px 8px rgba(45,90,39,0.08)' } } },
    MuiAppBar: { styleOverrides: { root: { backgroundColor: brandColors.darkGreen } } },
    MuiDrawer: { styleOverrides: { paper: { backgroundColor: '#fafcfa', borderRight: '1px solid #e0e0e0' } } },
  },
});

export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.1.0';
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'ERP Nexus';
