import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { isCompanyVatRegistered } from './uae';

interface VatSettings {
  trn: string;
  registrationDate: string | null;
}

/** Company TRN and VAT registration date, loaded once per screen. */
export function useCompanyVatSettings() {
  const [settings, setSettings] = useState<VatSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<{ vatRegistrationNumber?: string | null; vatRegistrationDate?: string | null }>('/company')
      .then((res) => {
        if (cancelled) return;
        setSettings({
          trn: res.data.vatRegistrationNumber || '',
          registrationDate: res.data.vatRegistrationDate || null,
        });
      })
      .catch(() => {
        if (!cancelled) setSettings({ trn: '', registrationDate: null });
      });
    return () => { cancelled = true; };
  }, []);

  const registeredOn = (asOf?: string | null): boolean | null => {
    if (!settings) return null;
    return isCompanyVatRegistered(settings.trn, settings.registrationDate, asOf);
  };

  return { loaded: settings !== null, registeredOn };
}
