import type { OtpPurpose, VerifyOtpResponse } from '@ru-lost-found/shared';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../lib/api/client';
import { authApi } from '../../lib/api/endpoints';

const RESEND_SECONDS = 60;

/**
 * The shared first two steps of sign-up and password reset: send a code to an email address,
 * then exchange the code for a verification token. Handles the resend countdown and errors.
 */
export function useCodeFlow(purpose: OtpPurpose) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [verified, setVerified] = useState<VerifyOtpResponse | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function run(action: () => Promise<void>) {
    setError(undefined);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'RATE_LIMITED') toast.error(err.message);
      else setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const sendCode = (to: string) =>
    run(async () => {
      await authApi.requestCode(to, purpose);
      setEmail(to);
      setCode('');
      setCodeSent(true);
      setResendIn(RESEND_SECONDS);
      toast.success(`If ${to} can be used, a code is on its way.`);
    });

  const verify = () =>
    run(async () => {
      setVerified(await authApi.verifyCode(email, purpose, code));
    });

  const startOver = () => {
    setCodeSent(false);
    setVerified(null);
    setCode('');
    setError(undefined);
  };

  return {
    email,
    code,
    setCode,
    error,
    busy,
    resendIn,
    codeSent,
    verified,
    sendCode,
    verify,
    startOver,
  };
}
