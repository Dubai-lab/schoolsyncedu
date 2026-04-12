-- ============================================================
-- Migration 022: Letter Template Defaults & Staff Access Control
-- Purpose:
--   1. Add updated_at to letter_templates (service already writes it)
--   2. Create letter_template_access table (template → role mapping)
--   3. Replace blanket letter_templates_tenant policy with role-based RLS
--   4. Seed all 23 default letter templates per school with proper access grants
-- ============================================================

-- ============================================================
-- PART 1: Add missing updated_at column
-- ============================================================

ALTER TABLE letter_templates
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ============================================================
-- PART 2: Create letter_template_access table
-- Maps which staff role can USE (see/generate) which template.
-- Principal manages these grants; other staff only see their assigned templates.
-- ============================================================

CREATE TABLE IF NOT EXISTS letter_template_access (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES letter_templates(id) ON DELETE CASCADE,
  role        user_role NOT NULL,
  granted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(template_id, role)
);

CREATE INDEX IF NOT EXISTS idx_lta_school_id   ON letter_template_access(school_id);
CREATE INDEX IF NOT EXISTS idx_lta_template_id ON letter_template_access(template_id);
CREATE INDEX IF NOT EXISTS idx_lta_school_role ON letter_template_access(school_id, role);

ALTER TABLE letter_template_access ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART 3: Replace broad letter_templates policy with role-based RLS
-- ============================================================

-- Drop the existing blanket policy from migration 006
DROP POLICY IF EXISTS letter_templates_tenant ON letter_templates;

-- SELECT: Leadership sees all school templates; other staff see only granted templates
CREATE POLICY letter_templates_select ON letter_templates
  FOR SELECT USING (
    is_super_admin()
    OR (
      school_id = auth_school_id()
      AND (
        auth_user_role() IN (
          'principal'::user_role,
          'vice_principal'::user_role,
          'admin_staff'::user_role,
          'it_admin'::user_role
        )
        OR id IN (
          SELECT template_id
          FROM letter_template_access
          WHERE school_id = auth_school_id()
            AND role = auth_user_role()
        )
      )
    )
  );

-- INSERT: Only leadership can create new templates
CREATE POLICY letter_templates_insert ON letter_templates
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'principal'::user_role,
      'vice_principal'::user_role,
      'admin_staff'::user_role,
      'it_admin'::user_role
    )
  );

-- UPDATE: Only leadership can edit templates
CREATE POLICY letter_templates_update ON letter_templates
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'principal'::user_role,
      'vice_principal'::user_role,
      'admin_staff'::user_role,
      'it_admin'::user_role
    )
  );

-- DELETE: Only principal/vice_principal can delete templates
CREATE POLICY letter_templates_delete ON letter_templates
  FOR DELETE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'principal'::user_role,
      'vice_principal'::user_role
    )
  );

-- RLS for letter_template_access:
-- Any school staff can view access records (to know what's available)
-- Only principal/vice_principal can grant or revoke access
CREATE POLICY lta_select ON letter_template_access
  FOR SELECT USING (school_id = auth_school_id() OR is_super_admin());

CREATE POLICY lta_insert ON letter_template_access
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() IN ('principal'::user_role, 'vice_principal'::user_role)
  );

CREATE POLICY lta_delete ON letter_template_access
  FOR DELETE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN ('principal'::user_role, 'vice_principal'::user_role)
  );

-- ============================================================
-- PART 4: Function to seed default letter templates per school
-- Call this after a school registers (or via trigger).
-- Safe to call multiple times — skips if starters already exist.
-- ============================================================

CREATE OR REPLACE FUNCTION seed_default_letter_templates(
  p_school_id UUID,
  p_created_by UUID  -- should be the principal's users.id
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hdr TEXT;
  v_ftr TEXT;
  v_tid UUID;
BEGIN
  -- Skip if this school already has starter templates
  IF EXISTS (
    SELECT 1 FROM letter_templates
    WHERE school_id = p_school_id AND is_starter = TRUE
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  -- Common letter header (uses school placeholders)
  v_hdr := '<div style="font-family:Georgia,serif;max-width:700px;margin:auto;padding:32px 40px;">
  <table width="100%" style="border-bottom:3px double #1a3c5e;padding-bottom:16px;margin-bottom:24px;">
    <tr>
      <td style="vertical-align:middle;width:80px;"><img src="{{school_logo_url}}" alt="Logo" style="height:72px;width:72px;object-fit:contain;" /></td>
      <td style="text-align:center;vertical-align:middle;">
        <h2 style="margin:0;font-size:22px;color:#1a3c5e;letter-spacing:1px;">{{school_name}}</h2>
        <p style="margin:4px 0 0;font-size:12px;color:#555;">{{school_address}}</p>
        <p style="margin:2px 0;font-size:12px;color:#555;">Tel: {{school_phone}} &nbsp;|&nbsp; {{school_website}}</p>
        <p style="margin:2px 0;font-size:11px;color:#888;">MOE Reg No: {{moe_registration_number}}</p>
      </td>
    </tr>
  </table>
  <p style="text-align:right;font-size:13px;color:#333;">{{date}}</p>';

  -- Common letter footer
  v_ftr := '<br/><br/>
  <p style="margin:0;">Yours sincerely,</p>
  <div style="margin-top:40px;border-top:1px solid #333;display:inline-block;min-width:200px;padding-top:4px;">
    <strong>{{principal_name}}</strong><br/>
    <em style="font-size:12px;color:#555;">Principal, {{school_name}}</em>
  </div>
</div>';

  -- ==== MODULE 1: ADMISSIONS (default access → registrar) ====

  -- 1. Acceptance Letter
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'Student Acceptance Letter', 'admissions', 'acceptance_letter', 'medium',
    'Offer of Admission — {{school_name}}',
    v_hdr || '
  <h3 style="text-align:center;color:#1a5276;text-transform:uppercase;letter-spacing:2px;font-size:15px;">Offer of Admission</h3>
  <p>Dear Parent/Guardian of <strong>{{student_name}}</strong>,</p>
  <p>We are pleased to inform you that your ward, <strong>{{student_name}}</strong>, has been <strong>accepted for admission</strong> into <strong>{{class_name}}</strong> at {{school_name}} for the <strong>{{academic_year}}</strong> academic year.</p>
  <p>Please report to the Registrar''s Office no later than <strong>{{reporting_date}}</strong> with the following:</p>
  <ul style="line-height:1.8;">
    <li>Original birth certificate</li>
    <li>Previous school reports / transcripts (last 2 years)</li>
    <li>Four (4) recent passport photographs</li>
    <li>Completed payment of school fees (see attached fee schedule)</li>
  </ul>
  <p>We are delighted to welcome <strong>{{student_name}}</strong> to the {{school_name}} family.</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","student_name","class_name","academic_year","reporting_date","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'acceptance_letter' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'registrar', p_created_by) ON CONFLICT DO NOTHING;

  -- 2. Rejection Letter
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'Admission Rejection Letter', 'admissions', 'rejection_letter', 'medium',
    'Admission Decision — {{school_name}}',
    v_hdr || '
  <h3 style="text-align:center;color:#922b21;text-transform:uppercase;letter-spacing:2px;font-size:15px;">Admission Decision</h3>
  <p>Dear Parent/Guardian of <strong>{{student_name}}</strong>,</p>
  <p>Thank you for your interest in {{school_name}} and for submitting an application for the <strong>{{academic_year}}</strong> academic year.</p>
  <p>After careful review of all applications received, we regret to inform you that we are unable to offer admission to <strong>{{student_name}}</strong> at this time. Our decision is based on {{rejection_reason}}.</p>
  <p>We encourage you to explore other educational opportunities and wish {{student_name}} every success in the future.</p>
  <p>Should you have any questions, please do not hesitate to contact the Registrar''s Office.</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","student_name","academic_year","rejection_reason","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'rejection_letter' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'registrar', p_created_by) ON CONFLICT DO NOTHING;

  -- 3. Waitlist Notification
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'Waitlist Notification', 'admissions', 'waitlist_notification', 'low',
    'Waitlist Status — {{student_name}} — {{school_name}}',
    v_hdr || '
  <h3 style="text-align:center;color:#7d6608;text-transform:uppercase;letter-spacing:2px;font-size:15px;">Waitlist Notification</h3>
  <p>Dear Parent/Guardian of <strong>{{student_name}}</strong>,</p>
  <p>Thank you for applying to {{school_name}} for the <strong>{{academic_year}}</strong> academic year. We have received a high volume of applications this year and are pleased to inform you that <strong>{{student_name}}</strong> has been placed on our <strong>waitlist</strong> for <strong>{{class_name}}</strong>.</p>
  <p>We will notify you as soon as a place becomes available. Waitlist decisions are made on a rolling basis, and we will contact you by <strong>{{decision_date}}</strong>.</p>
  <p>Please contact the Registrar''s Office if you have any questions or if your circumstances change.</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","student_name","class_name","academic_year","decision_date","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'waitlist_notification' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'registrar', p_created_by) ON CONFLICT DO NOTHING;

  -- 4. Transfer Letter
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'Transfer Letter', 'admissions', 'transfer_letter', 'medium',
    'Letter of Transfer — {{student_name}}',
    v_hdr || '
  <h3 style="text-align:center;color:#1a5276;text-transform:uppercase;letter-spacing:2px;font-size:15px;">Letter of Transfer</h3>
  <p>To Whom It May Concern,</p>
  <p>This is to certify that <strong>{{student_name}}</strong> (Student ID: {{student_id_number}}), was enrolled at {{school_name}} from <strong>{{enrollment_date}}</strong> to <strong>{{transfer_date}}</strong>, studying in <strong>{{class_name}}</strong>.</p>
  <p>The student is being transferred due to {{transfer_reason}} and is in good standing with the school. We wish {{student_name}} continued success.</p>
  <p>Please extend all necessary courtesies to the student.</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","student_name","student_id_number","class_name","enrollment_date","transfer_date","transfer_reason","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'transfer_letter' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'registrar', p_created_by) ON CONFLICT DO NOTHING;

  -- ==== MODULE 2: DISCIPLINARY (default access → dean_of_students) ====

  -- 5. Warning Letter
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'Student Warning Letter', 'disciplinary', 'warning_letter', 'medium',
    'OFFICIAL WARNING — {{student_name}}',
    v_hdr || '
  <h3 style="text-align:center;color:#b7770d;text-transform:uppercase;letter-spacing:2px;font-size:15px;">Official Warning</h3>
  <p>Dear Parent/Guardian of <strong>{{student_name}}</strong>,</p>
  <p>We are writing to formally warn <strong>{{student_name}}</strong> (Class: {{class_name}}) regarding the following conduct: <strong>{{offense_description}}</strong>, which occurred on <strong>{{incident_date}}</strong>.</p>
  <p>This behavior is in violation of the school''s Code of Conduct. If this conduct continues, further disciplinary action — including suspension or expulsion — will be taken.</p>
  <p>We request that you discuss this matter with your ward and ensure a marked improvement in behavior. Please sign and return the acknowledgment slip below.</p>
  <hr style="margin:24px 0;border:none;border-top:1px dashed #ccc;"/>
  <p><strong>Acknowledgment:</strong> I, _________________________, parent/guardian of {{student_name}}, have received and understood this warning letter.</p>
  <p>Signature: _________________ &nbsp;&nbsp; Date: _________________</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","student_name","class_name","offense_description","incident_date","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'warning_letter' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'dean_of_students', p_created_by) ON CONFLICT DO NOTHING;

  -- 6. Suspension Notice
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'Suspension Notice', 'disciplinary', 'suspension_notice', 'high',
    'SUSPENSION NOTICE — {{student_name}}',
    v_hdr || '
  <h3 style="text-align:center;color:#c0392b;text-transform:uppercase;letter-spacing:2px;font-size:15px;">Notice of Suspension</h3>
  <p>Dear Parent/Guardian of <strong>{{student_name}}</strong>,</p>
  <p>This letter serves as formal notice that <strong>{{student_name}}</strong> (Class: {{class_name}}) has been <strong>suspended from school</strong> for <strong>{{suspension_days}} day(s)</strong>, effective <strong>{{suspension_start_date}}</strong> to <strong>{{suspension_end_date}}</strong>.</p>
  <p><strong>Reason for suspension:</strong> {{offense_description}}</p>
  <p>During the suspension period, {{student_name}} is not permitted on school premises. A re-admission interview will be conducted on <strong>{{readmission_date}}</strong>. You are required to accompany your ward to this meeting.</p>
  <p>We urge you to use this period to counsel your ward on the importance of adhering to school rules and regulations.</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","student_name","class_name","suspension_days","suspension_start_date","suspension_end_date","offense_description","readmission_date","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'suspension_notice' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'dean_of_students', p_created_by) ON CONFLICT DO NOTHING;

  -- 7. NTR Notice (Never To Return)
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'NTR Notice', 'disciplinary', 'ntr_notice', 'critical',
    'NOTICE — {{student_name}} — Never To Return',
    v_hdr || '
  <h3 style="text-align:center;color:#922b21;text-transform:uppercase;letter-spacing:2px;font-size:15px;">Notice: Never To Return (NTR)</h3>
  <p>Dear Parent/Guardian of <strong>{{student_name}}</strong>,</p>
  <p>This letter serves as official notification that <strong>{{student_name}}</strong> (Class: {{class_name}}, Student ID: {{student_id_number}}) has been issued a <strong>Never To Return (NTR)</strong> order, effective <strong>{{effective_date}}</strong>.</p>
  <p><strong>Grounds:</strong> {{offense_description}}</p>
  <p>This decision was made following a thorough review of the student''s conduct record and is final. The student is permanently prohibited from entering the school premises or attending any school-sponsored events.</p>
  <p>You may collect the student''s personal belongings and official documents (transcripts, certificates) from the Registrar''s Office within <strong>14 days</strong> of this notice.</p>
  <p>You have the right to appeal this decision in writing to the Board of Governors within <strong>7 days</strong>.</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","student_name","class_name","student_id_number","effective_date","offense_description","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'ntr_notice' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'dean_of_students', p_created_by) ON CONFLICT DO NOTHING;

  -- 8. Expulsion Notice
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'Expulsion Notice', 'disciplinary', 'expulsion_notice', 'critical',
    'NOTICE OF EXPULSION — {{student_name}}',
    v_hdr || '
  <h3 style="text-align:center;color:#922b21;text-transform:uppercase;letter-spacing:2px;font-size:15px;">Notice of Expulsion</h3>
  <p>Dear Parent/Guardian of <strong>{{student_name}}</strong>,</p>
  <p>After due process and careful deliberation by the school administration, this letter serves as formal notice that <strong>{{student_name}}</strong> (Class: {{class_name}}) has been <strong>permanently expelled</strong> from {{school_name}}, effective <strong>{{effective_date}}</strong>.</p>
  <p><strong>Grounds for expulsion:</strong> {{offense_description}}</p>
  <p>This decision was reached after prior warnings (referenced: {{prior_warnings}}) went unheeded. The student is to vacate school premises immediately and is not to return.</p>
  <p>You may collect personal belongings and academic documents from the Registrar''s Office. An appeal may be submitted in writing to the School Board within <strong>10 business days</strong>.</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","student_name","class_name","effective_date","offense_description","prior_warnings","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'expulsion_notice' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'dean_of_students', p_created_by) ON CONFLICT DO NOTHING;

  -- ==== MODULE 3: ACADEMIC (default access → admin_staff) ====

  -- 9. Report Card Cover Letter
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'Report Card Cover Letter', 'academic', 'report_card_cover', 'low',
    'Academic Report — {{student_name}} — {{term}} {{academic_year}}',
    v_hdr || '
  <h3 style="text-align:center;color:#1a5276;text-transform:uppercase;letter-spacing:2px;font-size:15px;">Academic Report — {{term}} {{academic_year}}</h3>
  <p>Dear Parent/Guardian of <strong>{{student_name}}</strong>,</p>
  <p>Please find enclosed the academic report card for <strong>{{student_name}}</strong> (Class: {{class_name}}) for the <strong>{{term}}</strong> of the {{academic_year}} academic year.</p>
  <p><strong>Overall Performance:</strong> {{overall_grade}} &nbsp;|&nbsp; <strong>Position:</strong> {{class_position}} of {{class_size}} &nbsp;|&nbsp; <strong>Attendance:</strong> {{attendance_percentage}}%</p>
  <p>{{principal_remarks}}</p>
  <p>We encourage you to review this report with your ward and to contact your ward''s class teacher if you have any concerns.</p>
  <p>The next term begins on <strong>{{next_term_start_date}}</strong>.</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","student_name","class_name","term","academic_year","overall_grade","class_position","class_size","attendance_percentage","principal_remarks","next_term_start_date","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'report_card_cover' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'admin_staff', p_created_by) ON CONFLICT DO NOTHING;

  -- 10. Promotion Letter
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'Student Promotion Letter', 'academic', 'promotion_letter', 'low',
    'Promotion to {{next_class}} — {{student_name}}',
    v_hdr || '
  <h3 style="text-align:center;color:#1a5276;text-transform:uppercase;letter-spacing:2px;font-size:15px;">Notice of Promotion</h3>
  <p>Dear Parent/Guardian of <strong>{{student_name}}</strong>,</p>
  <p>We are pleased to inform you that <strong>{{student_name}}</strong> has successfully completed the requirements for <strong>{{current_class}}</strong> and has been <strong>promoted to {{next_class}}</strong> for the <strong>{{academic_year}}</strong> academic year.</p>
  <p>This achievement reflects the student''s hard work and dedication. We congratulate {{student_name}} and encourage continued excellence.</p>
  <p>Please ensure your ward resumes for the new academic year on <strong>{{resumption_date}}</strong>.</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","student_name","current_class","next_class","academic_year","resumption_date","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'promotion_letter' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'admin_staff', p_created_by) ON CONFLICT DO NOTHING;

  -- 11. Retention Notice
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'Class Retention Notice', 'academic', 'retention_notice', 'high',
    'Academic Standing — {{student_name}}',
    v_hdr || '
  <h3 style="text-align:center;color:#b7770d;text-transform:uppercase;letter-spacing:2px;font-size:15px;">Notice of Class Retention</h3>
  <p>Dear Parent/Guardian of <strong>{{student_name}}</strong>,</p>
  <p>Following the academic review for the <strong>{{academic_year}}</strong> academic year, we regret to inform you that <strong>{{student_name}}</strong> (Class: {{current_class}}) has <strong>not met the promotion requirements</strong> and will be required to <strong>repeat {{current_class}}</strong>.</p>
  <p><strong>Academic Summary:</strong> Overall Average: {{overall_average}}% (Minimum required: {{minimum_pass}}%)</p>
  <p>{{retention_reason}}</p>
  <p>We encourage you to schedule a meeting with the class teacher and academic counselor to discuss a support plan for the coming year. Please contact the school office to arrange this meeting.</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","student_name","current_class","academic_year","overall_average","minimum_pass","retention_reason","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'retention_notice' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'admin_staff', p_created_by) ON CONFLICT DO NOTHING;

  -- 12. Honor Roll Certificate
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'Honor Roll Certificate', 'academic', 'honor_roll_certificate', 'low',
    'Honor Roll — {{student_name}} — {{term}} {{academic_year}}',
    v_hdr || '
  <div style="text-align:center;border:3px double #d4ac0d;padding:24px;margin:16px 0;background:#fffbeb;">
    <h3 style="color:#7d6608;font-size:20px;margin:0 0 8px;text-transform:uppercase;letter-spacing:3px;">Honor Roll Certificate</h3>
    <p style="font-size:16px;color:#333;margin:8px 0;">This certifies that</p>
    <h2 style="color:#1a3c5e;font-size:24px;margin:8px 0;font-style:italic;">{{student_name}}</h2>
    <p style="margin:4px 0;color:#555;">(Class: {{class_name}})</p>
    <p style="font-size:14px;color:#333;margin:12px 0;">
      has been recognized for <strong>Academic Excellence</strong><br/>
      achieving an overall average of <strong>{{overall_average}}%</strong><br/>
      during the <strong>{{term}} {{academic_year}}</strong> term.
    </p>
    <p style="font-size:13px;color:#7d6608;margin-top:16px;">Position: {{class_position}} of {{class_size}} students</p>
  </div>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","student_name","class_name","term","academic_year","overall_average","class_position","class_size","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'honor_roll_certificate' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'admin_staff', p_created_by) ON CONFLICT DO NOTHING;

  -- ==== MODULE 4: FINANCIAL (default access → bursar) ====

  -- 13. Fee Reminder
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'Fee Payment Reminder', 'financial', 'fee_reminder', 'medium',
    'Fee Payment Reminder — {{student_name}} — {{school_name}}',
    v_hdr || '
  <h3 style="text-align:center;color:#b7770d;text-transform:uppercase;letter-spacing:2px;font-size:15px;">Fee Payment Reminder</h3>
  <p>Dear Parent/Guardian of <strong>{{student_name}}</strong>,</p>
  <p>This is a friendly reminder that the school fees for <strong>{{student_name}}</strong> (Class: {{class_name}}) for the <strong>{{term}} {{academic_year}}</strong> term are due for payment.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
    <tr style="background:#f0f4f8;">
      <th style="text-align:left;padding:8px;border:1px solid #ddd;">Description</th>
      <th style="text-align:right;padding:8px;border:1px solid #ddd;">Amount (USD)</th>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #ddd;">{{fee_description}}</td>
      <td style="text-align:right;padding:8px;border:1px solid #ddd;">{{fee_amount}}</td>
    </tr>
    <tr style="background:#fff8e1;">
      <td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Total Outstanding</td>
      <td style="text-align:right;padding:8px;border:1px solid #ddd;font-weight:bold;color:#c0392b;">{{outstanding_balance}}</td>
    </tr>
  </table>
  <p><strong>Payment Due Date: {{due_date}}</strong></p>
  <p>Please make payment to the school''s Finance Office or via MTN MoMo / Orange Money. Failure to settle this balance by the due date may result in the student being unable to sit for examinations.</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","student_name","class_name","term","academic_year","fee_description","fee_amount","outstanding_balance","due_date","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'fee_reminder' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'bursar', p_created_by) ON CONFLICT DO NOTHING;

  -- 14. Outstanding Balance Notice
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'Outstanding Balance Notice', 'financial', 'outstanding_balance_notice', 'high',
    'URGENT: Outstanding Balance — {{student_name}}',
    v_hdr || '
  <h3 style="text-align:center;color:#c0392b;text-transform:uppercase;letter-spacing:2px;font-size:15px;">URGENT: Outstanding Balance Notice</h3>
  <p>Dear Parent/Guardian of <strong>{{student_name}}</strong>,</p>
  <p>Despite previous reminders, we wish to bring to your urgent attention that <strong>{{student_name}}</strong> (Class: {{class_name}}) has an <strong>outstanding fee balance of {{outstanding_balance}}</strong> for the <strong>{{term}} {{academic_year}}</strong> term.</p>
  <p>This balance has been outstanding since <strong>{{original_due_date}}</strong>. As a result, the student''s access to certain school activities and examinations may be affected.</p>
  <p>We strongly urge you to clear this balance <strong>immediately</strong> or contact the Bursar''s Office to arrange a payment plan. Failure to respond by <strong>{{final_deadline}}</strong> may result in the student being suspended from classes.</p>
  <p>Kindly contact the Finance Office at {{school_phone}} to resolve this matter.</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","student_name","class_name","term","academic_year","outstanding_balance","original_due_date","final_deadline","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'outstanding_balance_notice' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'bursar', p_created_by) ON CONFLICT DO NOTHING;

  -- 15. Payment Receipt Letter
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'Payment Receipt Letter', 'financial', 'payment_receipt', 'low',
    'Payment Received — {{student_name}} — Ref: {{payment_reference}}',
    v_hdr || '
  <h3 style="text-align:center;color:#1a7431;text-transform:uppercase;letter-spacing:2px;font-size:15px;">Official Payment Receipt</h3>
  <p>Dear Parent/Guardian of <strong>{{student_name}}</strong>,</p>
  <p>This letter confirms receipt of payment for school fees as detailed below:</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
    <tr style="background:#f0f9f4;">
      <th style="text-align:left;padding:8px;border:1px solid #ddd;">Detail</th>
      <th style="text-align:left;padding:8px;border:1px solid #ddd;">Information</th>
    </tr>
    <tr><td style="padding:8px;border:1px solid #ddd;">Student Name</td><td style="padding:8px;border:1px solid #ddd;"><strong>{{student_name}}</strong></td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd;">Class</td><td style="padding:8px;border:1px solid #ddd;">{{class_name}}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd;">Term / Year</td><td style="padding:8px;border:1px solid #ddd;">{{term}} {{academic_year}}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd;">Payment Reference</td><td style="padding:8px;border:1px solid #ddd;">{{payment_reference}}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd;">Payment Method</td><td style="padding:8px;border:1px solid #ddd;">{{payment_method}}</td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd;">Amount Paid</td><td style="padding:8px;border:1px solid #ddd;"><strong>{{amount_paid}}</strong></td></tr>
    <tr><td style="padding:8px;border:1px solid #ddd;">Date of Payment</td><td style="padding:8px;border:1px solid #ddd;">{{payment_date}}</td></tr>
    <tr style="background:#f0f9f4;"><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Remaining Balance</td><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">{{remaining_balance}}</td></tr>
  </table>
  <p>Please retain this letter for your records. For queries, contact the Finance Office.</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","student_name","class_name","term","academic_year","payment_reference","payment_method","amount_paid","payment_date","remaining_balance","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'payment_receipt' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'bursar', p_created_by) ON CONFLICT DO NOTHING;

  -- ==== MODULE 5: ATTENDANCE (default access → dean_of_students) ====

  -- 16. Chronic Absenteeism Notice
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'Chronic Absenteeism Notice', 'attendance', 'chronic_absenteeism_notice', 'high',
    'Attendance Concern — {{student_name}}',
    v_hdr || '
  <h3 style="text-align:center;color:#b7770d;text-transform:uppercase;letter-spacing:2px;font-size:15px;">Chronic Absenteeism Notice</h3>
  <p>Dear Parent/Guardian of <strong>{{student_name}}</strong>,</p>
  <p>We are writing to express our concern regarding the attendance record of <strong>{{student_name}}</strong> (Class: {{class_name}}) for the <strong>{{term}} {{academic_year}}</strong> term.</p>
  <p>As of <strong>{{report_date}}</strong>, {{student_name}} has been absent on <strong>{{days_absent}} day(s)</strong> out of {{school_days}} school days, representing an attendance rate of only <strong>{{attendance_percentage}}%</strong>. The school''s minimum required attendance is <strong>{{minimum_attendance}}%</strong>.</p>
  <p>Chronic absenteeism seriously impacts your ward''s academic progress and may result in the student being unable to sit for end-of-term examinations.</p>
  <p>Please contact the Dean of Students'' Office immediately to discuss this matter and provide documentation for any medically excused absences.</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","student_name","class_name","term","academic_year","report_date","days_absent","school_days","attendance_percentage","minimum_attendance","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'chronic_absenteeism_notice' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'dean_of_students', p_created_by) ON CONFLICT DO NOTHING;

  -- 17. Truancy Notice
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'Truancy Notice', 'attendance', 'truancy_notice', 'high',
    'TRUANCY NOTICE — {{student_name}}',
    v_hdr || '
  <h3 style="text-align:center;color:#c0392b;text-transform:uppercase;letter-spacing:2px;font-size:15px;">Truancy Notice</h3>
  <p>Dear Parent/Guardian of <strong>{{student_name}}</strong>,</p>
  <p>This letter is to formally notify you that <strong>{{student_name}}</strong> (Class: {{class_name}}) has been found to be <strong>truant</strong> on <strong>{{truancy_dates}}</strong>. The student was absent without authorization or prior notice to the school.</p>
  <p>Truancy is a serious violation of school policy and may have long-term consequences for the student''s academic record and well-being.</p>
  <p>You are required to <strong>report to the Dean of Students'' Office on {{meeting_date}} at {{meeting_time}}</strong> to discuss this matter. Failure to attend this meeting may result in further disciplinary action.</p>
  <p>We urge you to take immediate steps to ensure your ward attends school regularly and on time.</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","student_name","class_name","truancy_dates","meeting_date","meeting_time","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'truancy_notice' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'dean_of_students', p_created_by) ON CONFLICT DO NOTHING;

  -- ==== MODULE 6: COMMUNICATION (default access → admin_staff) ====

  -- 18. PTA Meeting Invitation
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'PTA Meeting Invitation', 'communication', 'pta_meeting_invitation', 'low',
    'Invitation — Parent-Teacher Association Meeting — {{school_name}}',
    v_hdr || '
  <h3 style="text-align:center;color:#1a5276;text-transform:uppercase;letter-spacing:2px;font-size:15px;">Parent-Teacher Association Meeting</h3>
  <p>Dear Parent/Guardian,</p>
  <p>You are cordially invited to attend the <strong>Parent-Teacher Association (PTA) Meeting</strong> organized by {{school_name}}.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
    <tr><td style="padding:6px 0;width:40%;font-weight:bold;">Date:</td><td>{{meeting_date}}</td></tr>
    <tr><td style="padding:6px 0;font-weight:bold;">Time:</td><td>{{meeting_time}}</td></tr>
    <tr><td style="padding:6px 0;font-weight:bold;">Venue:</td><td>{{meeting_venue}}</td></tr>
    <tr><td style="padding:6px 0;font-weight:bold;">Agenda:</td><td>{{meeting_agenda}}</td></tr>
  </table>
  <p>Your presence is very important. This meeting provides an opportunity to discuss your ward''s progress, school policies, and upcoming events.</p>
  <p>Kindly confirm your attendance by returning the slip below no later than <strong>{{rsvp_date}}</strong>.</p>
  <hr style="margin:24px 0;border:none;border-top:1px dashed #ccc;"/>
  <p><strong>Attendance Confirmation:</strong> I, _________________________ (Parent/Guardian of _________________________), will / will not attend the PTA meeting on {{meeting_date}}.</p>
  <p>Signature: _________________ &nbsp;&nbsp; Date: _________________</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","meeting_date","meeting_time","meeting_venue","meeting_agenda","rsvp_date","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'pta_meeting_invitation' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'admin_staff', p_created_by) ON CONFLICT DO NOTHING;

  -- 19. General Announcement
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'General Announcement', 'communication', 'general_announcement', 'low',
    'Announcement — {{announcement_title}} — {{school_name}}',
    v_hdr || '
  <h3 style="text-align:center;color:#1a5276;text-transform:uppercase;letter-spacing:2px;font-size:15px;">General Announcement</h3>
  <h4 style="text-align:center;color:#333;font-size:16px;margin:8px 0;">{{announcement_title}}</h4>
  <p>Dear Parent/Guardian,</p>
  <p>{{announcement_body}}</p>
  <p>For further information or clarifications, please contact the school office at {{school_phone}} during regular working hours (Monday–Friday, 8:00 AM – 4:00 PM).</p>
  <p>Thank you for your continued support and cooperation.</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","announcement_title","announcement_body","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'general_announcement' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'admin_staff', p_created_by) ON CONFLICT DO NOTHING;

  -- 20. Emergency Notice
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'Emergency Notice', 'communication', 'emergency_notice', 'critical',
    'URGENT NOTICE — {{school_name}}',
    v_hdr || '
  <div style="background:#fff0f0;border:2px solid #c0392b;padding:12px;text-align:center;margin-bottom:16px;">
    <span style="color:#c0392b;font-weight:bold;font-size:16px;text-transform:uppercase;letter-spacing:2px;">URGENT NOTICE</span>
  </div>
  <p>Dear Parent/Guardian,</p>
  <p>{{emergency_message}}</p>
  <p><strong>Effective Date / Time:</strong> {{effective_datetime}}</p>
  <p><strong>Required Action:</strong> {{required_action}}</p>
  <p>For updates and information, please contact the school directly at <strong>{{school_phone}}</strong> or visit <strong>{{school_website}}</strong>.</p>
  <p>We apologize for any inconvenience and appreciate your understanding and cooperation.</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","emergency_message","effective_datetime","required_action","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'emergency_notice' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'admin_staff', p_created_by) ON CONFLICT DO NOTHING;

  -- ==== MODULE 7: ADMINISTRATIVE ====

  -- 21. Enrollment Verification (access → registrar)
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'Enrollment Verification Letter', 'administrative', 'enrollment_verification', 'low',
    'Enrollment Verification — {{student_name}} — {{school_name}}',
    v_hdr || '
  <h3 style="text-align:center;color:#1a5276;text-transform:uppercase;letter-spacing:2px;font-size:15px;">Enrollment Verification</h3>
  <p>To Whom It May Concern,</p>
  <p>This is to certify that <strong>{{student_name}}</strong> (Date of Birth: {{date_of_birth}}, Student ID: {{student_id_number}}) is currently enrolled as a student at <strong>{{school_name}}</strong> in <strong>{{class_name}}</strong> for the <strong>{{academic_year}}</strong> academic year.</p>
  <p>The student is in good standing and is expected to complete the current academic year on <strong>{{expected_completion_date}}</strong>.</p>
  <p>This letter is issued upon the request of the student/parent for the purpose of <strong>{{purpose}}</strong>.</p>
  <p>For verification, please contact the Registrar''s Office at {{school_phone}}.</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","student_name","date_of_birth","student_id_number","class_name","academic_year","expected_completion_date","purpose","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'enrollment_verification' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'registrar', p_created_by) ON CONFLICT DO NOTHING;

  -- 22. Recommendation Letter (access → guidance_counselor)
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'Student Recommendation Letter', 'administrative', 'recommendation_letter', 'low',
    'Letter of Recommendation — {{student_name}}',
    v_hdr || '
  <h3 style="text-align:center;color:#1a5276;text-transform:uppercase;letter-spacing:2px;font-size:15px;">Letter of Recommendation</h3>
  <p>To Whom It May Concern,</p>
  <p>It is my pleasure to recommend <strong>{{student_name}}</strong> (Class: {{class_name}}, Student ID: {{student_id_number}}) for {{recommendation_purpose}}.</p>
  <p>{{student_name}} has been a student at {{school_name}} since {{enrollment_date}} and has consistently demonstrated {{student_strengths}}. During this time, the student has achieved {{notable_achievements}} and has shown exceptional character in {{character_traits}}.</p>
  <p>I am confident that {{student_name}} possesses the skills, dedication, and character required to excel in {{recommendation_purpose}}. I recommend this student without reservation.</p>
  <p>Please do not hesitate to contact me for any further information.</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","student_name","class_name","student_id_number","recommendation_purpose","enrollment_date","student_strengths","notable_achievements","character_traits","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'recommendation_letter' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'guidance_counselor', p_created_by) ON CONFLICT DO NOTHING;

  -- 23. Withdrawal Confirmation (access → registrar)
  INSERT INTO letter_templates
    (school_id, name, category, letter_type, severity, subject, body_html, placeholders_used, is_starter, created_by)
  VALUES (
    p_school_id, 'Withdrawal Confirmation', 'administrative', 'withdrawal_confirmation', 'medium',
    'Withdrawal Confirmation — {{student_name}} — {{school_name}}',
    v_hdr || '
  <h3 style="text-align:center;color:#1a5276;text-transform:uppercase;letter-spacing:2px;font-size:15px;">Confirmation of Withdrawal</h3>
  <p>Dear Parent/Guardian of <strong>{{student_name}}</strong>,</p>
  <p>This letter confirms that <strong>{{student_name}}</strong> (Student ID: {{student_id_number}}, Class: {{class_name}}) has been officially <strong>withdrawn from {{school_name}}</strong>, effective <strong>{{withdrawal_date}}</strong>.</p>
  <p><strong>Reason for withdrawal:</strong> {{withdrawal_reason}}</p>
  <p>The following documents are available for collection from the Registrar''s Office:</p>
  <ul style="line-height:1.8;">
    <li>Academic transcripts / report cards</li>
    <li>Transfer certificate</li>
    <li>Clearance form (if applicable)</li>
  </ul>
  <p>Please note that all outstanding fees must be settled before official documents will be released. We wish {{student_name}} the very best going forward.</p>'
    || v_ftr,
    '["school_name","school_logo_url","school_address","school_phone","school_website","moe_registration_number","date","student_name","student_id_number","class_name","withdrawal_date","withdrawal_reason","principal_name"]',
    TRUE, p_created_by
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_tid FROM letter_templates
    WHERE school_id = p_school_id AND letter_type = 'withdrawal_confirmation' AND is_starter = TRUE LIMIT 1;
  INSERT INTO letter_template_access (school_id, template_id, role, granted_by)
    VALUES (p_school_id, v_tid, 'registrar', p_created_by) ON CONFLICT DO NOTHING;

END;
$$;

GRANT EXECUTE ON FUNCTION seed_default_letter_templates TO authenticated;

-- ============================================================
-- PART 5: Seed defaults for all existing schools
-- Uses a stub created_by (super_admin) for existing schools that have no principal yet.
-- Schools with a principal already set will use that user's record.
-- ============================================================

DO $$
DECLARE
  v_school RECORD;
  v_principal_id UUID;
BEGIN
  FOR v_school IN SELECT id FROM schools LOOP
    -- Skip if already seeded
    IF EXISTS (
      SELECT 1 FROM letter_templates WHERE school_id = v_school.id AND is_starter = TRUE LIMIT 1
    ) THEN CONTINUE; END IF;

    -- Find the principal for this school
    SELECT id INTO v_principal_id
    FROM users
    WHERE school_id = v_school.id AND role = 'principal'
    LIMIT 1;

    -- Fall back to any admin-level user if no principal found
    IF v_principal_id IS NULL THEN
      SELECT id INTO v_principal_id
      FROM users
      WHERE school_id = v_school.id AND role IN ('admin_staff', 'it_admin', 'vice_principal')
      LIMIT 1;
    END IF;

    -- Skip if no suitable user found for this school
    IF v_principal_id IS NULL THEN CONTINUE; END IF;

    PERFORM seed_default_letter_templates(v_school.id, v_principal_id);
  END LOOP;
END $$;

-- ============================================================
-- PART 6: Auto-seed when a principal user is created (for new schools)
-- Trigger: fires after INSERT on users, seeds letter templates if the
-- new user is a principal and the school has no starters yet.
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_seed_letter_templates_on_principal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'principal'::user_role THEN
    PERFORM seed_default_letter_templates(NEW.school_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_seed_letter_templates ON users;
CREATE TRIGGER auto_seed_letter_templates
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_letter_templates_on_principal();
