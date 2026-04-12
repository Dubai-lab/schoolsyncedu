import { useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import {
  GraduationCap,
  CalendarCheck,
  DollarSign,
  FileText,
  ArrowRight,
} from 'lucide-react';

const reportSections = [
  {
    title: 'Academic Reports',
    description: 'View grade summaries, GPA distributions, and student performance across classes and terms.',
    icon: GraduationCap,
    path: '/reports/academic',
    color: 'text-blue-600 bg-blue-100',
  },
  {
    title: 'Attendance Reports',
    description: 'Analyze attendance rates by class, identify trends, and track student attendance percentages.',
    icon: CalendarCheck,
    path: '/reports/attendance',
    color: 'text-green-600 bg-green-100',
  },
  {
    title: 'Financial Reports',
    description: 'Monitor fee collections, outstanding balances, monthly revenue, and late payment summaries.',
    icon: DollarSign,
    path: '/reports/financial',
    color: 'text-amber-600 bg-amber-100',
  },
];

export default function ReportList() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Reports' }]} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Generate and view reports across academic, attendance, and financial data.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportSections.map((section) => (
          <Card key={section.path} className="flex flex-col justify-between">
            <div className="p-6">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg ${section.color} mb-4`}>
                <section.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{section.title}</h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{section.description}</p>
            </div>
            <div className="px-6 pb-6">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate(section.path)}
              >
                <FileText className="w-4 h-4 mr-2" />
                View Reports
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
