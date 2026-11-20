import { fmtMoney, money, parseInput, previewDocument } from '../../utils/money';
import { useState, useEffect } from 'react';
import {
  Box, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  IconButton, TextField, Autocomplete, Button, FormControlLabel, Checkbox, Paper, Typography, Alert,
} from '@mui/material';
import { Delete, Add } from '@mui/icons-material';
import { TAX_CODE_OPTIONS, UNREGISTERED_TAX_CODES } from '../../utils/uae';
import { useCompanyVatSettings } from '../../utils/useVatRegistration';

/** Charged VAT % shown in the preview for a tax code (RC/IMP are self-assessed, not charged). */
export function chargedRate(taxCode: string | undefined, productRate: number): number {
  if (!taxCode || taxCode === 'SR') return productRate;
  return 0;
}

export interface LineItem {
  id?: string;
  productId: string;
  productName?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  unit?: string;
  costPrice?: number;
  /** UAE tax code (SR/ZR/EX/OOS/RC/IMP/DZ); blank = product default */
  taxCode?: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  costPrice?: number;
  vatRate: number;
  unit?: string;
  packing?: string | null;
  countryOfOrigin?: string | null;
  taxCode?: string | null;
}

interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  width?: number;
  min?: number;
}

export function NumberField({ value, onChange, width = 80, min }: NumberFieldProps) {
  const [local, setLocal] = useState(value === 0 ? '' : String(value));

  useEffect(() => {
    setLocal(value === 0 ? '' : String(value));
  }, [value]);

  return (
    <TextField
      size="small"
      value={local}
      onChange={(e) => {
        const raw = e.target.value;
        setLocal(raw);
        if (raw === '' || raw === '-') return;
        const parsed = parseInput(raw);
        if (!isNaN(parsed)) onChange(parsed);
      }}
      onBlur={() => {
        if (local === '' || local === '-') {
          onChange(0);
          setLocal('');
        } else {
          const parsed = parseInput(local);
          if (!isNaN(parsed)) {
            onChange(parsed);
            setLocal(parsed === 0 ? '' : String(parsed));
          }
        }
      }}
      sx={{ width }}
      inputProps={{ min, step: 0.01 }}
    />
  );
}

function productLabel(p: Product) {
  const base = `${p.sku} - ${p.name}`;
  return p.countryOfOrigin ? `${base} (${p.countryOfOrigin})` : base;
}

interface Props {
  products: Product[];
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  vatApplicable: boolean;
  onVatChange: (v: boolean) => void;
  priceField?: 'sellingPrice' | 'costPrice';
  showCost?: boolean;
  showDiscount?: boolean;
  discount?: number;
  onDiscountChange?: (v: number) => void;
  /** Which side's tax codes to offer (RC/IMP are purchase-only). Defaults from priceField. */
  taxSide?: 'SALES' | 'PURCHASE';
  /** Document date (YYYY-MM-DD). VAT registration is judged on this date. */
  documentDate?: string;
}

export default function LineItemsForm({
  products, items, onChange, vatApplicable, onVatChange,
  priceField = 'sellingPrice', showCost = false,
  showDiscount = false, discount = 0, onDiscountChange, taxSide, documentDate,
}: Props) {
  const { registeredOn } = useCompanyVatSettings();
  const registered = registeredOn(documentDate);
  const side = taxSide ?? (priceField === 'costPrice' ? 'PURCHASE' : 'SALES');
  // Only sales are locked before registration. Purchases can still be with or without VAT.
  const salesLocked = registered === false && side === 'SALES';
  const codeOptions = salesLocked
    ? TAX_CODE_OPTIONS.filter((o) => (UNREGISTERED_TAX_CODES as readonly string[]).includes(o.value))
    : TAX_CODE_OPTIONS.filter((o) => side === 'PURCHASE' || !['RC', 'IMP'].includes(o.value));
  const showTax = vatApplicable || salesLocked;

  const unregisteredCode = (code: string | null | undefined, productCode?: string | null) => {
    const explicit = (code || '').toUpperCase();
    if (explicit === 'ZR' || explicit === 'EX') return explicit;
    const product = (productCode || '').toUpperCase();
    return product === 'ZR' || product === 'EX' ? product : 'ZR';
  };

  useEffect(() => {
    if (!salesLocked) return;
    let changed = false;
    const next = items.map((it) => {
      const product = products.find((p) => p.id === it.productId);
      const taxCode = unregisteredCode(it.taxCode, product?.taxCode);
      if (taxCode === (it.taxCode || '')) return it;
      changed = true;
      return { ...it, taxCode };
    });
    if (changed) onChange(next);
  }, [salesLocked, items, products, onChange]);

  const addItem = () => {
    onChange([...items, {
      productId: '', quantity: 1, unitPrice: 0, vatRate: salesLocked ? 0 : 5,
      taxCode: salesLocked ? 'ZR' : 'SR',
    }]);
  };

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const selectProduct = (index: number, product: Product | null) => {
    if (!product) return;
    const updated = [...items];
    const productCode = (product.taxCode || '').toUpperCase();
    const taxCode = salesLocked
      ? (productCode === 'EX' || productCode === 'ZR' ? productCode : 'ZR')
      : (productCode || 'SR');
    updated[index] = {
      ...updated[index],
      productId: product.id,
      productName: product.name,
      unit: product.unit || 'PCS',
      unitPrice: money(product[priceField] ?? 0),
      costPrice: money(product.costPrice ?? 0),
      vatRate: money(product.vatRate),
      taxCode,
    };
    onChange(updated);
  };

  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));

  // Same algorithm as the server (fils-rounded lines, discount allocated per line, VAT on the
  // discounted value) so the totals shown here equal the posted document.
  const doc = previewDocument(items.map((it) => ({ ...it, vatRate: chargedRate(it.taxCode || products.find((p) => p.id === it.productId)?.taxCode || undefined, it.vatRate) })), vatApplicable, showDiscount ? discount : 0);
  const calcLine = (item: LineItem) => {
    const c = doc.lines[items.indexOf(item)];
    return { sub: c.net, vat: c.vat, total: c.total };
  };
  const lineTotals = { sub: doc.subtotal, vat: doc.vatAmount, total: doc.total };
  const grandTotal = doc.total;

  return (
    <Box>
      {salesLocked ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          This company is not VAT-registered for this date — the TRN is missing, or the VAT registration date has not been reached.
          The document title is INVOICE. Tax code can only be zero rated (ZR) or exempt (EX).
        </Alert>
      ) : (
        <>
          {registered === false && side === 'PURCHASE' && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Purchases can be with or without VAT whether or not this company is VAT-registered.
              Tick VAT Applicable when the supplier charged VAT. Until this company is registered, that VAT is not recoverable and is included in the cost.
            </Alert>
          )}
          <FormControlLabel
            control={<Checkbox checked={vatApplicable} onChange={(e) => onVatChange(e.target.checked)} />}
            label={side === 'PURCHASE' ? 'VAT Applicable' : 'VAT Applicable (Tax Invoice)'}
            sx={{ mb: 1 }}
          />
          {!vatApplicable && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
              {side === 'PURCHASE'
                ? 'This purchase has no VAT.'
                : 'This invoice is outside the VAT system and will not appear in VAT reports.'}
            </Typography>
          )}
        </>
      )}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell>Item Code</TableCell>
              <TableCell>Packing</TableCell>
              <TableCell align="center">UOM</TableCell>
              <TableCell align="right">Qty</TableCell>
              {showCost && <TableCell align="right">Purchase Cost</TableCell>}
              <TableCell align="right">Unit Price</TableCell>
              {showTax && <TableCell>Tax code</TableCell>}
              {showTax && <TableCell align="right">VAT %</TableCell>}
              {showTax && <TableCell align="right">VAT Amt</TableCell>}
              <TableCell align="right">Total</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item, i) => {
              const calc = calcLine(item);
              const product = products.find((p) => p.id === item.productId);
              return (
                <TableRow key={i}>
                  <TableCell sx={{ minWidth: 220 }}>
                    <Autocomplete
                      size="small"
                      options={products}
                      getOptionLabel={productLabel}
                      value={product || null}
                      onChange={(_, v) => selectProduct(i, v)}
                      renderInput={(params) => <TextField {...params} placeholder="Select product" />}
                    />
                  </TableCell>
                  <TableCell>{product?.sku || '-'}</TableCell>
                  <TableCell>{product?.packing || '-'}</TableCell>
                  <TableCell align="center">{product?.unit || item.unit || '-'}</TableCell>
                  <TableCell align="right">
                    <NumberField value={item.quantity} onChange={(v) => updateItem(i, 'quantity', v)} />
                  </TableCell>
                  {showCost && (
                    <TableCell align="right">
                      {fmtMoney(item.costPrice ?? product?.costPrice ?? 0)}
                    </TableCell>
                  )}
                  <TableCell align="right">
                    <NumberField value={item.unitPrice} onChange={(v) => updateItem(i, 'unitPrice', v)} width={100} />
                  </TableCell>
                  {showTax && (
                    <TableCell sx={{ minWidth: 150 }}>
                      <TextField select size="small" fullWidth value={item.taxCode || (salesLocked ? 'ZR' : '')}
                        SelectProps={{ native: true }}
                        onChange={(e) => updateItem(i, 'taxCode', e.target.value)}>
                        {!salesLocked && <option value="">Default{product?.taxCode ? ` (${product.taxCode})` : ' (SR)'}</option>}
                        {codeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </TextField>
                    </TableCell>
                  )}
                  {showTax && (
                    <TableCell align="right">{chargedRate(item.taxCode || (salesLocked ? 'ZR' : product?.taxCode || undefined), item.vatRate)}%</TableCell>
                  )}
                  {showTax && (
                    <TableCell align="right">{fmtMoney(calc.vat)}</TableCell>
                  )}
                  <TableCell align="right">{fmtMoney(calc.total)}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => removeItem(i)} color="error"><Delete /></IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, alignItems: 'flex-end' }}>
        <Button startIcon={<Add />} onClick={addItem} size="small">Add Line</Button>
        <Box sx={{ textAlign: 'right' }}>
          <div>Subtotal: {fmtMoney(lineTotals.sub)}</div>
          {showTax && <div>VAT: {fmtMoney(lineTotals.vat)}</div>}
          {showDiscount && onDiscountChange && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, my: 0.5 }}>
              <span>Discount:</span>
              <NumberField value={discount} onChange={onDiscountChange} width={100} />
            </Box>
          )}
          <strong>Total: {fmtMoney(grandTotal)}</strong>
        </Box>
      </Box>
    </Box>
  );
}
