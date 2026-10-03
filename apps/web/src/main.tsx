import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.js';
import { I18nProvider } from './lib/i18n.js';
import { ToastProvider } from './components/ui.js';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (n, err) => n < 2 && (err as { status?: number }).status !== 401 && (err as { status?: number }).status !== 403,
      refetchOnWindowFocus: false,
      staleTime: 8_000,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </I18nProvider>
  </StrictMode>,
);
