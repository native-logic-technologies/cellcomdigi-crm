import { DbConnection } from '../generated';

function getHost(): string {
  const envHost = (import.meta as any).env?.VITE_SPACETIME_HOST;
  if (envHost) return envHost;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3001';
}

const HOST = getHost();
const DB_NAME = (import.meta as any).env?.VITE_SPACETIME_DB || 'cellcom-crm';

export const connectionBuilder = DbConnection.builder()
  .withUri(HOST)
  .withDatabaseName(DB_NAME)
  .onConnect((conn, identity, _token) => {
    console.log('Connected to SpacetimeDB as', identity.toHexString());
    conn
      .subscriptionBuilder()
      .onApplied(() => {
        console.log('Subscriptions applied');
        // Seed demo data if database is empty
        const lang = localStorage.getItem('cellcom_language') || 'en';
        let hasContacts = false;
        for (const _ of conn.db.contacts.iter()) { hasContacts = true; break; }
        if (!hasContacts) {
          console.log('Database empty — seeding demo data...');
          (conn.reducers as any).seedDemoData({ language: lang });
        }
        // Seed rich inbox conversations if fewer than 3 exist
        let convCount = 0;
        for (const _ of conn.db.conversations.iter()) { convCount++; if (convCount >= 3) break; }
        if (convCount < 3) {
          console.log('Inbox sparse — seeding demo conversations...');
          (conn.reducers as any).seedInboxData({ tenantId: 1n, language: lang });
        }
      })
      .onError((_ctx: any) => console.error('Subscription error:', _ctx))
      .subscribe([
        'SELECT * FROM users',
        'SELECT * FROM contacts',
        'SELECT * FROM companies',
        'SELECT * FROM pipelines',
        'SELECT * FROM pipeline_stages',
        'SELECT * FROM deals',
        'SELECT * FROM activities',
        'SELECT * FROM conversations',
        'SELECT * FROM messages',
        'SELECT * FROM products',
        'SELECT * FROM invoices',
        'SELECT * FROM invoice_items',
        'SELECT * FROM payments',
        'SELECT * FROM kg_vertex',
        'SELECT * FROM kg_edge',
        'SELECT * FROM tenant_member',
        'SELECT * FROM workflows',
        'SELECT * FROM workflow_executions',
        'SELECT * FROM deal_stage_history',
        'SELECT * FROM social_campaigns',
        'SELECT * FROM social_posts',
        'SELECT * FROM documents',
        'SELECT * FROM memories',
        'SELECT * FROM memory_collections',
      ]);
  })
  .onConnectError((_ctx, err) => {
    console.error('Connection error:', err);
  })
  .onDisconnect((_ctx, err) => {
    console.log('Disconnected from SpacetimeDB', err);
  });
