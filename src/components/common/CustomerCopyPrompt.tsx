import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

interface Props {
  open: boolean;
  /** Short name of the document, e.g. "invoice" or "delivery note". */
  documentLabel: string;
  busy?: boolean;
  onClose: () => void;
  /** true = office copy plus a customer copy labelled at the bottom of the PDF. */
  onConfirm: (includeCustomerCopy: boolean) => void;
}

/** Asks which PDF copies to download before any file is saved. */
export default function CustomerCopyPrompt({ open, documentLabel, busy, onClose, onConfirm }: Props) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Download {documentLabel}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          The office copy downloads on its own. A customer copy is the same document with “Customer Copy” printed at the bottom.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={() => onConfirm(false)} disabled={busy}>Office copy only</Button>
        <Button variant="contained" onClick={() => onConfirm(true)} disabled={busy}>
          {busy ? <CircularProgress size={18} /> : 'Include customer copy'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
