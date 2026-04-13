import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { pricingPlanService, billingService, enterpriseService } from '@/services/adminService';
import { useAuth } from '@/hooks/useAuth';
import type { SubscriptionPlan } from '@/types/report.types';
import {
  CheckCircle, X, ArrowRight, HelpCircle, CheckCircle2,
  Building2, User, Phone, Mail, Users, Layers, MessageSquare,
  Loader2, Send, Sparkles,
} from 'lucide-react';

type ViewMode = 'standard' | 'enterprise';

interface EnterpriseForm {
  school_name: string;
  contact_name: string;
  email: string;
  phone: string;
  student_count: string;
  modules_needed: string;
  message: string;
}

const EMPTY_FORM: EnterpriseForm = {
  school_name: '', contact_name: '', email: '', phone: '',
  student_count: '', modules_needed: '', message: '',
};

const STUDENT_RANGES = ['Under 500', '500 – 1,000', '1,000 – 2,500', '2,500 – 5,000', '5,000 – 10,000', 'Over 10,000'];
const MODULE_OPTIONS = ['Attendance', 'Grades & Report Cards', 'Fee Management', 'Letters & Approvals', 'Library', 'NFC / ID Cards', 'Communications', 'WAEC Reports', 'Parent Portal', 'Staff Scheduling'];

export default function PricingPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>(
    searchParams.get('view') === 'enterprise' ? 'enterprise' : 'standard'
  );
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  // Enterprise form state
  const [eForm, setEForm] = useState<EnterpriseForm>(EMPTY_FORM);
  const [eSubmitting, setESubmitting] = useState(false);
  const [eError, setEError] = useState('');
  const [eSuccess, setESuccess] = useState(false);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  const { data: allPlans = [], isLoading } = useFetch<SubscriptionPlan[]>(
    ['public-pricing-plans'],
    () => pricingPlanService.list(),
  );

  const { data: subscriptions = [] } = useFetch(
    ['my-subscriptions', user?.school_id ?? ''],
    () => billingService.listSubscriptionsWithDetails(),
    { enabled: !!user?.school_id },
  );

  const activeSub = subscriptions.find(
    (s) => s.school_id === user?.school_id && ['active', 'trial', 'grace'].includes(s.status),
  );
  const expiredSub = subscriptions.find(
    (s) => s.school_id === user?.school_id && ['suspended', 'cancelled', 'archived'].includes(s.status),
  );

  const standardPlans = allPlans.filter((p) => p.is_visible && p.is_active && !p.is_enterprise);
  const enterprisePlan = allPlans.find((p) => p.is_visible && p.is_active && p.is_enterprise);
  const allFeatureKeys = Array.from(new Set(standardPlans.flatMap((p) => (p.features ? Object.keys(p.features) : []))));
  const formatFeatureLabel = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  function PlanButton({ plan, isPopular }: { plan: SubscriptionPlan; isPopular: boolean }) {
    const base = isPopular
      ? 'mt-8 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-all bg-primary-600 text-white shadow-md hover:bg-primary-700'
      : 'mt-8 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-all border border-slate-300 text-slate-700 hover:bg-slate-50';

    if (activeSub && activeSub.plan_name === plan.name)
      return <div className={`${base} opacity-80 cursor-default pointer-events-none`}><CheckCircle2 className="h-4 w-4" /> Current Plan</div>;
    if (expiredSub && expiredSub.plan_name === plan.name)
      return <Link to={`/pay?school=${user?.school_id}&email=${user?.email}`} className={base}>Renew Now <ArrowRight className="h-4 w-4" /></Link>;
    if (activeSub?.status === 'trial')
      return <Link to={`/pay?school=${user?.school_id}&email=${user?.email}`} className={base}>Upgrade Now <ArrowRight className="h-4 w-4" /></Link>;
    const ctaText = plan.cta_button_text?.trim() || 'Start Free Trial';
    return <Link to={`/register?plan=${plan.slug}`} className={base}>{ctaText} <ArrowRight className="h-4 w-4" /></Link>;
  }

  const toggleModule = (m: string) =>
    setSelectedModules((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);

  const handleEnterpriseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEError('');
    if (!eForm.school_name.trim()) { setEError('School name is required'); return; }
    if (!eForm.contact_name.trim()) { setEError('Contact name is required'); return; }
    if (!eForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eForm.email)) {
      setEError('Valid email address is required'); return;
    }
    setESubmitting(true);
    try {
      await enterpriseService.submitInquiry({
        ...eForm,
        modules_needed: selectedModules.length > 0 ? selectedModules.join(', ') : eForm.modules_needed,
      });
      setESuccess(true);
      setEForm(EMPTY_FORM);
      setSelectedModules([]);
    } catch (err) {
      setEError(err instanceof Error ? err.message : 'Failed to submit. Please try again.');
    } finally {
      setESubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <section className="bg-gradient-to-br from-primary-900 via-primary-700 to-primary-600 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl text-center px-4">
          <h1 className="text-3xl font-extrabold text-white sm:text-5xl">Plans & Pricing</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/70">
            Affordable plans designed for schools of every size. Start with a free trial — no credit card required.
          </p>

          {/* View mode toggle: Standard | Enterprise */}
          <div className="mt-8 inline-flex items-center rounded-full border border-white/20 bg-white/10 p-1 backdrop-blur-sm">
            <button
              onClick={() => setViewMode('standard')}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                viewMode === 'standard' ? 'bg-white text-primary-700 shadow' : 'text-white/70 hover:text-white'
              }`}
            >
              Standard Plans
            </button>
            <button
              onClick={() => setViewMode('enterprise')}
              className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-all ${
                viewMode === 'enterprise' ? 'bg-white text-primary-700 shadow' : 'text-white/70 hover:text-white'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" /> Enterprise
            </button>
          </div>

          {/* Billing cycle toggle — only shown for standard */}
          {viewMode === 'standard' && (
            <div className="mt-4 inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                  billingCycle === 'monthly' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                  billingCycle === 'yearly' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'
                }`}
              >
                Yearly
                {(() => {
                  const maxDiscount = Math.max(...standardPlans.map((p) => p.yearly_discount_percent ?? 0));
                  return maxDiscount > 0 ? <span className="ml-1 text-green-400">Save {maxDiscount}%</span> : null;
                })()}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ──────── STANDARD PLANS ──────── */}
      {viewMode === 'standard' && (
        <>
          <section className="py-16 sm:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {isLoading ? (
                <div className="flex justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                </div>
              ) : standardPlans.length === 0 ? (
                <p className="text-center text-slate-500">No plans available at the moment. Please check back soon.</p>
              ) : (
                <div className={`mx-auto grid max-w-6xl grid-cols-1 gap-8 ${
                  standardPlans.length === 1 ? 'md:max-w-md' : standardPlans.length === 2 ? 'md:grid-cols-2 md:max-w-3xl' : 'md:grid-cols-3'
                }`}>
                  {standardPlans.map((plan, idx) => {
                    const isPopular = standardPlans.length >= 3 ? idx === 1 : false;
                    const discountFactor = 1 - (plan.yearly_discount_percent ?? 0) / 100;
                    const price =
                      billingCycle === 'yearly'
                        ? plan.billing_cycle === 'yearly' ? plan.price_usd : +(plan.price_usd * 12 * discountFactor).toFixed(2)
                        : plan.billing_cycle === 'monthly' ? plan.price_usd : +(plan.price_usd / 12).toFixed(2);

                    return (
                      <div
                        key={plan.id}
                        className={`relative flex flex-col rounded-2xl border p-8 ${
                          isPopular
                            ? 'border-primary-300 bg-primary-50/40 shadow-xl shadow-primary-100 ring-2 ring-primary-300'
                            : 'border-slate-200 bg-white shadow-sm'
                        }`}
                      >
                        {isPopular && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-600 px-4 py-1 text-xs font-semibold text-white">
                            Most Popular
                          </div>
                        )}
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                          <p className="mt-2 text-sm text-slate-500">{plan.description}</p>
                        </div>
                        <div className="mt-6 border-t border-slate-100 pt-6">
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-extrabold text-slate-900">${price}</span>
                            <span className="text-sm text-slate-500">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                          </div>
                          {billingCycle === 'yearly' && plan.billing_cycle === 'monthly' && (plan.yearly_discount_percent ?? 0) > 0 && (
                            <p className="mt-1 text-xs text-green-600 font-medium">
                              Save ${(plan.price_usd * 12 * (plan.yearly_discount_percent / 100)).toFixed(2)} per year
                            </p>
                          )}
                        </div>
                        <ul className="mt-6 flex-1 space-y-3">
                          <li className="flex items-center gap-2 text-sm text-slate-700">
                            <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                            Up to <strong>{plan.student_limit.toLocaleString()}</strong> students
                          </li>
                          <li className="flex items-center gap-2 text-sm text-slate-700">
                            <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                            {plan.trial_days} day free trial
                          </li>
                          {plan.grace_days > 0 && (
                            <li className="flex items-center gap-2 text-sm text-slate-700">
                              <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                              {plan.grace_days} day grace period
                            </li>
                          )}
                          {plan.features && Object.entries(plan.features).map(([key, enabled]) => (
                            <li key={key} className={`flex items-center gap-2 text-sm ${enabled ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                              {enabled ? <CheckCircle className="h-4 w-4 shrink-0 text-green-500" /> : <X className="h-4 w-4 shrink-0 text-slate-300" />}
                              {formatFeatureLabel(key)}
                            </li>
                          ))}
                        </ul>
                        <PlanButton plan={plan} isPopular={isPopular} />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Enterprise nudge banner */}
              <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-violet-200 bg-violet-50 p-6 text-center">
                <Sparkles className="mx-auto mb-3 h-7 w-7 text-violet-500" />
                <h3 className="text-base font-semibold text-violet-900">Need something bigger?</h3>
                <p className="mt-1.5 text-sm text-violet-700">
                  {enterprisePlan
                    ? `Our ${enterprisePlan.name} plan is fully custom — unlimited students, dedicated support, and pricing tailored to your institution.`
                    : 'Our Enterprise plan is fully custom — unlimited students, dedicated support, and pricing tailored to your institution.'}
                </p>
                <button
                  onClick={() => setViewMode('enterprise')}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  Explore Enterprise <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>

          {/* Feature comparison */}
          {standardPlans.length > 1 && allFeatureKeys.length > 0 && (
            <section className="bg-slate-50 py-16 sm:py-20">
              <div className="mx-auto max-w-5xl px-4 sm:px-6">
                <h2 className="text-center text-2xl font-bold text-slate-900">Compare Plans</h2>
                <p className="mt-2 text-center text-sm text-slate-500">See what's included in each plan</p>
                <div className="mt-10 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="px-6 py-4 text-left font-medium text-slate-500">Feature</th>
                        {standardPlans.map((p) => (
                          <th key={p.id} className="px-6 py-4 text-center font-semibold text-slate-900">{p.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-50">
                        <td className="px-6 py-3 text-slate-600">Student Limit</td>
                        {standardPlans.map((p) => (
                          <td key={p.id} className="px-6 py-3 text-center font-medium text-slate-900">{p.student_limit.toLocaleString()}</td>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-50">
                        <td className="px-6 py-3 text-slate-600">Free Trial</td>
                        {standardPlans.map((p) => (
                          <td key={p.id} className="px-6 py-3 text-center font-medium text-slate-900">{p.trial_days} days</td>
                        ))}
                      </tr>
                      {allFeatureKeys.map((key) => (
                        <tr key={key} className="border-b border-slate-50">
                          <td className="px-6 py-3 text-slate-600">{formatFeatureLabel(key)}</td>
                          {standardPlans.map((p) => (
                            <td key={p.id} className="px-6 py-3 text-center">
                              {p.features?.[key]
                                ? <CheckCircle className="inline h-5 w-5 text-green-500" />
                                : <X className="inline h-5 w-5 text-slate-300" />}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* ──────── ENTERPRISE SECTION ──────── */}
      {viewMode === 'enterprise' && (
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-start">

              {/* Left — value prop */}
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                  <Sparkles className="h-3.5 w-3.5" /> Enterprise
                </div>
                <h2 className="mt-4 text-3xl font-extrabold text-slate-900 sm:text-4xl">
                  A plan built<br />around your school
                </h2>
                <p className="mt-4 text-base text-slate-500 leading-relaxed">
                  Large institutions have unique needs. Our Enterprise plan gives you a fully custom setup — talk to us
                  about student numbers, specific modules, integrations, dedicated support, and pricing that works for your budget.
                </p>

                <ul className="mt-8 space-y-4">
                  {[
                    ['Unlimited students', 'No cap on enrollment — scale as your school grows'],
                    ['Custom modules', 'Enable only what you need — attendance, fees, library, NFC, and more'],
                    ['Dedicated onboarding', 'Our team sets up your account and trains your staff'],
                    ['Priority support', 'Direct line to our support team via email and phone'],
                    ['Custom pricing', 'Flexible billing — annual, multi-year, or government invoicing'],
                    ['Data & compliance', 'Custom data retention, export, and MOE compliance packages'],
                  ].map(([title, desc]) => (
                    <li key={title} className="flex gap-3">
                      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-violet-500" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{title}</p>
                        <p className="text-xs text-slate-500">{desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Questions before filling the form?{' '}
                    <a href="mailto:support@schoolsyncedu.com" className="font-semibold text-violet-700 hover:text-violet-800">
                      support@schoolsyncedu.com
                    </a>
                    <br />
                    We typically respond within 1–2 business days.
                  </p>
                </div>
              </div>

              {/* Right — contact form */}
              <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                {eSuccess ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100">
                      <CheckCircle className="h-8 w-8 text-violet-600" />
                    </div>
                    <h3 className="mt-4 text-xl font-bold text-slate-900">Inquiry Received!</h3>
                    <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                      Thank you! We've received your enterprise inquiry and will reach out to{' '}
                      <strong>{eForm.email || 'you'}</strong> within 1–2 business days.
                    </p>
                    <button
                      onClick={() => setESuccess(false)}
                      className="mt-6 rounded-lg border border-slate-200 px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Submit another inquiry
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleEnterpriseSubmit} className="space-y-5">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Contact our sales team</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Tell us about your school and what you need — we'll get back to you with a custom proposal.
                      </p>
                    </div>

                    {eError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{eError}</div>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-700">School Name *</label>
                        <div className="relative mt-1">
                          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <input
                            type="text" required value={eForm.school_name}
                            onChange={(e) => setEForm({ ...eForm, school_name: e.target.value })}
                            placeholder="Monrovia Academy"
                            className="block w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700">Your Name *</label>
                        <div className="relative mt-1">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <input
                            type="text" required value={eForm.contact_name}
                            onChange={(e) => setEForm({ ...eForm, contact_name: e.target.value })}
                            placeholder="Full name"
                            className="block w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700">Email Address *</label>
                        <div className="relative mt-1">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <input
                            type="email" required value={eForm.email}
                            onChange={(e) => setEForm({ ...eForm, email: e.target.value })}
                            placeholder="you@school.com"
                            className="block w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700">Phone Number</label>
                        <div className="relative mt-1">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <input
                            type="tel" value={eForm.phone}
                            onChange={(e) => setEForm({ ...eForm, phone: e.target.value })}
                            placeholder="+231 ..."
                            className="block w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        <Users className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                        Estimated Number of Students
                      </label>
                      <select
                        value={eForm.student_count}
                        onChange={(e) => setEForm({ ...eForm, student_count: e.target.value })}
                        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                      >
                        <option value="">Select a range</option>
                        {STUDENT_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-2">
                        <Layers className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                        Modules You Need
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {MODULE_OPTIONS.map((m) => (
                          <label key={m} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedModules.includes(m)}
                              onChange={() => toggleModule(m)}
                              className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                            />
                            <span className="text-xs text-slate-700">{m}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        <MessageSquare className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                        Additional Requirements or Questions
                      </label>
                      <textarea
                        value={eForm.message}
                        onChange={(e) => setEForm({ ...eForm, message: e.target.value })}
                        rows={3}
                        placeholder="Tell us about any specific integrations, compliance requirements, or features you need..."
                        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={eSubmitting}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {eSubmitting ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                      ) : (
                        <><Send className="h-4 w-4" /> Send Inquiry</>
                      )}
                    </button>

                    <p className="text-center text-xs text-slate-400">
                      We'll reply to your email within 1–2 business days.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FAQ — shown on both views */}
      <section className="bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-2xl font-bold text-slate-900">Frequently Asked Questions</h2>
          <div className="mt-10 space-y-6">
            {[
              { q: 'Is there a free trial?', a: 'Yes! Every standard plan comes with a free trial period. You can explore all features during the trial with no payment required.' },
              { q: 'Can I change my plan later?', a: 'Absolutely. You can upgrade or downgrade at any time from the billing settings in your admin dashboard.' },
              { q: 'What payment methods do you accept?', a: 'We accept Visa, Mastercard, and mobile money (Orange Money, MTN, Lonestar). All payments are processed securely.' },
              { q: 'What happens when my trial ends?', a: "You'll receive email reminders before your trial expires. If you don't subscribe, your school enters a grace period where you can still access data but some features are limited." },
              { q: 'Is my school data secure?', a: 'Yes. All data is encrypted at rest and in transit. Each school has isolated data with row-level security policies. We use Supabase, which is SOC2 compliant.' },
              { q: 'Who is the Enterprise plan for?', a: "Large schools, school networks, or government institutions that need more than 2,500 students, custom modules, dedicated support, or custom billing terms. Contact us and we'll design a plan around your needs." },
            ].map((item) => (
              <div key={item.q} className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <HelpCircle className="h-5 w-5 text-primary-500" /> {item.q}
                </h3>
                <p className="mt-2 pl-7 text-sm leading-relaxed text-slate-500">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary-900 py-16">
        <div className="mx-auto max-w-3xl text-center px-4">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Ready to get started?</h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-white/60">
            Create your school in under 5 minutes. Start your free trial today.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link to="/register" className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-accent-600">
              Register Your School <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={() => setViewMode('enterprise')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-6 py-3.5 text-base font-semibold text-white hover:bg-white/10"
            >
              <Sparkles className="h-4 w-4" /> Enterprise Inquiry
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
