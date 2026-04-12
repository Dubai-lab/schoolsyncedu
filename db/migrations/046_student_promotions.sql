-- ============================================================
-- Migration 046: Student Promotions
-- Tracks year-end promotion decisions by the registrar.
-- Safe to re-run.
-- ============================================================

DROP TABLE IF EXISTS student_promotions CASCADE;

CREATE TABLE student_promotions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID        NOT NULL REFERENCES schools(id)   ON DELETE CASCADE,
  student_id       UUID        NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  academic_year    TEXT        NOT NULL,          -- e.g. '2024-2025'
  from_grade_level TEXT        NOT NULL,          -- grade before promotion
  to_grade_level   TEXT,                          -- grade after (NULL if graduated)
  outcome          TEXT        NOT NULL DEFAULT 'promoted',
  -- outcomes: promoted, retained, graduated
  grade_average    NUMERIC(5,2),                  -- computed average stored for record
  notes            TEXT,
  processed_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, student_id, academic_year)   -- one decision per student per year
);

ALTER TABLE student_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY promotions_tenant ON student_promotions
  FOR ALL
  USING  (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

CREATE INDEX idx_promotions_school       ON student_promotions(school_id);
CREATE INDEX idx_promotions_student      ON student_promotions(student_id);
CREATE INDEX idx_promotions_year         ON student_promotions(academic_year);
CREATE INDEX idx_promotions_outcome      ON student_promotions(outcome);
