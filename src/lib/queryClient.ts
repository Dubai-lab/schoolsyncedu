import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,      // 30 s — data stays fresh for 30 s, then refetches
      gcTime: 5 * 60 * 1000,    // keep unused cache for 5 min
      retry: 1,
      refetchOnWindowFocus: true, // auto-refresh when user returns to the tab
      refetchOnReconnect: true,   // auto-refresh on network reconnect
    },
  },
});