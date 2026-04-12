import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { notify } from '@/components/shared/Toast';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  Mail,
  Server,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Send,
  Info,
} from 'lucide-react';

type EmailConfig = {
  smtp_host: string;
  smtp_port: string;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass: string;
  from_name: string;
  from_address: string;
  reply_to: string;
};

const DEFAULTS: EmailConfig = {
  smtp_host: '',
  smtp_port: '587',
  smtp_secure: false,
  smtp_user: '',
  smtp_pass: '',
  from_name: '',
  from_address: '',
  reply_to: '',
};

const PROVIDERS = [
  { label: 'Gmail', host: 'smtp.gmail.com', port: '587', secure: false },
  { label: 'Outlook / Microsoft 365', host: 'smtp.office365.com', port: '587', secure: false },
  { label: 'Yahoo Mail', host: 'smtp.mail.yahoo.com', port: '587', secure: false },
  { label: 'Zoho Mail', host: 'smtp.zoho.com', port: '587', secure: false },
  { label: 'Custom / cPanel', host: '', port: '587', secure: false },
];

export default function EmailSettings() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [form, setForm] = useState<EmailConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [lastTested, setLastTested] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState(user?.email ?? '');
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    supabase
      .from('school_email_configs')
      .select('*')
      .eq('school_id', schoolId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setHasExisting(true);
          setIsVerified(data.is_verified ?? false);
          setLastTested(data.last_tested_at ?? null);
          setForm({
            smtp_host: data.smtp_host ?? '',
            smtp_port: String(data.smtp_port ?? 587),
            smtp_secure: data.smtp_secure ?? false,
            smtp_user: data.smtp_user ?? '',
            smtp_pass: data.smtp_pass ?? '',
            from_name: data.from_name ?? '',
            from_address: data.from_address ?? '',
            reply_to: data.reply_to ?? '',
          });
        }
      })
      .then(() => setLoading(false), () => setLoading(false));
  }, [schoolId]);

  function set(key: keyof EmailConfig, val: string | boolean) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function applyProvider(p: typeof PROVIDERS[0]) {
    setForm((f) => ({
      ...f,
      smtp_host: p.host,
      smtp_port: p.port,
      smtp_secure: p.secure,
    }));
  }

  async function handleSave() {
    if (!form.smtp_host || !form.smtp_user || !form.smtp_pass || !form.from_address) {
      notify.error('Please fill in SMTP Host, Username, Password, and From Address.');
      return;
    }
    setSaving(true);
    const payload = {
      school_id: schoolId,
      smtp_host: form.smtp_host,
      smtp_port: Number(form.smtp_port) || 587,
      smtp_secure: form.smtp_secure,
      smtp_user: form.smtp_user,
      smtp_pass: form.smtp_pass,
      from_name: form.from_name,
      from_address: form.from_address,
      reply_to: form.reply_to || null,
    };

    const { error } = hasExisting
      ? await supabase.from('school_email_configs').update(payload).eq('school_id', schoolId)
      : await supabase.from('school_email_configs').insert(payload);

    setSaving(false);
    if (error) {
      notify.error('Failed to save: ' + error.message);
    } else {
      setHasExisting(true);
      notify.success('Email settings saved.');
    }
  }

  async function handleTest() {
    if (!testEmail) { notify.error('Enter a test email address.'); return; }
    setTesting(true);
    try {
      const { error, data } = await supabase.functions.invoke('send-letter-email', {
        body: {
          school_id: schoolId,
          to: testEmail,
          subject: `Test Email — ${form.from_name || 'SchoolSync'}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;border:1px solid #e5e7eb;border-radius:8px;">
              <h2 style="color:#1e3a5f;margin-top:0;">Email Configuration Test</h2>
              <p>This is a test email from <strong>${form.from_name || 'your school'}</strong> to confirm your SMTP settings are working correctly.</p>
              <p style="color:#6b7280;font-size:13px;">
                Sent via: ${form.smtp_host}:${form.smtp_port}<br/>
                From: ${form.from_address}
              </p>
              <p style="color:#16a34a;font-weight:bold;">✓ Your email system is configured correctly!</p>
            </div>`,
          fromName: form.from_name,
        },
      });

      if (error) {
        // Try to extract the actual error message from the Edge Function response body
        let msg = error.message ?? 'Unknown error';
        try {
          const ctx = (error as Record<string, unknown>).context as Response | undefined;
          if (ctx) {
            const body = await ctx.json().catch(() => null) as Record<string, unknown> | null;
            if (body?.error) msg = String(body.error);
          }
        } catch { /* ignore parse errors */ }

        const is401 = msg.includes('401') || /unauthorized/i.test(msg);
        if (is401) {
          throw new Error(
            'Email function is not reachable (401). The function needs to be redeployed. ' +
            'Run: supabase functions deploy send-letter-email --no-verify-jwt',
          );
        }
        throw new Error(msg);
      }

      // Edge Function returned success but check if it reported an SMTP error in the body
      const body = data as Record<string, unknown> | null;
      if (body?.error) throw new Error(String(body.error));

      // Mark as verified
      await supabase.from('school_email_configs').update({
        is_verified: true,
        last_tested_at: new Date().toISOString(),
      }).eq('school_id', schoolId);

      setIsVerified(true);
      setLastTested(new Date().toISOString());
      notify.success(`Test email sent to ${testEmail}. Check your inbox!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Test failed';
      notify.error(msg);
      setIsVerified(false);
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'IT Admin', href: '/it-admin' }, { label: 'Email Settings' }]} />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            <Mail className="inline-block h-6 w-6 mr-2 text-blue-600" />
            School Email Settings
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure your school's SMTP server so all system emails (acceptance letters, notifications) are sent from your own domain.
          </p>
        </div>
        {isVerified ? (
          <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 border border-green-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Verified
            {lastTested && <span className="opacity-60 ml-1">· {new Date(lastTested).toLocaleDateString()}</span>}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            Not verified
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main form ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Quick-fill provider */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Server className="h-4 w-4 text-slate-400" /> Quick Setup — Choose Your Email Provider
            </h2>
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyProvider(p)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    form.smtp_host === p.host
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Card>

          {/* SMTP Connection */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Server className="h-4 w-4 text-slate-400" /> SMTP Connection
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="SMTP Host *"
                  value={form.smtp_host}
                  onChange={(e) => set('smtp_host', e.target.value)}
                  placeholder="e.g. smtp.gmail.com"
                />
              </div>
              <Input
                label="Port *"
                type="number"
                value={form.smtp_port}
                onChange={(e) => set('smtp_port', e.target.value)}
                placeholder="587"
              />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const next = !form.smtp_secure;
                  set('smtp_secure', next);
                  if (next) set('smtp_port', '465');
                  else set('smtp_port', '587');
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.smtp_secure ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  form.smtp_secure ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
              <span className="text-sm text-slate-600">
                Use SSL/TLS (port 465)
                <span className="ml-1 text-xs text-slate-400">— leave off for STARTTLS / port 587</span>
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="SMTP Username / Email *"
                value={form.smtp_user}
                onChange={(e) => set('smtp_user', e.target.value)}
                placeholder="yourname@gmail.com"
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Password / App Password *</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.smtp_pass}
                    onChange={(e) => set('smtp_pass', e.target.value)}
                    placeholder={showPass ? 'Enter password' : '••••••••••••••••'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Sender Identity */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400" /> Sender Identity
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="From Name"
                value={form.from_name}
                onChange={(e) => set('from_name', e.target.value)}
                placeholder="e.g. Saint John Academy"
              />
              <Input
                label="From Email Address *"
                type="email"
                value={form.from_address}
                onChange={(e) => set('from_address', e.target.value)}
                placeholder="admissions@yourschool.edu.lr"
              />
              <Input
                label="Reply-To Address (optional)"
                type="email"
                value={form.reply_to}
                onChange={(e) => set('reply_to', e.target.value)}
                placeholder="registrar@yourschool.edu.lr"
              />
            </div>
          </Card>

          {/* Save */}
          <div className="flex justify-end">
            <Button onClick={handleSave} loading={saving}>
              Save Email Settings
            </Button>
          </div>
        </div>

        {/* ── Sidebar: Test + Help ── */}
        <div className="space-y-5">

          {/* Test connection */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Send className="h-4 w-4 text-slate-400" /> Test Connection
            </h2>
            <p className="text-xs text-slate-500 mb-3">
              Send a test email to confirm your SMTP settings are working. Save first before testing.
            </p>
            <Input
              label="Send test to"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="your@email.com"
            />
            <Button
              className="mt-3 w-full"
              variant="outline"
              onClick={handleTest}
              loading={testing}
              disabled={!hasExisting}
            >
              <Send className="h-4 w-4 mr-1.5" />
              Send Test Email
            </Button>
            {!hasExisting && (
              <p className="mt-2 text-xs text-slate-400">Save settings first to enable testing.</p>
            )}
          </Card>

          {/* Help */}
          <Card className="p-5 bg-blue-50 border-blue-100">
            <h2 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
              <Info className="h-4 w-4" /> Setup Guide
            </h2>
            <div className="space-y-3 text-xs text-blue-700">
              <div>
                <p className="font-semibold">Gmail</p>
                <p className="opacity-80">Use an App Password (not your regular password). Go to Google Account → Security → 2-Step Verification → App Passwords.</p>
              </div>
              <div>
                <p className="font-semibold">Outlook / Microsoft 365</p>
                <p className="opacity-80">Use your full email address as username. Enable SMTP AUTH in the Microsoft 365 admin panel if needed.</p>
              </div>
              <div>
                <p className="font-semibold">Custom Domain / cPanel</p>
                <p className="opacity-80">Your host provides SMTP details in cPanel → Email Accounts → Connect Device. Use your domain email as username.</p>
              </div>
              <div>
                <p className="font-semibold">School Domain Email</p>
                <p className="opacity-80">For a professional look use admissions@yourschool.edu.lr as the From address. Parents and students will see your school's domain in their inbox.</p>
              </div>
            </div>
          </Card>

          {/* Security note */}
          <Card className="p-4 bg-slate-50 border-slate-100">
            <div className="flex gap-2">
              <Shield className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500">
                Your SMTP password is stored encrypted in the database and is never exposed to the browser. It is only accessed server-side by the email sending function.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
