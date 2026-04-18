import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Lazily-created client for public pages — no auth session.
// Created on first use only to avoid GoTrueClient conflicts at startup.
let _publicClient: SupabaseClient | null = null;
function getPublicClient(): SupabaseClient {
  if (!_publicClient) {
    _publicClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storageKey: 'sb-public-site-token',
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return _publicClient;
}

/**
 * Public service for fetching school data by slug.
 * Uses a separate Supabase client with no session to avoid
 * auth lock conflicts when opening school sites in new tabs.
 */
export const schoolSiteService = {
  /** Fetch a school's public info by its slug */
  async getBySlug(slug: string) {
    const { data, error } = await getPublicClient()
      .from('schools')
      .select('*')
      .eq('slug', slug)
      .eq('site_published', true)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /** Fetch a school by its custom domain (for custom-domain hosting) */
  async getByCustomDomain(hostname: string) {
    const { data, error } = await getPublicClient()
      .from('schools')
      .select('*')
      .eq('custom_domain', hostname)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};
