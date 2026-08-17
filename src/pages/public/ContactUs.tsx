import { useState } from 'react';
import GridBackdrop from '@/components/shared/GridBackdrop';
import { supabase } from '@/lib/supabase';
import { Mail, Phone, MapPin, Clock, Send, Loader2, CheckCircle, MessageSquare, Headphones, Building2 } from 'lucide-react';

interface ContactForm {
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
}

const CATEGORIES = [
  'General Inquiry',
  'Technical Support',
  'Billing & Subscription',
  'School Registration',
  'Enterprise / Custom Plan',
  'Partnership',
  'Other',
];

export default function ContactUs() {
  const [form, setForm] = useState<ContactForm>({
    name: '', email: '', subject: '', category: '', message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const update = (field: keyof ContactForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      // Was a 1200ms setTimeout followed by a success screen — every enquiry
      // was discarded while the sender was told it had been sent. The row is
      // now the guarantee; email notification is a convenience on top of it,
      // so a mail problem can never lose a message again.
      const { data, error: rpcErr } = await supabase.rpc('submit_contact_message', {
        p_name: form.name.trim(),
        p_email: form.email.trim(),
        p_message: form.message.trim(),
        p_subject: [form.category, form.subject].filter(Boolean).join(' — ') || null,
        p_phone: null,
        p_source_page: window.location.pathname,
      });
      if (rpcErr) throw rpcErr;

      const result = data as { ok?: boolean; message?: string } | null;
      if (!result?.ok) {
        setError(result?.message ?? 'Could not send your message. Please try again.');
        return;
      }

      // Notification only — the message is already stored, so this is allowed
      // to fail. Deliberately not awaited into the success path: a slow or
      // misconfigured mail server must not make the visitor think their
      // message failed, nor keep them staring at a spinner.
      void supabase.functions
        .invoke('notify-contact-message', {
          body: {
            name: form.name.trim(),
            email: form.email.trim(),
            subject: [form.category, form.subject].filter(Boolean).join(' — '),
            message: form.message.trim(),
          },
        })
        .catch(() => { /* the row in contact_messages is the record that matters */ });

      setSubmitted(true);
    } catch {
      // A real failure now says so, instead of showing a success screen.
      setError('Could not send your message. Please try again, or email support@schoolsyncedu.com.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Hero */}
      <GridBackdrop glow="amber" className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h1 className="text-3xl font-extrabold text-white sm:text-5xl">Contact Us</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/70">
            Have a question or need help? We're here for you. Reach out and we'll get back to you within 1–2 business days.
          </p>
        </div>
      </GridBackdrop>

      {/* Contact options */}
      <section className="py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                icon: Mail,
                label: 'Email Support',
                value: 'support@schoolsyncedu.com',
                sub: 'For general & technical questions',
                href: 'mailto:support@schoolsyncedu.com',
                color: 'bg-amber-100 text-amber-600',
              },
              {
                icon: Headphones,
                label: 'Sales & Enterprise',
                value: 'support@schoolsyncedu.com',
                sub: 'Custom plans & partnerships',
                href: 'mailto:support@schoolsyncedu.com',
                color: 'bg-amber-100 text-amber-600',
              },
              {
                icon: Clock,
                label: 'Response Time',
                value: '1 – 2 Business Days',
                sub: 'Monday – Friday, 8am – 5pm WAT',
                href: null,
                color: 'bg-amber-100 text-amber-600',
              },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${item.color}`}>
                  <item.icon className="h-6 w-6" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{item.label}</p>
                {item.href ? (
                  <a href={item.href} className="mt-1 block text-sm font-semibold text-amber-600 hover:underline">
                    {item.value}
                  </a>
                ) : (
                  <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main content: form + info */}
      <section className="pb-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-5">

            {/* Form — 3 cols */}
            <div className="lg:col-span-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                {submitted ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="mt-4 text-xl font-bold text-slate-900">Message Sent!</h3>
                    <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-sm">
                      Thank you for reaching out. We've received your message and will reply to{' '}
                      <strong>{form.email}</strong> within 1–2 business days.
                    </p>
                    <button
                      onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', category: '', message: '' }); }}
                      className="mt-6 rounded-lg border border-slate-200 px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Send us a message</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Fill out the form and we'll get back to you as soon as possible.
                      </p>
                    </div>

                    {error && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-700">Full Name *</label>
                        <input
                          type="text" required value={form.name}
                          onChange={(e) => update('name', e.target.value)}
                          placeholder="John Doe"
                          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700">Email Address *</label>
                        <input
                          type="email" required value={form.email}
                          onChange={(e) => update('email', e.target.value)}
                          placeholder="you@example.com"
                          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700">Category</label>
                      <select
                        value={form.category}
                        onChange={(e) => update('category', e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="">Select a category</option>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700">Subject</label>
                      <input
                        type="text" value={form.subject}
                        onChange={(e) => update('subject', e.target.value)}
                        placeholder="Brief description of your inquiry"
                        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700">Message *</label>
                      <textarea
                        required rows={5} value={form.message}
                        onChange={(e) => update('message', e.target.value)}
                        placeholder="Describe your question or issue in detail..."
                        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <button
                      type="submit" disabled={submitting}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-accent-500 px-6 py-3 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                      ) : (
                        <><Send className="h-4 w-4" /> Send Message</>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Side info — 2 cols */}
            <div className="lg:col-span-2 space-y-6">
              {/* Office info */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-amber-600" /> Our Office
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">EduLiberia HQ</p>
                      <p className="text-xs text-slate-500">Monrovia, Liberia</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">General inquiries</p>
                      <a href="mailto:support@schoolsyncedu.com" className="text-sm font-medium text-amber-600 hover:underline">
                        support@schoolsyncedu.com
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Business hours</p>
                      <p className="text-sm font-medium text-slate-800">Mon – Fri, 8am – 5pm WAT</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick help */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-amber-600" /> Quick Help
                </h3>
                {[
                  { q: 'How do I register my school?', href: '/register' },
                  { q: 'View pricing plans', href: '/pricing' },
                  { q: 'Enterprise custom plan', href: '/pricing?view=enterprise' },
                ].map((item) => (
                  <a
                    key={item.q}
                    href={item.href}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3 text-sm text-slate-700 hover:border-amber-200 hover:bg-amber-50 transition-colors"
                  >
                    {item.q}
                    <span className="text-amber-600">→</span>
                  </a>
                ))}
              </div>

              {/* Phone placeholder */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
                <Phone className="mx-auto h-6 w-6 text-slate-400 mb-2" />
                <p className="text-sm text-slate-500">
                  Phone support coming soon. Email us in the meantime at{' '}
                  <a href="mailto:support@schoolsyncedu.com" className="text-amber-600 hover:underline font-medium">
                    support@schoolsyncedu.com
                  </a>
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
