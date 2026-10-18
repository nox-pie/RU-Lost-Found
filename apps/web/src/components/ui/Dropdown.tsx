import {
  Field,
  Label,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from '@headlessui/react';
import { Check, ChevronDown, type LucideIcon } from 'lucide-react';
import { useId, type ReactNode } from 'react';

export interface DropdownOption<T extends string = string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface DropdownProps<T extends string> {
  /** The dropdown's name, shown above it (or only to screen readers with `hideLabel`). */
  label: string;
  hideLabel?: boolean;
  value: T;
  onChange: (value: T) => void;
  options: readonly DropdownOption<T>[];
  /** Shown while the value matches no option (e.g. nothing chosen yet). */
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
  disabled?: boolean;
  /** `field` matches the text inputs; `pill` is a compact rounded filter (browse page, tables). */
  look?: 'field' | 'pill';
  onBlur?: () => void;
  className?: string;
}

/**
 * A themed dropdown (Headless UI Listbox): brand colours, a check on the current option and
 * optional icons, instead of the operating system's unstyled list. Keyboard and screen readers
 * work as with a native one: arrow keys, Home/End, type-ahead, Enter, Esc.
 */
export function Dropdown<T extends string>({
  label,
  hideLabel = false,
  value,
  onChange,
  options,
  placeholder = 'Choose…',
  error,
  hint,
  disabled,
  look = 'field',
  onBlur,
  className = '',
}: DropdownProps<T>) {
  const messageId = useId();
  const selected = options.find((option) => option.value === value);
  const Icon = selected?.icon;
  const pill = look === 'pill';

  return (
    <Field disabled={disabled} className={className}>
      <Label
        className={
          hideLabel
            ? 'sr-only'
            : 'mb-1 block text-sm font-medium text-gray-700 data-disabled:opacity-60'
        }
      >
        {label}
      </Label>
      <Listbox value={value} onChange={onChange} invalid={Boolean(error)}>
        <ListboxButton
          onBlur={onBlur}
          aria-describedby={error || hint ? messageId : undefined}
          className={`group flex w-full items-center gap-2 border bg-white text-left text-sm transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/60 data-open:border-primary data-open:ring-2 data-open:ring-primary/20 data-disabled:cursor-not-allowed data-disabled:bg-gray-50 data-disabled:text-gray-500 data-hover:border-gray-400 ${
            pill ? 'rounded-full px-4 py-2 shadow-xs' : 'rounded-xl px-3 py-2.5'
          } ${error ? 'border-red-400' : pill ? 'border-gray-200' : 'border-gray-300'}`}
        >
          {Icon && <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
          <span
            className={`min-w-0 flex-1 truncate ${selected ? 'text-gray-900' : 'text-gray-500'}`}
          >
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 group-data-open:rotate-180"
            aria-hidden
          />
        </ListboxButton>
        <ListboxOptions
          anchor={{ to: 'bottom start', gap: 6, padding: 12 }}
          transition
          className="z-70 max-h-72 w-(--button-width) min-w-48 overflow-y-auto rounded-2xl border border-gray-100 bg-white p-1.5 shadow-xl outline-hidden transition duration-150 ease-out [--anchor-max-height:18rem] data-closed:-translate-y-1 data-closed:opacity-0"
        >
          {options.map((option) => (
            <ListboxOption
              key={option.value}
              value={option.value}
              className="group flex cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-gray-700 data-focus:bg-primary/10 data-selected:font-semibold data-focus:text-primary data-selected:text-gray-900"
            >
              {option.icon && (
                <option.icon
                  className="h-4 w-4 shrink-0 text-gray-500 group-data-focus:text-primary group-data-selected:text-primary"
                  aria-hidden
                />
              )}
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              <Check
                className="invisible h-4 w-4 shrink-0 text-primary group-data-selected:visible"
                aria-hidden
              />
            </ListboxOption>
          ))}
        </ListboxOptions>
      </Listbox>
      {error ? (
        <p id={messageId} role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="mt-1 text-xs text-gray-500">
          {hint}
        </p>
      ) : null}
    </Field>
  );
}
