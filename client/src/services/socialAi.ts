// AI AI — Social Media Content Generation
// Generates bilingual BM+EN social posts using live CRM context

const API_URL = 'https://api.inceptionlabs.ai/v1/chat/completions';
const MODEL = 'mercury-2';

export interface GeneratedSocialPost {
  scheduled_at: string;
  platform: 'TikTok' | 'Whatsapp' | 'Instagram' | 'Facebook';
  content: string;
  hashtags: string[];
  image_prompt: string;
  target_audience: string;
}

export interface GeneratedCampaignBatch {
  posts: GeneratedSocialPost[];
}

function getApiKey(): string | null {
  return (import.meta as any).env?.VITE_AI_API_KEY || localStorage.getItem('ai_api_key') || null;
}

function buildSystemPrompt(context: SocialContext): string {
  const products = context.products.map((p: any) => `${p.name} (${p.description ?? 'product'})`).join(', ');
  const companies = context.companies.map((c: any) => `${c.name} (${c.industry ?? 'business'})`).join(', ');
  const recentWins = context.wonDeals.map((d: any) => `${d.name}`).join(', ');

  return `You are a Malaysian social media strategist who creates high-performing content for SMEs.

MEMORY GRAPH CONTEXT:
${context.graphContext || 'No detailed context available.'}

BUSINESS CONTEXT:
- Companies: ${companies || 'Malaysian SMEs'}
- Products/Services: ${products || 'business solutions'}
- Recent Wins: ${recentWins || 'growing local businesses'}

CONTENT RULES:
1. Every post MUST be bilingual with clear [EN] and [BM] sections
2. Use Malaysian English (lah, kan, etc. sparingly and naturally)
3. Bahasa Malaysia should feel natural, not Google-translated
4. Include relevant local context (Klang Valley, SME grants, digital transformation)
5. Hashtags must include a mix of English and Malay tags
6. Match tone to platform:
   - TikTok: fun, trend-aware, short hooks, young energy
   - Instagram: visual-first, aesthetic captions, storytelling
   - Facebook: community-focused, longer form, engagement questions
   - WhatsApp: personal, direct, action-oriented, no hashtags
7. WhatsApp posts should feel like a message you'd send to a contact — no hashtags, conversational
8. Image prompts should be vivid, detailed, and appropriate for Malaysian urban/SME settings

OUTPUT FORMAT — respond ONLY with valid JSON:
{
  "posts": [
    {
      "scheduled_at": "2026-05-01T09:00:00Z",
      "platform": "TikTok",
      "content": "[EN] ... [BM] ...",
      "hashtags": ["#tag1", "#tag2"],
      "image_prompt": "A vibrant...",
      "target_audience": "SME owners aged 25-40 in Klang Valley"
    }
  ]
}`;
}

export interface SocialContext {
  companies: any[];
  products: any[];
  wonDeals: any[];
  contacts: any[];
  graphContext?: string;
}

export async function generateSocialBatch(
  theme: string,
  objective: string,
  platforms: string[],
  days: number,
  context: SocialContext
): Promise<GeneratedCampaignBatch> {
  const apiKey = getApiKey();

  const userPrompt = `Generate ${days} social media posts for a Malaysian SME.

THEME: ${theme}
OBJECTIVE: ${objective}
PLATFORMS: ${platforms.join(', ')}
DAYS: ${days} (one post per day, spread across mornings 9am and evenings 6pm)

Requirements:
- Diverse content angles: educational, promotional, social proof, behind-the-scenes, tips, customer stories
- Rotate platforms evenly across the schedule
- Each post needs a strong hook in the first line
- Image prompts should describe scenes relevant to Malaysian business environments`;

  if (!apiKey) {
    return mockGenerateBatch(theme, platforms, days);
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
        { role: 'system', content: buildSystemPrompt(context) },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI API');

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    return JSON.parse(jsonStr) as GeneratedCampaignBatch;
  } catch (e) {
    throw new Error(`Failed to parse social batch JSON: ${e}`);
  }
}

export async function generateSinglePost(
  topic: string,
  platform: string,
  context: SocialContext
): Promise<GeneratedSocialPost> {
  const batch = await generateSocialBatch(topic, 'Engagement', [platform], 1, context);
  return batch.posts[0];
}

// ---------------------------------------------------------------------------
// Mock generator — keyword-based fallback when no API key
// ---------------------------------------------------------------------------

function mockGenerateBatch(_theme: string, platforms: string[], days: number): GeneratedCampaignBatch {
  const templates: Record<string, GeneratedSocialPost[]> = {
    default: [
      {
        scheduled_at: '2026-05-01T09:00:00Z',
        platform: 'TikTok',
        content: '[EN] Malaysian SMEs: Did you know automating your follow-ups can save 10+ hours per week? 🚀 Let us show you how. [BM] PKS Malaysia: Tahukah anda automasi follow-up boleh jimat 10+ jam seminggu? 🚀 Biar kami tunjukkan caranya.',
        hashtags: ['#SMEMalaysia', '#CRM', '#DigitalTransformation', '#PerniagaanMalaysia', '#Automation'],
        image_prompt: 'A modern Malaysian office in Kuala Lumpur with young professionals working on laptops, warm lighting, productive atmosphere',
        target_audience: 'SME owners 25-45 in Klang Valley',
      },
      {
        scheduled_at: '2026-05-02T18:00:00Z',
        platform: 'Instagram',
        content: '[EN] Behind the scenes: How TechVenture Sdn Bhd closed RM 150K in new deals using our CRM pipeline 📈 [BM] Di sebalik tabir: Bagaimana TechVenture Sdn Bhd tutup RM 150K dalam deal baharu guna pipeline CRM kami 📈',
        hashtags: ['#CustomerStory', '#SuccessStory', '#MalaysiaBusiness', '#CRM'],
        image_prompt: 'A celebratory business meeting in a Malaysian SME office, handshake between two professionals, modern interior with glass walls',
        target_audience: 'SME decision makers',
      },
      {
        scheduled_at: '2026-05-03T09:00:00Z',
        platform: 'Whatsapp',
        content: '[EN] Hi there! We just published a free guide: "5 Automation Workflows Every Malaysian SME Needs in 2026". Want the link? Just reply YES! [BM] Hi! Kami baru terbitkan panduan percuma: "5 Workflow Automasi yang Setiap PKS Malaysia Perlukan". Nak link? Balas YES!',
        hashtags: [],
        image_prompt: 'A clean minimalist graphic showing "5 Free Automation Tips" in English and Bahasa Malaysia, professional design',
        target_audience: 'SME owners interested in automation',
      },
    ],
  };

  const base = templates.default;
  const posts: GeneratedSocialPost[] = [];
  for (let i = 0; i < days; i++) {
    const tmpl = base[i % base.length];
    const platform = platforms[i % platforms.length];
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    date.setHours(i % 2 === 0 ? 9 : 18, 0, 0, 0);

    let content = tmpl.content;
    let hashtags = [...tmpl.hashtags];

    if (platform === 'Whatsapp') {
      hashtags = [];
    }

    posts.push({
      ...tmpl,
      platform: platform as any,
      scheduled_at: date.toISOString(),
      content: content.replace(/TikTok|Instagram|WhatsApp/g, platform),
      hashtags,
    });
  }

  return { posts };
}
