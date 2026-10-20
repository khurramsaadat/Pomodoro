import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from '@/App';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { registerServiceWorker } from '@/lib/service-worker';
import '@/index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element #root was not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);

// The worker is registered after the first paint, so it never delays the
// app's own start. A failure here is not a failure of the app.
void registerServiceWorker();
