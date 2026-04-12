import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';
import type { GradeReportSummary } from '@/types/grade.types';
import type { AttendanceSummaryByClass } from '@/types/attendance.types';
import type { FinancialSummaryByClass, LatePaymentSummary, MonthlyRevenueSummary } from '@/types/fee.types';
import type { RecentAuditActivity } from '@/types/user.types';

// ==================== ACADEMIC REPORTS ====================

export const academicReportService = {
  async getGradeReportSummary(schoolId: UUID) {
    const { data, error } = await supabase
      .from('vw_grade_report_summary')
      .select('*')
      .eq('school_id', schoolId);
    if (error) throw error;
    return data as GradeReportSummary[];
  },

  async getStudentDashboard(schoolId: UUID) {
    const { data, error } = await supabase
      .from('vw_student_dashboard')
      .select('*')
      .eq('school_id', schoolId);
    if (error) throw error;
    return data as Record<string, unknown>[];
  },
};

// ==================== ATTENDANCE REPORTS ====================

export const attendanceReportService = {
  async getSummaryByClass(schoolId: UUID) {
    const { data, error } = await supabase
      .from('vw_attendance_summary_by_class')
      .select('*')
      .eq('school_id', schoolId);
    if (error) throw error;
    return data as AttendanceSummaryByClass[];
  },
};

// ==================== FINANCIAL REPORTS ====================

export const financialReportService = {
  async getSummaryByClass(schoolId: UUID) {
    const { data, error } = await supabase
      .from('vw_financial_summary_by_class')
      .select('*')
      .eq('school_id', schoolId);
    if (error) throw error;
    return data as FinancialSummaryByClass[];
  },

  async getLatePayments(schoolId: UUID) {
    const { data, error } = await supabase
      .from('vw_late_payments')
      .select('*')
      .eq('school_id', schoolId);
    if (error) throw error;
    return data as LatePaymentSummary[];
  },

  async getMonthlyRevenue(schoolId: UUID) {
    const { data, error } = await supabase
      .from('vw_monthly_revenue_summary')
      .select('*')
      .eq('school_id', schoolId)
      .order('month', { ascending: false });
    if (error) throw error;
    return data as MonthlyRevenueSummary[];
  },
};

// ==================== AUDIT / ACTIVITY ====================

export const auditReportService = {
  async getRecentActivity(schoolId: UUID) {
    const { data, error } = await supabase
      .from('vw_recent_audit_activity')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data as RecentAuditActivity[];
  },
};