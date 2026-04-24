// Embedding Service — Google Gemini Embedding 2 (gemini-embedding-001)
// Via Vertex AI. Best-performing API for RAG in Southeast Asia.
// Supports BM/EN multilingual embeddings natively.

// Supported models (configure via VITE_GEMINI_MODEL):
//   gemini-embedding-001          -> unified, best overall, 768-3072 dim, supports Malay/Indonesian
//   text-embedding-005            -> English/code specialist, 768 dim max
//   text-multilingual-embedding-002 -> multilingual specialist, 768 dim max
const MODEL = (import.meta as any).env?.VITE_GEMINI_MODEL || 'gemini-embedding-001';

// Output dims vary by model:
//   gemini-embedding-001: up to 3072 (we default to 768)
//   text-embedding-005: up to 768
//   text-multilingual-embedding-002: up to 768
const SOURCE_DIM = Number((import.meta as any).env?.VITE_GEMINI_OUTPUT_DIM) || 768;
const TARGET_DIM = 384;   // projected down for SpacetimeDB storage
const MAX_CHARS_PER_TEXT = 6000; // ~2048 tokens safety margin

let projectionMatrix: number[][] | null = null;

function getApiKey(): string | null {
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || null;
}

function getProjectId(): string | null {
  return (import.meta as any).env?.VITE_GEMINI_PROJECT_ID || localStorage.getItem('gemini_project_id') || null;
}

function getLocation(): string {
  return (import.meta as any).env?.VITE_GEMINI_LOCATION || localStorage.getItem('gemini_location') || 'asia-southeast2';
}

function getApiBase(): string {
  const loc = getLocation();
  return `https://${loc}-aiplatform.googleapis.com/v1`;
}

function getEndpointPath(): string {
  const project = getProjectId();
  const loc = getLocation();
  if (!project) {
    throw new Error('Gemini Project ID not configured. Set VITE_GEMINI_PROJECT_ID or localStorage.gemini_project_id');
  }
  return `projects/${project}/locations/${loc}/publishers/google/models/${MODEL}`;
}

function getProjectionMatrix(): number[][] {
  if (projectionMatrix) return projectionMatrix;
  const seed = 42;
  let s = seed;
  const rng = () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
  projectionMatrix = [];
  for (let i = 0; i < TARGET_DIM; i++) {
    const row: number[] = [];
    for (let j = 0; j < SOURCE_DIM; j++) {
      row.push(rng() * 2 - 1);
    }
    projectionMatrix.push(row);
  }
  return projectionMatrix;
}

function projectEmbedding(vec: number[]): number[] {
  const matrix = getProjectionMatrix();
  const result: number[] = [];
  for (let i = 0; i < TARGET_DIM; i++) {
    let sum = 0;
    for (let j = 0; j < SOURCE_DIM; j++) {
      sum += matrix[i][j] * vec[j];
    }
    result.push(sum);
  }
  let norm = 0;
  for (const v of result) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < result.length; i++) result[i] /= norm;
  }
  return result;
}

interface VertexEmbedResponse {
  predictions?: Array<{
    embeddings?: {
      values: number[];
      statistics?: {
        truncated: boolean;
        token_count: number;
      };
    };
  }>;
}

async function callVertexPredict(
  text: string,
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' | 'SEMANTIC_SIMILARITY',
  title?: string
): Promise<number[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Set VITE_GEMINI_API_KEY or localStorage.gemini_api_key');
  }

  const endpointPath = getEndpointPath();
  const url = `${getApiBase()}/${endpointPath}:predict?key=${apiKey}`;

  const instance: Record<string, any> = {
    content: text.slice(0, MAX_CHARS_PER_TEXT),
    task_type: taskType,
  };
  if (title && taskType === 'RETRIEVAL_DOCUMENT') {
    instance.title = title;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [instance],
      parameters: {
        autoTruncate: true,
        outputDimensionality: SOURCE_DIM,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini Embedding API error: ${res.status} ${err}`);
  }

  const data: VertexEmbedResponse = await res.json();
  const values = data.predictions?.[0]?.embeddings?.values;
  if (!values || values.length !== SOURCE_DIM) {
    throw new Error(`Unexpected embedding dimensions: ${values?.length}, expected ${SOURCE_DIM}`);
  }

  return projectEmbedding(values);
}

/**
 * Embed a single text string.
 * Uses RETRIEVAL_DOCUMENT for stored content (vertices, documents, memories)
 * and RETRIEVAL_QUERY for user search queries.
 */
export async function embedText(
  text: string,
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT',
  title?: string
): Promise<number[]> {
  return callVertexPredict(text, taskType, title);
}

/**
 * Embed a batch of texts.
 * gemini-embedding-001 accepts only ONE input per request, so we loop sequentially.
 * For large batches, consider calling from a backend worker instead.
 */
export async function embedBatch(
  texts: string[],
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT'
): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    const embedding = await callVertexPredict(text, taskType);
    results.push(embedding);
  }
  return results;
}

/**
 * Embed a vertex for storage in the knowledge graph.
 * Uses RETRIEVAL_DOCUMENT task type for corpus indexing.
 */
export async function embedVertex(text: string, title?: string): Promise<number[]> {
  return callVertexPredict(text, 'RETRIEVAL_DOCUMENT', title);
}

/**
 * Embed a user search query for semantic search.
 * Uses RETRIEVAL_QUERY task type for optimal retrieval performance.
 */
export async function embedQuery(text: string): Promise<number[]> {
  return callVertexPredict(text, 'RETRIEVAL_QUERY');
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
