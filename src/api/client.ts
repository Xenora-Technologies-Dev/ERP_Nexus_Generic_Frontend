import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const companyId = localStorage.getItem('companyId');
  if (companyId) config.headers['X-Company-Id'] = companyId;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 403 && /selected company/.test(error.response?.data?.error || '')) {
      localStorage.removeItem('companyId');
      window.location.reload();
    }
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/** Display document number as stored (e.g. 2026-08-0042) */
export function displayDocumentNumber(documentNumber: string): string {
  return documentNumber;
}

/** PDF filename: CustomerName_2026-08-0001.pdf */
export function pdfFilename(partyName: string, documentNumber: string): string {
  const sanitized = partyName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 50) || 'Party';
  return `${sanitized}_${displayDocumentNumber(documentNumber)}.pdf`;
}

export const getLogoUrl = (logoUrl?: string | null) => {
  if (!logoUrl || logoUrl === '/default-logo.png') return '/default-logo.png';
  if (logoUrl.startsWith('http')) return logoUrl;
  const base = import.meta.env.VITE_API_URL?.replace('/api', '') || '';
  return `${base}${logoUrl}`;
};
