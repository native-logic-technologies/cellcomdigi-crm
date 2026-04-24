// Auto-Insight Extraction Service
// After a document is uploaded or scraped, calls Mercury 2 to extract
// factual insights and saves them as Memory vertices in the graph.

// Auto-insight extraction using Mercury 2

const API_URL = 'https://api.inceptionlabs.ai/v1/chat/completions';
const MODEL = 'mercury-2';

function getApiKey(): string | null {
  return (import.meta as any).env?.VITE_MERCURY_API_KEY || localStorage.getItem('mercury_api_key') || null;
}

interface ExtractedInsight {
  title: string;
  content: string;
  confidence: number;
}

const INSIGHT_PROMPT = `You are a knowledge extraction engine for a Malaysian SME CRM.

Read the provided document and extract 1 to 3 concise factual insights that would be useful for a sales or marketing team.

Each insight should be:
- A specific fact (not a summary)
- Actionable or relationship-building relevant
- Written in clear English or Bahasa Malaysia (match the document language)

Examples of good insights:
- "Contact prefers WhatsApp over email for urgent matters"
- "Company is planning to expand to Penang in Q3 2026"
- "Procurement decision requires approval from CFO Ahmad bin Ismail"

Return ONLY a JSON array in this exact format:
[
  {"title": "Short insight label", "content": "Full description", "confidence": 0.92}
]

If no useful insights can be extracted, return an empty array [].`;

export async function extractInsightsFromText(
  documentText: string,
  documentTitle?: string
): Promise<ExtractedInsight[]> {
  const apiKey = getApiKey();

  const truncated = documentText.slice(0, 6000);
  const context = documentTitle ? `Document: ${documentTitle}\n\n` : '';

  if (!apiKey) {
    // Fallback: return empty if no API key
    return [];
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: INSIGHT_PROMPT },
        { role: 'user', content: `${context}${truncated}` },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mercury insight extraction error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return [];

  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : '[]';
    return JSON.parse(jsonStr) as ExtractedInsight[];
  } catch {
    return [];
  }
}

/**
 * Full pipeline: extract insights from text and save to SpacetimeDB as Memory vertices.
 */
export async function saveInsightsFromDocument(
  documentText: string,
  documentTitle: string,
  tenantId: bigint,
  targetEntityTable: string | undefined,
  targetEntityId: bigint | undefined,
  db: any
): Promise<number> {
  const insights = await extractInsightsFromText(documentText, documentTitle);
  if (insights.length === 0 || !db) return 0;

  for (const insight of insights) {
    (db.reducers as any).createMemory({
      tenantId,
      title: insight.title,
      content: insight.content,
      memoryType: { tag: 'Insight' },
      sourceTable: targetEntityTable ?? undefined,
      sourceId: targetEntityId ?? undefined,
      createdBy: 1n,
    });
  }

  return insights.length;
}
