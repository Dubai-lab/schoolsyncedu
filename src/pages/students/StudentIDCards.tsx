import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card, CardContent } from '@/components/ui/Card';
import { CreditCard } from 'lucide-react';

export default function StudentIDCards() {
  return (
    <div className="space-y-5">
      <Breadcrumb items={[
        { label: 'Students', href: '/students' },
        { label: 'ID Cards' },
      ]} />

      <h1 className="text-xl font-bold text-slate-900">Student ID Cards</h1>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 mb-4">
            <CreditCard className="h-7 w-7 text-primary-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-700">ID Card Generator</h2>
          <p className="mt-1 text-sm text-slate-400 max-w-sm">
            Design, generate, and print student ID cards with NFC encoding. Full card designer coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}