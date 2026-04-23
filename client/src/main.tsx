import React from 'react';
import ReactDOM from 'react-dom/client';
import { NextUIProvider } from '@nextui-org/react';
import { Toaster } from 'sonner';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NextUIProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '14px',
          },
        }}
      />
      <App />
    </NextUIProvider>
  </React.StrictMode>,
);
