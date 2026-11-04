import type { ChangeEvent } from 'react';

interface FormFieldProps {
  name: string;
  label: string;
  value: string;
  error?: string | undefined;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  maxLength?: number;
  autoComplete?: string;
  multiline?: boolean;
}

export function FormField({ label, error, onChange, multiline, type, ...props }: FormFieldProps) {
  const errorId = `${props.name}-error`;
  const control = {
    ...props,
    id: props.name,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value),
  };

  return (
    <div className="form-field">
      <label htmlFor={props.name}>{label}</label>
      {multiline ? <textarea rows={5} {...control} /> : <input type={type} {...control} />}
      {error && (
        <p id={errorId} className="form-field__error">
          {error}
        </p>
      )}
    </div>
  );
}
