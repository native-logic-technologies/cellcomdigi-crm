import { config } from './config.js';
import type { KgVertex, KgEdge } from './types.js';

interface SqlColumn {
  name: { some: string } | null;
  algebraic_type: any;
}

interface SqlResult {
  schema: { elements: SqlColumn[] };
  rows: any[][];
  total_duration_micros: number;
}

interface IdentityResponse {
  identity: string;
  token: string;
}

let cachedIdentity: IdentityResponse | null = null;

async function fetchIdentity(): Promise<IdentityResponse> {
  if (cachedIdentity) return cachedIdentity;

  const res = await fetch(`${config.spacetimeHost}/v1/database/${config.spacetimeDb}/identity`);
  if (!res.ok) {
    throw new Error(`Failed to fetch identity: ${res.status}`);
  }

  const identity = (await res.text()).trim();
  const token = res.headers.get('spacetime-identity-token') || '';
  cachedIdentity = { identity, token };
  return cachedIdentity;
}

export async function runSql(query: string): Promise<SqlResult[]> {
  const { identity, token } = await fetchIdentity();

  const res = await fetch(`${config.spacetimeHost}/v1/database/${identity}/sql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body: query,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SQL query failed: ${res.status} - ${text}`);
  }

  return (await res.json()) as SqlResult[];
}

// --- Row parsers ---

function parseU64(value: any): bigint {
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string') return BigInt(value);
  return 0n;
}

function parseString(value: any): string {
  return String(value);
}

function parseOption<T>(value: any, parser: (v: any) => T): T | undefined {
  // SpacetimeDB Option is a Sum type: Some = [0, value], None = [1, []]
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [variant, inner] = value;
  if (variant === 0) return parser(inner);
  return undefined;
}

function parseEnumTag(value: any): string {
  // SpacetimeDB enum is a Sum type: [variant_index, []]
  if (!Array.isArray(value) || value.length !== 2) return '';
  const variantIndex = value[0];
  // We need the schema to map variant_index to name, but the SQL result
  // only gives us the index. For now, we rely on the caller providing the schema.
  return String(variantIndex);
}

function parseTimestamp(value: any): Date {
  // Timestamp is a Product type: [micros_since_epoch]
  if (Array.isArray(value) && value.length === 1) {
    const micros = parseU64(value[0]);
    return new Date(Number(micros / 1000n));
  }
  return new Date();
}

function parseFloatArray(value: any): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((v: any) => Number(v));
}

// Map enum variant index to name for EntityType
const ENTITY_TYPE_VARIANTS = [
  'Contact', 'Company', 'Deal', 'Message', 'Invoice', 'Product', 'User',
  'WorkflowRun', 'Payment', 'Activity', 'Conversation', 'Document', 'Memory',
  'Container', 'ContentFragment', 'SocialPost', 'SocialCampaign', 'Workflow',
  'PipelineStage', 'InvoiceItem',
];

// Map enum variant index to name for RelationType
const RELATION_TYPE_VARIANTS = [
  'BelongsTo', 'CommunicatedWith', 'Purchased', 'WorksAt', 'Triggered',
  'RelatedTo', 'Paid', 'MentionedIn', 'HadActivity', 'ParticipatedIn',
  'Sent', 'Received', 'Contains', 'PaidFor', 'About', 'ExtractedFrom',
  'SimilarTo', 'AuthoredBy', 'AssignedTo', 'AtStage', 'InPipeline', 'PartOf',
  'ContainedIn', 'HasMemory', 'HasDocument',
];

function parseEntityType(value: any): { tag: string } {
  const idx = Number(parseEnumTag(value));
  return { tag: ENTITY_TYPE_VARIANTS[idx] || `Unknown(${idx})` };
}

function parseRelationType(value: any): { tag: string } {
  const idx = Number(parseEnumTag(value));
  return { tag: RELATION_TYPE_VARIANTS[idx] || `Unknown(${idx})` };
}

export function parseVertices(results: SqlResult[]): KgVertex[] {
  if (results.length === 0) return [];
  const { elements } = results[0].schema;
  const rows = results[0].rows;

  // Map column names to indices
  const colIndex = new Map<string, number>();
  elements.forEach((col, i) => {
    if (col.name?.some) colIndex.set(col.name.some, i);
  });

  const get = (row: any[], name: string) => row[colIndex.get(name)!];

  return rows.map((row) => ({
    id: parseU64(get(row, 'id')),
    tenantId: parseU64(get(row, 'tenant_id')),
    entityType: parseEntityType(get(row, 'entity_type')),
    sourceTable: parseString(get(row, 'source_table')),
    sourceId: parseU64(get(row, 'source_id')),
    properties: parseString(get(row, 'properties')),
    vectorEmbedding: parseOption(get(row, 'vector_embedding'), parseFloatArray),
    createdAt: parseTimestamp(get(row, 'created_at')),
    updatedAt: parseTimestamp(get(row, 'updated_at')),
  }));
}

export function parseEdges(results: SqlResult[]): KgEdge[] {
  if (results.length === 0) return [];
  const { elements } = results[0].schema;
  const rows = results[0].rows;

  const colIndex = new Map<string, number>();
  elements.forEach((col, i) => {
    if (col.name?.some) colIndex.set(col.name.some, i);
  });

  const get = (row: any[], name: string) => row[colIndex.get(name)!];

  return rows.map((row) => ({
    id: parseU64(get(row, 'id')),
    tenantId: parseU64(get(row, 'tenant_id')),
    sourceVertexId: parseU64(get(row, 'source_vertex_id')),
    targetVertexId: parseU64(get(row, 'target_vertex_id')),
    relationType: parseRelationType(get(row, 'relation_type')),
    properties: parseString(get(row, 'properties')),
    weight: parseOption(get(row, 'weight'), Number),
    createdAt: parseTimestamp(get(row, 'created_at')),
  }));
}
