-- Migration 085: Student documents table
-- Allows registrar/staff to store and manage documents for any student.
-- Also used to surface documents submitted during online applications.

CREATE TABLE IF NOT EXISTS student_documents (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID        NOT NULL REFERENCES schools(id)   ON DELETE CASCADE,
  student_id     UUID        NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  document_type  TEXT        NOT NULL DEFAULT 'other',
  document_name  TEXT        NOT NULL,
  file_url       TEXT        NOT NULL,
  file_path      TEXT,
  uploaded_by    UUID        REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_student_documents_student_id
  ON student_documents (student_id);

CREATE INDEX IF NOT EXISTS idx_student_documents_school_id
  ON student_documents (school_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE student_documents ENABLE ROW LEVEL SECURITY;

-- School staff can manage documents for students in their school
CREATE POLICY "staff_manage_student_documents" ON student_documents
  FOR ALL TO authenticated
  USING (
    school_id = (SELECT school_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    school_id = (SELECT school_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );

-- Students can view their own documents
CREATE POLICY "student_view_own_documents" ON student_documents
  FOR SELECT TO authenticated
  USING (
    student_id IN (
      SELECT s.id FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON student_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON student_documents TO service_role;

NOTIFY pgrst, 'reload schema';
