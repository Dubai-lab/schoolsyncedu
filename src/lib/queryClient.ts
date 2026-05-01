import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,  // 2 min — data stays fresh, avoids burst refetches on tab return
      gcTime: 10 * 60 * 1000,   // keep unused cache for 10 min
      retry: 1,
      refetchOnWindowFocus: true, // auto-refresh when user returns to the tab
      refetchOnReconnect: true,   // auto-refresh on network reconnect
    },
  },
});