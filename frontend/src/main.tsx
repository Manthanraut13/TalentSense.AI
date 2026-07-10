import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import { App } from './App';
import { SessionProvider } from './context/SessionContext';
import { queryClient } from './lib/queryClient';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <App />
        </SessionProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
