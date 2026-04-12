import type { School } from '@/types/school.types';

/**
 * Replace all {{key}} placeholders in an HTML string with values from a data map.
 * Unknown placeholders are left as-is so the user knows what still needs filling.
 */
export function resolvePlaceholders(html: string, data: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => data[key] ?? `{{${key}}}`);
}

/**
 * Build the school-level placeholder map from a School record.
 * These are auto-filled from the school's registration data — the user never
 * needs to type them in manually.
 */
export function buildSchoolPlaceholders(school: School): Record<string, string> {
  return {
    school_name: school.name ?? '',
    school_logo_url: school.logo_url ?? '',
    school_address: school.address ?? '',
    school_phone: school.phone ?? '',
    school_website: school.website ?? '',
    moe_registration_number: school.moe_registration_number ?? '',
    principal_name: school.principal_name ?? '',
    school_motto: school.motto ?? '',
    school_county: ((school as unknown as Record<string, unknown>).county as string) ?? '',
    date: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    academic_year: new Date().getFullYear() + '–' + (new Date().getFullYear() + 1),
  };
}

/**
 * Build student-level placeholders from a student record snapshot.
 */
export function buildStudentPlaceholders(student: {
  first_name?: string;
  last_name?: string;
  registration_number?: string;
  current_grade_level?: string;
  gender?: string;
  [key: string]: unknown;
}): Record<string, string> {
  const fullName = [student.first_name, student.last_name].filter(Boolean).join(' ');
  return {
    student_name: fullName,
    student_first_name: student.first_name ?? '',
    student_last_name: student.last_name ?? '',
    student_id_number: student.registration_number ?? '',
    class_name: student.current_grade_level ?? '',
    student_gender: student.gender ?? '',
  };
}

/**
 * Full render: merge school + student + any extra overrides, then resolve.
 * School placeholders are always auto-resolved; student and extra are optional.
 */
export function renderLetterHtml(
  bodyHtml: string,
  school: School,
  studentData?: Parameters<typeof buildStudentPlaceholders>[0],
  extra?: Record<string, string>,
): string {
  const data: Record<string, string> = {
    ...buildSchoolPlaceholders(school),
    ...(studentData ? buildStudentPlaceholders(studentData) : {}),
    ...(extra ?? {}),
  };
  return resolvePlaceholders(bodyHtml, data);
}

