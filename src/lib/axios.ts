import axios from 'axios';
import { supabase } from './supabase';

/**
 * Pre-configured Axios instance for custom API calls (Edge Functions, etc.).
 * Automatically attaches the Supabase access token to every request.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach auth token ──
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: normalise errors ──
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const msg =
        error.response.data?.message ||
        error.response.data?.error ||
        error.response.statusText;
      return Promise.reject(new Error(msg));
    }
    if (error.request) {
      return Promise.reject(new Error('Network error — please check your connection.'));
    }
    return Promise.reject(error);
  },
);

export default api;