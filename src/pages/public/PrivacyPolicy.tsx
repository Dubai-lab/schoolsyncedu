import { Shield, Lock, Eye, Database, Mail, RefreshCw } from 'lucide-react';

const LAST_UPDATED = 'April 13, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <div className="text-sm leading-relaxed text-slate-600 space-y-3">{children}</div>
    </div>
  );
}

export default function PrivacyPolicy() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-900 via-primary-700 to-primary-600 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white sm:text-5xl">Privacy Policy</h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/70">
            We take your privacy seriously. This policy explains how EduLiberia collects, uses, and protects your information.
          </p>
          <p className="mt-4 text-sm text-white/50">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      {/* Quick summary cards */}
      <section className="py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Lock, title: 'Data Encrypted', desc: 'All data is encrypted at rest and in transit using industry-standard TLS.' },
              { icon: Eye, title: 'No Data Selling', desc: 'We never sell, rent, or trade your personal information to third parties.' },
              { icon: Database, title: 'School Isolation', desc: 'Each school\'s data is isolated with row-level security — other schools cannot access your data.' },
              { icon: RefreshCw, title: 'Your Rights', desc: 'You can request access, correction, or deletion of your data at any time.' },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                  <item.icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Full policy text */}
      <section className="pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="space-y-10">

            <Section title="1. Who We Are">
              <p>
                SchoolSync is a product of <strong>EduLiberia</strong>, a technology company registered in Liberia. We operate a
                multi-tenant school management platform (schoolsyncedu.com) that serves schools, administrators, teachers, students,
                and parents across Liberia.
              </p>
              <p>
                For any privacy-related concerns, contact us at{' '}
                <a href="mailto:support@schoolsyncedu.com" className="text-primary-600 hover:underline font-medium">
                  support@schoolsyncedu.com
                </a>.
              </p>
            </Section>

            <Section title="2. Information We Collect">
              <p>We collect the following categories of information:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Account information:</strong> Name, email address, phone number, and password (hashed) when you register
                  a school or create a user account.
                </li>
                <li>
                  <strong>School information:</strong> School name, location, MOE registration number, principal details, and
                  address provided during registration.
                </li>
                <li>
                  <strong>Student records:</strong> Student names, enrollment data, grades, attendance records, and fee payment
                  history entered by authorized school staff.
                </li>
                <li>
                  <strong>Payment information:</strong> Billing records and transaction references. We do not store full card
                  numbers — payments are processed by secure third-party gateways.
                </li>
                <li>
                  <strong>Usage data:</strong> Log data, browser type, IP address, pages visited, and other diagnostic information
                  to improve platform performance.
                </li>
              </ul>
            </Section>

            <Section title="3. How We Use Your Information">
              <p>We use collected information to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Provide, maintain, and improve the SchoolSync platform</li>
                <li>Process school registrations and subscription payments</li>
                <li>Send transactional emails (OTP verification, payment receipts, subscription alerts)</li>
                <li>Respond to support requests and inquiries</li>
                <li>Monitor platform health, security, and prevent fraud</li>
                <li>Comply with applicable laws and regulations in Liberia</li>
              </ul>
              <p>
                We do <strong>not</strong> use student data for advertising, profiling, or any purpose unrelated to the
                educational management services we provide.
              </p>
            </Section>

            <Section title="4. Data Storage & Security">
              <p>
                Your data is stored on secure cloud infrastructure provided by <strong>Supabase</strong> (hosted on AWS), which
                is SOC 2 compliant. All data is:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Encrypted at rest using AES-256</li>
                <li>Encrypted in transit using TLS 1.2 or higher</li>
                <li>Isolated per school using PostgreSQL row-level security (RLS) policies</li>
                <li>Backed up automatically on a regular schedule</li>
              </ul>
              <p>
                Access to production data is restricted to authorized EduLiberia engineers on a need-to-know basis.
              </p>
            </Section>

            <Section title="5. Data Sharing">
              <p>
                We do <strong>not</strong> sell or rent your personal information. We may share data only in the following
                limited circumstances:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Service providers:</strong> We use trusted third-party services (email delivery, payment gateways)
                  solely to operate the platform. These providers are contractually bound to protect your data.
                </li>
                <li>
                  <strong>Legal requirements:</strong> We may disclose information if required by law, court order, or
                  government authority in Liberia.
                </li>
                <li>
                  <strong>Business transfers:</strong> In the event of a merger or acquisition, data may be transferred to
                  the successor entity, subject to the same privacy protections.
                </li>
              </ul>
            </Section>

            <Section title="6. Cookies & Tracking">
              <p>
                SchoolSync uses minimal cookies strictly necessary for authentication (session tokens) and platform functionality.
                We do not use third-party advertising cookies or cross-site tracking.
              </p>
              <p>
                You can disable cookies in your browser settings, but doing so may prevent you from logging in or using certain
                platform features.
              </p>
            </Section>

            <Section title="7. Your Rights">
              <p>You have the right to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
                <li><strong>Correction:</strong> Ask us to correct inaccurate or incomplete information</li>
                <li><strong>Deletion:</strong> Request deletion of your account and associated personal data</li>
                <li><strong>Portability:</strong> Request an export of your school's data in a standard format</li>
                <li><strong>Objection:</strong> Object to certain types of processing where permitted by law</li>
              </ul>
              <p>
                To exercise any of these rights, email us at{' '}
                <a href="mailto:support@schoolsyncedu.com" className="text-primary-600 hover:underline font-medium">
                  support@schoolsyncedu.com
                </a>{' '}
                with your request. We will respond within 14 business days.
              </p>
            </Section>

            <Section title="8. Data Retention">
              <p>
                We retain your data for as long as your school account is active. If you close your account, we will delete or
                anonymize your personal data within <strong>90 days</strong>, except where we are required to retain it for legal
                or regulatory purposes.
              </p>
              <p>
                Student academic records may be retained for a longer period as required by Liberian Ministry of Education
                regulations.
              </p>
            </Section>

            <Section title="9. Children's Privacy">
              <p>
                SchoolSync is used by schools to manage student information on behalf of parents and guardians. Schools are
                responsible for ensuring appropriate consent is obtained from parents or legal guardians before entering
                student data into the platform.
              </p>
              <p>
                We do not knowingly collect personal data directly from children. All student data is entered and managed by
                authorized school administrators.
              </p>
            </Section>

            <Section title="10. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. When we do, we will update the "Last updated" date at
                the top of this page and notify school administrators via email for material changes.
              </p>
              <p>
                Your continued use of SchoolSync after changes are posted constitutes your acceptance of the updated policy.
              </p>
            </Section>

            <Section title="11. Contact">
              <p>
                If you have any questions, concerns, or complaints about this Privacy Policy or how we handle your data,
                please contact:
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-2">
                <p className="font-semibold text-slate-900">EduLiberia — Privacy Team</p>
                <p className="flex items-center gap-2 text-slate-600">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <a href="mailto:support@schoolsyncedu.com" className="text-primary-600 hover:underline">
                    support@schoolsyncedu.com
                  </a>
                </p>
                <p className="text-slate-500">Monrovia, Liberia</p>
              </div>
            </Section>

          </div>
        </div>
      </section>
    </div>
  );
}
