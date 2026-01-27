import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { MainLayout } from '@/components/layout/MainLayout';
import { getTheme } from '@/utils/storage';
import { getAgentId } from '@/utils/config';
import { useEffect } from 'react';
import { createIDBPersister, dehydrateOptions } from '@/services/storage/queryPersister';
import { prefetchCriticalData } from '@/services/prefetch';

// Create the query client with optimized defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 minutes - data considered fresh
      gcTime: 30 * 60 * 1000,         // 30 minutes - keep unused data in cache
      refetchOnWindowFocus: false,
      retry: false,                    // Disable automatic retries to prevent console spam from 404s
    },
  },
});

// Create IndexedDB persister for query cache persistence across page reloads
const persister = createIDBPersister();

// Persist options
const persistOptions = {
  persister,
  maxAge: 24 * 60 * 60 * 1000,        // 24 hours max cache age
  buster: 'v1',                        // Cache buster - increment to invalidate all cached queries
  dehydrateOptions,
};

function App() {
  useEffect(() => {
    const theme = getTheme();
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  // Prefetch critical data on app load
  useEffect(() => {
    prefetchCriticalData(queryClient);
  }, []);

  const agentId = getAgentId() || 'test-dd-local';

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
    >
      <MainLayout agentId={agentId} />
    </PersistQueryClientProvider>
  );
}

export default App;
