import { useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { CodeInput } from './AuthLayout';
import type { useCodeFlow } from './useCodeFlow';

type Flow = ReturnType<typeof useCodeFlow>;

/** Step 1: ask for the email address and send a code to it. */
export function EmailStep({ flow, hint }: { flow: Flow; hint: string }) {
  const [email, setEmail] = useState(flow.email);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void flow.sendCode(email.trim().toLowerCase());
  };
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        hint={hint}
        error={flow.error}
        autoFocus
      />
      <Button type="submit" size="lg" className="w-full" loading={flow.busy} disabled={!email}>
        Send code
      </Button>
    </form>
  );
}

/** Step 2: enter the emailed code; offers a resend after the cooldown. */
export function CodeStep({ flow }: { flow: Flow }) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void flow.verify();
  };
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="text-sm text-gray-600">
        We sent a code to <span className="font-medium text-gray-900">{flow.email}</span>. It
        expires in 10 minutes.
      </p>
      <CodeInput value={flow.code} onChange={flow.setCode} error={flow.error} />
      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={flow.busy}
        disabled={flow.code.length !== 6}
      >
        Verify
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={flow.startOver} className="text-gray-600 hover:underline">
          Use a different email
        </button>
        <button
          type="button"
          onClick={() => void flow.sendCode(flow.email)}
          disabled={flow.resendIn > 0 || flow.busy}
          className="font-medium text-primary hover:underline disabled:text-gray-400 disabled:no-underline"
        >
          {flow.resendIn > 0 ? `Resend in ${flow.resendIn}s` : 'Resend code'}
        </button>
      </div>
    </form>
  );
}
