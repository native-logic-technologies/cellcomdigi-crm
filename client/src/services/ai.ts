// AI API Service
// OpenAI-compatible API for workflow generation

const API_URL = 'https://api.inceptionlabs.ai/v1/chat/completions';
const MODEL = 'mercury-2';

export interface WorkflowStep {
  id: string;
  type: 'trigger' | 'wait' | 'send_email' | 'create_task' | 'update_field' | 'condition' | 'end';
  label: string;
  config: Record<string, any>;
}

export interface GeneratedWorkflow {
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: Record<string, any>;
  steps: WorkflowStep[];
  email_template?: {
    subject: string;
    body: string;
  };
}

export interface CompanyProfile {
  name: string;
  industry?: string;
  description?: string;
}

export interface KbContext {
  memories: string[];
  documents: string[];
}

function buildSystemPrompt(company?: CompanyProfile, kb?: KbContext): string {
  const companySection = company
    ? `\nCompany Profile:\n- Name: ${company.name}\n- Industry: ${company.industry || 'N/A'}\n- Description: ${company.description || 'N/A'}\n`
    : '';

  const kbSection = kb
    ? `\nKnowledge Base Context:\n${kb.memories.length > 0 ? '- Memories: ' + kb.memories.slice(0, 5).join('; ') : ''}\n${kb.documents.length > 0 ? '- Documents: ' + kb.documents.slice(0, 3).join('; ') : ''}\n`
    : '';

  return `You are an automation workflow builder for a CRM system. 
Given a user's natural language description, generate a JSON workflow definition.

When generating email templates, use the company profile and knowledge base context below to write personalised, contextually relevant emails that reflect the company's brand voice and offerings. Do NOT use generic placeholder text — reference actual services, products, and value propositions from the knowledge base.${companySection}${kbSection}

Available step types:
- trigger: Entry point (e.g., new_contact, deal_won, schedule)
- wait: Delay before next step (duration in hours/days)
- send_email: Send an email with subject/body using {{variable}} placeholders
- create_task: Create a follow-up task
- update_field: Update a record field
- condition: Branch based on a condition
- end: Terminate the workflow

Respond ONLY with valid JSON in this exact format:
{
  "name": "Short workflow name",
  "description": "What this automation does",
  "trigger_type": "new_contact|deal_stage_change|schedule|manual",
  "trigger_config": {},
  "steps": [
    { "id": "1", "type": "trigger", "label": "...", "config": {} },
    { "id": "2", "type": "wait", "label": "Wait 1 hour", "config": { "duration": "1h" } },
    { "id": "3", "type": "send_email", "label": "Send welcome email", "config": { "to": "{{contact.email}}", "subject": "...", "body": "..." } }
  ],
  "email_template": { "subject": "...", "body": "..." }
}

Use CRM variables like {{contact.name}}, {{contact.email}}, {{company.name}}, {{deal.value}}.
Keep workflows simple — 3-5 steps maximum.`;
}

function getApiKey(): string | null {
  return (import.meta as any).env?.VITE_AI_API_KEY || localStorage.getItem('ai_api_key') || null;
}

export async function generateWorkflow(
  description: string,
  company?: CompanyProfile,
  kb?: KbContext
): Promise<GeneratedWorkflow> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return mockGenerateWorkflow(description, company, kb);
  }

  const systemPrompt = buildSystemPrompt(company, kb);

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
        { role: 'user', content: description },
      ],
      temperature: 0.3,
      max_tokens: 2000,
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
    return JSON.parse(jsonStr) as GeneratedWorkflow;
  } catch (e) {
    throw new Error(`Failed to parse workflow JSON: ${e}`);
  }
}

function mockGenerateWorkflow(
  description: string,
  company?: CompanyProfile,
  kb?: KbContext
): GeneratedWorkflow {
  const desc = description.toLowerCase();
  const companyName = company?.name || 'CelcomDigi';
  const industry = company?.industry || 'telecommunications';
  const kbContext = kb?.memories?.length
    ? ` We specialise in ${kb.memories[0].slice(0, 120)}...`
    : '';

  if (desc.includes('website') || desc.includes('order') || desc.includes('welcome')) {
    return {
      name: 'Website Order Welcome',
      description: 'Send a follow-up email to new website customers welcoming them to the brand',
      trigger_type: 'new_contact',
      trigger_config: { source: 'Website' },
      steps: [
        { id: 'trig-1', type: 'trigger', label: 'New Website Contact', config: { source: 'Website' } },
        { id: 'wait-1', type: 'wait', label: 'Wait 30 minutes', config: { duration: '30m' } },
        { id: 'email-1', type: 'send_email', label: 'Send Welcome Email', config: { to: '{{contact.email}}', template: 'welcome' } },
        { id: 'task-1', type: 'create_task', label: 'Create follow-up task', config: { title: 'Follow up with {{contact.name}}', due_in: '2d' } },
        { id: 'end-1', type: 'end', label: 'End', config: {} },
      ],
      email_template: {
        subject: `Welcome to ${companyName}, {{contact.name}}!`,
        body: `Hi {{contact.name}},\n\nThank you for choosing ${companyName}!${kbContext}\n\nWe're thrilled to have you on board. If you have any questions about our ${industry} services, reply to this email or reach out to our team.\n\nBest regards,\nThe ${companyName} Team`,
      },
    };
  }

  if (desc.includes('deal') || desc.includes('proposal') || desc.includes('follow')) {
    return {
      name: 'Deal Follow-up Sequence',
      description: 'Automated follow-up sequence for deals entering the Proposal stage',
      trigger_type: 'deal_stage_change',
      trigger_config: { stage: 'Proposal' },
      steps: [
        { id: 'trig-1', type: 'trigger', label: 'Deal → Proposal', config: { stage: 'Proposal' } },
        { id: 'wait-1', type: 'wait', label: 'Wait 2 days', config: { duration: '2d' } },
        { id: 'email-1', type: 'send_email', label: 'Send Follow-up', config: { to: '{{contact.email}}', template: 'followup' } },
        { id: 'cond-1', type: 'condition', label: 'Deal still open?', config: { field: 'deal.status', op: 'eq', value: 'Open' } },
        { id: 'email-2', type: 'send_email', label: 'Send Reminder', config: { to: '{{contact.email}}', template: 'reminder' } },
        { id: 'end-1', type: 'end', label: 'End', config: {} },
      ],
      email_template: {
        subject: `Following up on your proposal — ${companyName}`,
        body: `Hi {{contact.name}},\n\nI wanted to follow up on the proposal we sent for {{deal.name}}.${kbContext}\n\nPlease let me know if you have any questions or if you'd like to discuss next steps.\n\nBest,\n{{user.name}}`,
      },
    };
  }

  if (desc.includes('invoice') || desc.includes('payment') || desc.includes('overdue')) {
    return {
      name: 'Invoice Payment Reminder',
      description: 'Send reminders for overdue invoices',
      trigger_type: 'schedule',
      trigger_config: { cron: '0 9 * * 1' },
      steps: [
        { id: 'trig-1', type: 'trigger', label: 'Every Monday 9am', config: { cron: '0 9 * * 1' } },
        { id: 'cond-1', type: 'condition', label: 'Invoice overdue?', config: { field: 'invoice.status', op: 'eq', value: 'Overdue' } },
        { id: 'email-1', type: 'send_email', label: 'Send Reminder', config: { to: '{{contact.email}}', template: 'overdue' } },
        { id: 'task-1', type: 'create_task', label: 'Escalate if >30 days', config: { title: 'Escalate {{invoice.number}}', condition: 'days_overdue > 30' } },
        { id: 'end-1', type: 'end', label: 'End', config: {} },
      ],
      email_template: {
        subject: 'Payment Reminder: Invoice {{invoice.number}}',
        body: `Hi {{contact.name}},\n\nThis is a friendly reminder that invoice {{invoice.number}} for {{invoice.total}} is now overdue.${kbContext}\n\nPlease arrange payment at your earliest convenience.\n\nThank you,\n${companyName} Finance Team`,
      },
    };
  }

  return {
    name: 'New Contact Follow-up',
    description: 'Automatically follow up with new contacts',
    trigger_type: 'new_contact',
    trigger_config: {},
    steps: [
      { id: 'trig-1', type: 'trigger', label: 'New Contact Created', config: {} },
      { id: 'wait-1', type: 'wait', label: 'Wait 1 hour', config: { duration: '1h' } },
      { id: 'email-1', type: 'send_email', label: 'Send Welcome Email', config: { to: '{{contact.email}}' } },
      { id: 'end-1', type: 'end', label: 'End', config: {} },
    ],
    email_template: {
      subject: `Welcome, {{contact.name}}!`,
      body: `Hi {{contact.name}},\n\nWelcome to ${companyName}!${kbContext}\n\nWe're excited to connect with you.\n\nBest,\nThe ${companyName} Team`,
    },
  };
}
