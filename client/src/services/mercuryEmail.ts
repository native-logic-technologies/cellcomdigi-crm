// AI AI — Hyper-Personalised Email Reply Generation
// Uses Memory graph context for deeply personalised replies

const API_URL = 'https://api.inceptionlabs.ai/v1/chat/completions';
const MODEL = 'mercury-2';

interface EmailReplyRequest {
  contactId: bigint;
  companyId?: bigint;
  dealId?: bigint;
  originalEmail: string;
  tone: 'professional' | 'friendly' | 'casual' | 'urgent';
  language: 'en' | 'bm' | 'bilingual';
  context: string;
}

function getApiKey(): string | null {
  return (import.meta as any).env?.VITE_AI_API_KEY || localStorage.getItem('ai_api_key') || null;
}

export async function generateEmailReply(req: EmailReplyRequest): Promise<string> {
  const apiKey = getApiKey();

  const systemPrompt = `You are an expert email copywriter for a Malaysian SME CRM.
You write hyper-personalised email replies using the provided contact intelligence graph.

RULES:
1. Reference specific facts from the context (deal status, past activities, recent messages)
2. Match the requested tone precisely
3. For bilingual mode, write [EN] section first, then [BM] section
4. Malaysian English is acceptable ("lah", "kan" sparingly)
5. Bahasa Malaysia must feel natural, not translated
6. Keep replies concise — 2-4 short paragraphs
7. Always include a clear call-to-action or next step
8. Sign off professionally with the company name if known

CONTEXT:
${req.context}
`;

  const userPrompt = `Write a ${req.tone} email reply to the following message.

ORIGINAL EMAIL:
${req.originalEmail}

REQUIREMENTS:
- Tone: ${req.tone}
- Language: ${req.language}
- Reference at least 2 specific facts from the contact context
- Include a next step or CTA`;

  if (!apiKey) {
    return mockEmailReply(req);
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
      temperature: 0.5,
      max_tokens: 1500,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function mockEmailReply(req: EmailReplyRequest): string {
  const { tone, language, originalEmail } = req;
  const isUrgent = originalEmail.toLowerCase().includes('urgent') || originalEmail.toLowerCase().includes('asap');

  if (language === 'bilingual') {
    return `[EN]

Hi there,

Thank you for reaching out! Based on our recent conversation about the CRM pipeline, I've prepared the information you requested.

${isUrgent ? "I understand this is urgent — I'll prioritise this and get back to you by end of day." : "Let me know if you'd like to schedule a quick call to go through the details."}

Best regards,
The Team

[BM]

Hi,

Terima kasih atas emel anda! Berdasarkan perbualan kami baru-baru ini tentang pipeline CRM, saya telah sediakan maklumat yang diminta.

${isUrgent ? "Saya faham ini urgent — saya akan prioritikan dan balas anda sebelum hari ini berakhir." : "Beritahu saya jika anda nak schedule panggilan pantas untuk bincang detail."}

Salam mesra,
Pasukan Kami`;
  }

  if (tone === 'friendly') {
    return `Hi there!

Great to hear from you again 😊 Based on our recent chat about the CRM pipeline, I've pulled together the info you need.

${isUrgent ? "Totally get that this is urgent — I'm on it and will circle back by EOD!" : "Give me a shout if you want to jump on a quick call to run through things."}

Cheers,
The Team`;
  }

  if (tone === 'urgent') {
    return `Hi,

Acknowledged — I understand the urgency and have escalated this internally.

I will provide a detailed update within 2 hours. In the meantime, please share any additional context that may help us resolve this faster.

Regards,
The Team`;
  }

  return `Dear Sir/Madam,

Thank you for your email. We have reviewed your request in the context of our ongoing engagement.

${isUrgent ? "We recognise the urgency and will expedite our response accordingly." : "We would be happy to arrange a follow-up discussion at your convenience."}

Please do not hesitate to contact us should you require further assistance.

Yours sincerely,
The Team`;
}
