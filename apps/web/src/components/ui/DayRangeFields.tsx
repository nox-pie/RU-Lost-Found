import { isBackwards, todayIso } from '../../lib/format';
import { Input } from './Field';

/**
 * "From" and "To" day boxes (YYYY-MM-DD, both days included, none in the future), with an error
 * under "To" when it is before "From". Renders the two fields only: the page lays them out.
 */
export function DayRangeFields({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (changes: { from: string } | { to: string }) => void;
}) {
  return (
    <>
      <Input
        label="From"
        type="date"
        value={from}
        max={to || todayIso()}
        onChange={(event) => onChange({ from: event.target.value })}
      />
      <Input
        label="To"
        type="date"
        value={to}
        min={from || undefined}
        max={todayIso()}
        onChange={(event) => onChange({ to: event.target.value })}
        error={isBackwards(from, to) ? '"To" must be on or after "From"' : undefined}
      />
    </>
  );
}
