// ============================================================
// API TYPES — Request/response wrappers for Supabase operations
// ============================================================

/** Standard API success response */
export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
}

/** Standard API error */
export interface ApiError {
  message: string;
  code: string;
  status: number;
  details?: Record<string, unknown>;
}

/** Supabase query result wrapper */
export interface SupabaseResult<T> {
  data: T | null;
  error: SupabaseError | null;
  count: number | null;
}

export interface SupabaseError {
  message: string;
  details: string;
  hint: string;
  code: string;
}

/** Mutation result */
export interface MutationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Fetch state for hooks */
export interface FetchState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Infinite scroll pagination */
export interface CursorPaginationParams {
  cursor?: string;
  limit: number;
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Bulk operation result */
export interface BulkOperationResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: { index: number; message: string }[];
}

/** File upload */
export interface FileUploadResult {
  url: string;
  path: string;
  size: number;
  mimeType: string;
}

/** Real-time subscription */
export interface RealtimeSubscription {
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}