-- Migration 085: Student documents table
-- Allows registrar/staff to store and manage documents for any student.
-- Drop and recreate to recover from any previous partial run.

DROP TABLE IF EXISTS student_documents CASCADE;

CREATE TABLE student_documents (
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

CREATE INDEX idx_student_documents_student_id ON student_documents (student_id);
CREATE INDEX idx_student_documents_school_id  ON student_documents (school_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE student_documents ENABLE ROW LEVEL SECURITY;

-- Staff can manage documents for students in their school (inline subquery, no helper fn needed)
CREATE POLICY "staff_manage_student_documents" ON student_documents
  FOR ALL TO authenticated
  USING (
    school_id IN (
      SELECT u.school_id FROM users u WHERE u.auth_id = auth.uid()
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT u.school_id FROM users u WHERE u.auth_id = auth.uid()
    )
  );

-- Students can view their own documents
CREATE POLICY "student_view_own_documents" ON student_documents
  FOR SELECT TO authenticated
  USING (
    student_id IN (
      SELECT s.id
        FROM students  s
        JOIN users     u ON u.id = s.user_id
       WHERE u.auth_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON student_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON student_documents TO service_role;

NOTIFY pgrst, 'reload schema';
