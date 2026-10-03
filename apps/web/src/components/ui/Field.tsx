import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

const CONTROL =
  'block w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:bg-gray-50 disabled:text-gray-500';

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}

/** Label, control, hint and error message, wired together for screen readers. */
function FieldShell({ id, label, error, hint, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: ReactNode) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

type Common = { label: string; error?: string; hint?: ReactNode };

export const Input = forwardRef<HTMLInputElement, Common & InputHTMLAttributes<HTMLInputElement>>(
  function Input({ label, error, hint, className = '', id, ...rest }, ref) {
    const generated = useId();
    const inputId = id ?? generated;
    return (
      <FieldShell id={inputId} label={label} error={error} hint={hint}>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(inputId, error, hint)}
          className={`${CONTROL} ${error ? 'border-red-400' : 'border-gray-300'} ${className}`}
          {...rest}
        />
      </FieldShell>
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  Common & TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ label, error, hint, className = '', id, ...rest }, ref) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <FieldShell id={inputId} label={label} error={error} hint={hint}>
      <textarea
        ref={ref}
        id={inputId}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, error, hint)}
        className={`${CONTROL} ${error ? 'border-red-400' : 'border-gray-300'} ${className}`}
        {...rest}
      />
    </FieldShell>
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  Common & SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ label, error, hint, className = '', id, children, ...rest }, ref) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <FieldShell id={inputId} label={label} error={error} hint={hint}>
      <select
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, error, hint)}
        className={`${CONTROL} ${error ? 'border-red-400' : 'border-gray-300'} ${className}`}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
});

export const Checkbox = forwardRef<
  HTMLInputElement,
  { label: ReactNode } & InputHTMLAttributes<HTMLInputElement>
>(function Checkbox({ label, ...rest }, ref) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        {...rest}
      />
      <span>{label}</span>
    </label>
  );
});
