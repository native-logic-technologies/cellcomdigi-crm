import { useTable as useStTable, useSpacetimeDB } from 'spacetimedb/react';
import { tables } from '../generated';

export function useTable(tableName: string) {
  const table = (tables as any)[tableName];
  if (!table) throw new Error(`Unknown table: ${tableName}`);
  return useStTable(table);
}

export function useDb() {
  const state = useSpacetimeDB();
  return state.getConnection() ?? null;
}

export function useConnectionStatus() {
  const state = useSpacetimeDB();
  return state.isActive;
}
