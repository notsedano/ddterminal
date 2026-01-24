import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { getTheme } from '@/utils/storage';
import { getAgentId } from '@/utils/config';
import { useEffect } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: false, // Disable automatic retries to prevent console spam from 404s
    },
  },
});

function App() {
  useEffect(() => {
    const theme = getTheme();
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  const agentId = getAgentId() || 'test-dd-local';

  return (
    <QueryClientProvider client={queryClient}>
      <MainLayout agentId={agentId} />
    </QueryClientProvider>
  );
}

export default App;
