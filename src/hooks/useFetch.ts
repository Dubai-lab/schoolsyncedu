import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';

/**
 * Thin wrapper around useQuery for consistent loading/error patterns.
 */
export function useFetch<T>(
  key: string[],
  fetcher: () => Promise<T>,
  options?: Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<T, Error>({
    queryKey: key,
    queryFn: fetcher,
    ...options,
  });
}

/**
 * Wrapper around useMutation with automatic cache invalidation.
 * After any successful mutation the listed query keys are invalidated
 * so every component subscribed to those keys immediately re-fetches —
 * no manual browser refresh needed.
 */
export function useMutate<TData, TVariables>(
  mutationFn: (vars: TVariables) => Promise<TData>,
  invalidateKeys?: string[][],
  options?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'>,
) {
  const qc = useQueryClient();
  return useMutation<TData, Error, TVariables>({
    mutationFn,
    onSuccess: (...args) => {
      // Invalidate and immediately refetch all related queries
      invalidateKeys?.forEach((key) =>
        qc.invalidateQueries({ queryKey: key, refetchType: 'active' }),
      );
      options?.onSuccess?.(...args);
    },
    onError: (...args) => {
      options?.onError?.(...args);
    },
    ...options,
  });
}