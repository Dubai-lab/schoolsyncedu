/**
 * API Client — thin wrappers around the configured Axios instance.
 * Use these helpers for calling Supabase Edge Functions or any custom REST API.
 * For direct Supabase table operations, keep using `supabase` from @/lib/supabase.
 */
import api from '@/lib/axios';

export const apiClient = {
  /** GET request */
  async get<T = unknown>(url: string, params?: Record<string, unknown>) {
    const { data } = await api.get<T>(url, { params });
    return data;
  },

  /** POST request */
  async post<T = unknown>(url: string, body?: unknown) {
    const { data } = await api.post<T>(url, body);
    return data;
  },

  /** PUT request */
  async put<T = unknown>(url: string, body?: unknown) {
    const { data } = await api.put<T>(url, body);
    return data;
  },

  /** PATCH request */
  async patch<T = unknown>(url: string, body?: unknown) {
    const { data } = await api.patch<T>(url, body);
    return data;
  },

  /** DELETE request */
  async del<T = unknown>(url: string) {
    const { data } = await api.delete<T>(url);
    return data;
  },
};

export default apiClient;