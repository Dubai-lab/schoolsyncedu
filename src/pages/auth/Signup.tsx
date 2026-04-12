import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Signup() {
  return (
    <div className="space-y-8">
      <div className="text-center lg:text-left">
        <h2 className="text-2xl font-bold text-slate-900">Register your school</h2>
        <p className="mt-2 text-sm text-slate-500">
          School registration is managed by our onboarding team.
          Contact us to get started.
        </p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-700 space-y-2">
        <p className="font-medium">How to register:</p>
        <ol className="list-decimal ml-4 space-y-1 text-blue-600">
          <li>Contact our team at <strong>onboarding@eduliberia.com</strong></li>
          <li>We'll set up your school and admin account</li>
          <li>You'll receive login credentials via email</li>
        </ol>
      </div>

      <div className="text-center">
        <Link
          to="/auth/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}