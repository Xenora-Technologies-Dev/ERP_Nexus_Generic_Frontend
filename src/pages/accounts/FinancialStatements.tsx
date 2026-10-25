import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Alert,
  Skeleton,
  Tabs,
  Tab,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Paper,
} from '@mui/material';
import { ExpandMore, PictureAsPdf } from '@mui/icons-material';
import { api } from '../../api/client';
import PageHeader from '../../components/common/PageHeader';
import { brandColors } from '../../theme';

const formatAed = (n: number) =>
  n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface AccountLineItem {
  id: string;
  code: string;
  name: string;
  amount: number;
}

interface CategorySection {
  label: string;
  accounts: AccountLineItem[];
  total: number;
}

interface PeriodAmounts {
  current: number;
  prior?: number;
}

interface ProfitLossReport {
  period: { from: string; to: string };
  priorPeriod?: { from: string; to: string };
  revenue: CategorySection;
  otherIncome: CategorySection;
  cogs: CategorySection;
  operatingExpenses: CategorySection;
  otherExpenses: CategorySection;
  grossProfit: PeriodAmounts;
  operatingProfit: PeriodAmounts;
  netProfit: PeriodAmounts;
}

interface BalanceSheetReport {
  asOf: string;
  assets: {
    currentAssets: CategorySection;
    prepaidExpenses: CategorySection;
    fixedAssets: CategorySection;
    otherAssets: CategorySection;
    total: number;
  };
  liabilities: { currentLiabilities: CategorySection; longTermLiabilities: CategorySection; total: number };
  equity: {
    ownerCapital: CategorySection;
    ownerCurrentAccount: CategorySection;
    ownerDrawings: CategorySection;
    retainedEarnings: number;
    total: number;
  };
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  balanceCheck: boolean;
}

interface CashFlowReport {
  period: { from: string; to: string };
  openingCash: number;
  closingCash: number;
  netMovement: number;
  operating: {
    netProfit: number;
    changeInReceivables: number;
    changeInPayables: number;
    changeInInventory: number;
    total: number;
  };
  financing: { ownerEquityMovements: number; total: number };
}

interface Paginated<T> {
  data: T;
  total: number;
  page: number;
  pageSize: number;
}

type TabKey = 'pl' | 'bs' | 'cf';

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function yearStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

function CategoryAccordion({
  section,
  showPrior,
  priorTotal,
}: {
  section: CategorySection;
  showPrior?: boolean;
  priorTotal?: number;
}) {
  return (
    <Accordion disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 1 }}>
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', pr: 2 }}>
          <Typography fontWeight={600}>{section.label}</Typography>
          <Typography fontWeight={600}>{formatAed(section.total)}</Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        {section.accounts.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No activity in this period</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Account</TableCell>
                <TableCell align="right">Amount (AED)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {section.accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.code}</TableCell>
                  <TableCell>{a.name}</TableCell>
                  <TableCell align="right">{formatAed(a.amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell colSpan={2}><strong>Subtotal</strong></TableCell>
                <TableCell align="right"><strong>{formatAed(section.total)}</strong></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
        {showPrior && priorTotal !== undefined && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Prior period total: {formatAed(priorTotal)}
          </Typography>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

function SummaryRow({
  label,
  amounts,
  showPrior,
  highlight,
}: {
  label: string;
  amounts: PeriodAmounts;
  showPrior: boolean;
  highlight?: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        py: 1.5,
        px: 2,
        bgcolor: highlight ? brandColors.lightGreen : 'grey.100',
        borderRadius: 1,
        mb: 1,
        flexWrap: 'wrap',
        gap: 1,
      }}
    >
      <Typography fontWeight={700}>{label}</Typography>
      <Box sx={{ display: 'flex', gap: 4 }}>
        <Box sx={{ textAlign: 'right', minWidth: 120 }}>
          <Typography variant="caption" color="text.secondary">Current</Typography>
          <Typography fontWeight={700}>{formatAed(amounts.current)}</Typography>
        </Box>
        {showPrior && (
          <Box sx={{ textAlign: 'right', minWidth: 120 }}>
            <Typography variant="caption" color="text.secondary">Prior</Typography>
            <Typography fontWeight={700}>{formatAed(amounts.prior ?? 0)}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default function FinancialStatements() {
  const [tab, setTab] = useState<TabKey>('pl');
  const [dateFrom, setDateFrom] = useState(yearStartIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [asOf, setAsOf] = useState(todayIso());
  const [compareWithPrev, setCompareWithPrev] = useState(false);

  const [pl, setPl] = useState<ProfitLossReport | null>(null);
  const [bs, setBs] = useState<BalanceSheetReport | null>(null);
  const [cf, setCf] = useState<CashFlowReport | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const fetchPl = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Paginated<ProfitLossReport>>('/accounts/profit-loss', {
        params: { dateFrom, dateTo, compareWithPrev },
      });
      setPl(res.data.data);
    } catch {
      setError('Failed to load Profit & Loss statement');
      setPl(null);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, compareWithPrev]);

  const fetchBs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Paginated<BalanceSheetReport>>('/accounts/balance-sheet', {
        params: { asOf },
      });
      setBs(res.data.data);
    } catch {
      setError('Failed to load Balance Sheet');
      setBs(null);
    } finally {
      setLoading(false);
    }
  }, [asOf]);

  const fetchCf = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Paginated<CashFlowReport>>('/accounts/cash-flow', {
        params: { dateFrom, dateTo },
      });
      setCf(res.data.data);
    } catch {
      setError('Failed to load Cash Flow statement');
      setCf(null);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (tab === 'pl') fetchPl();
    else if (tab === 'bs') fetchBs();
    else fetchCf();
  }, [tab, fetchPl, fetchBs, fetchCf]);

  const handleExportPdf = async () => {
    setExporting(true);
    setError('');
    try {
      let url = '';
      let filename = 'report.pdf';
      if (tab === 'pl') {
        url = '/accounts/profit-loss';
        filename = 'profit-loss.pdf';
      } else if (tab === 'bs') {
        url = '/accounts/balance-sheet';
        filename = 'balance-sheet.pdf';
      } else {
        url = '/accounts/cash-flow';
        filename = 'cash-flow.pdf';
      }

      const params: Record<string, string | boolean> = { format: 'pdf' };
      if (tab === 'bs') params.asOf = asOf;
      else {
        params.dateFrom = dateFrom;
        params.dateTo = dateTo;
        if (tab === 'pl') params.compareWithPrev = compareWithPrev;
      }

      const res = await api.get(url, { params, responseType: 'blob' });
      const blobUrl = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      setError('PDF export failed');
    } finally {
      setExporting(false);
    }
  };

  const showPrior = compareWithPrev && !!pl?.priorPeriod;

  return (
    <Box>
      <PageHeader
        title="Financial Statements"
        subtitle="Profit & Loss, Balance Sheet, and Cash Flow"
      />

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v: TabKey) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Profit & Loss" value="pl" />
          <Tab label="Balance Sheet" value="bs" />
          <Tab label="Cash Flow" value="cf" />
        </Tabs>
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        {tab !== 'bs' && (
          <>
            <TextField
              size="small"
              label="From"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              size="small"
              label="To"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </>
        )}
        {tab === 'bs' && (
          <TextField
            size="small"
            label="As of Date"
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        )}
        {tab === 'pl' && (
          <FormControlLabel
            control={
              <Switch
                checked={compareWithPrev}
                onChange={(e) => setCompareWithPrev(e.target.checked)}
              />
            }
            label="Compare with prior period"
          />
        )}
        <Button variant="outlined" onClick={() => { if (tab === 'pl') fetchPl(); else if (tab === 'bs') fetchBs(); else fetchCf(); }}>
          Refresh
        </Button>
        <Button
          variant="contained"
          startIcon={<PictureAsPdf />}
          onClick={handleExportPdf}
          disabled={exporting || loading}
        >
          Export PDF
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rounded" height={56} sx={{ mb: 1 }} />
          ))}
        </Box>
      ) : tab === 'pl' && pl ? (
        <Box>
          {showPrior && pl.priorPeriod && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Comparing {dateFrom} to {dateTo} with prior period{' '}
              {pl.priorPeriod.from.slice(0, 10)} to {pl.priorPeriod.to.slice(0, 10)}
            </Alert>
          )}
          <CategoryAccordion section={pl.revenue} />
          <CategoryAccordion section={pl.cogs} />
          <SummaryRow label="Gross Profit" amounts={pl.grossProfit} showPrior={showPrior} highlight />
          <CategoryAccordion section={pl.operatingExpenses} />
          <SummaryRow label="Operating Profit" amounts={pl.operatingProfit} showPrior={showPrior} highlight />
          <CategoryAccordion section={pl.otherIncome} />
          <CategoryAccordion section={pl.otherExpenses} />
          <SummaryRow label="Net Profit" amounts={pl.netProfit} showPrior={showPrior} highlight />
        </Box>
      ) : tab === 'bs' && bs ? (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Chip
              label={bs.balanceCheck ? 'Balanced' : 'Out of Balance'}
              color={bs.balanceCheck ? 'success' : 'error'}
            />
            <Typography variant="body2" color="text.secondary">
              Total Assets: {formatAed(bs.totalAssets)} | Liabilities + Equity: {formatAed(bs.totalLiabilitiesAndEquity)}
            </Typography>
          </Box>
          <Typography variant="h6" gutterBottom>Assets</Typography>
          <CategoryAccordion section={bs.assets.currentAssets} />
          <CategoryAccordion section={bs.assets.prepaidExpenses} />
          <CategoryAccordion section={bs.assets.fixedAssets} />
          <CategoryAccordion section={bs.assets.otherAssets} />
          <SummaryRow
            label="Total Assets"
            amounts={{ current: bs.totalAssets }}
            showPrior={false}
            highlight
          />
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Liabilities</Typography>
          <CategoryAccordion section={bs.liabilities.currentLiabilities} />
          <CategoryAccordion section={bs.liabilities.longTermLiabilities} />
          <SummaryRow
            label="Total Liabilities"
            amounts={{ current: bs.liabilities.total }}
            showPrior={false}
          />
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Equity</Typography>
          <CategoryAccordion section={bs.equity.ownerCapital} />
          <CategoryAccordion section={bs.equity.ownerCurrentAccount} />
          <CategoryAccordion section={bs.equity.ownerDrawings} />
          <SummaryRow
            label="Retained Earnings"
            amounts={{ current: bs.equity.retainedEarnings }}
            showPrior={false}
          />
          <SummaryRow
            label="Total Equity"
            amounts={{ current: bs.equity.total }}
            showPrior={false}
            highlight
          />
        </Box>
      ) : tab === 'cf' && cf ? (
        <Box>
          <SummaryRow label="Opening Cash" amounts={{ current: cf.openingCash }} showPrior={false} />
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Operating Activities</Typography>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            {[
              ['Net Profit', cf.operating.netProfit],
              ['Change in Receivables', cf.operating.changeInReceivables],
              ['Change in Payables', cf.operating.changeInPayables],
              ['Change in Inventory', cf.operating.changeInInventory],
            ].map(([label, val]) => (
              <Box key={label as string} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Typography variant="body2">{label as string}</Typography>
                <Typography variant="body2" fontWeight={600}>{formatAed(val as number)}</Typography>
              </Box>
            ))}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, mt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography fontWeight={700}>Net Cash from Operating</Typography>
              <Typography fontWeight={700}>{formatAed(cf.operating.total)}</Typography>
            </Box>
          </Paper>
          <Typography variant="h6" sx={{ mb: 1 }}>Financing Activities</Typography>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography variant="body2">Owner Equity Movements</Typography>
              <Typography variant="body2" fontWeight={600}>{formatAed(cf.financing.ownerEquityMovements)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, mt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography fontWeight={700}>Net Cash from Financing</Typography>
              <Typography fontWeight={700}>{formatAed(cf.financing.total)}</Typography>
            </Box>
          </Paper>
          <SummaryRow label="Closing Cash" amounts={{ current: cf.closingCash }} showPrior={false} highlight />
          <SummaryRow label="Net Movement" amounts={{ current: cf.netMovement }} showPrior={false} />
        </Box>
      ) : !loading && (
        <Alert severity="info">No data available for the selected period.</Alert>
      )}
    </Box>
  );
}
