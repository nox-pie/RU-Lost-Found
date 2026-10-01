import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { Toaster } from 'sonner';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ServerWakeNotice } from './components/ServerWakeNotice';
import { warmUpServer } from './lib/api/client';
import { AuthProvider } from './features/auth/AuthProvider';
import { startMonitoring } from './lib/monitoring';
import { queryClient } from './lib/queryClient';
import './index.css';

startMonitoring();
warmUpServer();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
            <Toaster position="top-center" richColors closeButton />
            <ServerWakeNotice />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
