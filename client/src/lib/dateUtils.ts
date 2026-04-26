/**
 * Safely convert a SpacetimeDB Timestamp, Date, string, or number to a JS Date.
 * Returns null for falsy values.
 */
export function safeDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function formatTime(value: any): string {
  const d = safeDate(value);
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
}

export function formatDate(value: any): string {
  const d = safeDate(value);
  return d ? d.toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

export function formatDateTime(value: any): string {
  const d = safeDate(value);
  return d ? d.toLocaleString('en-MY', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

export function formatRelative(value: any): string {
  const d = safeDate(value);
  if (!d) return '—';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-MY', { month: 'short', day: 'numeric' });
}
