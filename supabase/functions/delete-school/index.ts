// Supabase Edge Function: delete-school
//
// Permanently removes a school and all its related data.
// Uses the service role key to bypass RLS (which blocks client-side deletes).
// Also deletes Supabase Auth accounts for every user in the school.
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Caller must be authenticated as a super_admin.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient    = createClient(supabaseUrl, serviceRoleKey);

    // ── Verify caller is a super_admin ────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the JWT using the admin client
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(jwt);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch caller's role from users table (auth_id = Supabase Auth UUID)
    const { data: callerProfile } = await adminClient
      .from('users')
      .select('role')
      .eq('auth_id', caller.id)
      .maybeSingle();

    if (callerProfile?.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: super_admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Parse request ─────────────────────────────────────────────────────────
    const { school_id } = await req.json() as { school_id?: string };
    if (!school_id) {
      return new Response(JSON.stringify({ error: 'school_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Verify the school exists ──────────────────────────────────────────────
    const { data: school } = await adminClient
      .from('schools')
      .select('id, name')
      .eq('id', school_id)
      .maybeSingle();

    if (!school) {
      return new Response(JSON.stringify({ error: 'School not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Collect all auth user IDs for this school ─────────────────────────────
    const { data: schoolUsers } = await adminClient
      .from('users')
      .select('id')
      .eq('school_id', school_id);

    const authUserIds = (schoolUsers ?? []).map((u: { id: string }) => u.id);

    // ── Delete the school record (CASCADE handles related DB rows) ────────────
    const { error: deleteError } = await adminClient
      .from('schools')
      .delete()
      .eq('id', school_id);

    if (deleteError) {
      console.error('Failed to delete school:', deleteError.message);
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`School deleted: ${school.name} (${school_id})`);

    // ── Delete Supabase Auth accounts for all school users ────────────────────
    const failedAuthDeletes: string[] = [];
    for (const uid of authUserIds) {
      const { error: authDelErr } = await adminClient.auth.admin.deleteUser(uid);
      if (authDelErr) {
        console.warn(`Could not delete auth user ${uid}:`, authDelErr.message);
        failedAuthDeletes.push(uid);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        school_name: school.name,
        users_deleted: authUserIds.length - failedAuthDeletes.length,
        auth_delete_failures: failedAuthDeletes.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('delete-school error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
