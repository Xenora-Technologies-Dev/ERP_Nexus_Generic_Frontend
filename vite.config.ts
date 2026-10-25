import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5001', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5001', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@mui/x-data-grid')) return 'vendor-datagrid';
          if (id.includes('@mui/icons-material')) return 'vendor-icons';
          if (id.includes('@mui') || id.includes('@emotion')) return 'vendor-mui';
          if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'vendor-react';
          if (id.includes('date-fns')) return 'vendor-date';
          return 'vendor';
        },
      },
    },
  },
});
