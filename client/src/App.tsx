import { useState } from 'react';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { connectionBuilder } from './spacetime/client';
import VertexList from './components/VertexList';
import EdgeList from './components/EdgeList';
import GraphView from './components/GraphView';

function AppContent() {
  const [tab, setTab] = useState<'vertices' | 'edges' | 'graph'>('vertices');

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-900 text-white p-4">
        <h1 className="text-2xl font-bold">CellCom CRM — Knowledge Graph</h1>
      </header>

      <nav className="bg-white border-b flex">
        {(['vertices', 'edges', 'graph'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-3 font-medium capitalize ${
              tab === t
                ? 'border-b-2 border-slate-900 text-slate-900'
                : 'text-gray-500'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-auto">
        {tab === 'vertices' && <VertexList />}
        {tab === 'edges' && <EdgeList />}
        {tab === 'graph' && <GraphView />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      <AppContent />
    </SpacetimeDBProvider>
  );
}
