import { useState, useEffect } from 'react';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { connectionBuilder } from './spacetime/client';
import Layout, { type Page } from './components/Layout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Contacts from './components/Contacts';
import Companies from './components/Companies';
import Deals from './components/Deals';
import Inbox from './components/Inbox';
import Products from './components/Products';
import Invoices from './components/Invoices';
import GraphView from './components/GraphView';
import AutomationBuilder from './components/AutomationBuilder';
import Analytics from './components/Analytics';

function AppContent() {
  const [page, setPage] = useState<Page>('dashboard');
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('cellcom_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        localStorage.removeItem('cellcom_user');
      }
    }
  }, []);

  const handleLogin = (u: { name: string; email: string }) => {
    setUser(u);
    localStorage.setItem('cellcom_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('cellcom_user');
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Layout page={page} setPage={setPage} user={user} onLogout={handleLogout}>
      {page === 'dashboard' && <Dashboard />}
      {page === 'contacts' && <Contacts />}
      {page === 'companies' && <Companies />}
      {page === 'deals' && <Deals />}
      {page === 'inbox' && <Inbox />}
      {page === 'products' && <Products />}
      {page === 'invoices' && <Invoices />}
      {page === 'graph' && <GraphView />}
      {page === 'automations' && <AutomationBuilder />}
      {page === 'analytics' && <Analytics />}
    </Layout>
  );
}

export default function App() {
  return (
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      <AppContent />
    </SpacetimeDBProvider>
  );
}
