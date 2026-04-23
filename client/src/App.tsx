import { useState } from 'react';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { connectionBuilder } from './spacetime/client';
import Layout, { type Page } from './components/Layout';
import Dashboard from './components/Dashboard';
import Contacts from './components/Contacts';
import Companies from './components/Companies';
import Deals from './components/Deals';
import Inbox from './components/Inbox';
import Products from './components/Products';
import Invoices from './components/Invoices';
import GraphView from './components/GraphView';
import AutomationBuilder from './components/AutomationBuilder';

function AppContent() {
  const [page, setPage] = useState<Page>('dashboard');

  return (
    <Layout page={page} setPage={setPage}>
      {page === 'dashboard' && <Dashboard />}
      {page === 'contacts' && <Contacts />}
      {page === 'companies' && <Companies />}
      {page === 'deals' && <Deals />}
      {page === 'inbox' && <Inbox />}
      {page === 'products' && <Products />}
      {page === 'invoices' && <Invoices />}
      {page === 'graph' && <GraphView />}
      {page === 'automations' && <AutomationBuilder />}
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
