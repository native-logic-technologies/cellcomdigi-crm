import { DbConnection } from '../generated';

function getHost(): string {
  const envHost = (import.meta as any).env?.VITE_SPACETIME_HOST;
  if (envHost) return envHost;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3001';
}

const HOST = getHost();
const DB_NAME = (import.meta as any).env.VITE_SPACETIME_DB || 'cellcomcrm';

export const connectionBuilder = DbConnection.builder()
  .withUri(HOST)
  .withDatabaseName(DB_NAME)
  .onConnect((conn, identity, _token) => {
    console.log('Connected to SpacetimeDB as', identity.toHexString());
    conn
      .subscriptionBuilder()
      .onApplied(() => console.log('Subscriptions applied'))
      .onError((_ctx: any) => console.error('Subscription error:', _ctx))
      .subscribe([
        'SELECT * FROM kg_vertex',
        'SELECT * FROM kg_edge',
        'SELECT * FROM tenant_member',
      ]);
  })
  .onConnectError((_ctx, err) => {
    console.error('Connection error:', err);
  })
  .onDisconnect((_ctx, err) => {
    console.log('Disconnected from SpacetimeDB', err);
  });
