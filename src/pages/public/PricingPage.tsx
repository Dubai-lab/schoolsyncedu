import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { pricingPlanService } from '@/services/adminService';
import type { SubscriptionPlan } from '@/types/report.types';
import { CheckCircle, X, ArrowRight, HelpCircle } from 'lucide-react';

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const { data: allPlans = [], isLoading } = useFetch<SubscriptionPlan[]>(
    ['public-pricing-plans'],
    () => pricingPlanService.list(),
  );

  const plans = allPlans.filter((p) => p.is_visible && p.is_active);

  // Gather all feature keys across all plans
  const allFeatureKeys = Array.from(
    new Set(plans.flatMap((p) => (p.features ? Object.keys(p.features) : []))),
  );

  const formatFeatureLabel = (key: string) =>
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div>
      {/* Header */}
      <section className="bg-gradient-to-br from-primary-900 via-primary-700 to-primary-600 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl text-center px-4">
          <h1 className="text-3xl font-extrabold text-white sm:text-5xl">
            Plans & Pricing
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/70">
            Affordable plans designed for schools of every size. Start with a free trial — no credit card required.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center rounded-full border border-white/20 bg-white/10 p-1 backdrop-blur-sm">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-white text-primary-700 shadow'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                billingCycle === 'yearly'
                  ? 'bg-white text-primary-700 shadow'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Yearly <span className="ml-1 text-xs text-green-400">Save 20%</span>
            </button>
          </div>
        </div>
      </section>

      {/* Plan cards */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : plans.length === 0 ? (
            <p className="text-center text-slate-500">No plans available at the moment. Please check back soon.</p>
          ) : (
            <div className={`mx-auto grid max-w-6xl grid-cols-1 gap-8 ${
              plans.length === 1 ? 'md:max-w-md' : plans.length === 2 ? 'md:grid-cols-2 md:max-w-3xl' : 'md:grid-cols-3'
            }`}>
              {plans.map((plan, idx) => {
                const isPopular = plans.length >= 3 ? idx === 1 : false;
                const price =
                  billingCycle === 'yearly'
                    ? plan.billing_cycle === 'yearly'
                      ? plan.price_usd
                      : +(plan.price_usd * 12 * 0.8).toFixed(2)
                    : plan.billing_cycle === 'monthly'
                    ? plan.price_usd
                    : +(plan.price_usd / 12).toFixed(2);

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
                        <span className="text-4xl font-extrabold text-slate-900">
                          ${price}
                        </span>
                        <span className="text-sm text-slate-500">
                          /{billingCycle === 'yearly' ? 'year' : 'month'}
                        </span>
                      </div>
                      {billingCycle === 'yearly' && plan.billing_cycle === 'monthly' && (
                        <p className="mt-1 text-xs text-green-600 font-medium">
                          Save ${(plan.price_usd * 12 * 0.2).toFixed(2)} per year
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
                      {plan.features &&
                        Object.entries(plan.features).map(([key, enabled]) => (
                          <li
                            key={key}
                            className={`flex items-center gap-2 text-sm ${
                              enabled ? 'text-slate-700' : 'text-slate-400 line-through'
                            }`}
                          >
                            {enabled ? (
                              <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                            ) : (
                              <X className="h-4 w-4 shrink-0 text-slate-300" />
                            )}
                            {formatFeatureLabel(key)}
                          </li>
                        ))}
                    </ul>

                    <Link
                      to={`/register?plan=${plan.slug}`}
                      className={`mt-8 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-all ${
                        isPopular
                          ? 'bg-primary-600 text-white shadow-md hover:bg-primary-700'
                          : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Start Free Trial <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Feature comparison table */}
      {plans.length > 1 && allFeatureKeys.length > 0 && (
        <section className="bg-slate-50 py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-bold text-slate-900">Compare Plans</h2>
            <p className="mt-2 text-center text-sm text-slate-500">
              See what's included in each plan
            </p>

            <div className="mt-10 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-4 text-left font-medium text-slate-500">Feature</th>
                    {plans.map((p) => (
                      <th key={p.id} className="px-6 py-4 text-center font-semibold text-slate-900">
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-50">
                    <td className="px-6 py-3 text-slate-600">Student Limit</td>
                    {plans.map((p) => (
                      <td key={p.id} className="px-6 py-3 text-center font-medium text-slate-900">
                        {p.student_limit.toLocaleString()}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-50">
                    <td className="px-6 py-3 text-slate-600">Free Trial</td>
                    {plans.map((p) => (
                      <td key={p.id} className="px-6 py-3 text-center font-medium text-slate-900">
                        {p.trial_days} days
                      </td>
                    ))}
                  </tr>
                  {allFeatureKeys.map((key) => (
                    <tr key={key} className="border-b border-slate-50">
                      <td className="px-6 py-3 text-slate-600">{formatFeatureLabel(key)}</td>
                      {plans.map((p) => (
                        <td key={p.id} className="px-6 py-3 text-center">
                          {p.features?.[key] ? (
                            <CheckCircle className="inline h-5 w-5 text-green-500" />
                          ) : (
                            <X className="inline h-5 w-5 text-slate-300" />
                          )}
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

      {/* FAQ */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-2xl font-bold text-slate-900">Frequently Asked Questions</h2>
          <div className="mt-10 space-y-6">
            {[
              {
                q: 'Is there a free trial?',
                a: 'Yes! Every plan comes with a free trial period. You can explore all features during the trial with no payment required.',
              },
              {
                q: 'Can I change my plan later?',
                a: 'Absolutely. You can upgrade or downgrade your plan at any time from the billing settings in your admin dashboard.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept Visa, Mastercard, and mobile money (Orange Money, MTN, Lonestar). All payments are processed securely.',
              },
              {
                q: 'What happens when my trial ends?',
                a: 'You\'ll receive email reminders before your trial expires. If you don\'t subscribe, your school enters a grace period where you can still access data but some features are limited.',
              },
              {
                q: 'Is my school data secure?',
                a: 'Yes. All data is encrypted at rest and in transit. Each school has isolated data with row-level security policies. We use Supabase, which is SOC2 compliant.',
              },
              {
                q: 'How many users can I add?',
                a: 'There is no limit on the number of staff, teacher, or parent accounts. The student limit depends on your plan — see the comparison table above.',
              },
            ].map((item) => (
              <div key={item.q} className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <HelpCircle className="h-5 w-5 text-primary-500" />
                  {item.q}
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
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Ready to get started?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-white/60">
            Create your school in under 5 minutes. Start your free trial today.
          </p>
          <Link
            to="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-accent-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-accent-600"
          >
            Register Your School <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
