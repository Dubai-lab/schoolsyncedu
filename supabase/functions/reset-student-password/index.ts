// Supabase Edge Function: reset-student-password
//
// Called by IT Admin to set a student's auth password directly to the school's
// default password (no email link sent). Uses the Admin API (service role) which
// can set any user's password.
//
// Body: { student_id: UUID, school_id: UUID }
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify caller is authenticated
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { student_id, school_id } = await req.json() as {
      student_id?: string;
      school_id?: string;
    };

    if (!student_id || !school_id) {
      return new Response(JSON.stringify({ error: 'student_id and school_id are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Verify caller is an IT Admin (or similar privileged role) for this school
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: caller } = await adminClient
      .from('users')
      .select('school_id, role')
      .eq('auth_id', user.id)
      .single();

    if (!caller || caller.school_id !== school_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allowedRoles = ['it_admin', 'admin_staff', 'proprietor', 'principal'];
    if (!allowedRoles.includes(caller.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get school's default student password from settings
    const { data: settings } = await adminClient
      .from('school_settings')
      .select('setting_value')
      .eq('school_id', school_id)
      .eq('setting_key', 'default_student_password')
      .maybeSingle();

    // Get the student's user record (for auth_id and registration number as fallback)
    const { data: studentRecord } = await adminClient
      .from('students')
      .select('user_id, registration_number, users!inner(auth_id)')
      .eq('id', student_id)
      .eq('school_id', school_id)
      .single();

    if (!studentRecord) {
      return new Response(JSON.stringify({ error: 'Student not found in this school' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const defaultPassword = settings?.setting_value?.trim() || studentRecord.registration_number || 'school123';

    // Use Admin API to set password directly — no email sent
    const authId = (studentRecord.users as { auth_id: string }).auth_id;
    const { error: updateError } = await adminClient.auth.admin.updateUserById(authId, {
      password: defaultPassword,
    });

    if (updateError) {
      throw new Error(updateError.message);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('reset-student-password error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
