-- ============================================================
-- MIGRATION 007: WAEC EXAM REGISTRATION TABLES
-- SchoolSync v4.0 — WAEC (LJHSCE / WASSCE) Candidate Registration
-- ============================================================

-- Enum for WAEC exam types
CREATE TYPE waec_exam_type AS ENUM ('LJHSCE', 'WASSCE');

-- Enum for registration status
CREATE TYPE waec_registration_status AS ENUM (
  'draft', 'pending_payment', 'payment_confirmed',
  'submitted', 'confirmed', 'rejected'
);

CREATE TYPE waec_subject_category AS ENUM ('core', 'elective');

-- ============================================================
-- 1. EXAM SESSIONS — school creates a registration window
-- ============================================================
CREATE TABLE waec_exam_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_type       waec_exam_type NOT NULL,
  academic_year   VARCHAR(20) NOT NULL,            -- e.g. '2025-2026'
  exam_year       INTEGER NOT NULL,                -- e.g. 2026
  registration_deadline DATE NOT NULL,
  exam_start_date DATE,
  exam_end_date   DATE,
  fee_per_candidate_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  fee_per_subject_usd   NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (school_id, exam_type, exam_year)
);

-- ============================================================
-- 2. CANDIDATES — one row per student per session
-- ============================================================
CREATE TABLE waec_candidates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id          UUID NOT NULL REFERENCES waec_exam_sessions(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  candidate_number    VARCHAR(50),                   -- assigned after WAEC confirmation
  exam_type           waec_exam_type NOT NULL,
  grade_level         VARCHAR(20) NOT NULL,
  status              waec_registration_status NOT NULL DEFAULT 'draft',
  registration_fee_paid BOOLEAN NOT NULL DEFAULT false,
  registered_by       UUID NOT NULL REFERENCES users(id),
  submitted_at        TIMESTAMPTZ,
  confirmed_at        TIMESTAMPTZ,
  rejection_reason    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (session_id, student_id)
);

-- ============================================================
-- 3. CANDIDATE SUBJECTS — subjects selected per candidate
-- ============================================================
CREATE TABLE waec_candidate_subjects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID NOT NULL REFERENCES waec_candidates(id) ON DELETE CASCADE,
  subject_name    VARCHAR(100) NOT NULL,
  subject_code    VARCHAR(10) NOT NULL,
  category        waec_subject_category NOT NULL DEFAULT 'elective',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (candidate_id, subject_code)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_waec_sessions_school  ON waec_exam_sessions(school_id);
CREATE INDEX idx_waec_candidates_session ON waec_candidates(session_id);
CREATE INDEX idx_waec_candidates_student ON waec_candidates(student_id);
CREATE INDEX idx_waec_candidates_status  ON waec_candidates(status);
CREATE INDEX idx_waec_subjects_candidate ON waec_candidate_subjects(candidate_id);

-- ============================================================
-- VIEW: waec_candidates_with_students
-- ============================================================
CREATE OR REPLACE VIEW waec_candidates_with_students AS
SELECT
  wc.*,
  s.first_name,
  s.last_name,
  c.name AS class_name,
  (SELECT COUNT(*) FROM waec_candidate_subjects wcs WHERE wcs.candidate_id = wc.id) AS subject_count
FROM waec_candidates wc
JOIN students s ON s.id = wc.student_id
LEFT JOIN class_assignments ca ON ca.student_id = s.id AND ca.removed_at IS NULL
LEFT JOIN classes c ON c.id = ca.class_id;

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE waec_exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE waec_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE waec_candidate_subjects ENABLE ROW LEVEL SECURITY;

-- Sessions: school staff can read, admin roles can manage
CREATE POLICY waec_sessions_select ON waec_exam_sessions
  FOR SELECT USING (school_id = current_setting('app.school_id')::uuid);
CREATE POLICY waec_sessions_manage ON waec_exam_sessions
  FOR ALL USING (school_id = current_setting('app.school_id')::uuid);

-- Candidates: school staff can read, admin roles can manage
CREATE POLICY waec_candidates_select ON waec_candidates
  FOR SELECT USING (school_id = current_setting('app.school_id')::uuid);
CREATE POLICY waec_candidates_manage ON waec_candidates
  FOR ALL USING (school_id = current_setting('app.school_id')::uuid);

-- Candidate subjects: inherit from candidate access
CREATE POLICY waec_subjects_select ON waec_candidate_subjects
  FOR SELECT USING (
    candidate_id IN (SELECT id FROM waec_candidates WHERE school_id = current_setting('app.school_id')::uuid)
  );
CREATE POLICY waec_subjects_manage ON waec_candidate_subjects
  FOR ALL USING (
    candidate_id IN (SELECT id FROM waec_candidates WHERE school_id = current_setting('app.school_id')::uuid)
  );
