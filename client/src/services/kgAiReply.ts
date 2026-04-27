// AI Reply Generator using Knowledge Graph context + AI API

const API_URL = 'https://api.inceptionlabs.ai/v1/chat/completions';
const MODEL = 'mercury-2';

function getApiKey(): string | null {
  return (import.meta as any).env?.VITE_AI_API_KEY || localStorage.getItem('ai_api_key') || null;
}

function safeJsonParse(str: string): any {
  try { return JSON.parse(str); } catch { return {}; }
}

export interface KgVertex {
  id: bigint;
  entityType: { tag: string };
  sourceTable: string;
  sourceId: bigint;
  properties: string;
}

export interface KgEdge {
  id: bigint;
  sourceVertexId: bigint;
  targetVertexId: bigint;
  relationType: { tag: string };
}

export interface MessageContext {
  sender: string;
  body: string;
  direction: string;
}

export function buildKgContext(
  contactId: bigint,
  vertices: KgVertex[],
  edges: KgEdge[]
): string {
  const contactVertex = vertices.find(
    (v) => v.sourceTable === 'contacts' && v.sourceId === contactId
  );
  if (!contactVertex) return '';

  const contactProps = safeJsonParse(contactVertex.properties);
  const lines: string[] = [];

  if (contactProps.name) lines.push(`Name: ${contactProps.name}`);
  if (contactProps.email) lines.push(`Email: ${contactProps.email}`);
  if (contactProps.phone) lines.push(`Phone: ${contactProps.phone}`);
  if (contactProps.status) lines.push(`Status: ${contactProps.status}`);

  const contactVid = contactVertex.id;

  for (const edge of edges) {
    const isSource = edge.sourceVertexId === contactVid;
    const isTarget = edge.targetVertexId === contactVid;
    if (!isSource && !isTarget) continue;

    const otherId = isSource ? edge.targetVertexId : edge.sourceVertexId;
    const other = vertices.find((v) => v.id === otherId);
    if (!other) continue;

    const props = safeJsonParse(other.properties);
    const rel = edge.relationType?.tag;
    const type = other.entityType?.tag;

    if (type === 'Company' && rel === 'WorksAt') {
      lines.push(`Company: ${props.name || 'N/A'}${props.industry ? ` (${props.industry})` : ''}`);
    }
    if (type === 'Deal') {
      const val = props.value ? `RM ${(Number(props.value) / 100).toLocaleString('en-MY')}` : '';
      lines.push(`Deal: ${props.name || 'N/A'}${val ? ` — ${val}` : ''}${props.status ? ` [${props.status}]` : ''}`);
    }
    if (type === 'Memory' && (rel === 'HasMemory' || rel === 'About')) {
      lines.push(`Note: ${props.title || ''}${props.summary ? ` — ${props.summary}` : ''}`);
    }
    if (type === 'Document' && (rel === 'HasDocument' || rel === 'About')) {
      lines.push(`Document: ${props.title || ''}${props.summary ? ` — ${props.summary}` : ''}`);
    }
    if (type === 'Activity' && rel === 'HadActivity') {
      lines.push(`Activity: ${props.type || ''} — ${props.description || ''}`);
    }
    if (type === 'Invoice' && rel === 'BelongsTo') {
      lines.push(`Invoice: ${props.invoice_number || ''}${props.total ? ` — RM ${(Number(props.total) / 100).toLocaleString('en-MY')}` : ''} [${props.status || ''}]`);
    }
    if (type === 'Payment' && rel === 'Paid') {
      lines.push(`Payment: RM ${(Number(props.amount) / 100).toLocaleString('en-MY')} via ${props.method || ''}`);
    }
  }

  return lines.join('\n');
}

export async function generateAiReply(params: {
  contactName: string;
  contactEmail: string;
  contactStatus?: string;
  companyName?: string;
  recentMessages: MessageContext[];
  kgContext: string;
}): Promise<string> {
  const apiKey = getApiKey();

  const systemPrompt = `You are a professional, warm customer service agent for CelcomDigi, a leading Malaysian telecommunications and digital services company.

You have access to the customer's full profile and company knowledge graph. Use this information to craft personalised, accurate replies.

GUIDELINES:
- Be friendly, professional, and concise (2–4 sentences).
- Address the customer by name.
- Reference specific context from their profile/deals/notes when relevant.
- If they ask about products or services, give helpful, factual guidance.
- If this is a follow-up, acknowledge previous messages.
- Reply in the same language the customer used.
- Do NOT include signatures like "Best regards" or "The CelcomDigi Team" — just the reply body.
- Return ONLY the reply text. No markdown formatting, no explanations.`;

  const recentThread = params.recentMessages
    .map((m) => `${m.sender}: ${m.body}`)
    .join('\n');

  const userPrompt = `CUSTOMER PROFILE:
Name: ${params.contactName}
Email: ${params.contactEmail}${params.contactStatus ? `\nStatus: ${params.contactStatus}` : ''}${params.companyName ? `\nCompany: ${params.companyName}` : ''}

KNOWLEDGE GRAPH CONTEXT:
${params.kgContext || 'No additional context available.'}

RECENT CONVERSATION:
${recentThread || 'No previous messages.'}

Generate a reply to the customer's last message.`;

  if (!apiKey) {
    // Fallback mock response
    const lastMsg = params.recentMessages.filter(m => m.direction === 'Inbound').pop();
    const topic = lastMsg?.body.toLowerCase() || '';
    if (topic.includes('broadband') || topic.includes('plan')) {
      return `Hi ${params.contactName}, thanks for your interest in our broadband plans! We have several options ranging from 100Mbps to 1Gbps, with unlimited data and free installation. Would you like me to recommend a plan based on your usage?`;
    }
    if (topic.includes('upgrade')) {
      return `Hi ${params.contactName}, absolutely! I can help you with the upgrade. Let me check your current package and available options. Could you confirm which services you're currently subscribed to?`;
    }
    if (topic.includes('slow') || topic.includes('internet')) {
      return `Hi ${params.contactName}, I'm sorry to hear you're experiencing slow speeds. Let me run a quick diagnostic on your line and check for any outages in your area. I'll get back to you within 15 minutes.`;
    }
    return `Hi ${params.contactName}, thank you for reaching out! I'd be happy to help. Could you share a bit more detail so I can assist you better?`;
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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Empty response from AI API');

  return content;
}
