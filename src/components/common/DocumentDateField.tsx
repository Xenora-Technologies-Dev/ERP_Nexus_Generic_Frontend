import { TextField, TextFieldProps } from '@mui/material';
import { todayISO } from '../../utils/date';

type Props = Omit<TextFieldProps, 'type' | 'value' | 'onChange'> & {
  value?: string;
  onChange: (value: string) => void;
};

/**
 * Document date field: defaults to today when empty and required,
 * allows past/future, and uses DD/MM/YYYY presentation via en-GB locale.
 * Value is always YYYY-MM-DD for the API.
 */
export default function DocumentDateField({
  value,
  onChange,
  label = 'Date',
  fullWidth = true,
  required = true,
  helperText = 'DD/MM/YYYY — past or future dates allowed',
  ...rest
}: Props) {
  const displayValue = value || (required ? todayISO() : '');
  return (
    <TextField
      {...rest}
      type="date"
      label={label}
      value={displayValue}
      onChange={(e) => onChange(e.target.value)}
      fullWidth={fullWidth}
      required={required}
      InputLabelProps={{ shrink: true, ...rest.InputLabelProps }}
      inputProps={{ lang: 'en-GB', ...rest.inputProps }}
      helperText={helperText}
    />
  );
}
