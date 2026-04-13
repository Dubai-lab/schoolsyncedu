import { FileText, AlertTriangle, CheckCircle, Mail } from 'lucide-react';

const LAST_UPDATED = 'April 13, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <div className="text-sm leading-relaxed text-slate-600 space-y-3">{children}</div>
    </div>
  );
}

export default function TermsOfService() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-900 via-primary-700 to-primary-600 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
            <FileText className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white sm:text-5xl">Terms of Service</h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/70">
            Please read these terms carefully before using SchoolSync. By using our platform, you agree to be bound by these terms.
          </p>
          <p className="mt-4 text-sm text-white/50">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      {/* Notice banner */}
      <section className="py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <p className="text-sm text-amber-800 leading-relaxed">
              <strong>Important:</strong> These Terms of Service constitute a legally binding agreement between you (the school
              proprietor, administrator, or authorized representative) and EduLiberia. By registering or using SchoolSync, you
              confirm that you have read, understood, and agreed to these terms.
            </p>
          </div>
        </div>
      </section>

      {/* Full terms */}
      <section className="pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="space-y-10">

            <Section title="1. Definitions">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>"Platform"</strong> refers to the SchoolSync web application and all related services operated by EduLiberia.</li>
                <li><strong>"We," "Us," "EduLiberia"</strong> refers to EduLiberia, the company operating SchoolSync.</li>
                <li><strong>"You," "School," "Customer"</strong> refers to the school, institution, or individual using the Platform.</li>
                <li><strong>"User"</strong> refers to any individual with access to the Platform under your school's account, including administrators, staff, teachers, parents, and students.</li>
                <li><strong>"Content"</strong> refers to data, text, files, and other materials uploaded or entered into the Platform.</li>
                <li><strong>"Subscription"</strong> refers to a paid or trial plan granting access to Platform features.</li>
              </ul>
            </Section>

            <Section title="2. Eligibility & Account Registration">
              <p>
                To use SchoolSync, you must be a legally operating school or educational institution in Liberia, or an authorized
                representative thereof. By registering, you represent and warrant that:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>You have the authority to bind your institution to these Terms</li>
                <li>All registration information you provide is accurate, current, and complete</li>
                <li>You are at least 18 years of age</li>
                <li>Your use of the Platform does not violate any applicable laws or regulations</li>
              </ul>
              <p>
                You are responsible for maintaining the confidentiality of your account credentials and for all activity that
                occurs under your account. Notify us immediately at{' '}
                <a href="mailto:support@schoolsyncedu.com" className="text-primary-600 hover:underline font-medium">
                  support@schoolsyncedu.com
                </a>{' '}
                if you suspect unauthorized access.
              </p>
            </Section>

            <Section title="3. Subscriptions & Payment">
              <p>
                SchoolSync is offered on a subscription basis. The following terms apply:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Free Trial:</strong> New subscribers receive a free trial period as specified in the chosen plan.
                  No payment is required during the trial. Access may be limited or suspended after the trial ends without payment.
                </li>
                <li>
                  <strong>Billing:</strong> Subscription fees are billed monthly or annually as selected. All fees are quoted
                  in USD or LRD as applicable and are due in advance.
                </li>
                <li>
                  <strong>Grace Period:</strong> If payment is not received by the due date, a grace period may apply as
                  specified in your plan. Access may be restricted during this period.
                </li>
                <li>
                  <strong>No Refunds:</strong> Subscription fees are non-refundable except where required by applicable law.
                  If you believe you have been charged in error, contact us within 14 days.
                </li>
                <li>
                  <strong>Price Changes:</strong> We reserve the right to change subscription pricing. We will provide at
                  least 30 days' notice before any price increase takes effect for existing subscribers.
                </li>
                <li>
                  <strong>Suspension:</strong> We reserve the right to suspend or terminate access for non-payment after the
                  grace period expires.
                </li>
              </ul>
            </Section>

            <Section title="4. Acceptable Use">
              <p>You agree to use SchoolSync only for lawful, educational management purposes. You must not:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Use the Platform to store, transmit, or distribute illegal, harmful, or offensive content</li>
                <li>Attempt to gain unauthorized access to other schools' data or system components</li>
                <li>Reverse engineer, decompile, or disassemble any part of the Platform</li>
                <li>Use automated scripts, bots, or scrapers to access the Platform without written permission</li>
                <li>Resell, sublicense, or transfer your account to any third party without prior written consent</li>
                <li>Use the Platform in any way that could damage, disable, or impair its functionality or servers</li>
                <li>Enter false, misleading, or fraudulent student or school data</li>
              </ul>
              <p>
                We reserve the right to immediately suspend accounts found to be in violation of these terms without prior notice.
              </p>
            </Section>

            <Section title="5. Data Ownership & Responsibility">
              <div>
                <p className="font-medium text-slate-800">Your Data</p>
                <p className="mt-1">
                  You retain full ownership of all student records, school data, and other Content you enter into the Platform.
                  By using SchoolSync, you grant EduLiberia a limited, non-exclusive license to process and store your Content
                  solely for the purpose of providing the Platform services.
                </p>
              </div>
              <div>
                <p className="font-medium text-slate-800">Your Responsibilities</p>
                <p className="mt-1">You are solely responsible for:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Ensuring the accuracy and legality of all data entered into the Platform</li>
                  <li>Obtaining appropriate consent from parents or guardians for student data</li>
                  <li>Complying with Liberian data protection laws and Ministry of Education regulations</li>
                  <li>Managing user access and permissions within your school account</li>
                </ul>
              </div>
            </Section>

            <Section title="6. Student Limits">
              <p>
                Each subscription plan includes a maximum number of active students as specified in the plan details. Exceeding
                the student limit is not permitted. If your school's enrollment exceeds your plan's limit, you must upgrade to
                a higher plan before adding additional students.
              </p>
              <p>
                Attempts to circumvent student limit enforcement may result in account suspension.
              </p>
            </Section>

            <Section title="7. Intellectual Property">
              <p>
                The SchoolSync Platform, including its design, software, trademarks, logos, and all original content created by
                EduLiberia, is the exclusive property of EduLiberia and is protected by applicable intellectual property laws.
              </p>
              <p>
                Nothing in these Terms grants you any right to use EduLiberia's trademarks, brand names, or logos without our
                prior written consent.
              </p>
            </Section>

            <Section title="8. Service Availability">
              <p>
                We strive to maintain 99.9% platform uptime. However, we do not guarantee uninterrupted access and shall not
                be liable for:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Scheduled maintenance windows (we will provide advance notice where possible)</li>
                <li>Outages caused by third-party service providers (hosting, email, payment gateways)</li>
                <li>Force majeure events beyond our reasonable control</li>
              </ul>
            </Section>

            <Section title="9. Limitation of Liability">
              <p>
                To the maximum extent permitted by applicable law, EduLiberia shall not be liable for any indirect, incidental,
                special, consequential, or punitive damages, including loss of data, revenue, or goodwill, arising from your use
                of or inability to use the Platform.
              </p>
              <p>
                Our total liability to you for any claim arising out of or relating to these Terms or the Platform shall not
                exceed the total fees you paid to us in the three (3) months preceding the claim.
              </p>
            </Section>

            <Section title="10. Termination">
              <p>
                Either party may terminate the subscription at any time. You may cancel by contacting us at{' '}
                <a href="mailto:support@schoolsyncedu.com" className="text-primary-600 hover:underline font-medium">
                  support@schoolsyncedu.com
                </a>.
                Termination takes effect at the end of the current billing period unless otherwise agreed.
              </p>
              <p>
                Upon termination, your access to the Platform will cease. You may request an export of your school data within
                30 days of termination. After 90 days, we may permanently delete your data.
              </p>
              <p>
                We reserve the right to terminate accounts that violate these Terms, engage in fraudulent activity, or fail to
                pay subscription fees after the grace period.
              </p>
            </Section>

            <Section title="11. Modifications to Terms">
              <p>
                We may update these Terms of Service from time to time. We will notify school administrators via email at least
                14 days before material changes take effect. Your continued use of the Platform after the effective date
                constitutes acceptance of the revised Terms.
              </p>
              <p>
                If you do not agree to the revised Terms, you must stop using the Platform and may request account termination.
              </p>
            </Section>

            <Section title="12. Governing Law">
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the <strong>Republic of Liberia</strong>.
                Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts of Liberia.
              </p>
            </Section>

            <Section title="13. Contact">
              <p>
                For questions about these Terms of Service, contact us at:
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-2">
                <p className="font-semibold text-slate-900">EduLiberia — Legal</p>
                <p className="flex items-center gap-2 text-slate-600">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <a href="mailto:support@schoolsyncedu.com" className="text-primary-600 hover:underline">
                    support@schoolsyncedu.com
                  </a>
                </p>
                <p className="text-slate-500">Monrovia, Liberia</p>
              </div>
            </Section>

            {/* Acceptance note */}
            <div className="rounded-xl border border-green-200 bg-green-50 p-5 flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              <p className="text-sm text-green-800 leading-relaxed">
                By registering a school on SchoolSync or using any part of the Platform, you acknowledge that you have read,
                understood, and agree to be bound by these Terms of Service and our{' '}
                <a href="/privacy" className="font-semibold underline hover:text-green-900">Privacy Policy</a>.
              </p>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
