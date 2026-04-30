// MobileMoneyForm — reusable MTN / Orange Money payment flow
// Used in: SchoolFees.tsx, SchoolApplicationForm.tsx
//
// Flow:
//   1. Student enters phone number → submits
//   2. Calls school-mtn-pay / school-orange-pay edge function
//   3. Shows "Check your phone" waiting screen
//   4. Polls school-mtn-status / school-orange-status every 4s (max 5 min)
//   5. On success → calls onSuccess(); fee is already recorded server-side
//   6. On failure / timeout → shows error with retry option

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Phone, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export type MobileGateway = 'mtn' | 'orange';

interface Props {
  gateway:        MobileGateway;
  schoolId:       string;
  paymentType:    'student_fee' | 'application_fee';
  studentFeeId?:  string;
  applicationId?: string;
  amountUsd:      number;
  primaryColor:   string;
  onSuccess:      (referenceId: string) => void;
  onError:        (msg: string) => void;
}

type Step = 'input' | 'waiting' | 'success' | 'failed';

const POLL_INTERVAL_MS = 4000;
const POLL_MAX_MS      = 5 * 60 * 1000; // 5 minutes

export default function MobileMoneyForm({
  gateway, schoolId, paymentType, studentFeeId, applicationId,
  amountUsd, primaryColor, onSuccess, onError,
}: Props) {
  const [step,       setStep]       = useState<Step>('input');
  const [phone,      setPhone]      = useState('');
  const [phoneErr,   setPhoneErr]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refId,      setRefId]      = useState('');
  const [pollMsg,    setPollMsg]    = useState('Waiting for your approval…');

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef<number>(0);

  const isOrange = gateway === 'orange';
  const label    = isOrange ? 'Orange Money' : 'MTN MoMo';
  const color    = isOrange ? '#FF6600' : '#FFCC00';
  const textColor = isOrange ? 'text-orange-900' : 'text-yellow-900';
  const borderColor = isOrange ? 'border-orange-300' : 'border-yellow-300';
  const bgColor = isOrange ? 'bg-orange-50' : 'bg-yellow-50';

  const payFn     = `school-${gateway}-pay`;
  const statusFn  = `school-${gateway}-status`;

  // Clean up polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const startPolling = (referenceId: string) => {
    startedRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      const elapsed = Date.now() - startedRef.current;
      if (elapsed > POLL_MAX_MS) {
        clearInterval(pollRef.current!);
        setStep('failed');
        setPollMsg('Payment timed out. Please try again.');
        onError('Payment timed out. Please try again or visit the school office.');
        return;
      }

      try {
        const { data: json, error } = await supabase.functions.invoke<{ status: string; activated?: boolean; error?: string }>(statusFn, {
          body: { reference_id: referenceId },
        });

        if (!json || error) throw new Error(error?.message ?? 'no response');

        if (json.status === 'successful') {
          clearInterval(pollRef.current!);
          setStep('success');
          onSuccess(referenceId);
        } else if (json.status === 'failed') {
          clearInterval(pollRef.current!);
          setStep('failed');
          setPollMsg('Payment was declined. Please try again.');
          onError('Payment was declined by ' + label + '. Please try again.');
        } else {
          const secs = Math.floor(elapsed / 1000);
          setPollMsg(`Waiting for your approval… (${secs}s)`);
        }
      } catch {
        // Network blip — keep polling silently
      }
    }, POLL_INTERVAL_MS);
  };

  const handleSubmit = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 8) {
      setPhoneErr('Please enter a valid phone number');
      return;
    }
    setPhoneErr('');
    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke(payFn, {
        body: {
          school_id:       schoolId,
          payment_type:    paymentType,
          student_fee_id:  studentFeeId,
          application_id:  applicationId,
          amount_usd:      amountUsd,
          phone_number:    phone,
        },
      });

      if (error || (data as { error?: string })?.error) {
        const msg = (data as { error?: string })?.error ?? error?.message ?? 'Payment initiation failed';
        onError(msg);
        return;
      }

      const { reference_id } = data as { reference_id: string };
      setRefId(reference_id);
      setStep('waiting');
      startPolling(reference_id);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setStep('input');
    setPollMsg('Waiting for your approval…');
    setRefId('');
  };

  if (step === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <CheckCircle className="h-12 w-12 text-emerald-500" />
        <p className="font-bold text-gray-900">Payment Confirmed!</p>
        <p className="text-sm text-gray-500">Your {label} payment has been received and your fee balance updated.</p>
        <p className="font-mono text-xs text-gray-400 break-all">{refId}</p>
      </div>
    );
  }

  if (step === 'waiting') {
    return (
      <div className={`rounded-xl border ${borderColor} ${bgColor} p-5 space-y-4`}>
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color }} />
          <div>
            <p className={`font-semibold text-sm ${textColor}`}>Check your phone</p>
            <p className="text-xs text-gray-500 mt-0.5">{pollMsg}</p>
          </div>
        </div>
        <div className={`rounded-lg p-3 border ${borderColor} bg-white/60 space-y-1 text-xs ${textColor}`}>
          <p className="font-medium">Steps to approve:</p>
          {isOrange ? (
            <>
              <p>1. Open the <strong>Orange Money</strong> app or dial <strong>*144#</strong></p>
              <p>2. You will receive a payment request notification</p>
              <p>3. Enter your PIN to approve the payment</p>
            </>
          ) : (
            <>
              <p>1. Open the <strong>MTN MoMo</strong> app or dial <strong>*156#</strong></p>
              <p>2. You will receive a payment request push notification</p>
              <p>3. Enter your MoMo PIN to approve the payment</p>
            </>
          )}
        </div>
        <button
          onClick={handleRetry}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Cancel & try different number
        </button>
      </div>
    );
  }

  if (step === 'failed') {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-red-800">Payment failed</p>
            <p className="text-xs text-red-600 mt-0.5">{pollMsg}</p>
          </div>
        </div>
        <button
          onClick={handleRetry}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" /> Try Again
        </button>
      </div>
    );
  }

  // step === 'input'
  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-4 space-y-3`}>
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color }}>
          <Phone className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className={`font-semibold text-sm ${textColor}`}>{label}</p>
          <p className="text-xs text-gray-500">A push request will be sent to your phone</p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Your {label} phone number
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setPhoneErr(''); }}
          placeholder={isOrange ? '+231 77 …' : '+231 77 …'}
          maxLength={20}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        {phoneErr && <p className="mt-1 text-xs text-red-600">{phoneErr}</p>}
        <p className="mt-1 text-xs text-gray-400">
          Amount: <strong>${amountUsd.toFixed(2)} USD</strong>
        </p>
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white shadow transition hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: color }}
      >
        {submitting ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Sending request…</>
        ) : (
          <><Phone className="h-4 w-4" /> Pay ${amountUsd.toFixed(2)} with {label}</>
        )}
      </button>
    </div>
  );
}
