import { fmtMoney, money, parseInput, previewDocument } from '../../utils/money';
import { useState, useEffect } from 'react';
import {
  Box, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  IconButton, TextField, Autocomplete, Button, FormControlLabel, Checkbox, Paper, Typography,
} from '@mui/material';
import { Delete, Add } from '@mui/icons-material';
import { TAX_CODE_OPTIONS } from '../../utils/uae';

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
}

export default function LineItemsForm({
  products, items, onChange, vatApplicable, onVatChange,
  priceField = 'sellingPrice', showCost = false,
  showDiscount = false, discount = 0, onDiscountChange, taxSide,
}: Props) {
  const side = taxSide ?? (priceField === 'costPrice' ? 'PURCHASE' : 'SALES');
  const codeOptions = TAX_CODE_OPTIONS.filter((o) => side === 'PURCHASE' || !['RC', 'IMP'].includes(o.value));
  const addItem = () => {
    onChange([...items, { productId: '', quantity: 1, unitPrice: 0, vatRate: 5 }]);
  };

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const selectProduct = (index: number, product: Product | null) => {
    if (!product) return;
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      productId: product.id,
      productName: product.name,
      unit: product.unit || 'PCS',
      unitPrice: money(product[priceField] ?? 0),
      costPrice: money(product.costPrice ?? 0),
      vatRate: money(product.vatRate),
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
      <FormControlLabel
        control={<Checkbox checked={vatApplicable} onChange={(e) => onVatChange(e.target.checked)} />}
        label="VAT Applicable (Tax Invoice)"
        sx={{ mb: 1 }}
      />
      {!vatApplicable && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
          This invoice is outside the VAT system and will not appear in VAT reports.
        </Typography>
      )}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell align="center">UOM</TableCell>
              <TableCell align="right">Qty</TableCell>
              {showCost && <TableCell align="right">Purchase Cost</TableCell>}
              <TableCell align="right">Unit Price</TableCell>
              {vatApplicable && <TableCell>Tax code</TableCell>}
              {vatApplicable && <TableCell align="right">VAT %</TableCell>}
              {vatApplicable && <TableCell align="right">VAT Amt</TableCell>}
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
                  {vatApplicable && (
                    <TableCell sx={{ minWidth: 110 }}>
                      <TextField select size="small" fullWidth value={item.taxCode || ''}
                        SelectProps={{ native: true }}
                        onChange={(e) => updateItem(i, 'taxCode', e.target.value)}>
                        <option value="">Default{product?.taxCode ? ` (${product.taxCode})` : ''}</option>
                        {codeOptions.map((o) => <option key={o.value} value={o.value}>{o.value}</option>)}
                      </TextField>
                    </TableCell>
                  )}
                  {vatApplicable && (
                    <TableCell align="right">{chargedRate(item.taxCode || product?.taxCode || undefined, item.vatRate)}%</TableCell>
                  )}
                  {vatApplicable && (
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
          {vatApplicable && <div>VAT: {fmtMoney(lineTotals.vat)}</div>}
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
