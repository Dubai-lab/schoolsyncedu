import { useState, useEffect, useRef } from 'react';
import { verifyOTP, requestOTPEmail } from '@/services/authService';
import { notify } from '@/components/shared/Toast';
import Button from '@/components/ui/Button';
import { X, Loader2, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface OTPVerificationModalProps {
  email: string;
  schoolName?: string;
  isOpen: boolean;
  onVerified: () => void;
  onCancel: () => void;
}

export default function OTPVerificationModal({
  email,
  schoolName = 'SchoolSync',
  isOpen,
  onVerified,
  onCancel,
}: OTPVerificationModalProps) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCountdown <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  if (!isOpen) return null;

  const handleOTPChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return; // Only allow digits

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace: focus previous input
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    // ArrowLeft: move to previous
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    // ArrowRight: move to next
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').split('').slice(0, 6);

    const newOtp = [...otp];
    digits.forEach((digit, i) => {
      if (i < 6) newOtp[i] = digit;
    });
    setOtp(newOtp);

    // Focus the last filled input or the next empty one
    const nextEmptyIndex = newOtp.findIndex((v) => !v);
    if (nextEmptyIndex !== -1 && nextEmptyIndex < 6) {
      inputRefs.current[nextEmptyIndex]?.focus();
    } else if (nextEmptyIndex === -1) {
      inputRefs.current[5]?.focus();
    }
  };

  const otpCode = otp.join('');
  const isComplete = otpCode.length === 6;

  const handleVerify = async () => {
    if (!isComplete) return;

    setVerifying(true);
    setError('');

    try {
      const result = await verifyOTP(email, otpCode);

      if (result.success) {
        notify.success('Email verified successfully!');
        onVerified();
      } else {
        if (result.is_expired) {
          setError('Your OTP has expired. Please request a new one.');
          setOtp(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
        } else {
          setError(result.message || 'Invalid OTP code. Please try again.');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed. Please try again.';
      setError(message);
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');

    try {
      await requestOTPEmail(email, schoolName);
      notify.success('New OTP sent to your email');
      setOtp(['', '', '', '', '', '']);
      setCanResend(false);
      setResendCountdown(60);
      inputRefs.current[0]?.focus();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send OTP. Please try again.';
      setError(message);
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          {/* Header */}
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Verify Email</h2>
              <p className="text-xs text-slate-500 mt-0.5">Enter the 6-digit code sent to your email</p>
            </div>
            <button
              onClick={onCancel}
              className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-600 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-8 space-y-6">
            {/* Email display */}
            <div className="flex items-center gap-3 background-slate-50 rounded-lg px-4 py-3">
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-slate-500">Verification code sent to</p>
                <p className="text-sm font-medium text-slate-900">{email}</p>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* OTP input fields */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">Verification Code</label>
              <div className="flex gap-2 justify-center">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOTPChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    placeholder="–"
                    className={`h-14 w-12 rounded-lg border-2 text-center text-2xl font-bold transition-all ${
                      digit
                        ? 'border-primary-400 bg-primary-50 text-primary-700'
                        : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 focus:border-primary-500'
                    } focus:outline-none focus:ring-2 focus:ring-primary-100`}
                    disabled={verifying}
                  />
                ))}
              </div>
              <p className="text-center text-xs text-slate-500">
                Enter the 6-digit code from your email
              </p>
            </div>

            {/* Info box */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-slate-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600">
                  Code expires in <strong>15 minutes</strong>. Never share this code.
                </p>
              </div>
            </div>

            {/* Resend button */}
            <div className="text-center">
              {canResend ? (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors disabled:text-slate-400"
                >
                  {resending ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    "Didn't receive the code? Resend"
                  )}
                </button>
              ) : (
                <p className="text-xs text-slate-500">
                  Resend available in <strong>{resendCountdown}s</strong>
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={verifying}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerify}
              disabled={!isComplete || verifying}
              loading={verifying}
              className="flex-1"
            >
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Verify
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
