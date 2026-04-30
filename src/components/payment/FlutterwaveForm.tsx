// FlutterwaveForm — Flutterwave inline checkout for school student/application fees
//
// Flow:
//   1. User clicks Pay → calls school-flw-pay to get a tx_ref
//   2. Opens Flutterwave inline popup (loaded via CDN script)
//   3. On FLW callback → calls school-flw-verify with transaction_id + tx_ref
//   4. Server verifies with school's own secret key → records fee automatically
//   5. Calls onSuccess()

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { CreditCard, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface Customer {
  name:   string;
  email:  string;
  phone?: string;
}

interface Props {
  schoolId:       string;
  publicKey:      string;
  currency:       string;
  paymentType:    'student_fee' | 'application_fee';
  studentFeeId?:  string;
  applicationId?: string;
  amountUsd:      number;
  customer:       Customer;
  paymentTitle:   string;
  onSuccess:      (txRef: string) => void;
  onError:        (msg: string) => void;
}

declare global {
  interface Window {
    FlutterwaveCheckout?: (config: Record<string, unknown>) => void;
  }
}

type Step = 'idle' | 'opening' | 'verifying' | 'success' | 'failed';

export default function FlutterwaveForm({
  schoolId, publicKey, currency, paymentType, studentFeeId, applicationId,
  amountUsd, customer, paymentTitle, onSuccess, onError,
}: Props) {
  const [step,   setStep]   = useState<Step>('idle');
  const [errMsg, setErrMsg] = useState('');

  // Load Flutterwave inline script once
  useEffect(() => {
    if (document.getElementById('flw-v3-script')) return;
    const s  = document.createElement('script');
    s.id     = 'flw-v3-script';
    s.src    = 'https://checkout.flutterwave.com/v3.js';
    s.async  = true;
    document.head.appendChild(s);
  }, []);

  const handlePay = async () => {
    setStep('opening');
    setErrMsg('');

    try {
      // Step 1: get tx_ref from edge function
      const { data, error } = await supabase.functions.invoke<{ tx_ref: string; error?: string }>(
        'school-flw-pay',
        {
          body: {
            school_id:       schoolId,
            payment_type:    paymentType,
            student_fee_id:  studentFeeId,
            application_id:  applicationId,
            amount_usd:      amountUsd,
          },
        },
      );

      if (error || data?.error) {
        throw new Error(data?.error ?? error?.message ?? 'Failed to initiate payment');
      }

      const { tx_ref } = data!;

      // Step 2: open Flutterwave inline checkout
      if (typeof window.FlutterwaveCheckout !== 'function') {
        throw new Error('Payment provider not loaded yet. Please wait a moment and try again.');
      }

      window.FlutterwaveCheckout({
        public_key: publicKey,
        tx_ref,
        amount:     amountUsd,
        currency,
        customer: {
          email:        customer.email,
          name:         customer.name,
          phone_number: customer.phone ?? '',
        },
        customizations: {
          title:       paymentTitle || 'School Fee Payment',
          description: paymentType === 'student_fee' ? 'School Fee Payment' : 'Application Fee',
        },
        callback: async (paymentData: Record<string, unknown>) => {
          if (paymentData.status === 'successful' || paymentData.status === 'completed') {
            setStep('verifying');
            try {
              const { data: vData, error: vErr } = await supabase.functions.invoke<{
                status: string; error?: string;
              }>('school-flw-verify', {
                body: {
                  transaction_id: paymentData.transaction_id,
                  tx_ref,
                  school_id: schoolId,
                },
              });

              if (vErr || vData?.error) {
                throw new Error(vData?.error ?? vErr?.message ?? 'Verification failed');
              }

              if (vData?.status === 'successful') {
                setStep('success');
                onSuccess(tx_ref);
              } else {
                throw new Error('Payment could not be verified. Please contact the school office with your transaction ID.');
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Verification error';
              setStep('failed');
              setErrMsg(msg);
              onError(msg);
            }
          } else {
            setStep('idle');
          }
        },
        onclose: () => {
          setStep((s) => (s === 'opening' ? 'idle' : s));
        },
      });

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      setStep('failed');
      setErrMsg(msg);
      onError(msg);
    }
  };

  if (step === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <CheckCircle className="h-12 w-12 text-emerald-500" />
        <p className="font-bold text-gray-900">Payment Confirmed!</p>
        <p className="text-sm text-gray-500">Your card payment has been verified and your fee balance updated.</p>
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
            <p className="text-xs text-red-600 mt-0.5">{errMsg}</p>
          </div>
        </div>
        <button
          onClick={() => { setStep('idle'); setErrMsg(''); }}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" /> Try Again
        </button>
      </div>
    );
  }

  const isLoading = step === 'opening' || step === 'verifying';
  const loadingLabel = step === 'verifying' ? 'Verifying payment…' : 'Opening payment…';

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-orange-500">
          <CreditCard className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="font-semibold text-sm text-orange-900">Flutterwave</p>
          <p className="text-xs text-gray-500">Visa / MasterCard — secure card payment</p>
        </div>
      </div>
      <p className="text-xs text-orange-700">
        Amount: <strong>${amountUsd.toFixed(2)} {currency}</strong>
      </p>
      <button
        onClick={handlePay}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white shadow transition hover:opacity-90 disabled:opacity-50 bg-orange-500"
      >
        {isLoading ? (
          <><Loader2 className="h-4 w-4 animate-spin" />{loadingLabel}</>
        ) : (
          <><CreditCard className="h-4 w-4" />Pay ${amountUsd.toFixed(2)} with Card</>
        )}
      </button>
    </div>
  );
}
