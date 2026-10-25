import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Alert, Paper, Grid, TextField, Table, TableBody, TableCell, TableRow, TableHead, Typography, Autocomplete, IconButton, ToggleButton, ToggleButtonGroup, Divider,
} from '@mui/material';
import { Delete } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import { fmtMoney, parseInput } from '../../utils/money';
import { apiError } from '../../utils/apiError';

interface Product { id: string; sku: string; name: string; sellingPrice: string | number; vatRate: string | number; taxCode?: string | null }
interface Session { id: string; sessionNumber: string; openingFloat: string; openedAt: string; status: string }
interface CartLine { product: Product; quantity: string; discount: string }
interface Report {
  type: 'X' | 'Z'; sessionNumber: string; transactions: number; itemsSold: number; netSales: number; discounts: number; vat: number; grossSales: number;
  vatBreakdown: { rate: number; net: number; vat: number }[]; payments: { cash: { count: number; total: number }; card: { count: number; total: number } };
  openingFloat: number; expectedCash: number; countedCash: number | null; cashVariance: number | null; openedAt: string; closedAt?: string | null;
}

/** Display-only cart preview; the server recomputes all amounts with decimal arithmetic. */
const preview = (cart: CartLine[]) => {
  let net = 0, vat = 0;
  for (const l of cart) {
    const n = Math.round((parseInput(l.quantity) * Number(l.product.sellingPrice) - parseInput(l.discount)) * 100) / 100; // num-ok: display preview only
    net += n; vat += Math.round(n * Number(l.product.vatRate)) / 100; // num-ok: display preview only
  }
  return { net, vat, total: net + vat }; // num-ok: display preview only
};

export default function PosPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [tendered, setTendered] = useState('');
  const [float, setFloat] = useState('0');
  const [counted, setCounted] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const err = (e: unknown) => setMsg({ type: 'error', text: apiError(e, 'Request failed') });

  const load = async () => {
    try {
      const [s, p] = await Promise.all([api.get('/pos/sessions/current'), api.get<Product[]>('/inventory/products', { params: { active: true } })]);
      setSession(s.data || null);
      setProducts(Array.isArray(p.data) ? p.data : (p.data as { data?: Product[] }).data ?? []);
    } catch (e) { err(e); }
  };
  useEffect(() => { load(); }, []);
  const totals = useMemo(() => preview(cart), [cart]);

  const add = (p: Product | null) => {
    if (!p) return;
    setCart((c) => {
      const i = c.findIndex((l) => l.product.id === p.id);
      if (i >= 0) return c.map((l, j) => (j === i ? { ...l, quantity: String(parseInput(l.quantity) + 1) } : l)); // num-ok: quantity
      return [...c, { product: p, quantity: '1', discount: '0' }];
    });
  };
  const open = async () => {
    try { const r = await api.post('/pos/sessions', { openingFloat: parseInput(float) }); setSession(r.data); setReport(null); setMsg({ type: 'success', text: `Session ${r.data.sessionNumber} opened` }); } catch (e) { err(e); }
  };
  const pay = async () => {
    if (!session || !cart.length) return;
    try {
      const r = await api.post(`/pos/sessions/${session.id}/sales`, {
        paymentMethod: method, amountTendered: method === 'CASH' && tendered ? parseInput(tendered) : undefined,
        lines: cart.map((l) => ({ productId: l.product.id, quantity: parseInput(l.quantity), discount: parseInput(l.discount) || undefined })),
      });
      setMsg({ type: 'success', text: `Receipt ${r.data.receiptNumber}: total AED ${fmtMoney(r.data.total)}${r.data.changeGiven ? ` · change AED ${fmtMoney(r.data.changeGiven)}` : ''}` });
      setCart([]); setTendered('');
    } catch (e) { err(e); }
  };
  const xReport = async () => { if (session) try { setReport((await api.get(`/pos/sessions/${session.id}/report`)).data); } catch (e) { err(e); } };
  const close = async () => {
    if (!session) return;
    try { const r = await api.post(`/pos/sessions/${session.id}/close`, { countedCash: parseInput(counted) }); setReport(r.data); setSession(null); setCounted(''); } catch (e) { err(e); }
  };

  return (
    <Box>
      <PageHeader title="Point of Sale" subtitle={session ? `Session ${session.sessionNumber} · opened ${new Date(session.openedAt).toLocaleString()}` : 'No open session'} />
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      {!session && (
        <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField size="small" label="Opening float (AED)" value={float} onChange={(e) => setFloat(e.target.value)} />
          <Button variant="contained" onClick={open}>Open session</Button>
        </Paper>
      )}
      {session && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2 }}>
              <Autocomplete options={products} getOptionLabel={(p) => `${p.sku} · ${p.name} · AED ${fmtMoney(p.sellingPrice)}`} onChange={(_e, v) => add(v)} value={null}
                renderInput={(params) => <TextField {...params} label="Scan or search product" autoFocus />} sx={{ mb: 2 }} />
              <Table size="small">
                <TableHead><TableRow><TableCell>Item</TableCell><TableCell width={90}>Qty</TableCell><TableCell align="right">Price</TableCell><TableCell width={100}>Discount</TableCell><TableCell /></TableRow></TableHead>
                <TableBody>
                  {cart.map((l, i) => (
                    <TableRow key={l.product.id}>
                      <TableCell>{l.product.name}</TableCell>
                      <TableCell><TextField size="small" value={l.quantity} onChange={(e) => setCart(cart.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} /></TableCell>
                      <TableCell align="right">{fmtMoney(l.product.sellingPrice)}</TableCell>
                      <TableCell><TextField size="small" value={l.discount} onChange={(e) => setCart(cart.map((x, j) => (j === i ? { ...x, discount: e.target.value } : x)))} /></TableCell>
                      <TableCell><IconButton size="small" onClick={() => setCart(cart.filter((_x, j) => j !== i))}><Delete fontSize="small" /></IconButton></TableCell>
                    </TableRow>
                  ))}
                  {!cart.length && <TableRow><TableCell colSpan={5}><Typography color="text.secondary">Cart is empty</Typography></TableCell></TableRow>}
                </TableBody>
              </Table>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography>Net: AED {fmtMoney(totals.net)}</Typography>
              <Typography>VAT: AED {fmtMoney(totals.vat)}</Typography>
              <Typography variant="h5" sx={{ my: 1 }}>Total: AED {fmtMoney(totals.total)}</Typography>
              <ToggleButtonGroup exclusive value={method} onChange={(_e, v) => v && setMethod(v)} size="small" sx={{ mb: 1 }}>
                <ToggleButton value="CASH">Cash</ToggleButton><ToggleButton value="CARD">Card</ToggleButton>
              </ToggleButtonGroup>
              {method === 'CASH' && <TextField fullWidth size="small" label="Amount tendered" value={tendered} onChange={(e) => setTendered(e.target.value)} sx={{ mb: 1 }} />}
              <Button fullWidth variant="contained" size="large" disabled={!cart.length} onClick={pay}>Complete sale</Button>
            </Paper>
            <Paper sx={{ p: 2 }}>
              <Button fullWidth onClick={xReport} sx={{ mb: 1 }}>X report (interim)</Button>
              <Divider sx={{ my: 1 }} />
              <TextField fullWidth size="small" label="Counted cash in drawer" value={counted} onChange={(e) => setCounted(e.target.value)} sx={{ mb: 1 }} />
              <Button fullWidth color="warning" variant="outlined" disabled={counted === ''} onClick={close}>Close session &amp; print Z report</Button>
            </Paper>
          </Grid>
        </Grid>
      )}
      {report && (
        <Paper sx={{ p: 2, mt: 2, maxWidth: 480 }} id="z-report">
          <Typography variant="h6">{report.type} report · {report.sessionNumber}</Typography>
          <Table size="small"><TableBody>
            {([
              ['Transactions', String(report.transactions)], ['Items sold', String(report.itemsSold)], ['Discounts', fmtMoney(report.discounts)],
              ['Net sales', fmtMoney(report.netSales)], ['VAT', fmtMoney(report.vat)], ['Gross sales', fmtMoney(report.grossSales)],
              ...report.vatBreakdown.map((v) => [`VAT ${v.rate}% on ${fmtMoney(v.net)}`, fmtMoney(v.vat)]),
              [`Cash (${report.payments.cash.count})`, fmtMoney(report.payments.cash.total)], [`Card (${report.payments.card.count})`, fmtMoney(report.payments.card.total)],
              ['Opening float', fmtMoney(report.openingFloat)], ['Expected cash', fmtMoney(report.expectedCash)],
              ...(report.countedCash !== null ? [['Counted cash', fmtMoney(report.countedCash)], ['Over / (short)', fmtMoney(report.cashVariance ?? 0)]] : []),
            ] as [string, string][]).map(([k, v]) => <TableRow key={k}><TableCell>{k}</TableCell><TableCell align="right">{v}</TableCell></TableRow>)}
          </TableBody></Table>
          <Button sx={{ mt: 1 }} onClick={() => window.print()}>Print</Button>
        </Paper>
      )}
    </Box>
  );
}
