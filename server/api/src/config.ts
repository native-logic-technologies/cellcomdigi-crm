export const config = {
  port: Number(process.env.PORT || 4000),
  spacetimeHost: process.env.SPACETIME_HOST || 'http://127.0.0.1:3001',
  spacetimeDb: process.env.SPACETIME_DB || 'cellcom-crm',
  apiKeys: new Set(
    (process.env.API_KEYS || 'dev-key-change-in-production')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
  ),
};
