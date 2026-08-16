import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { notify } from '@/components/shared/Toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import Button from '@/components/ui/Button';
import { Wifi, Lock, Eye, EyeOff, CheckCircle2, ExternalLink, Smartphone, Info } from 'lucide-react';

export default function KioskSettings() {
  const { user } = useAuth();
  const schoolId   = user?.school_id ?? '';
  const schoolCode = (user as unknown as Record<string, unknown>)?.school_code as string ?? '';

  const [newPin,      setNewPin]      = useState('');
  const [confirmPin,  setConfirmPin]  = useState('');
  const [showPin,     setShowPin]     = useState(false);
  const [pinIsSet,    setPinIsSet]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [checking,    setChecking]    = useState(true);

  // is_kiosk_pin_set reports existence without disclosing the value. The old
  // code read the PIN itself, which is no longer possible — and was the reason
  // any staff account could learn it. See migration 206.
  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;

    void (async () => {
      try {
        const { data } = await supabase.rpc('is_kiosk_pin_set');
        if (!cancelled) setPinIsSet(data === true);
      } catch {
        if (!cancelled) setPinIsSet(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => { cancelled = true; };
  }, [schoolId]);

  async function handleSave() {
    if (!newPin.trim()) { notify.error('Enter a new PIN.'); return; }
    if (newPin.length < 4) { notify.error('PIN must be at least 4 digits.'); return; }
    if (!/^\d+$/.test(newPin)) { notify.error('PIN must contain digits only.'); return; }
    if (newPin !== confirmPin) { notify.error('PINs do not match.'); return; }

    // The current PIN is deliberately NOT required. Whoever reaches this screen
    // is already signed in as finance or school leadership, and the server
    // re-checks that role. Demanding the old PIN guarded only against an
    // unattended session, while making a forgotten PIN a permanent lockout with
    // no way out — which is exactly what happened.
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('set_kiosk_pin', { p_pin: newPin });
      if (error) throw error;

      const result = data as { ok?: boolean; message?: string } | null;
      if (!result?.ok) {
        notify.error(result?.message ?? 'Could not save the PIN.');
        return;
      }

      notify.success(pinIsSet ? 'Kiosk PIN updated.' : 'Kiosk PIN set successfully.');
      setPinIsSet(true);
      setNewPin('');
      setConfirmPin('');
    } catch {
      notify.error('Failed to save PIN. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const kioskUrl = 'https://www.schoolsyncedu.com/kiosk';

  return (
    <div className="space-y-5 max-w-2xl">
      <Breadcrumb items={[
        { label: 'Bursar', href: '/bursar' },
        { label: 'Kiosk Settings' },
      ]} />

      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Wifi className="h-5 w-5 text-emerald-600" />
          Exam Clearance Kiosk
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Set up the PIN for the NFC fee-clearance kiosk used during Semester 1 and 2 exams.
        </p>
      </div>

      {/* How it works */}
      <Card className="border-blue-100 bg-blue-50/50">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
            <Info className="h-4 w-4" /> How the Kiosk Works
          </div>
          <ol className="text-sm text-blue-700 space-y-1 ml-4 list-decimal">
            <li>Open the kiosk on an Android phone: <strong className="font-mono">{kioskUrl}</strong></li>
            <li>Enter your school code (<strong>{schoolCode || 'your school code'}</strong>) and the PIN below</li>
            <li>Select the semester (1 or 2) and the class to scan</li>
            <li>Tap each student's NFC card — shows CLEARED or BALANCE OWED instantly</li>
            <li>Download the session records as CSV when done</li>
          </ol>
        </CardContent>
      </Card>

      {/* Kiosk URL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" /> Kiosk URL
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
            <code className="flex-1 text-sm text-slate-700 font-mono break-all">{kioskUrl}</code>
            <a
              href={kioskUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open kiosk in new tab"
              className="shrink-0 text-primary-600 hover:text-primary-700"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <p className="text-xs text-slate-500">
            Open this URL on an Android phone and tap <strong>Add to Home Screen</strong> in Chrome
            to install it as a PWA for offline-capable NFC scanning.
          </p>
        </CardContent>
      </Card>

      {/* PIN Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {pinIsSet ? 'Change Kiosk PIN' : 'Set Kiosk PIN'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {checking ? (
            <p className="text-sm text-slate-400">Checking PIN status…</p>
          ) : (
            <>
              {pinIsSet && (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Kiosk PIN is currently set.
                </div>
              )}

              {pinIsSet && (
                <p className="flex items-start gap-1.5 text-xs text-slate-500">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  You do not need the old PIN. Setting a new one replaces it
                  immediately, and every kiosk will need the new PIN from then on.
                </p>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">New PIN (4–8 digits)</label>
                <div className="relative w-48">
                  <input
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={8}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm font-mono tracking-widest focus:outline-none focus:border-primary-400"
                  />
                  {/* Reveal applies to both fields — the PIN is about to be read
                      aloud to whoever mans the exam door, so hiding it from the
                      person setting it serves no one. */}
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Confirm New PIN</label>
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={8}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:border-primary-400"
                />
              </div>

              <Button onClick={handleSave} loading={loading} disabled={!newPin || newPin !== confirmPin}>
                <Lock className="h-4 w-4 mr-1" />
                {pinIsSet ? 'Update PIN' : 'Save PIN'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
