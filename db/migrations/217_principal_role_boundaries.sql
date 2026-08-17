-- ============================================================
-- Migration 217: Principal role boundaries
--
-- Two things, both found while auditing what the Principal can actually do.
--
-- ── 1. ANY SIGNED-IN USER COULD MAKE THEMSELVES PRINCIPAL ────────────────────
--
--   users_update (migration 011) permits `id = auth_user_id()` — your own row —
--   and has no WITH CHECK, so the row you are writing is never validated.
--   `authenticated` holds UPDATE on every column (migration 102), nothing
--   guarded the `role` column, and auth_user_role() reads that column directly.
--   A student could PATCH their own users row to role='principal' and approve
--   their own grades.
--
--   Migration 104 closed this exact hole for user_metadata. The same
--   escalation was still open through the table itself — and 104's sync
--   trigger would have carried the new role into app_metadata for them.
--
--   Fixed with a trigger, because RLS is row-level and the problem is one
--   column. Nobody changes their own role or school, whatever their role.
--   Granting or removing it_admin / proprietor / super_admin is restricted to
--   those roles, so a Principal cannot mint an account more powerful than
--   themselves; they keep ordinary staff role changes.
--
-- ── 2. NO SEGREGATION OF DUTIES IN FINANCE ───────────────────────────────────
--
--   Every finance gate quietly included principal and vice_principal beside
--   bursar. A Principal could raise a fee correction, verify the bank proof
--   behind it, and delete the fee record — with no second person involved.
--
--   The code already says this was not the intent. bursar_correct_fee raises
--   'Unauthorized: only Bursar can correct fee payments' while permitting four
--   other roles: the roles were widened later and the intent was never
--   revisited. This restores it.
--
--   Oversight is not removed, only execution. The Principal keeps SELECT on
--   payments, student_fees and bank_transfer_proofs, so every figure and every
--   correction stays visible to them — they simply cannot move the money.
--
-- ROLLBACK
--   DROP TRIGGER users_guard_role_changes ON users;
--   DROP FUNCTION guard_user_role_changes();
--   -- and re-run 011 / 032 / 060 / 083 / 206 for the widened role lists
-- ============================================================


-- ============================================================
-- 1. PRIVILEGE ESCALATION
-- ============================================================

CREATE OR REPLACE FUNCTION guard_user_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role user_role;
  v_privileged CONSTANT TEXT[] := ARRAY['proprietor','super_admin','it_admin'];
BEGIN
  -- Only privilege-bearing columns are guarded. Every other edit to a user
  -- row — name, phone, photo — passes straight through, so a form that
  -- resubmits an unchanged role is unaffected.
  IF NEW.role      IS NOT DISTINCT FROM OLD.role
 AND NEW.school_id IS NOT DISTINCT FROM OLD.school_id THEN
    RETURN NEW;
  END IF;

  -- Server-side callers — service_role, Edge Functions, migrations, the
  -- signup path — carry no JWT. They are already trusted; this guards the
  -- API surface, not the database's own maintenance.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- The escalation itself. No exceptions: a proprietor cannot do this to
  -- their own row either, because there would be nobody to undo it.
  IF OLD.auth_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own role or school.';
  END IF;

  SELECT role INTO v_actor_role FROM users WHERE auth_id = auth.uid();

  -- Moving a user between schools is a platform operation, not a school one.
  IF NEW.school_id IS DISTINCT FROM OLD.school_id
 AND COALESCE(v_actor_role::TEXT, '') NOT IN ('proprietor','super_admin') THEN
    RAISE EXCEPTION 'Only the Proprietor may move a user to another school.';
  END IF;

  IF COALESCE(v_actor_role::TEXT, '') = ANY (v_privileged) THEN
    RETURN NEW;
  END IF;

  -- Leadership keeps ordinary staff changes (teacher → dean, say) but cannot
  -- grant or strip a role above its own. Without this a Principal could
  -- create an it_admin account and use it to grant themselves anything.
  IF COALESCE(v_actor_role::TEXT, '') IN ('principal','admin_staff') THEN
    IF OLD.role::TEXT = ANY (v_privileged) OR NEW.role::TEXT = ANY (v_privileged) THEN
      RAISE EXCEPTION 'Only IT Admin or the Proprietor may grant or remove that role.';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'You are not permitted to change user roles.';
END;
$$;

DROP TRIGGER IF EXISTS users_guard_role_changes ON users;
CREATE TRIGGER users_guard_role_changes
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION guard_user_role_changes();

-- USING decides which rows may be touched; WITH CHECK decides what they may
-- become. Without the second, an allowed UPDATE could rewrite school_id and
-- move the row out of the caller's reach on the way past.
DROP POLICY IF EXISTS users_update ON users;
CREATE POLICY users_update ON users
  FOR UPDATE
  USING (
    (id = auth_user_id())
    OR (school_id = auth_school_id() AND auth_user_role() IN ('proprietor'::user_role, 'principal'::user_role, 'admin_staff'::user_role, 'it_admin'::user_role))
    OR is_super_admin()
  )
  WITH CHECK (
    (id = auth_user_id())
    OR (school_id = auth_school_id() AND auth_user_role() IN ('proprietor'::user_role, 'principal'::user_role, 'admin_staff'::user_role, 'it_admin'::user_role))
    OR is_super_admin()
  );


-- ============================================================
-- 2. FINANCE — EXECUTION MOVES TO THE BURSAR
--    Bodies are reproduced from migration 083 unchanged apart from the role
--    list and the message, so nothing about the accounting moves.
-- ============================================================

CREATE OR REPLACE FUNCTION bursar_confirm_reg_fee(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   user_role;
  v_caller_school UUID;
  v_student       RECORD;
  v_fee           RECORD;
BEGIN
  SELECT role, school_id
    INTO v_caller_role, v_caller_school
    FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN ('bursar','admin_staff','super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: only the Bursar may confirm fee payments';
  END IF;

  SELECT * INTO v_student FROM students WHERE id = p_student_id;

  IF v_student.id IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  IF v_student.school_id != v_caller_school AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Student belongs to a different school';
  END IF;

  SELECT sf.*
    INTO v_fee
    FROM student_fees sf
    JOIN fee_structures fs ON fs.id = sf.fee_structure_id
   WHERE sf.student_id = p_student_id
     AND fs.fee_type   = 'registration'
   ORDER BY sf.created_at DESC
   LIMIT 1;

  IF v_fee.id IS NULL THEN
    RAISE EXCEPTION 'No registration fee record found for this student';
  END IF;

  IF v_fee.status IN ('paid', 'partial') THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Registration fee was already marked as paid.'
    );
  END IF;

  UPDATE student_fees
     SET amount_paid = amount_due,
         balance     = 0,
         status      = 'paid',
         updated_at  = NOW()
   WHERE id = v_fee.id;

  INSERT INTO payments (
    school_id, student_id, student_fee_id,
    amount_usd, amount_lrd, currency_charged,
    payment_method, gateway_ref, status, payment_date
  ) VALUES (
    v_student.school_id,
    p_student_id,
    v_fee.id,
    v_fee.amount_due,
    0,
    'USD',
    'manual',
    'Registration fee confirmed by Bursar (imported student)',
    'success',
    NOW()
  );

  RETURN jsonb_build_object(
    'success',    TRUE,
    'student_id', p_student_id,
    'amount',     v_fee.amount_due,
    'message',    'Registration fee confirmed and marked as paid.'
  );
END;
$$;


CREATE OR REPLACE FUNCTION bursar_correct_fee(
  p_student_fee_id UUID,
  p_paid_amount    NUMERIC,
  p_reason         TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   user_role;
  v_caller_school UUID;
  v_fee           RECORD;
  v_adjustment    NUMERIC;
  v_new_balance   NUMERIC;
  v_new_status    TEXT;
BEGIN
  SELECT role, school_id
    INTO v_caller_role, v_caller_school
    FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN ('bursar','admin_staff','super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: only the Bursar may correct fee payments';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'A reason is required for fee corrections';
  END IF;

  IF p_paid_amount < 0 THEN
    RAISE EXCEPTION 'Paid amount cannot be negative';
  END IF;

  SELECT sf.*, s.school_id AS student_school_id
    INTO v_fee
    FROM student_fees sf
    JOIN students s ON s.id = sf.student_id
   WHERE sf.id = p_student_fee_id;

  IF v_fee.id IS NULL THEN
    RAISE EXCEPTION 'Fee record not found';
  END IF;

  IF v_fee.student_school_id != v_caller_school AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Fee belongs to a student at a different school';
  END IF;

  IF p_paid_amount > v_fee.amount_due THEN
    RAISE EXCEPTION 'Paid amount (%) cannot exceed amount due (%)',
      p_paid_amount, v_fee.amount_due;
  END IF;

  v_adjustment  := p_paid_amount - COALESCE(v_fee.amount_paid, 0);
  v_new_balance := v_fee.amount_due - p_paid_amount;
  v_new_status  := CASE
    WHEN p_paid_amount >= v_fee.amount_due THEN 'paid'
    WHEN p_paid_amount > 0                 THEN 'partial'
    ELSE 'pending'
  END;

  UPDATE student_fees
     SET amount_paid = p_paid_amount,
         balance     = v_new_balance,
         status      = v_new_status,
         updated_at  = NOW()
   WHERE id = p_student_fee_id;

  INSERT INTO payments (
    school_id, student_id, student_fee_id,
    amount_usd, amount_lrd, currency_charged,
    payment_method, gateway_ref, status, payment_date
  ) VALUES (
    v_fee.student_school_id,
    v_fee.student_id,
    p_student_fee_id,
    v_adjustment,
    0,
    'USD',
    'manual',
    'Bursar correction: ' || TRIM(p_reason),
    'success',
    NOW()
  );

  RETURN jsonb_build_object(
    'success',        TRUE,
    'student_fee_id', p_student_fee_id,
    'old_paid',       COALESCE(v_fee.amount_paid, 0),
    'new_paid',       p_paid_amount,
    'new_balance',    v_new_balance,
    'new_status',     v_new_status,
    'message',        'Fee record updated and audit entry created.'
  );
END;
$$;


-- ============================================================
-- 3. FINANCE TABLE POLICIES
--    SELECT is untouched everywhere — the Principal still sees every figure.
-- ============================================================

DROP POLICY IF EXISTS payments_insert_policy ON payments;
CREATE POLICY payments_insert_policy ON payments
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'bursar'::user_role, 'admin_staff'::user_role, 'registrar'::user_role
    )
    OR is_super_admin()
  );

DROP POLICY IF EXISTS payments_update_policy ON payments;
CREATE POLICY payments_update_policy ON payments
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN ('bursar'::user_role, 'admin_staff'::user_role)
    OR is_super_admin()
  );

DROP POLICY IF EXISTS student_fees_insert_policy ON student_fees;
CREATE POLICY student_fees_insert_policy ON student_fees
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'bursar'::user_role, 'admin_staff'::user_role, 'registrar'::user_role
    )
    OR is_super_admin()
  );

DROP POLICY IF EXISTS student_fees_update_policy ON student_fees;
CREATE POLICY student_fees_update_policy ON student_fees
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'bursar'::user_role, 'admin_staff'::user_role, 'registrar'::user_role
    )
    OR is_super_admin()
  );

DROP POLICY IF EXISTS student_fees_delete_policy ON student_fees;
CREATE POLICY student_fees_delete_policy ON student_fees
  FOR DELETE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN ('bursar'::user_role, 'admin_staff'::user_role)
    OR is_super_admin()
  );

-- Verifying the proof behind a correction must not be the same hand that
-- raised it. Reading them stays open to leadership (policy untouched).
DROP POLICY IF EXISTS "bursar_update_school_proofs" ON bank_transfer_proofs;
CREATE POLICY "bursar_update_school_proofs" ON bank_transfer_proofs
  FOR UPDATE TO authenticated
  USING (
    school_id = (SELECT school_id FROM users WHERE auth_id = auth.uid())
    AND (SELECT role FROM users WHERE auth_id = auth.uid())
        IN ('bursar', 'admin_staff', 'proprietor')
  );


-- ============================================================
-- 4. KIOSK PIN
--    The PIN decides who may sit an exam on the strength of their fees, so it
--    belongs with whoever owns the fees. IT Admin is dropped too: running the
--    system is not the same as holding the gate to it.
-- ============================================================

CREATE OR REPLACE FUNCTION set_kiosk_pin(p_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT id, school_id, role INTO v_user
  FROM   users
  WHERE  auth_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not signed in.');
  END IF;

  IF v_user.role::TEXT NOT IN ('bursar', 'proprietor', 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'You cannot change the kiosk PIN.');
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^\d{4,8}$' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'PIN must be 4 to 8 digits.');
  END IF;

  INSERT INTO school_settings (school_id, setting_key, setting_value)
  VALUES (v_user.school_id, 'kiosk_pin', crypt(p_pin, gen_salt('bf')))
  ON CONFLICT (school_id, setting_key) DO UPDATE
    SET setting_value = EXCLUDED.setting_value;

  RETURN jsonb_build_object('ok', true);
END;
$$;

NOTIFY pgrst, 'reload schema';
