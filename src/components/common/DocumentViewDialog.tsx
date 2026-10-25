import { D, fmtMoney, lineNet, money } from '../../utils/money';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper, Divider, Grid,
} from '@mui/material';
import { StatusChip } from './DocumentTable';
import { formatDateDDMMYYYY } from '../../utils/date';

export interface DocumentViewItem {
  productName?: string;
  description?: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
  vatRate?: number;
  vatAmount?: number;
  total?: number;
  product?: { name?: string; sku?: string; unit?: string };
}

export interface DocumentViewData {
  documentNumber: string;
  date?: string;
  status?: string;
  reference?: string | null;
  remarks?: string | null;
  notes?: string | null;
  partyName?: string;
  partyLabel?: string;
  partyAddress?: string | null;
  partyVatNumber?: string | null;
  partyPhone?: string | null;
  partyEmail?: string | null;
  vatApplicable?: boolean;
  subtotal?: number;
  vatAmount?: number;
  discount?: number;
  total?: number;
  items: DocumentViewItem[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  document: DocumentViewData | null;
  extraFields?: { label: string; value: string }[];
  /** Payment/receipt vouchers: party left, meta right, Description|Amount table.
   *  qtyOnly: GRN/DN — description, UOM, qty only (no prices). */
  variant?: 'standard' | 'voucher' | 'qtyOnly';
  onDownload?: () => void | Promise<void>;
  onPrint?: () => void | Promise<void>;
  busy?: boolean;
}

const formatDate = (d?: string) => formatDateDDMMYYYY(d);
const formatCurrency = (n?: number) => (n ?? 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Qty × unit price (pre-VAT line value). */
const lineValue = (item: DocumentViewItem): number => money(lineNet({ quantity: item.quantity, unitPrice: item.unitPrice }));

/** Prefer stored vatAmount; fall back to qty × unitPrice × vatRate/100 when missing. */
const lineVatAmount = (item: DocumentViewItem): number => {
  if (item.vatAmount != null && item.vatAmount !== ('' as unknown)) {
    return money(item.vatAmount);
  }
  return money(D(lineValue(item)).times(D(item.vatRate)).dividedBy(100));
};

export default function DocumentViewDialog({
  open, onClose, title, document, extraFields, variant = 'standard', onDownload, onPrint, busy,
}: Props) {
  if (!document) return null;

  const items = document.items || [];
  const isVoucher = variant === 'voucher';
  const isQtyOnly = variant === 'qtyOnly';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title} — {document.documentNumber}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6}>
            {document.partyName && (
              <Box>
                <Typography variant="caption" color="text.secondary">{document.partyLabel || 'Party'}</Typography>
                <Typography variant="body2" fontWeight={600}>{document.partyName}</Typography>
                {document.partyAddress && (
                  <Typography variant="body2" color="text.secondary">{document.partyAddress}</Typography>
                )}
                {document.partyVatNumber && (
                  <Typography variant="body2">TRN: {document.partyVatNumber}</Typography>
                )}
                {document.partyPhone && (
                  <Typography variant="body2">Tel: {document.partyPhone}</Typography>
                )}
                {document.partyEmail && (
                  <Typography variant="body2">Email: {document.partyEmail}</Typography>
                )}
              </Box>
            )}
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box sx={{ textAlign: { sm: 'right' } }}>
              <Typography variant="caption" color="text.secondary">Date</Typography>
              <Typography variant="body2">{formatDate(document.date)}</Typography>
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">No</Typography>
                <Typography variant="body2">{document.documentNumber}</Typography>
              </Box>
              {document.reference && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">Reference</Typography>
                  <Typography variant="body2">{document.reference}</Typography>
                </Box>
              )}
              {extraFields?.map((f) => (
                <Box key={f.label} sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">{f.label}</Typography>
                  <Typography variant="body2">{f.value}</Typography>
                </Box>
              ))}
              {document.status && (
                <Box sx={{ mt: 1, display: 'flex', justifyContent: { sm: 'flex-end' } }}>
                  <StatusChip status={document.status} />
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>

        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Description</TableCell>
                {!isVoucher && (
                  <>
                    <TableCell align="center">UOM</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    {!isQtyOnly && (
                      <>
                        <TableCell align="right">Unit Price</TableCell>
                        <TableCell align="right">Value</TableCell>
                        {document.vatApplicable && <TableCell align="right">VAT</TableCell>}
                      </>
                    )}
                  </>
                )}
                {!isQtyOnly && (
                  <TableCell align="right">{isVoucher ? 'Amount' : 'Total'}</TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{item.description || item.productName || item.product?.name || '-'}</TableCell>
                  {!isVoucher && (
                    <>
                      <TableCell align="center">{item.unit?.trim() || item.product?.unit?.trim() || '-'}</TableCell>
                      <TableCell align="right">{fmtMoney(item.quantity)}</TableCell>
                      {!isQtyOnly && (
                        <>
                          <TableCell align="right">{formatCurrency(money(item.unitPrice))}</TableCell>
                          <TableCell align="right">{formatCurrency(lineValue(item))}</TableCell>
                          {document.vatApplicable && (
                            <TableCell align="right">{formatCurrency(lineVatAmount(item))}</TableCell>
                          )}
                        </>
                      )}
                    </>
                  )}
                  {!isQtyOnly && (
                    <TableCell align="right">{formatCurrency(money(item.total))}</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {!isQtyOnly && (
          <Box sx={{ textAlign: 'right', mb: 2 }}>
            {!isVoucher && document.subtotal !== undefined && (
              <Typography variant="body2">Subtotal: {formatCurrency(document.subtotal)}</Typography>
            )}
            {!isVoucher && document.vatApplicable && document.vatAmount !== undefined && (
              <Typography variant="body2">VAT: {formatCurrency(document.vatAmount)}</Typography>
            )}
            {!isVoucher && document.discount !== undefined && D(document.discount).gt(0) && (
              <Typography variant="body2">Discount: -{formatCurrency(document.discount)}</Typography>
            )}
            {document.total !== undefined && (
              <Typography variant="subtitle1" fontWeight={700}>Total: {formatCurrency(document.total)}</Typography>
            )}
          </Box>
        )}

        {(document.remarks || document.notes) && (
          <>
            <Divider sx={{ mb: 1 }} />
            {document.remarks && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">Remarks</Typography>
                <Typography variant="body2">{document.remarks}</Typography>
              </Box>
            )}
            {!isVoucher && document.notes && (
              <Box>
                <Typography variant="caption" color="text.secondary">Notes</Typography>
                <Typography variant="body2">{document.notes}</Typography>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {onPrint && (
          <Button variant="outlined" onClick={() => void onPrint()} disabled={busy}>Print</Button>
        )}
        {onDownload && (
          <Button variant="contained" onClick={() => void onDownload()} disabled={busy}>
            {busy ? 'Preparing…' : 'Download PDF'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
