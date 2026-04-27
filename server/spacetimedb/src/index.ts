/**
 * Malaysian SME CRM — SpacetimeDB Server Module
 *
 * Tables:
 *   Operational: users, contacts, companies, pipelines, pipeline_stages,
 *                deals, activities, conversations, messages,
 *                products, invoices, invoice_items, payments
 *   Knowledge Graph: kg_vertex, kg_edge
 *   Auth: tenant_member
 *
 * Notes:
 *   - Currency stored as u64 cents (RM 100.50 = 10050n)
 *   - JSON fields stored as strings (JSON.stringify/parse at boundaries)
 *   - KG auto-syncs from operational tables via dual-write in reducers
 */

import { schema, table, t } from 'spacetimedb/server';
import { Timestamp } from 'spacetimedb';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

const userRole = t.enum('UserRole', ['Admin', 'Manager', 'Sales', 'Viewer']);

const contactSource = t.enum('ContactSource', [
  'Whatsapp', 'Tiktok', 'Email', 'Website', 'Manual', 'Pos', 'Referral',
]);

const contactStatus = t.enum('ContactStatus', [
  'Lead', 'Prospect', 'Customer', 'Churned',
]);

const dealStatus = t.enum('DealStatus', ['Open', 'Won', 'Lost', 'Stalled']);

const activityType = t.enum('ActivityType', [
  'Call', 'Meeting', 'Email', 'Whatsapp', 'Note', 'Task',
]);

const channelType = t.enum('ChannelType', [
  'Whatsapp', 'Tiktok', 'Email', 'Livechat', 'Pos',
]);

const conversationStatus = t.enum('ConversationStatus', [
  'Active', 'Archived', 'Spam',
]);

const messageSenderType = t.enum('MessageSenderType', [
  'Contact', 'User', 'System', 'Bot',
]);

const messageDirection = t.enum('MessageDirection', ['Inbound', 'Outbound']);

const messageStatus = t.enum('MessageStatus', [
  'Sent', 'Delivered', 'Read', 'Failed',
]);

const invoiceStatus = t.enum('InvoiceStatus', [
  'Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled',
]);

const lhdnValidationStatus = t.enum('LhdnValidationStatus', [
  'Pending', 'Validated', 'Failed',
]);

const paymentMethod = t.enum('PaymentMethod', [
  'Fpx', 'Duitnow', 'Card', 'TngWallet', 'Grabpay',
  'Boost', 'Shopeepay', 'Cash', 'BankTransfer',
]);

const paymentStatus = t.enum('PaymentStatus', [
  'Pending', 'Completed', 'Failed', 'Refunded',
]);

const entityType = t.enum('EntityType', [
  'Contact', 'Company', 'Deal', 'Message',
  'Invoice', 'Product', 'User', 'WorkflowRun',
  'Payment',
  'Activity',
  'Conversation',
  'Document',
  'Memory',
  'Container',
  'ContentFragment',
  'SocialPost',
  'SocialCampaign',
  'Workflow',
  'PipelineStage',
  'InvoiceItem',
]);

const relationType = t.enum('RelationType', [
  'BelongsTo', 'CommunicatedWith', 'Purchased',
  'WorksAt', 'Triggered', 'RelatedTo', 'Paid',
  'MentionedIn',
  'HadActivity',
  'ParticipatedIn',
  'Sent',
  'Received',
  'Contains',
  'PaidFor',
  'About',
  'ExtractedFrom',
  'SimilarTo',
  'AuthoredBy',
  'AssignedTo',
  'AtStage',
  'InPipeline',
  'PartOf',
  'ContainedIn',
  'HasMemory',
  'HasDocument',
]);

const memoryType = t.enum('MemoryType', [
  'Note', 'Insight', 'Fact', 'Template', 'Summary',
]);

const collectionType = t.enum('CollectionType', [
  'AutoContact', 'AutoCompany', 'AutoDeal', 'Manual',
]);

const socialPostPlatform = t.enum('SocialPostPlatform', [
  'TikTok', 'Whatsapp', 'Instagram', 'Facebook',
]);

const socialPostStatus = t.enum('SocialPostStatus', [
  'Draft', 'Scheduled', 'Published', 'Failed',
]);

const campaignObjective = t.enum('CampaignObjective', [
  'Awareness', 'Engagement', 'Leads', 'Sales',
]);

const campaignStatus = t.enum('CampaignStatus', [
  'Draft', 'Active', 'Completed', 'Paused',
]);

// ---------------------------------------------------------------------------
// Operational Tables
// ---------------------------------------------------------------------------

const users = table(
  { name: 'users', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    email: t.string().index('btree'),
    name: t.string(),
    role: userRole,
    avatar_url: t.option(t.string()),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

const contacts = table(
  {
    name: 'contacts',
    public: true,
    indexes: [
      { accessor: 'tenant_email', algorithm: 'btree', columns: ['tenant_id', 'email'] },
      { accessor: 'tenant_phone', algorithm: 'btree', columns: ['tenant_id', 'phone'] },
      { accessor: 'tenant_status', algorithm: 'btree', columns: ['tenant_id', 'status'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    email: t.string(),
    phone: t.string(),
    name: t.string(),
    company_id: t.option(t.u64()),
    source: contactSource,
    status: contactStatus,
    assigned_to: t.option(t.u64()),
    custom_fields: t.string(), // JSON
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

const companies = table(
  { name: 'companies', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    name: t.string(),
    registration_number: t.option(t.string()),
    industry: t.option(t.string()),
    phone: t.option(t.string()),
    email: t.option(t.string()),
    website: t.option(t.string()),
    address: t.string(), // JSON
    billing_address: t.string(), // JSON
    notes: t.string(), // JSON or plain text
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

const pipelines = table(
  { name: 'pipelines', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    name: t.string(),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

const pipelineStages = table(
  {
    name: 'pipeline_stages',
    public: true,
    indexes: [
      { accessor: 'tenant_pipeline', algorithm: 'btree', columns: ['tenant_id', 'pipeline_id'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    pipeline_id: t.u64().index('btree'),
    name: t.string(),
    order_index: t.u32(),
    win_probability: t.u8(),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

const deals = table(
  {
    name: 'deals',
    public: true,
    indexes: [
      { accessor: 'tenant_pipeline', algorithm: 'btree', columns: ['tenant_id', 'pipeline_id'] },
      { accessor: 'tenant_contact', algorithm: 'btree', columns: ['tenant_id', 'contact_id'] },
      { accessor: 'tenant_stage', algorithm: 'btree', columns: ['tenant_id', 'stage_id'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    name: t.string(),
    contact_id: t.u64().index('btree'),
    company_id: t.option(t.u64()),
    pipeline_id: t.u64().index('btree'),
    stage_id: t.u64().index('btree'),
    value: t.u64(), // cents
    currency: t.string(),
    probability: t.u8(),
    expected_close: t.option(t.timestamp()),
    actual_close: t.option(t.timestamp()),
    status: dealStatus,
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

const activities = table(
  {
    name: 'activities',
    public: true,
    indexes: [
      { accessor: 'tenant_contact_created', algorithm: 'btree', columns: ['tenant_id', 'contact_id', 'created_at'] },
      { accessor: 'tenant_deal_created', algorithm: 'btree', columns: ['tenant_id', 'deal_id', 'created_at'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    contact_id: t.option(t.u64()),
    deal_id: t.option(t.u64()),
    type: activityType,
    description: t.string(),
    created_by: t.u64(),
    created_at: t.timestamp(),
  }
);

const conversations = table(
  {
    name: 'conversations',
    public: true,
    indexes: [
      { accessor: 'tenant_contact', algorithm: 'btree', columns: ['tenant_id', 'contact_id'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    contact_id: t.u64().index('btree'),
    channel: channelType,
    channel_conversation_id: t.string(),
    status: conversationStatus,
    last_message_at: t.timestamp(),
    unread_count: t.u32(),
  }
);

const messages = table(
  {
    name: 'messages',
    public: true,
    indexes: [
      { accessor: 'conversation_created', algorithm: 'btree', columns: ['conversation_id', 'created_at'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    conversation_id: t.u64().index('btree'),
    sender_type: messageSenderType,
    sender_id: t.u64(),
    body: t.string(),
    attachments: t.string(), // JSON
    direction: messageDirection,
    status: messageStatus,
    external_message_id: t.option(t.string()),
    created_at: t.timestamp(),
  }
);

const products = table(
  { name: 'products', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    name: t.string(),
    sku: t.option(t.string()),
    description: t.option(t.string()),
    price: t.u64(), // cents
    cost: t.option(t.u64()), // cents
    currency: t.string(),
    stock_quantity: t.option(t.u32()),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

const invoices = table(
  { name: 'invoices', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    invoice_number: t.string(),
    contact_id: t.u64().index('btree'),
    company_id: t.option(t.u64()),
    issue_date: t.timestamp(),
    due_date: t.timestamp(),
    subtotal: t.u64(), // cents
    tax_amount: t.u64(), // cents
    total: t.u64(), // cents
    currency: t.string(),
    status: invoiceStatus,
    lhdn_validation_status: lhdnValidationStatus,
    lhdn_uuid: t.option(t.string()),
    lhdn_qr_code: t.option(t.string()),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

const invoiceItems = table(
  {
    name: 'invoice_items',
    public: true,
    indexes: [
      { accessor: 'tenant_invoice', algorithm: 'btree', columns: ['tenant_id', 'invoice_id'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    invoice_id: t.u64().index('btree'),
    product_id: t.option(t.u64()),
    description: t.string(),
    quantity: t.u32(),
    unit_price: t.u64(), // cents
    total: t.u64(), // cents
  }
);

const payments = table(
  { name: 'payments', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    invoice_id: t.option(t.u64()),
    contact_id: t.u64().index('btree'),
    amount: t.u64(), // cents
    currency: t.string(),
    method: paymentMethod,
    gateway_reference: t.option(t.string()),
    status: paymentStatus,
    created_at: t.timestamp(),
  }
);

// ---------------------------------------------------------------------------
// Document & Memory Tables
// ---------------------------------------------------------------------------

const documents = table(
  { name: 'documents', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    title: t.string(),
    source_url: t.option(t.string()),
    content_text: t.string(),
    file_type: t.string(),
    extracted_summary: t.string(),
    extracted_keywords: t.string(),
    metadata: t.string(),
    uploaded_by: t.u64(),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

const memories = table(
  { name: 'memories', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    title: t.string(),
    content: t.string(),
    memory_type: memoryType,
    source_table: t.option(t.string()),
    source_id: t.option(t.u64()),
    created_by: t.u64(),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

const memoryCollections = table(
  { name: 'memory_collections', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    name: t.string(),
    description: t.string(),
    collection_type: collectionType,
    source_table: t.option(t.string()),
    source_id: t.option(t.u64()),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

// ---------------------------------------------------------------------------
// Knowledge Graph Tables
// ---------------------------------------------------------------------------

const kgVertex = table(
  {
    name: 'kg_vertex',
    public: true,
    indexes: [
      { accessor: 'tenant_entity', algorithm: 'btree', columns: ['tenant_id', 'entity_type'] },
      { accessor: 'tenant_source', algorithm: 'btree', columns: ['tenant_id', 'source_table', 'source_id'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    entity_type: entityType,
    source_table: t.string().index('btree'),
    source_id: t.u64().index('btree'),
    properties: t.string(), // JSON
    vector_embedding: t.option(t.array(t.f32())),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

const kgEdge = table(
  {
    name: 'kg_edge',
    public: true,
    indexes: [
      { accessor: 'tenant_source_rel', algorithm: 'btree', columns: ['tenant_id', 'source_vertex_id', 'relation_type'] },
      { accessor: 'tenant_target_rel', algorithm: 'btree', columns: ['tenant_id', 'target_vertex_id', 'relation_type'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    source_vertex_id: t.u64().index('btree'),
    target_vertex_id: t.u64().index('btree'),
    relation_type: relationType,
    properties: t.string(), // JSON
    weight: t.option(t.f32()),
    created_at: t.timestamp(),
  }
);

// ---------------------------------------------------------------------------
// Auth Table
// ---------------------------------------------------------------------------

const tenantMember = table(
  { name: 'tenant_member', public: true },
  {
    identity: t.identity().primaryKey(),
    tenant_id: t.u64().index('btree'),
  }
);

const workflows = table(
  { name: 'workflows', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    name: t.string(),
    description: t.string(),
    trigger_type: t.string(),
    trigger_config: t.string(),
    steps: t.string(),
    status: t.string(),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

const workflowExecutions = table(
  { name: 'workflow_executions', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    workflow_id: t.u64().index('btree'),
    tenant_id: t.u64().index('btree'),
    status: t.string(),
    started_at: t.timestamp(),
    completed_at: t.option(t.timestamp()),
    logs: t.string(),
  }
);

const dealStageHistory = table(
  { name: 'deal_stage_history', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    deal_id: t.u64().index('btree'),
    from_stage_id: t.option(t.u64()),
    to_stage_id: t.u64(),
    moved_by: t.option(t.u64()),
    moved_at: t.timestamp(),
  }
);

const socialCampaigns = table(
  { name: 'social_campaigns', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    name: t.string(),
    theme: t.string(),
    objective: campaignObjective,
    platforms: t.string(), // JSON array of platform tags
    start_date: t.timestamp(),
    end_date: t.timestamp(),
    status: campaignStatus,
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

const socialPosts = table(
  { name: 'social_posts', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    tenant_id: t.u64().index('btree'),
    campaign_id: t.option(t.u64()),
    platform: socialPostPlatform,
    content: t.string(),
    image_url: t.option(t.string()),
    hashtags: t.string(), // JSON array
    scheduled_at: t.timestamp(),
    published_at: t.option(t.timestamp()),
    status: socialPostStatus,
    target_audience: t.option(t.string()),
    engagement_estimate: t.option(t.u32()),
    metadata: t.string(), // JSON for platform extras
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  }
);

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const spacetimedb = schema({
  users,
  contacts,
  companies,
  pipelines,
  pipeline_stages: pipelineStages,
  deals,
  activities,
  conversations,
  messages,
  products,
  invoices,
  invoice_items: invoiceItems,
  payments,
  documents,
  memories,
  memory_collections: memoryCollections,
  kg_vertex: kgVertex,
  kg_edge: kgEdge,
  tenant_member: tenantMember,
  workflows,
  workflow_executions: workflowExecutions,
  deal_stage_history: dealStageHistory,
  social_campaigns: socialCampaigns,
  social_posts: socialPosts,
});

export default spacetimedb;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

function requireTenant(_ctx: any, _tenantId: bigint): void {
  // Demo mode: auth disabled for local standalone demo
}

// ---------------------------------------------------------------------------
// KG sync helpers
// ---------------------------------------------------------------------------

function safeJsonStringify(obj: any): string {
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'bigint') return Number(value);
    return value;
  });
}

function syncKgVertex(
  ctx: any,
  tenantId: bigint,
  entityType: any,
  sourceTable: string,
  sourceId: bigint,
  properties: any
): void {
  let existing: any;
  for (const v of ctx.db.kg_vertex.iter()) {
    if (v.tenant_id === tenantId && v.source_table === sourceTable && v.source_id === sourceId) {
      existing = v;
      break;
    }
  }
  if (existing) {
    ctx.db.kg_vertex.id.update({
      ...existing,
      properties: safeJsonStringify(properties),
      updated_at: ctx.timestamp,
    });
  } else {
    ctx.db.kg_vertex.insert({
      id: 0n,
      tenant_id: tenantId,
      entity_type: entityType,
      source_table: sourceTable,
      source_id: sourceId,
      properties: safeJsonStringify(properties),
      vector_embedding: undefined,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
  }
}

function deleteKgVertex(ctx: any, sourceTable: string, sourceId: bigint): void {
  for (const v of ctx.db.kg_vertex.iter()) {
    if (v.source_table === sourceTable && v.source_id === sourceId) {
      const edgesToDelete = [];
      for (const e of ctx.db.kg_edge.iter()) {
        if (e.source_vertex_id === v.id || e.target_vertex_id === v.id) {
          edgesToDelete.push(e.id);
        }
      }
      for (const edgeId of edgesToDelete) {
        ctx.db.kg_edge.id.delete(edgeId);
      }
      ctx.db.kg_vertex.id.delete(v.id);
      break;
    }
  }
}

function deleteMessagesForConversation(ctx: any, conversationId: bigint): void {
  const toDelete: bigint[] = [];
  for (const msg of ctx.db.messages.iter()) {
    if (msg.conversation_id === conversationId) {
      toDelete.push(msg.id);
    }
  }
  for (const msgId of toDelete) {
    deleteKgVertex(ctx, 'messages', msgId);
    ctx.db.messages.id.delete(msgId);
  }
}

function deleteConversationsForContact(ctx: any, contactId: bigint): void {
  const toDelete: bigint[] = [];
  for (const conv of ctx.db.conversations.iter()) {
    if (conv.contact_id === contactId) {
      toDelete.push(conv.id);
    }
  }
  for (const convId of toDelete) {
    deleteMessagesForConversation(ctx, convId);
    deleteKgVertex(ctx, 'conversations', convId);
    ctx.db.conversations.id.delete(convId);
  }
}

function deleteActivitiesForContact(ctx: any, contactId: bigint): void {
  const toDelete: bigint[] = [];
  for (const act of ctx.db.activities.iter()) {
    if (act.contact_id !== undefined && act.contact_id === contactId) {
      toDelete.push(act.id);
    }
  }
  for (const actId of toDelete) {
    deleteKgVertex(ctx, 'activities', actId);
    ctx.db.activities.id.delete(actId);
  }
}

function deleteActivitiesForDeal(ctx: any, dealId: bigint): void {
  const toDelete: bigint[] = [];
  for (const act of ctx.db.activities.iter()) {
    if (act.deal_id !== undefined && act.deal_id === dealId) {
      toDelete.push(act.id);
    }
  }
  for (const actId of toDelete) {
    deleteKgVertex(ctx, 'activities', actId);
    ctx.db.activities.id.delete(actId);
  }
}

function deletePaymentsForContact(ctx: any, contactId: bigint): void {
  const toDelete: bigint[] = [];
  for (const p of ctx.db.payments.iter()) {
    if (p.contact_id === contactId) {
      toDelete.push(p.id);
    }
  }
  for (const pId of toDelete) {
    deleteKgVertex(ctx, 'payments', pId);
    ctx.db.payments.id.delete(pId);
  }
}

function deletePaymentsForInvoice(ctx: any, invoiceId: bigint): void {
  const toDelete: bigint[] = [];
  for (const p of ctx.db.payments.iter()) {
    if (p.invoice_id !== undefined && p.invoice_id === invoiceId) {
      toDelete.push(p.id);
    }
  }
  for (const pId of toDelete) {
    deleteKgVertex(ctx, 'payments', pId);
    ctx.db.payments.id.delete(pId);
  }
}

function deleteMemoriesForEntity(ctx: any, sourceTable: string, sourceId: bigint): void {
  const toDelete: bigint[] = [];
  for (const mem of ctx.db.memories.iter()) {
    if (mem.source_table !== undefined && mem.source_id !== undefined &&
        mem.source_table === sourceTable && mem.source_id === sourceId) {
      toDelete.push(mem.id);
    }
  }
  for (const memId of toDelete) {
    deleteKgVertex(ctx, 'memories', memId);
    ctx.db.memories.id.delete(memId);
  }
}

function deleteContainersForEntity(ctx: any, sourceTable: string, sourceId: bigint): void {
  const toDelete: bigint[] = [];
  for (const coll of ctx.db.memory_collections.iter()) {
    if (coll.source_table !== undefined && coll.source_id !== undefined &&
        coll.source_table === sourceTable && coll.source_id === sourceId) {
      toDelete.push(coll.id);
    }
  }
  for (const collId of toDelete) {
    deleteKgVertex(ctx, 'memory_collections', collId);
    ctx.db.memory_collections.id.delete(collId);
  }
}

function unlinkCompany(ctx: any, companyId: bigint): void {
  for (const contact of ctx.db.contacts.iter()) {
    if (contact.company_id !== undefined && contact.company_id === companyId) {
      ctx.db.contacts.id.update({ ...contact, company_id: undefined });
    }
  }
  for (const deal of ctx.db.deals.iter()) {
    if (deal.company_id !== undefined && deal.company_id === companyId) {
      ctx.db.deals.id.update({ ...deal, company_id: undefined });
    }
  }
}

function pruneEntityKnowledgeBase(
  ctx: any,
  sourceTable: string,
  sourceId: bigint
): void {
  deleteMemoriesForEntity(ctx, sourceTable, sourceId);
  deleteContainersForEntity(ctx, sourceTable, sourceId);
}

function createKgEdge(
  ctx: any,
  tenantId: bigint,
  sourceVertexId: bigint,
  targetVertexId: bigint,
  relationType: any,
  properties?: any
): void {
  ctx.db.kg_edge.insert({
    id: 0n,
    tenant_id: tenantId,
    source_vertex_id: sourceVertexId,
    target_vertex_id: targetVertexId,
    relation_type: relationType,
    properties: safeJsonStringify(properties ?? {}),
    weight: undefined,
    created_at: ctx.timestamp,
  });
}

function findKgVertexId(ctx: any, tenantId: bigint, sourceTable: string, sourceId: bigint): bigint | undefined {
  for (const v of ctx.db.kg_vertex.iter()) {
    if (v.tenant_id === tenantId && v.source_table === sourceTable && v.source_id === sourceId) {
      return v.id;
    }
  }
  return undefined;
}

function deleteKgEdgesForVertex(ctx: any, vertexId: bigint): void {
  const edgesToDelete = [];
  for (const e of ctx.db.kg_edge.iter()) {
    if (e.source_vertex_id === vertexId || e.target_vertex_id === vertexId) {
      edgesToDelete.push(e.id);
    }
  }
  for (const edgeId of edgesToDelete) {
    ctx.db.kg_edge.id.delete(edgeId);
  }
}

function deleteEdgesByRelation(
  ctx: any,
  sourceVertexId: bigint,
  targetVertexId: bigint,
  relationTypeTag: string
): void {
  for (const e of ctx.db.kg_edge.iter()) {
    if (
      e.source_vertex_id === sourceVertexId &&
      e.target_vertex_id === targetVertexId &&
      e.relation_type.tag === relationTypeTag
    ) {
      ctx.db.kg_edge.id.delete(e.id);
    }
  }
}

function syncKgEdge(
  ctx: any,
  tenantId: bigint,
  sourceVertexId: bigint,
  targetVertexId: bigint,
  relationType: any,
  properties?: any,
  weight?: number
): void {
  for (const e of ctx.db.kg_edge.iter()) {
    if (
      e.tenant_id === tenantId &&
      e.source_vertex_id === sourceVertexId &&
      e.target_vertex_id === targetVertexId &&
      e.relation_type.tag === relationType.tag
    ) {
      ctx.db.kg_edge.id.update({
        ...e,
        properties: safeJsonStringify(properties ?? {}),
        weight: weight ?? e.weight,
      });
      return;
    }
  }
  ctx.db.kg_edge.insert({
    id: 0n,
    tenant_id: tenantId,
    source_vertex_id: sourceVertexId,
    target_vertex_id: targetVertexId,
    relation_type: relationType,
    properties: safeJsonStringify(properties ?? {}),
    weight: weight ?? undefined,
    created_at: ctx.timestamp,
  });
}

const MAX_COLLECTIONS_PER_TENANT = 1000;

function countCollectionsForTenant(ctx: any, tenantId: bigint): number {
  let count = 0;
  for (const coll of ctx.db.memory_collections.iter()) {
    if (coll.tenant_id === tenantId) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export const init = spacetimedb.init((_ctx: any) => {
  console.info('Malaysian SME CRM module initialized');
});

export const onConnect = spacetimedb.clientConnected((_ctx: any) => {});
export const onDisconnect = spacetimedb.clientDisconnected((_ctx: any) => {});

// ---------------------------------------------------------------------------
// User reducers
// ---------------------------------------------------------------------------

export const createUser = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    email: t.string(),
    name: t.string(),
    role: userRole,
    avatar_url: t.option(t.string()),
  },
  (ctx: any, { tenant_id, email, name, role, avatar_url }) => {
    requireTenant(ctx, tenant_id);
    const user = ctx.db.users.insert({
      id: 0n,
      tenant_id,
      email,
      name,
      role,
      avatar_url,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
    syncKgVertex(ctx, tenant_id, { tag: 'User' }, 'users', user.id, { email, name, role: role.tag });
  }
);

export const updateUser = spacetimedb.reducer(
  {
    id: t.u64(),
    name: t.string(),
    role: userRole,
    avatar_url: t.option(t.string()),
  },
  (ctx: any, { id, name, role, avatar_url }) => {
    const user = ctx.db.users.id.find(id);
    if (!user) throw new Error('User not found');
    requireTenant(ctx, user.tenant_id);
    ctx.db.users.id.update({ ...user, name, role, avatar_url, updated_at: ctx.timestamp });
    syncKgVertex(ctx, user.tenant_id, { tag: 'User' }, 'users', id, { email: user.email, name, role: role.tag });
  }
);

export const deleteUser = spacetimedb.reducer(
  { id: t.u64() },
  (ctx: any, { id }) => {
    const user = ctx.db.users.id.find(id);
    if (!user) throw new Error('User not found');
    requireTenant(ctx, user.tenant_id);
    // Unlink assigned contacts
    for (const contact of ctx.db.contacts.iter()) {
      if (contact.assigned_to !== undefined && contact.assigned_to === id) {
        ctx.db.contacts.id.update({ ...contact, assigned_to: undefined });
      }
    }
    deleteKgVertex(ctx, 'users', id);
    ctx.db.users.id.delete(id);
  }
);

// ---------------------------------------------------------------------------
// Contact reducers
// ---------------------------------------------------------------------------

export const createContact = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    email: t.string(),
    phone: t.string(),
    name: t.string(),
    company_id: t.option(t.u64()),
    source: contactSource,
    status: contactStatus,
    assigned_to: t.option(t.u64()),
    custom_fields: t.string(),
  },
  (ctx: any, { tenant_id, email, phone, name, company_id, source, status, assigned_to, custom_fields }) => {
    requireTenant(ctx, tenant_id);
    const contact = ctx.db.contacts.insert({
      id: 0n,
      tenant_id,
      email,
      phone,
      name,
      company_id,
      source,
      status,
      assigned_to,
      custom_fields,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
    syncKgVertex(ctx, tenant_id, { tag: 'Contact' }, 'contacts', contact.id, { email, phone, name, status: status.tag });

    if (company_id !== undefined) {
      const companyVertexId = findKgVertexId(ctx, tenant_id, 'companies', company_id);
      const contactVertexId = findKgVertexId(ctx, tenant_id, 'contacts', contact.id);
      if (companyVertexId && contactVertexId) {
        createKgEdge(ctx, tenant_id, contactVertexId, companyVertexId, { tag: 'WorksAt' });
      }
    }

  }
);

export const updateContact = spacetimedb.reducer(
  {
    id: t.u64(),
    email: t.string(),
    phone: t.string(),
    name: t.string(),
    company_id: t.option(t.u64()),
    status: contactStatus,
    assigned_to: t.option(t.u64()),
    custom_fields: t.string(),
  },
  (ctx: any, { id, email, phone, name, company_id, status, assigned_to, custom_fields }) => {
    const contact = ctx.db.contacts.id.find(id);
    if (!contact) throw new Error('Contact not found');
    requireTenant(ctx, contact.tenant_id);
    ctx.db.contacts.id.update({
      ...contact,
      email,
      phone,
      name,
      company_id,
      status,
      assigned_to,
      custom_fields,
      updated_at: ctx.timestamp,
    });
    syncKgVertex(ctx, contact.tenant_id, { tag: 'Contact' }, 'contacts', id, { email, phone, name, status: status.tag });

    const contactVertexId = findKgVertexId(ctx, contact.tenant_id, 'contacts', id);
    if (contactVertexId) {
      // Delete old WorksAt edge if company changed
      if (contact.company_id !== undefined && contact.company_id !== company_id) {
        const oldCompanyVertexId = findKgVertexId(ctx, contact.tenant_id, 'companies', contact.company_id);
        if (oldCompanyVertexId) {
          deleteEdgesByRelation(ctx, contactVertexId, oldCompanyVertexId, 'WorksAt');
        }
      }
      // Create new WorksAt edge
      if (company_id !== undefined) {
        const companyVertexId = findKgVertexId(ctx, contact.tenant_id, 'companies', company_id);
        if (companyVertexId) {
          syncKgEdge(ctx, contact.tenant_id, contactVertexId, companyVertexId, { tag: 'WorksAt' });
        }
      }
      // AssignedTo edge
      if (assigned_to !== undefined) {
        const userVertexId = findKgVertexId(ctx, contact.tenant_id, 'users', assigned_to);
        if (userVertexId) {
          syncKgEdge(ctx, contact.tenant_id, contactVertexId, userVertexId, { tag: 'AssignedTo' });
        }
      }
    }
  }
);

export const deleteContact = spacetimedb.reducer(
  { id: t.u64() },
  (ctx: any, { id }) => {
    const contact = ctx.db.contacts.id.find(id);
    if (!contact) throw new Error('Contact not found');
    requireTenant(ctx, contact.tenant_id);
    // Cascade delete dependent knowledge base + operational data
    pruneEntityKnowledgeBase(ctx, 'contacts', id);
    deleteActivitiesForContact(ctx, id);
    deleteConversationsForContact(ctx, id);
    deletePaymentsForContact(ctx, id);
    deleteKgVertex(ctx, 'contacts', id);
    ctx.db.contacts.id.delete(id);
  }
);

// ---------------------------------------------------------------------------
// Bulk contact operations
// ---------------------------------------------------------------------------

export const bulkDeleteContacts = spacetimedb.reducer(
  { ids_json: t.string() },
  (ctx: any, { ids_json }) => {
    let parsed: number[];
    try {
      parsed = JSON.parse(ids_json);
    } catch (_e) {
      throw new Error('Invalid JSON in ids_json');
    }
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('ids_json must be a non-empty array');
    const ids = parsed.map((id) => BigInt(id));

    for (const id of ids) {
      const contact = ctx.db.contacts.id.find(id);
      if (!contact) continue;
      requireTenant(ctx, contact.tenant_id);
      pruneEntityKnowledgeBase(ctx, 'contacts', id);
      deleteActivitiesForContact(ctx, id);
      deleteConversationsForContact(ctx, id);
      deletePaymentsForContact(ctx, id);
      deleteKgVertex(ctx, 'contacts', id);
      ctx.db.contacts.id.delete(id);
    }
  }
);

export const bulkUpdateContactStatus = spacetimedb.reducer(
  { ids_json: t.string(), status: contactStatus },
  (ctx: any, { ids_json, status }) => {
    let parsed: number[];
    try {
      parsed = JSON.parse(ids_json);
    } catch (_e) {
      throw new Error('Invalid JSON in ids_json');
    }
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('ids_json must be a non-empty array');
    const ids = parsed.map((id) => BigInt(id));

    for (const id of ids) {
      const contact = ctx.db.contacts.id.find(id);
      if (!contact) continue;
      requireTenant(ctx, contact.tenant_id);
      ctx.db.contacts.id.update({
        ...contact,
        status,
        updated_at: ctx.timestamp,
      });
      syncKgVertex(ctx, contact.tenant_id, { tag: 'Contact' }, 'contacts', id, {
        email: contact.email, phone: contact.phone, name: contact.name, status: status.tag,
      });
    }
  }
);

export const bulkUpdateContactAssignedTo = spacetimedb.reducer(
  { ids_json: t.string(), assigned_to: t.option(t.u64()) },
  (ctx: any, { ids_json, assigned_to }) => {
    let parsed: number[];
    try {
      parsed = JSON.parse(ids_json);
    } catch (_e) {
      throw new Error('Invalid JSON in ids_json');
    }
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('ids_json must be a non-empty array');
    const ids = parsed.map((id) => BigInt(id));

    for (const id of ids) {
      const contact = ctx.db.contacts.id.find(id);
      if (!contact) continue;
      requireTenant(ctx, contact.tenant_id);
      ctx.db.contacts.id.update({
        ...contact,
        assigned_to,
        updated_at: ctx.timestamp,
      });
      syncKgVertex(ctx, contact.tenant_id, { tag: 'Contact' }, 'contacts', id, {
        email: contact.email, phone: contact.phone, name: contact.name, status: contact.status.tag,
      });

      const contactVertexId = findKgVertexId(ctx, contact.tenant_id, 'contacts', id);
      if (contactVertexId) {
        // Remove old AssignedTo edges
        for (const e of ctx.db.kg_edge.iter()) {
          if (e.source_vertex_id === contactVertexId && e.relation_type.tag === 'AssignedTo') {
            ctx.db.kg_edge.id.delete(e.id);
          }
        }
        // Create new edge if assigned
        if (assigned_to !== undefined) {
          const userVertexId = findKgVertexId(ctx, contact.tenant_id, 'users', assigned_to);
          if (userVertexId) {
            syncKgEdge(ctx, contact.tenant_id, contactVertexId, userVertexId, { tag: 'AssignedTo' });
          }
        }
      }
    }
  }
);

// ---------------------------------------------------------------------------
// Bulk import contacts from CSV
// ---------------------------------------------------------------------------

export const bulkImportContacts = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    contacts_json: t.string(),
  },
  (ctx: any, { tenant_id, contacts_json }) => {
    requireTenant(ctx, tenant_id);

    interface CsvContactRow {
      name: string;
      email: string;
      phone?: string;
      company_name?: string;
      source?: string;
      status?: string;
      assigned_to_name?: string;
    }

    let rows: CsvContactRow[];
    try {
      rows = JSON.parse(contacts_json);
    } catch (_e) {
      throw new Error('Invalid JSON in contacts_json');
    }
    if (!Array.isArray(rows)) throw new Error('contacts_json must be an array');

    // Build lookup maps for company/user names
    const companyMap = new Map<string, bigint>();
    for (const c of ctx.db.companies.iter()) {
      if (c.tenant_id === tenant_id) {
        companyMap.set(c.name.toLowerCase(), c.id);
      }
    }

    const userMap = new Map<string, bigint>();
    for (const u of ctx.db.users.iter()) {
      if (u.tenant_id === tenant_id) {
        userMap.set(u.name.toLowerCase(), u.id);
      }
    }

    // Valid enum values (lowercased for matching)
    const validSources = new Set(['whatsapp', 'tiktok', 'email', 'website', 'manual', 'pos', 'referral']);
    const validStatuses = new Set(['lead', 'prospect', 'customer', 'churned']);

    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      if (!row.name || !row.email) {
        skipped++;
        continue;
      }

      // Resolve company by name
      let company_id: bigint | undefined;
      if (row.company_name) {
        const cid = companyMap.get(row.company_name.toLowerCase());
        if (cid !== undefined) company_id = cid;
      }

      // Resolve assigned user by name
      let assigned_to: bigint | undefined;
      if (row.assigned_to_name) {
        const uid = userMap.get(row.assigned_to_name.toLowerCase());
        if (uid !== undefined) assigned_to = uid;
      }

      // Normalize source
      const sourceRaw = (row.source ?? 'Manual').toLowerCase().trim();
      let sourceTag = 'Manual';
      if (validSources.has(sourceRaw)) {
        sourceTag = sourceRaw.charAt(0).toUpperCase() + sourceRaw.slice(1);
      }

      // Normalize status
      const statusRaw = (row.status ?? 'Lead').toLowerCase().trim();
      let statusTag = 'Lead';
      if (validStatuses.has(statusRaw)) {
        statusTag = statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1);
      }

      const contact = ctx.db.contacts.insert({
        id: 0n,
        tenant_id,
        email: row.email.trim(),
        phone: (row.phone ?? '').trim(),
        name: row.name.trim(),
        company_id: company_id !== undefined ? { tag: 'some', value: company_id } as any : undefined,
        source: { tag: sourceTag } as any,
        status: { tag: statusTag } as any,
        assigned_to: assigned_to !== undefined ? { tag: 'some', value: assigned_to } as any : undefined,
        custom_fields: '{}',
        created_at: ctx.timestamp,
        updated_at: ctx.timestamp,
      });
      imported++;

      syncKgVertex(ctx, tenant_id, { tag: 'Contact' }, 'contacts', contact.id, {
        email: row.email.trim(),
        phone: (row.phone ?? '').trim(),
        name: row.name.trim(),
        status: statusTag,
      });

      if (company_id !== undefined) {
        const companyVertexId = findKgVertexId(ctx, tenant_id, 'companies', company_id);
        const contactVertexId = findKgVertexId(ctx, tenant_id, 'contacts', contact.id);
        if (companyVertexId && contactVertexId) {
          createKgEdge(ctx, tenant_id, contactVertexId, companyVertexId, { tag: 'WorksAt' });
        }
      }

    }

    if (imported === 0) {
      throw new Error(`No valid contacts to import. ${skipped} rows skipped (missing name or email).`);
    }
  }
);

// ---------------------------------------------------------------------------
// Company reducers
// ---------------------------------------------------------------------------

export const createCompany = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    name: t.string(),
    registration_number: t.option(t.string()),
    industry: t.option(t.string()),
    phone: t.option(t.string()),
    email: t.option(t.string()),
    website: t.option(t.string()),
    address: t.string(),
    billing_address: t.string(),
    notes: t.string(),
  },
  (ctx: any, { tenant_id, name, registration_number, industry, phone, email, website, address, billing_address, notes }) => {
    requireTenant(ctx, tenant_id);
    const company = ctx.db.companies.insert({
      id: 0n,
      tenant_id,
      name,
      registration_number,
      industry,
      phone,
      email,
      website,
      address,
      billing_address,
      notes,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
    syncKgVertex(ctx, tenant_id, { tag: 'Company' }, 'companies', company.id, { name, registration_number, industry, email, phone });

  }
);

export const updateCompany = spacetimedb.reducer(
  {
    id: t.u64(),
    name: t.string(),
    registration_number: t.option(t.string()),
    industry: t.option(t.string()),
    phone: t.option(t.string()),
    email: t.option(t.string()),
    website: t.option(t.string()),
    address: t.string(),
    billing_address: t.string(),
    notes: t.string(),
  },
  (ctx: any, { id, name, registration_number, industry, phone, email, website, address, billing_address, notes }) => {
    const company = ctx.db.companies.id.find(id);
    if (!company) throw new Error('Company not found');
    requireTenant(ctx, company.tenant_id);
    ctx.db.companies.id.update({
      ...company,
      name,
      registration_number,
      industry,
      phone,
      email,
      website,
      address,
      billing_address,
      notes,
      updated_at: ctx.timestamp,
    });
    syncKgVertex(ctx, company.tenant_id, { tag: 'Company' }, 'companies', id, { name, registration_number, industry, email, phone });
  }
);

export const deleteCompany = spacetimedb.reducer(
  { id: t.u64() },
  (ctx: any, { id }) => {
    const company = ctx.db.companies.id.find(id);
    if (!company) throw new Error('Company not found');
    requireTenant(ctx, company.tenant_id);
    // Unlink from contacts and deals before pruning
    unlinkCompany(ctx, id);
    pruneEntityKnowledgeBase(ctx, 'companies', id);
    deleteKgVertex(ctx, 'companies', id);
    ctx.db.companies.id.delete(id);
  }
);

// ---------------------------------------------------------------------------
// Bulk company operations
// ---------------------------------------------------------------------------

export const bulkDeleteCompanies = spacetimedb.reducer(
  { ids_json: t.string() },
  (ctx: any, { ids_json }) => {
    let parsed: number[];
    try {
      parsed = JSON.parse(ids_json);
    } catch (_e) {
      throw new Error('Invalid JSON in ids_json');
    }
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('ids_json must be a non-empty array');
    const ids = parsed.map((id) => BigInt(id));

    for (const id of ids) {
      const company = ctx.db.companies.id.find(id);
      if (!company) continue;
      requireTenant(ctx, company.tenant_id);
      unlinkCompany(ctx, id);
      pruneEntityKnowledgeBase(ctx, 'companies', id);
      deleteKgVertex(ctx, 'companies', id);
      ctx.db.companies.id.delete(id);
    }
  }
);

// ---------------------------------------------------------------------------
// Pipeline & Stage reducers
// ---------------------------------------------------------------------------

export const createPipeline = spacetimedb.reducer(
  { tenant_id: t.u64(), name: t.string() },
  (ctx: any, { tenant_id, name }) => {
    requireTenant(ctx, tenant_id);
    ctx.db.pipelines.insert({
      id: 0n,
      tenant_id,
      name,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
  }
);

export const updatePipeline = spacetimedb.reducer(
  { id: t.u64(), name: t.string() },
  (ctx: any, { id, name }) => {
    const pipeline = ctx.db.pipelines.id.find(id);
    if (!pipeline) throw new Error('Pipeline not found');
    requireTenant(ctx, pipeline.tenant_id);
    ctx.db.pipelines.id.update({ ...pipeline, name, updated_at: ctx.timestamp });
  }
);

export const deletePipeline = spacetimedb.reducer(
  { id: t.u64() },
  (ctx: any, { id }) => {
    const pipeline = ctx.db.pipelines.id.find(id);
    if (!pipeline) throw new Error('Pipeline not found');
    requireTenant(ctx, pipeline.tenant_id);
    // Delete associated stages
    for (const stage of ctx.db.pipeline_stages.iter()) {
      if (stage.pipeline_id === id && stage.tenant_id === pipeline.tenant_id) {
        ctx.db.pipeline_stages.id.delete(stage.id);
      }
    }
    ctx.db.pipelines.id.delete(id);
  }
);

export const createPipelineStage = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    pipeline_id: t.u64(),
    name: t.string(),
    order_index: t.u32(),
    win_probability: t.u8(),
  },
  (ctx: any, { tenant_id, pipeline_id, name, order_index, win_probability }) => {
    requireTenant(ctx, tenant_id);
    const stage = ctx.db.pipeline_stages.insert({
      id: 0n,
      tenant_id,
      pipeline_id,
      name,
      order_index,
      win_probability,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
    syncKgVertex(ctx, tenant_id, { tag: 'PipelineStage' }, 'pipeline_stages', stage.id, { name, order_index, win_probability });
    const stageVertexId = findKgVertexId(ctx, tenant_id, 'pipeline_stages', stage.id);
    const pipelineVertexId = findKgVertexId(ctx, tenant_id, 'pipelines', pipeline_id);
    if (stageVertexId && pipelineVertexId) {
      syncKgEdge(ctx, tenant_id, stageVertexId, pipelineVertexId, { tag: 'InPipeline' });
    }
  }
);

export const updatePipelineStage = spacetimedb.reducer(
  {
    id: t.u64(),
    name: t.string(),
    order_index: t.u32(),
    win_probability: t.u8(),
  },
  (ctx: any, { id, name, order_index, win_probability }) => {
    const stage = ctx.db.pipeline_stages.id.find(id);
    if (!stage) throw new Error('Stage not found');
    requireTenant(ctx, stage.tenant_id);
    ctx.db.pipeline_stages.id.update({
      ...stage,
      name,
      order_index,
      win_probability,
      updated_at: ctx.timestamp,
    });
  }
);

export const deletePipelineStage = spacetimedb.reducer(
  { id: t.u64() },
  (ctx: any, { id }) => {
    const stage = ctx.db.pipeline_stages.id.find(id);
    if (!stage) throw new Error('Stage not found');
    requireTenant(ctx, stage.tenant_id);
    ctx.db.pipeline_stages.id.delete(id);
  }
);

export const reorderStages = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    stage_ids: t.array(t.u64()),
  },
  (ctx: any, { tenant_id, stage_ids }) => {
    requireTenant(ctx, tenant_id);
    for (let i = 0; i < stage_ids.length; i++) {
      const stage = ctx.db.pipeline_stages.id.find(stage_ids[i]);
      if (stage && stage.tenant_id === tenant_id) {
        ctx.db.pipeline_stages.id.update({ ...stage, order_index: i });
      }
    }
  }
);

// ---------------------------------------------------------------------------
// Deal reducers
// ---------------------------------------------------------------------------

export const createDeal = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    name: t.string(),
    contact_id: t.u64(),
    company_id: t.option(t.u64()),
    pipeline_id: t.u64(),
    stage_id: t.u64(),
    value: t.u64(),
    currency: t.string(),
    probability: t.u8(),
    expected_close: t.option(t.timestamp()),
  },
  (ctx: any, { tenant_id, name, contact_id, company_id, pipeline_id, stage_id, value, currency, probability, expected_close }) => {
    requireTenant(ctx, tenant_id);
    const deal = ctx.db.deals.insert({
      id: 0n,
      tenant_id,
      name,
      contact_id,
      company_id,
      pipeline_id,
      stage_id,
      value,
      currency,
      probability,
      expected_close,
      actual_close: undefined,
      status: { tag: 'Open' },
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
    syncKgVertex(ctx, tenant_id, { tag: 'Deal' }, 'deals', deal.id, { name, value, currency, probability });

    const dealVertexId = findKgVertexId(ctx, tenant_id, 'deals', deal.id);
    const contactVertexId = findKgVertexId(ctx, tenant_id, 'contacts', contact_id);
    if (dealVertexId && contactVertexId) {
      createKgEdge(ctx, tenant_id, dealVertexId, contactVertexId, { tag: 'BelongsTo' });
    }
    if (company_id !== undefined && dealVertexId) {
      const companyVertexId = findKgVertexId(ctx, tenant_id, 'companies', company_id);
      if (companyVertexId) {
        createKgEdge(ctx, tenant_id, dealVertexId, companyVertexId, { tag: 'RelatedTo' });
      }
    }

  }
);

export const updateDeal = spacetimedb.reducer(
  {
    id: t.u64(),
    name: t.string(),
    contact_id: t.u64(),
    company_id: t.option(t.u64()),
    pipeline_id: t.u64(),
    stage_id: t.u64(),
    value: t.u64(),
    currency: t.string(),
    probability: t.u8(),
    expected_close: t.option(t.timestamp()),
  },
  (ctx: any, { id, name, contact_id, company_id, pipeline_id, stage_id, value, currency, probability, expected_close }) => {
    const deal = ctx.db.deals.id.find(id);
    if (!deal) throw new Error('Deal not found');
    requireTenant(ctx, deal.tenant_id);
    ctx.db.deals.id.update({
      ...deal,
      name,
      contact_id,
      company_id,
      pipeline_id,
      stage_id,
      value,
      currency,
      probability,
      expected_close,
      updated_at: ctx.timestamp,
    });
    syncKgVertex(ctx, deal.tenant_id, { tag: 'Deal' }, 'deals', id, { name, value, currency, probability });

    const dealVertexId = findKgVertexId(ctx, deal.tenant_id, 'deals', id);
    if (dealVertexId) {
      // Delete old BelongsTo edge if contact changed
      if (deal.contact_id !== contact_id) {
        const oldContactVertexId = findKgVertexId(ctx, deal.tenant_id, 'contacts', deal.contact_id);
        if (oldContactVertexId) {
          deleteEdgesByRelation(ctx, dealVertexId, oldContactVertexId, 'BelongsTo');
        }
      }
      // Create new BelongsTo edge
      const contactVertexId = findKgVertexId(ctx, deal.tenant_id, 'contacts', contact_id);
      if (contactVertexId) {
        syncKgEdge(ctx, deal.tenant_id, dealVertexId, contactVertexId, { tag: 'BelongsTo' });
      }
      // Delete old RelatedTo edge if company changed
      if (deal.company_id !== undefined && deal.company_id !== company_id) {
        const oldCompanyVertexId = findKgVertexId(ctx, deal.tenant_id, 'companies', deal.company_id);
        if (oldCompanyVertexId) {
          deleteEdgesByRelation(ctx, dealVertexId, oldCompanyVertexId, 'RelatedTo');
        }
      }
      // Create new RelatedTo edge
      if (company_id !== undefined) {
        const companyVertexId = findKgVertexId(ctx, deal.tenant_id, 'companies', company_id);
        if (companyVertexId) {
          syncKgEdge(ctx, deal.tenant_id, dealVertexId, companyVertexId, { tag: 'RelatedTo' });
        }
      }
    }
  }
);

export const moveDealStage = spacetimedb.reducer(
  { id: t.u64(), stage_id: t.u64() },
  (ctx: any, { id, stage_id }) => {
    const deal = ctx.db.deals.id.find(id);
    if (!deal) throw new Error('Deal not found');
    requireTenant(ctx, deal.tenant_id);
    const stage = ctx.db.pipeline_stages.id.find(stage_id);
    if (!stage) throw new Error('Stage not found');
    ctx.db.deals.id.update({ ...deal, stage_id, probability: stage.win_probability, updated_at: ctx.timestamp });
    ctx.db.deal_stage_history.insert({
      id: 0n,
      tenant_id: deal.tenant_id,
      deal_id: id,
      from_stage_id: deal.stage_id,
      to_stage_id: stage_id,
      moved_by: undefined,
      moved_at: ctx.timestamp,
    });

    syncKgVertex(ctx, deal.tenant_id, { tag: 'Deal' }, 'deals', id, { name: deal.name, value: deal.value, currency: deal.currency, probability: stage.win_probability, status: deal.status.tag });
    // Update AtStage edge
    const dealVertexId = findKgVertexId(ctx, deal.tenant_id, 'deals', id);
    const newStageVertexId = findKgVertexId(ctx, deal.tenant_id, 'pipeline_stages', stage_id);
    if (dealVertexId && newStageVertexId) {
      // Delete old AtStage edges
      for (const e of ctx.db.kg_edge.iter()) {
        if (e.source_vertex_id === dealVertexId && e.relation_type.tag === 'AtStage') {
          ctx.db.kg_edge.id.delete(e.id);
        }
      }
      syncKgEdge(ctx, deal.tenant_id, dealVertexId, newStageVertexId, { tag: 'AtStage' }, { moved_at: ctx.timestamp.toISOString() });
    }
  }
);

export const winDeal = spacetimedb.reducer(
  { id: t.u64() },
  (ctx: any, { id }) => {
    const deal = ctx.db.deals.id.find(id);
    if (!deal) throw new Error('Deal not found');
    requireTenant(ctx, deal.tenant_id);
    ctx.db.deals.id.update({ ...deal, status: { tag: 'Won' }, actual_close: ctx.timestamp, updated_at: ctx.timestamp });
  }
);

export const loseDeal = spacetimedb.reducer(
  { id: t.u64() },
  (ctx: any, { id }) => {
    const deal = ctx.db.deals.id.find(id);
    if (!deal) throw new Error('Deal not found');
    requireTenant(ctx, deal.tenant_id);
    ctx.db.deals.id.update({ ...deal, status: { tag: 'Lost' }, actual_close: ctx.timestamp, updated_at: ctx.timestamp });
  }
);

export const deleteDeal = spacetimedb.reducer(
  { id: t.u64() },
  (ctx: any, { id }) => {
    const deal = ctx.db.deals.id.find(id);
    if (!deal) throw new Error('Deal not found');
    requireTenant(ctx, deal.tenant_id);
    pruneEntityKnowledgeBase(ctx, 'deals', id);
    deleteActivitiesForDeal(ctx, id);
    deleteKgVertex(ctx, 'deals', id);
    ctx.db.deals.id.delete(id);
  }
);

// ---------------------------------------------------------------------------
// Activity reducers
// ---------------------------------------------------------------------------

export const createActivity = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    contact_id: t.option(t.u64()),
    deal_id: t.option(t.u64()),
    type: activityType,
    description: t.string(),
    created_by: t.u64(),
  },
  (ctx: any, { tenant_id, contact_id, deal_id, type, description, created_by }) => {
    requireTenant(ctx, tenant_id);
    const activity = ctx.db.activities.insert({
      id: 0n,
      tenant_id,
      contact_id,
      deal_id,
      type,
      description,
      created_by,
      created_at: ctx.timestamp,
    });
    syncKgVertex(ctx, tenant_id, { tag: 'Activity' }, 'activities', activity.id, { type: type.tag, description, summary: description.slice(0, 120) });
    const activityVertexId = findKgVertexId(ctx, tenant_id, 'activities', activity.id);
    if (contact_id !== undefined && activityVertexId) {
      const contactVertexId = findKgVertexId(ctx, tenant_id, 'contacts', contact_id);
      if (contactVertexId) {
        syncKgEdge(ctx, tenant_id, contactVertexId, activityVertexId, { tag: 'HadActivity' });
        syncKgEdge(ctx, tenant_id, activityVertexId, contactVertexId, { tag: 'About' });
      }
    }
    if (deal_id !== undefined && activityVertexId) {
      const dealVertexId = findKgVertexId(ctx, tenant_id, 'deals', deal_id);
      if (dealVertexId) {
        syncKgEdge(ctx, tenant_id, activityVertexId, dealVertexId, { tag: 'About' });
      }
    }
  }
);

export const deleteActivity = spacetimedb.reducer(
  { id: t.u64() },
  (ctx: any, { id }) => {
    const activity = ctx.db.activities.id.find(id);
    if (!activity) throw new Error('Activity not found');
    requireTenant(ctx, activity.tenant_id);
    ctx.db.activities.id.delete(id);
  }
);

// ---------------------------------------------------------------------------
// Conversation & Message reducers
// ---------------------------------------------------------------------------

export const createConversation = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    contact_id: t.u64(),
    channel: channelType,
    channel_conversation_id: t.string(),
  },
  (ctx: any, { tenant_id, contact_id, channel, channel_conversation_id }) => {
    requireTenant(ctx, tenant_id);
    const conversation = ctx.db.conversations.insert({
      id: 0n,
      tenant_id,
      contact_id,
      channel,
      channel_conversation_id,
      status: { tag: 'Active' },
      last_message_at: ctx.timestamp,
      unread_count: 0,
    });
    syncKgVertex(ctx, tenant_id, { tag: 'Conversation' }, 'conversations', conversation.id, { channel: channel.tag, status: 'Active', unread_count: 0 });
    const convVertexId = findKgVertexId(ctx, tenant_id, 'conversations', conversation.id);
    if (convVertexId) {
      const contactVertexId = findKgVertexId(ctx, tenant_id, 'contacts', contact_id);
      if (contactVertexId) {
        syncKgEdge(ctx, tenant_id, contactVertexId, convVertexId, { tag: 'ParticipatedIn' });
      }
    }
  }
);

export const archiveConversation = spacetimedb.reducer(
  { id: t.u64() },
  (ctx: any, { id }) => {
    const conv = ctx.db.conversations.id.find(id);
    if (!conv) throw new Error('Conversation not found');
    requireTenant(ctx, conv.tenant_id);
    ctx.db.conversations.id.update({ ...conv, status: { tag: 'Archived' } });
  }
);

export const seedInboxData = spacetimedb.reducer(
  { tenant_id: t.u64(), language: t.string() },
  (ctx, { tenant_id, language }) => {
    requireTenant(ctx, tenant_id);
    const lang = language || 'en';

    // Clean slate: delete all existing conversations + messages + their KG vertices
    const convsToDelete: bigint[] = [];
    for (const conv of ctx.db.conversations.iter()) {
      if (conv.tenant_id === tenant_id) convsToDelete.push(conv.id);
    }
    for (const convId of convsToDelete) {
      deleteMessagesForConversation(ctx, convId);
      deleteKgVertex(ctx, 'conversations', convId);
      ctx.db.conversations.id.delete(convId);
    }

    // Gather existing contacts for this tenant
    const contacts: any[] = [];
    for (const c of ctx.db.contacts.iter()) {
      if (c.tenant_id === tenant_id) contacts.push(c);
    }
    if (contacts.length === 0) return;

    // Localized conversation scenarios
    const enScenarios = [
      {
        channel: { tag: 'Whatsapp' as const },
        unread: 1,
        memory: 'Prospect interested in 1Gbps fibre broadband for new apartment in KL Sentral. Budget around RM 200/month.',
        messages: [
          { dir: 'Inbound', body: 'Hi! I just moved into a new apartment near KL Sentral and I am looking for a high-speed internet plan. Do you have fibre coverage there?' },
          { dir: 'Outbound', body: 'Hi there! Welcome to the neighbourhood. Yes, we have full fibre coverage in KL Sentral with speeds up to 1Gbps. Could you share your unit address so I can confirm availability?' },
          { dir: 'Inbound', body: 'It is Residensi Sentral, unit 12B. I work from home so I need something reliable. What are the plans?' },
        ],
      },
      {
        channel: { tag: 'Email' as const },
        unread: 2,
        memory: 'Long-time customer on 300Mbps plan. Complained about billing discrepancy in March. Issue was resolved with credit applied.',
        messages: [
          { dir: 'Inbound', body: 'Hi, I just received my April invoice and the amount is RM 349. My plan is supposed to be RM 199. Can you explain why it is so high?' },
          { dir: 'Outbound', body: 'Hello! I apologise for the confusion. I have reviewed your account and I can see a prorated charge from your plan upgrade in mid-March plus a late payment fee. I have waived the late fee as a goodwill gesture. Your next bill will reflect the correct RM 199.' },
          { dir: 'Inbound', body: 'Thank you for checking. Can you also send me a detailed breakdown of the March charges? I want to make sure everything is correct going forward.' },
        ],
      },
      {
        channel: { tag: 'Whatsapp' as const },
        unread: 0,
        memory: 'Customer reported intermittent disconnections for 3 days. Technician visit scheduled for Friday 2pm. Modem replaced previously in January.',
        messages: [
          { dir: 'Inbound', body: 'My internet keeps dropping every 30 minutes since Tuesday. I have restarted the router five times already. This is really affecting my work calls.' },
          { dir: 'Outbound', body: 'I am very sorry to hear that, Ahmad. I can see from our logs that your line has had several session drops. I am booking a technician visit for you. Would Friday afternoon around 2 PM work?' },
          { dir: 'Inbound', body: 'Yes, Friday 2 PM is fine. Should I be home the whole day or just around that time?' },
          { dir: 'Outbound', body: 'Just around 2 PM is perfect. The technician will call you 30 minutes before arrival. I have also applied a 20% service credit to your next bill for the inconvenience.' },
        ],
      },
      {
        channel: { tag: 'Email' as const },
        unread: 1,
        memory: 'Current plan: 100Mbps. Customer wants to upgrade to 500Mbps before Ramadan for family streaming. Interested in 24-month contract with free router.',
        messages: [
          { dir: 'Inbound', body: 'I would like to upgrade my current 100Mbps plan to something faster. With Ramadan coming, my whole family will be streaming at the same time. What do you recommend?' },
          { dir: 'Outbound', body: 'Great timing! Our 500Mbps plan is perfect for multi-device households and we are running a Ramadan promotion — free mesh WiFi router plus the first month at 50% off on a 24-month contract. Shall I prepare the upgrade for you?' },
          { dir: 'Inbound', body: 'That sounds good. What is the monthly cost after the promotion ends? And can I keep my existing phone number?' },
        ],
      },
      {
        channel: { tag: 'Whatsapp' as const },
        unread: 2,
        memory: 'Customer from Maxis wants to port 4 numbers to CelcomDigi Family Plan. Needs unlimited calls and 200GB shared data.',
        messages: [
          { dir: 'Inbound', body: 'I am currently with Maxis and I want to port 4 numbers to your Family Plan. I need unlimited calls and at least 200GB shared data. What are my options?' },
          { dir: 'Outbound', body: 'We would love to welcome you to CelcomDigi! Our Family Plus plan gives you 4 lines with unlimited calls and 250GB shared data for RM 268/month. Porting is free and takes 24-48 hours. Would you like me to start the process?' },
          { dir: 'Inbound', body: 'Yes please. Do I need to go to a centre or can this be done online? Also, will there be any downtime during the port?' },
        ],
      },
      {
        channel: { tag: 'Email' as const },
        unread: 0,
        memory: 'Business traveller flying to London next week. Needs 30-day roaming pass with 10GB data. Previous trip to Singapore used 8GB.',
        messages: [
          { dir: 'Inbound', body: 'I am travelling to London for 3 weeks next Monday. I need a roaming plan with enough data for maps, video calls and emails. What do you suggest?' },
          { dir: 'Outbound', body: 'For a 3-week trip to the UK, I recommend our Europe Roaming Pass — 10GB data valid for 30 days at RM 99. It covers the UK, France, Germany and 15 other countries. Would you like me to activate it?' },
          { dir: 'Inbound', body: '10GB should be enough based on my last trip. Can you activate it to start on Monday 15th? Also, will WhatsApp calls work on roaming?' },
          { dir: 'Outbound', body: 'Absolutely! I have scheduled the Europe Roaming Pass to activate on Monday 15th. WhatsApp calls will work perfectly over data. You will receive an SMS confirmation once it is active.' },
        ],
      },
      {
        channel: { tag: 'Whatsapp' as const },
        unread: 1,
        memory: 'Interested in iPhone 16 Pro with 5G postpaid bundle. Currently using iPhone 12. Trade-in value estimated at RM 1,800.',
        messages: [
          { dir: 'Inbound', body: 'I saw your iPhone 16 Pro bundle ad. I have an iPhone 12 that I want to trade in. How much would I get and what is the monthly commitment?' },
          { dir: 'Outbound', body: 'Hi Sarah! Based on your iPhone 12 condition, our trade-in partner estimates RM 1,800. The iPhone 16 Pro 256GB with our 5G Postpaid 128 plan is RM 188/month for 24 months after trade-in credit. Interested?' },
          { dir: 'Inbound', body: 'That is tempting. Can I visit a store to inspect the phone colour options before committing? Also, do you have stock in titanium desert?' },
        ],
      },
      {
        channel: { tag: 'Email' as const },
        unread: 3,
        memory: 'Frequent complaints about poor 4G coverage in Taman Desa area. Customer works from home and experiences dropped calls. Previous ticket #8921 closed without resolution. Escalated to network ops.',
        messages: [
          { dir: 'Inbound', body: 'This is the third time I am writing about the terrible coverage in Taman Desa. My calls drop constantly and I cannot even load a webpage indoors. Your last technician said the issue was "resolved" but nothing changed.' },
          { dir: 'Outbound', body: 'Mr. Tan, I sincerely apologise for the repeated frustration. I have escalated this directly to our Network Operations team with ticket #10234. They confirmed a cell tower upgrade is scheduled for your area within 14 days. I am also applying a 50% discount for the next 2 months.' },
          { dir: 'Inbound', body: 'I appreciate the discount but I really need reliable service. Can I get a temporary 4G booster device while waiting for the tower upgrade?' },
        ],
      },
      {
        channel: { tag: 'Whatsapp' as const },
        unread: 0,
        memory: 'Auto-debit failed twice due to expired credit card. Customer wants to switch to online banking payment and settle outstanding balance of RM 447.',
        messages: [
          { dir: 'Inbound', body: 'My auto-debit failed again this month. I think my credit card expired. I want to switch to online banking payment instead. Can you help me set that up?' },
          { dir: 'Outbound', body: 'Of course, Lisa! I can see the failed auto-debit on your expired card ending in 4421. You have an outstanding balance of RM 447. I can send you a secure payment link via SMS to settle it immediately, and then switch your payment method to online banking. Shall I proceed?' },
          { dir: 'Inbound', body: 'Yes please send the link. After I pay, how do I set up the online banking auto-debit?' },
          { dir: 'Outbound', body: 'Link sent! Once you have paid, go to the CelcomDigi app → Billing → Payment Methods → Add Bank Account. It takes 2 minutes and your next bill will auto-debit from there.' },
        ],
      },
      {
        channel: { tag: 'Email' as const },
        unread: 1,
        memory: 'Customer moving overseas permanently to Australia. Wants to terminate all 3 lines under account. Contract ends in 2 months. Asking about early termination fees.',
        messages: [
          { dir: 'Inbound', body: 'I am relocating to Australia permanently next month and need to terminate all 3 lines under my account. My contract still has 2 months left. What are the early termination fees?' },
          { dir: 'Outbound', body: 'I understand, David. Relocating is a big step. Since your contract has only 2 months remaining, the early termination fee is RM 150 per line, so RM 450 total. However, if you can provide your employment letter from Australia, we can waive 50% of the fee as a relocation courtesy.' },
          { dir: 'Inbound', body: 'That is helpful. I have my employment letter ready. What is the best way to submit it and how long does the termination take to process?' },
        ],
      },
      {
        channel: { tag: 'Whatsapp' as const },
        unread: 0,
        memory: 'CelcomDigi Rewards member with 12,450 points. Wants to redeem points for Shopee vouchers. Previously redeemed RM 50 Touch n Go voucher in January.',
        messages: [
          { dir: 'Inbound', body: 'Hi! I have 12,450 Rewards points. What can I redeem them for? I prefer Shopee or Grab vouchers if available.' },
          { dir: 'Outbound', body: 'Hi Jessica! With 12,450 points you can redeem a RM 100 Shopee voucher (10,000 points) or a RM 50 Grab voucher (5,000 points) with points left over. The Shopee voucher is delivered instantly via email. Which would you prefer?' },
          { dir: 'Inbound', body: 'I will take the RM 100 Shopee voucher please. Can you send it to jessica.collins409@example.com?' },
          { dir: 'Outbound', body: 'Done! Your RM 100 Shopee voucher has been sent to jessica.collins409@example.com. You now have 2,450 points remaining. Thanks for being a loyal CelcomDigi Rewards member!' },
        ],
      },
      {
        channel: { tag: 'Email' as const },
        unread: 2,
        memory: 'Owner of a 12-person accounting firm in Petaling Jaya. Currently on 8 individual lines. Wants to consolidate to a single Business Flex Plan with centralised billing and dedicated account manager.',
        messages: [
          { dir: 'Inbound', body: 'I run a 12-person accounting firm in PJ and we currently have 8 individual lines with different billing dates. It is a nightmare to manage. Do you have a business plan that consolidates everything?' },
          { dir: 'Outbound', body: 'Absolutely! Our Business Flex Plan is designed exactly for this. You get 12 lines with shared unlimited calls and 500GB data, centralised billing, and a dedicated account manager — all for RM 688/month. I can also assign a single billing date of your choice.' },
          { dir: 'Inbound', body: 'That sounds ideal. Can we schedule a call to discuss the SLA and whether you provide 4G backup devices for each line? My team visits clients remotely often.' },
        ],
      },
    ];

    const msScenarios = [
      {
        channel: { tag: 'Whatsapp' as const }, unread: 1,
        memory: 'Prospek berminat dengan broadband gentian 1Gbps untuk apartmen baharu di KL Sentral. Bajet kira-kira RM 200/sebulan.',
        messages: [
          { dir: 'Inbound', body: 'Hi! Saya baru berpindah ke apartmen berhampiran KL Sentral dan sedang mencari pelan internet laju. Adakah anda mempunyai liputan gentian di sana?' },
          { dir: 'Outbound', body: 'Hi! Selamat datang ke kejiranan ini. Ya, kami mempunyai liputan gentian penuh di KL Sentral dengan kelajuan sehingga 1Gbps. Bolehkah anda berkongsi alamat unit supaya saya boleh sahkan ketersediaan?' },
          { dir: 'Inbound', body: 'Ia adalah Residensi Sentral, unit 12B. Saya bekerja dari rumah jadi saya memerlukan sesuatu yang boleh dipercayai. Apakah pelan yang ada?' },
        ],
      },
      {
        channel: { tag: 'Email' as const }, unread: 2,
        memory: 'Pelanggan lama pada pelan 300Mbps. Mengadu tentang percanggahan bil pada Mac. Isu telah diselesaikan dengan kredit diberikan.',
        messages: [
          { dir: 'Inbound', body: 'Hi, saya baru menerima invois April dan jumlahnya adalah RM 349. Pelan saya sepatutnya RM 199. Bolehkah anda terangkan mengapa ia begitu tinggi?' },
          { dir: 'Outbound', body: 'Hello! Maaf atas kekeliruan. Saya telah menyemak akaun anda dan saya dapat melihat caj prorata dari peningkatan pelan pertengahan Mac plus yuran lewat bayar. Saya telah membatalkan yuran lewat bayar sebagai tanda baik. Bil seterusnya akan mencerminkan RM 199 yang betul.' },
          { dir: 'Inbound', body: 'Terima kasih kerana menyemak. Bolehkah anda juga hantarkan pecahan terperinci bagi caj Mac? Saya mahu pastikan semuanya betul ke depan ini.' },
        ],
      },
      {
        channel: { tag: 'Whatsapp' as const }, unread: 0,
        memory: 'Pelanggan melaporkan pemutus sambungan berkala selama 3 hari. Lawatan juruteknik dijadualkan untuk Jumaat 2pm. Modem diganti sebelum ini pada Januari.',
        messages: [
          { dir: 'Inbound', body: 'Internet saya sentiasa terputus setiap 30 minit sejak Selasa. Saya telah menghidupkan semula router lima kali. Ini benar-benar menjejaskan panggilan kerja saya.' },
          { dir: 'Outbound', body: 'Saya sangat kesal mendengarnya, Ahmad. Saya dapat melihat dari log kami bahawa talian anda mengalami beberapa pemutus sesi. Saya sedang membuat tempahan lawatan juruteknik untuk anda. Adakah petang Jumaat sekitar 2 PM sesuai?' },
          { dir: 'Inbound', body: 'Ya, Jumaat 2 PM sesuai. Perlukah saya berada di rumah sepanjang hari atau hanya sekitar masa itu?' },
          { dir: 'Outbound', body: 'Sekitar 2 PM sudah cukup. Juruteknik akan menghubungi anda 30 minit sebelum ketibaan. Saya juga telah memohon kredit perkhidmatan 20% untuk bil seterusnya atas ketidakselesaan ini.' },
        ],
      },
      {
        channel: { tag: 'Email' as const }, unread: 1,
        memory: 'Pelan semasa: 100Mbps. Pelanggan mahu menaik taraf ke 500Mbps sebelum Ramadan untuk penstriman keluarga. Berminat dengan kontrak 24 bulan dengan router percuma.',
        messages: [
          { dir: 'Inbound', body: 'Saya ingin menaik taraf pelan 100Mbps semasa saya kepada sesuatu yang lebih laju. Dengan Ramadan yang bakal tiba, seluruh keluarga saya akan menonton secara serentak. Apa yang anda cadangkan?' },
          { dir: 'Outbound', body: 'Masa yang tepat! Pelan 500Mbps kami sesuai untuk isi rumah dengan banyak peranti dan kami sedang menjalankan promosi Ramadan — router mesh WiFi percuma ditambah bulan pertama dengan diskaun 50% pada kontrak 24 bulan. Bolehkah saya sediakan penaiktarafan untuk anda?' },
          { dir: 'Inbound', body: 'Kedengaran bagus. Berapakah kos bulanan selepas promosi tamat? Dan bolehkah saya kekalkan nombor telefon sedia ada?' },
        ],
      },
      {
        channel: { tag: 'Whatsapp' as const }, unread: 2,
        memory: 'Pelanggan dari Maxis mahu memindahkan 4 nombor ke Pelan Keluarga CelcomDigi. Perlukan panggilan tanpa had dan 200GB data perkongsian.',
        messages: [
          { dir: 'Inbound', body: 'Saya sekarang bersama Maxis dan saya mahu memindahkan 4 nombor ke Pelan Keluarga anda. Saya perlukan panggilan tanpa had dan sekurang-kurangnya 200GB data perkongsian. Apakah pilihan saya?' },
          { dir: 'Outbound', body: 'Kami sangat gembira untuk menyambut anda ke CelcomDigi! Pelan Keluarga Plus kami memberikan 4 talian dengan panggilan tanpa had dan 250GB data perkongsian pada RM 268/sebulan. Port percuma dan mengambil masa 24-48 jam. Adakah anda mahu saya mulakan proses?' },
          { dir: 'Inbound', body: 'Ya sila. Perlukah saya pergi ke pusat atau adakah ini boleh dilakukan dalam talian? Juga, adakah akan ada sebarang gangguan semasa port?' },
        ],
      },
      {
        channel: { tag: 'Email' as const }, unread: 0,
        memory: 'Pelancong perniagaan terbang ke London minggu depan. Perlukan pas roaming 30 hari dengan 10GB data. Perjalanan sebelumnya ke Singapura menggunakan 8GB.',
        messages: [
          { dir: 'Inbound', body: 'Saya akan melancong ke London selama 3 minggu Isnin depan. Saya perlukan pelan roaming dengan data yang mencukupi untuk peta, panggilan video dan e-mel. Apa yang anda cadangkan?' },
          { dir: 'Outbound', body: 'Untuk perjalanan 3 minggu ke UK, saya cadangkan Pas Roaming Eropah kami — 10GB data sah selama 30 hari pada RM 99. Ia merangkumi UK, Perancis, Jerman dan 15 negara lain. Adakah anda mahu saya mengaktifkannya?' },
          { dir: 'Inbound', body: '10GB sepatutnya mencukupi berdasarkan perjalanan terakhir saya. Bolehkah anda aktifkannya bermula Isnin 15? Juga, adakah panggilan WhatsApp berfungsi pada roaming?' },
          { dir: 'Outbound', body: 'Sudah tentu! Saya telah menjadualkan Pas Roaming Eropah untuk diaktifkan pada Isnin 15. Panggilan WhatsApp akan berfungsi dengan sempurna melalui data. Anda akan menerima pengesahan SMS setelah ia aktif.' },
        ],
      },
      {
        channel: { tag: 'Whatsapp' as const }, unread: 1,
        memory: 'Berminat dengan iPhone 16 Pro dengan pakej postpaid 5G. Sekarang menggunakan iPhone 12. Nilai tukar tambah dianggarkan pada RM 1,800.',
        messages: [
          { dir: 'Inbound', body: 'Saya melihat iklan pakej iPhone 16 Pro anda. Saya mempunyai iPhone 12 yang ingin saya tukar tambah. Berapakah yang saya akan dapat dan berapakah komitmen bulanan?' },
          { dir: 'Outbound', body: 'Hi Sarah! Berdasarkan keadaan iPhone 12 anda, rakan tukar tambah kami menganggarkan RM 1,800. iPhone 16 Pro 256GB dengan pelan 5G Postpaid 128 kami adalah RM 188/sebulan selama 24 bulan selepas kredit tukar tambah. Berminat?' },
          { dir: 'Inbound', body: 'Itu menggoda. Bolehkah saya melawat kedai untuk memeriksa pilihan warna telefon sebelum berkomitmen? Juga, adakah anda mempunyai stok titanium desert?' },
        ],
      },
      {
        channel: { tag: 'Email' as const }, unread: 3,
        memory: 'Aduan kerap tentang liputan 4G lemah di kawasan Taman Desa. Pelanggan bekerja dari rumah dan mengalami panggilan terputus. Tiket #8921 sebelumnya ditutup tanpa penyelesaian. Dinaikkan kepada operasi rangkaian.',
        messages: [
          { dir: 'Inbound', body: 'Ini adalah kali ketiga saya menulis tentang liputan teruk di Taman Desa. Panggilan saya sentiasa terputus dan saya tidak boleh memuatkan laman web di dalam rumah. Juruteknik terakhir anda mengatakan isu itu "diselesaikan" tetapi tiada perubahan.' },
          { dir: 'Outbound', body: 'Encik Tan, saya memohon maaf atas kekecewaan berulang. Saya telah menaikkan ini terus kepada pasukan Operasi Rangkaian kami dengan tiket #10234. Mereka mengesahkan penaiktarafan menara sel dijadualkan untuk kawasan anda dalam masa 14 hari. Saya juga memohon diskaun 50% untuk 2 bulan seterusnya.' },
          { dir: 'Inbound', body: 'Saya menghargai diskaun tetapi saya benar-benar memerlukan perkhidmatan yang boleh dipercayai. Bolehkah saya mendapatkan peranti penguat 4G sementara menunggu penaiktarafan menara?' },
        ],
      },
      {
        channel: { tag: 'Whatsapp' as const }, unread: 0,
        memory: 'Auto-debit gagal dua kali disebabkan kad kredit tamat tempoh. Pelanggan mahu bertukar kepada pembayaran perbankan dalam talian dan menyelesaikan baki tertunggak RM 447.',
        messages: [
          { dir: 'Inbound', body: 'Auto-debit saya gagal lagi bulan ini. Saya rasa kad kredit saya telah tamat tempoh. Saya mahu bertukar kepada pembayaran perbankan dalam talian. Bolehkah anda membantu saya menyiapkannya?' },
          { dir: 'Outbound', body: 'Sudah tentu, Lisa! Saya dapat melihat auto-debit gagal pada kad tamat tempoh anda yang berakhir dengan 4421. Anda mempunyai baki tertunggak RM 447. Saya boleh hantarkan pautan pembayaran selamat melalui SMS untuk menyelesaikannya serta-merta, dan kemudian menukar kaedah pembayaran anda kepada perbankan dalam talian. Bolehkah saya teruskan?' },
          { dir: 'Inbound', body: 'Ya sila hantarkan pautan. Selepas saya bayar, bagaimanakah saya menyiapkan auto-debit perbankan dalam talian?' },
          { dir: 'Outbound', body: 'Pautan dihantar! Selepas anda membayar, pergi ke aplikasi CelcomDigi → Bil → Kaedah Pembayaran → Tambah Akaun Bank. Ia mengambil masa 2 minit dan bil seterusnya akan auto-debit dari sana.' },
        ],
      },
      {
        channel: { tag: 'Email' as const }, unread: 1,
        memory: 'Pelanggan berpindah ke luar negara ke Australia secara kekal. Mahu menamatkan semua 3 talian di bawah akaun. Kontrak berakhir dalam 2 bulan. Menanya tentang yuran penamatan awal.',
        messages: [
          { dir: 'Inbound', body: 'Saya berpindah ke Australia secara kekal bulan depan dan perlu menamatkan semua 3 talian di bawah akaun saya. Kontrak saya masih mempunyai 2 bulan lagi. Berapakah yuran penamatan awal?' },
          { dir: 'Outbound', body: 'Saya faham, David. Berpindah adalah langkah besar. Memandangkan kontrak anda hanya tinggal 2 bulan, yuran penamatan awal adalah RM 150 setiap talian, jadi RM 450 keseluruhan. Walau bagaimanapun, jika anda boleh memberikan surat pekerjaan dari Australia, kami boleh membatalkan 50% yuran tersebut sebagai budi bahasa perpindahan.' },
          { dir: 'Inbound', body: 'Itu membantu. Saya mempunyai surat pekerjaan saya sedia. Apakah cara terbaik untuk menghantarnya dan berapa lamakah penamatan mengambil masa untuk diproses?' },
        ],
      },
      {
        channel: { tag: 'Whatsapp' as const }, unread: 0,
        memory: 'Ahli CelcomDigi Rewards dengan 12,450 mata. Mahu menebus mata untuk baucar Shopee. Sebelum ini menebus baucar Touch n Go RM 50 pada Januari.',
        messages: [
          { dir: 'Inbound', body: 'Hi! Saya mempunyai 12,450 mata Rewards. Apa yang boleh saya tebus? Saya lebih suka baucar Shopee atau Grab jika ada.' },
          { dir: 'Outbound', body: 'Hi Jessica! Dengan 12,450 mata anda boleh menebus baucar Shopee RM 100 (10,000 mata) atau baucar Grab RM 50 (5,000 mata) dengan mata yang tinggal. Baucar Shopee dihantar serta-merta melalui e-mel. Yang mana anda lebih suka?' },
          { dir: 'Inbound', body: 'Saya akan ambil baucar Shopee RM 100 sila. Bolehkah anda hantarkan ke jessica.collins409@example.com?' },
          { dir: 'Outbound', body: 'Selesai! Baucar Shopee RM 100 anda telah dihantar ke jessica.collins409@example.com. Anda kini mempunyai 2,450 mata yang tinggal. Terima kasih kerana menjadi ahli CelcomDigi Rewards yang setia!' },
        ],
      },
      {
        channel: { tag: 'Email' as const }, unread: 2,
        memory: 'Pemilik firma perakaunan 12 orang di Petaling Jaya. Sekarang menggunakan 8 talian individu. Mahu mengumpulkan kepada satu Pelan Business Flex dengan bil berpusat dan pengurus akaun khas.',
        messages: [
          { dir: 'Inbound', body: 'Saya menjalankan firma perakaunan 12 orang di PJ dan kami kini mempunyai 8 talian individu dengan tarikh bil yang berbeza. Ia adalah mimpi ngeri untuk diuruskan. Adakah anda mempunyai pelan perniagaan yang mengumpulkan segala-galanya?' },
          { dir: 'Outbound', body: 'Sudah tentu! Pelan Business Flex kami direka bentuk khas untuk ini. Anda mendapat 12 talian dengan perkongsian panggilan tanpa had dan 500GB data, bil berpusat, dan pengurus akaun khas — semuanya untuk RM 688/sebulan. Saya juga boleh tetapkan satu tarikh bil pilihan anda.' },
          { dir: 'Inbound', body: 'Kedengaran ideal. Bolehkah kami menjadualkan panggilan untuk membincangkan SLA dan sama ada anda menyediakan peranti sandaran 4G untuk setiap talian? Pasukan saya sering melawat klien secara jarak jauh.' },
        ],
      },
    ];

    const zhScenarios = [
      {
        channel: { tag: 'Whatsapp' as const }, unread: 1,
        memory: '潜在客户对 KL Sentral 新公寓的 1Gbps 光纤宽带感兴趣。预算约为每月 RM 200。',
        messages: [
          { dir: 'Inbound', body: '你好！我刚搬到 KL Sentral 附近的新公寓，正在寻找高速互联网套餐。你们那里有光纤覆盖吗？' },
          { dir: 'Outbound', body: '您好！欢迎加入这个社区。是的，我们在 KL Sentral 有完整的光纤覆盖，速度高达 1Gbps。您能分享您的单位地址以便我确认可用性吗？' },
          { dir: 'Inbound', body: '是 Residensi Sentral，12B 单位。我在家工作，所以需要可靠的网络。有哪些套餐？' },
        ],
      },
      {
        channel: { tag: 'Email' as const }, unread: 2,
        memory: '使用 300Mbps 套餐的老客户。投诉三月份账单有误。问题已通过发放积分解决。',
        messages: [
          { dir: 'Inbound', body: '你好，我刚收到四月份的账单，金额是 RM 349。我的套餐应该是 RM 199。你能解释一下为什么这么高吗？' },
          { dir: 'Outbound', body: '您好！对于造成的困惑我深表歉意。我已查看您的账户，可以看到三月中旬套餐升级的按比例计费以及滞纳金。作为善意表示，我已免除滞纳金。您的下一张账单将显示正确的 RM 199。' },
          { dir: 'Inbound', body: '谢谢你查证。你还能给我发送三月份费用的详细明细吗？我想确保以后一切都是正确的。' },
        ],
      },
      {
        channel: { tag: 'Whatsapp' as const }, unread: 0,
        memory: '客户报告三天来间歇性断网。技术人员访问安排在周五下午 2 点。调制解调器此前于一月份更换过。',
        messages: [
          { dir: 'Inbound', body: '我的互联网从周二开始每 30 分钟就断一次。我已经重启了路由器五次。这真的很影响我的工作通话。' },
          { dir: 'Outbound', body: 'Ahmad 先生，听到这个消息我非常抱歉。从我们的日志中可以看到您的线路有多次会话中断。我正在为您预约技术人员上门。周五下午 2 点左右方便吗？' },
          { dir: 'Inbound', body: '好的，周五下午 2 点可以。我需要整天在家还是就那个时间左右？' },
          { dir: 'Outbound', body: '就下午 2 点左右在家就行了。技术人员会在到达前 30 分钟给您打电话。对于造成的不便，我还为您的下一张账单申请了 20% 的服务积分。' },
        ],
      },
      {
        channel: { tag: 'Email' as const }, unread: 1,
        memory: '当前套餐：100Mbps。客户想在斋月前升级到 500Mbps 用于家庭流媒体。对 24 个月合约赠送免费路由器感兴趣。',
        messages: [
          { dir: 'Inbound', body: '我想把目前的 100Mbps 套餐升级到更快的。随着斋月的到来，我的全家人会同时观看流媒体。你有什么推荐？' },
          { dir: 'Outbound', body: '时机正好！我们的 500Mbps 套餐非常适合多设备家庭，目前正在进行斋月促销 — 免费网状 WiFi 路由器，24 个月合约首月半价。需要我为您准备升级吗？' },
          { dir: 'Inbound', body: '听起来不错。促销结束后每月费用是多少？我还能保留现有的电话号码吗？' },
        ],
      },
      {
        channel: { tag: 'Whatsapp' as const }, unread: 2,
        memory: '来自 Maxis 的客户想把 4 个号码转网到 CelcomDigi 家庭套餐。需要无限通话和 200GB 共享流量。',
        messages: [
          { dir: 'Inbound', body: '我目前在 Maxis，想把 4 个号码转到你们的家庭套餐。我需要无限通话和至少 200GB 共享流量。我有什么选择？' },
          { dir: 'Outbound', body: '非常欢迎您加入 CelcomDigi！我们的家庭增强套餐提供 4 条线路，无限通话和 250GB 共享流量，每月 RM 268。转网免费，需要 24-48 小时。需要我开始办理吗？' },
          { dir: 'Inbound', body: '好的请办。我需要去营业厅吗还是可以在网上办理？另外，转网期间会有停机吗？' },
        ],
      },
      {
        channel: { tag: 'Email' as const }, unread: 0,
        memory: '商务旅客下周飞往伦敦。需要 30 天漫游通行证，含 10GB 流量。之前新加坡之旅使用了 8GB。',
        messages: [
          { dir: 'Inbound', body: '我下周一要去伦敦待 3 周。我需要一个漫游套餐，有足够的数据用于地图、视频通话和电子邮件。你有什么建议？' },
          { dir: 'Outbound', body: '对于为期 3 周的英国之旅，我推荐我们的欧洲漫游通行证 — 10GB 数据，有效期 30 天，价格 RM 99。覆盖英国、法国、德国和其他 15 个国家。需要我为您激活吗？' },
          { dir: 'Inbound', body: '根据我上次旅行，10GB 应该够了。你能在 15 号周一激活吗？另外，WhatsApp 通话在漫游时能用吗？' },
          { dir: 'Outbound', body: '当然！我已安排欧洲漫游通行证在 15 号周一激活。WhatsApp 通话通过数据可以正常使用。激活后您会收到短信确认。' },
        ],
      },
      {
        channel: { tag: 'Whatsapp' as const }, unread: 1,
        memory: '对 iPhone 16 Pro 配 5G 后付费捆绑包感兴趣。目前使用 iPhone 12。以旧换新估价约 RM 1,800。',
        messages: [
          { dir: 'Inbound', body: '我看到了你们的 iPhone 16 Pro 捆绑包广告。我有一部 iPhone 12 想以旧换新。我能得到多少钱，每月承诺费用是多少？' },
          { dir: 'Outbound', body: '嗨 Sarah！根据您 iPhone 12 的状况，我们的以旧换新合作伙伴估价 RM 1,800。iPhone 16 Pro 256GB 配我们的 5G 后付费 128 套餐，在以旧换新抵扣后每月 RM 188，为期 24 个月。感兴趣吗？' },
          { dir: 'Inbound', body: '很诱人。我可以去门店看看手机颜色选项再做决定吗？还有，你们有钛金属沙漠色库存吗？' },
        ],
      },
      {
        channel: { tag: 'Email' as const }, unread: 3,
        memory: '频繁投诉 Taman Desa 地区 4G 覆盖差。客户在家工作，通话经常掉线。之前的工单 #8921 未解决就关闭了。已升级给网络运营部门。',
        messages: [
          { dir: 'Inbound', body: '这是我第三次写信投诉 Taman Desa 糟糕的信号覆盖。我的通话不断掉线，室内甚至无法加载网页。你们上次的技术人员说问题已"解决"，但没有任何改变。' },
          { dir: 'Outbound', body: 'Tan 先生，对于反复带来的困扰我深表歉意。我已直接升级给我们的网络运营团队，工单号 #10234。他们确认您所在区域的基站升级将在 14 天内进行。我还申请了接下来 2 个月 50% 的折扣。' },
          { dir: 'Inbound', body: '我感谢折扣，但我真的需要可靠的服务。等待基站升级期间，我能获得一个临时的 4G 信号增强器吗？' },
        ],
      },
      {
        channel: { tag: 'Whatsapp' as const }, unread: 0,
        memory: '自动扣款因信用卡过期连续两次失败。客户想切换到网上银行支付并结清 RM 447 的未付款项。',
        messages: [
          { dir: 'Inbound', body: '我这个月的自动扣款又失败了。我觉得我的信用卡过期了。我想换成网上银行支付。你能帮我设置吗？' },
          { dir: 'Outbound', body: '当然，Lisa！我可以看到您尾号 4421 的过期卡上自动扣款失败了。您有 RM 447 的未付款项。我可以通过短信发送安全支付链接让您立即结清，然后将您的付款方式切换到网上银行。需要我继续吗？' },
          { dir: 'Inbound', body: '好的请发送链接。付款后，我如何设置网上银行自动扣款？' },
          { dir: 'Outbound', body: '链接已发送！付款后，打开 CelcomDigi 应用 → 账单 → 付款方式 → 添加银行账户。只需 2 分钟，下一张账单将自动从那里扣款。' },
        ],
      },
      {
        channel: { tag: 'Email' as const }, unread: 1,
        memory: '客户永久移居澳大利亚。想终止账户下所有 3 条线路。合约还有 2 个月到期。询问提前终止费用。',
        messages: [
          { dir: 'Inbound', body: '我下个月要永久移居澳大利亚，需要终止账户下所有 3 条线路。我的合约还有 2 个月。提前终止费用是多少？' },
          { dir: 'Outbound', body: '我理解，David。搬家是个大事。由于您的合约只剩下 2 个月，提前终止费是每条线路 RM 150，总共 RM 450。不过，如果您能提供澳大利亚的雇佣信，我们可以作为搬迁优惠免除 50% 的费用。' },
          { dir: 'Inbound', body: '这很有帮助。我已经准备好了雇佣信。提交的最佳方式是什么，终止处理需要多长时间？' },
        ],
      },
      {
        channel: { tag: 'Whatsapp' as const }, unread: 0,
        memory: 'CelcomDigi Rewards 会员，有 12,450 积分。想用积分兑换 Shopee 优惠券。一月份之前兑换过 RM 50 的 Touch n Go 优惠券。',
        messages: [
          { dir: 'Inbound', body: '嗨！我有 12,450 积分。我能兑换什么？如果有的话，我更喜欢 Shopee 或 Grab 优惠券。' },
          { dir: 'Outbound', body: '嗨 Jessica！用 12,450 积分您可以兑换 RM 100 Shopee 优惠券（10,000 积分）或 RM 50 Grab 优惠券（5,000 积分），还能剩下积分。Shopee 优惠券会通过电子邮件即时送达。您更喜欢哪个？' },
          { dir: 'Inbound', body: '我要 RM 100 Shopee 优惠券。你能发送到 jessica.collins409@example.com 吗？' },
          { dir: 'Outbound', body: '完成！您的 RM 100 Shopee 优惠券已发送至 jessica.collins409@example.com。您现在还剩 2,450 积分。感谢您成为忠实的 CelcomDigi Rewards 会员！' },
        ],
      },
      {
        channel: { tag: 'Email' as const }, unread: 2,
        memory: '八打灵再也一家 12 人会计事务所的负责人。目前使用 8 条个人线路。想整合到一个 Business Flex 套餐，统一账单并配备专属客户经理。',
        messages: [
          { dir: 'Inbound', body: '我在 PJ 经营一家 12 人的会计事务所，目前我们有 8 条个人线路，账单日期各不相同。管理起来简直是噩梦。你们有没有能整合一切的商业套餐？' },
          { dir: 'Outbound', body: '当然！我们的 Business Flex 套餐正是为此设计的。您可获得 12 条线路，共享无限通话和 500GB 数据，统一账单，以及专属客户经理 — 全部每月 RM 688。我还可以为您设定一个统一的账单日期。' },
          { dir: 'Inbound', body: '听起来很理想。我们能安排一次通话讨论 SLA 以及你们是否为每条线路提供 4G 备用设备吗？我的团队经常远程拜访客户。' },
        ],
      },
    ];

    const conversationScenarios = lang === 'ms' ? msScenarios : lang === 'zh' ? zhScenarios : enScenarios;

    let contactIdx = 0;
    const step = Math.max(1, Math.floor(contacts.length / conversationScenarios.length));
    for (let i = 0; i < conversationScenarios.length && contactIdx < contacts.length; i++) {
      const contact = contacts[contactIdx];
      contactIdx += step;
      const scenario = conversationScenarios[i];

      // Create a memory for this contact to enrich KG context
      const mem = ctx.db.memories.insert({
        id: 0n,
        tenant_id,
        title: `Conversation context: ${scenario.memory.slice(0, 40)}...`,
        content: scenario.memory,
        memory_type: { tag: 'Insight' },
        source_table: 'contacts',
        source_id: contact.id,
        created_by: 1n,
        created_at: ctx.timestamp,
        updated_at: ctx.timestamp,
      });
      syncKgVertex(ctx, tenant_id, { tag: 'Memory' }, 'memories', mem.id, {
        title: 'Customer Context',
        summary: scenario.memory,
        memory_type: 'Insight',
      });
      const memVertexId = findKgVertexId(ctx, tenant_id, 'memories', mem.id);
      const contactVertexId = findKgVertexId(ctx, tenant_id, 'contacts', contact.id);
      if (memVertexId && contactVertexId) {
        syncKgEdge(ctx, tenant_id, memVertexId, contactVertexId, { tag: 'About' });
        syncKgEdge(ctx, tenant_id, contactVertexId, memVertexId, { tag: 'HasMemory' });
      }

      // Create conversation
      const conv = ctx.db.conversations.insert({
        id: 0n,
        tenant_id,
        contact_id: contact.id,
        channel: scenario.channel,
        channel_conversation_id: `demo-${contact.id}-${i}`,
        status: { tag: 'Active' },
        last_message_at: ctx.timestamp,
        unread_count: scenario.unread,
      });
      syncKgVertex(ctx, tenant_id, { tag: 'Conversation' }, 'conversations', conv.id, {
        channel: scenario.channel.tag, status: 'Active', unread_count: scenario.unread,
      });
      const convVertexId = findKgVertexId(ctx, tenant_id, 'conversations', conv.id);
      if (convVertexId && contactVertexId) {
        syncKgEdge(ctx, tenant_id, convVertexId, contactVertexId, { tag: 'CommunicatedWith' });
      }

      // Create messages with natural timestamps (slightly staggered)
      for (let m = 0; m < scenario.messages.length; m++) {
        const item = scenario.messages[m];
        const isInbound = item.dir === 'Inbound';
        const msg = ctx.db.messages.insert({
          id: 0n,
          tenant_id,
          conversation_id: conv.id,
          sender_type: isInbound ? { tag: 'Contact' } : { tag: 'User' },
          sender_id: isInbound ? contact.id : 1n,
          body: item.body,
          attachments: '[]',
          direction: isInbound ? { tag: 'Inbound' } : { tag: 'Outbound' },
          status: { tag: 'Delivered' },
          external_message_id: undefined,
          created_at: ctx.timestamp,
        });
        syncKgVertex(ctx, tenant_id, { tag: 'Message' }, 'messages', msg.id, {
          body: item.body.slice(0, 200),
          direction: isInbound ? 'Inbound' : 'Outbound',
          status: 'Delivered',
        });
        const msgVertexId = findKgVertexId(ctx, tenant_id, 'messages', msg.id);
        if (msgVertexId && convVertexId) {
          syncKgEdge(ctx, tenant_id, msgVertexId, convVertexId, { tag: 'ContainedIn' });
        }
      }
    }
  }
);

export const sendMessage = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    conversation_id: t.u64(),
    sender_type: messageSenderType,
    sender_id: t.u64(),
    body: t.string(),
    attachments: t.string(),
    direction: messageDirection,
  },
  (ctx: any, { tenant_id, conversation_id, sender_type, sender_id, body, attachments, direction }) => {
    requireTenant(ctx, tenant_id);
    const conv = ctx.db.conversations.id.find(conversation_id);
    if (!conv) throw new Error('Conversation not found');

    const message = ctx.db.messages.insert({
      id: 0n,
      tenant_id,
      conversation_id,
      sender_type,
      sender_id,
      body,
      attachments,
      direction,
      status: { tag: 'Sent' },
      external_message_id: undefined,
      created_at: ctx.timestamp,
    });

    const unread = direction.tag === 'Inbound' ? conv.unread_count + 1 : conv.unread_count;
    ctx.db.conversations.id.update({
      ...conv,
      last_message_at: ctx.timestamp,
      unread_count: unread,
    });

    syncKgVertex(ctx, tenant_id, { tag: 'Message' }, 'messages', message.id, { body: body.slice(0, 200), direction: direction.tag });

    const messageVertexId = findKgVertexId(ctx, tenant_id, 'messages', message.id);
    const convVertexId = findKgVertexId(ctx, tenant_id, 'conversations', conversation_id);
    if (messageVertexId && convVertexId) {
      syncKgEdge(ctx, tenant_id, messageVertexId, convVertexId, { tag: 'PartOf' });
    }
    // Sent/Received edges
    if (messageVertexId) {
      if (direction.tag === 'Outbound') {
        const senderVertexId = findKgVertexId(ctx, tenant_id, 'users', sender_id);
        if (senderVertexId) {
          syncKgEdge(ctx, tenant_id, senderVertexId, messageVertexId, { tag: 'Sent' });
        }
      } else {
        const contactVertexId = findKgVertexId(ctx, tenant_id, 'contacts', conv.contact_id);
        if (contactVertexId) {
          syncKgEdge(ctx, tenant_id, contactVertexId, messageVertexId, { tag: 'Sent' });
          syncKgEdge(ctx, tenant_id, messageVertexId, contactVertexId, { tag: 'Received' });
        }
      }
    }
  }
);

export const markMessageRead = spacetimedb.reducer(
  { id: t.u64() },
  (ctx: any, { id }) => {
    const message = ctx.db.messages.id.find(id);
    if (!message) throw new Error('Message not found');
    requireTenant(ctx, message.tenant_id);
    ctx.db.messages.id.update({ ...message, status: { tag: 'Read' } });

    const conv = ctx.db.conversations.id.find(message.conversation_id);
    if (conv && conv.unread_count > 0) {
      ctx.db.conversations.id.update({ ...conv, unread_count: conv.unread_count - 1 });
    }
  }
);

// ---------------------------------------------------------------------------
// SSD Archive reducers — offload old data from RAM to disk
// ---------------------------------------------------------------------------

/** Delete specific messages by ID. Call AFTER archiving to the archive API. */
export const deleteMessagesBatch = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    message_ids: t.array(t.u64()),
  },
  (ctx: any, { tenant_id, message_ids }) => {
    requireTenant(ctx, tenant_id);
    for (const id of message_ids) {
      const msg = ctx.db.messages.id.find(id);
      if (msg && msg.tenant_id === tenant_id) {
        deleteKgVertex(ctx, 'messages', id);
        ctx.db.messages.id.delete(id);
      }
    }
  }
);

/** Delete messages older than N days for a tenant.
 *  The client should first read these messages and archive them via the archive API,
 *  then call this reducer to free RAM. */
export const archiveMessages = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    days_old: t.u32(),
  },
  (ctx: any, { tenant_id, days_old }) => {
    requireTenant(ctx, tenant_id);
    const cutoff = new Date(ctx.timestamp.toDate().getTime() - days_old * 24 * 60 * 60 * 1000);
    const cutoffTs = Timestamp.fromDate(cutoff);
    const toDelete: bigint[] = [];
    for (const msg of ctx.db.messages.iter()) {
      if (msg.tenant_id !== tenant_id) continue;
      if (msg.created_at.toDate().getTime() < cutoffTs.toDate().getTime()) {
        toDelete.push(msg.id);
      }
    }
    for (const id of toDelete) {
      deleteKgVertex(ctx, 'messages', id);
      ctx.db.messages.id.delete(id);
    }
  }
);

/** Delete activities older than N days. Client should archive first. */
export const pruneOldActivities = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    days_old: t.u32(),
  },
  (ctx: any, { tenant_id, days_old }) => {
    requireTenant(ctx, tenant_id);
    const cutoff = new Date(ctx.timestamp.toDate().getTime() - days_old * 24 * 60 * 60 * 1000);
    const cutoffTs = Timestamp.fromDate(cutoff);
    const toDelete: bigint[] = [];
    for (const act of ctx.db.activities.iter()) {
      if (act.tenant_id !== tenant_id) continue;
      if (act.created_at.toDate().getTime() < cutoffTs.toDate().getTime()) {
        toDelete.push(act.id);
      }
    }
    for (const id of toDelete) {
      ctx.db.activities.id.delete(id);
    }
  }
);

// ---------------------------------------------------------------------------
// Product reducers
// ---------------------------------------------------------------------------

export const createProduct = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    name: t.string(),
    sku: t.option(t.string()),
    description: t.option(t.string()),
    price: t.u64(),
    cost: t.option(t.u64()),
    currency: t.string(),
    stock_quantity: t.option(t.u32()),
  },
  (ctx: any, { tenant_id, name, sku, description, price, cost, currency, stock_quantity }) => {
    requireTenant(ctx, tenant_id);
    const product = ctx.db.products.insert({
      id: 0n,
      tenant_id,
      name,
      sku,
      description,
      price,
      cost,
      currency,
      stock_quantity,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
    syncKgVertex(ctx, tenant_id, { tag: 'Product' }, 'products', product.id, { name, sku, price, currency });
  }
);

export const updateProduct = spacetimedb.reducer(
  {
    id: t.u64(),
    name: t.string(),
    sku: t.option(t.string()),
    description: t.option(t.string()),
    price: t.u64(),
    cost: t.option(t.u64()),
    currency: t.string(),
    stock_quantity: t.option(t.u32()),
  },
  (ctx: any, { id, name, sku, description, price, cost, currency, stock_quantity }) => {
    const product = ctx.db.products.id.find(id);
    if (!product) throw new Error('Product not found');
    requireTenant(ctx, product.tenant_id);
    ctx.db.products.id.update({
      ...product,
      name,
      sku,
      description,
      price,
      cost,
      currency,
      stock_quantity,
      updated_at: ctx.timestamp,
    });
    syncKgVertex(ctx, product.tenant_id, { tag: 'Product' }, 'products', id, { name, sku, price, currency });
  }
);

export const deleteProduct = spacetimedb.reducer(
  { id: t.u64() },
  (ctx: any, { id }) => {
    const product = ctx.db.products.id.find(id);
    if (!product) throw new Error('Product not found');
    requireTenant(ctx, product.tenant_id);
    deleteKgVertex(ctx, 'products', id);
    ctx.db.products.id.delete(id);
  }
);

// ---------------------------------------------------------------------------
// Invoice reducers
// ---------------------------------------------------------------------------

export const createInvoice = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    invoice_number: t.string(),
    contact_id: t.u64(),
    company_id: t.option(t.u64()),
    issue_date: t.timestamp(),
    due_date: t.timestamp(),
    subtotal: t.u64(),
    tax_amount: t.u64(),
    total: t.u64(),
    currency: t.string(),
  },
  (ctx: any, { tenant_id, invoice_number, contact_id, company_id, issue_date, due_date, subtotal, tax_amount, total, currency }) => {
    requireTenant(ctx, tenant_id);
    const invoice = ctx.db.invoices.insert({
      id: 0n,
      tenant_id,
      invoice_number,
      contact_id,
      company_id,
      issue_date,
      due_date,
      subtotal,
      tax_amount,
      total,
      currency,
      status: { tag: 'Draft' },
      lhdn_validation_status: { tag: 'Pending' },
      lhdn_uuid: undefined,
      lhdn_qr_code: undefined,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
    syncKgVertex(ctx, tenant_id, { tag: 'Invoice' }, 'invoices', invoice.id, { invoice_number, total, currency, status: 'Draft' });

    const invoiceVertexId = findKgVertexId(ctx, tenant_id, 'invoices', invoice.id);
    const contactVertexId = findKgVertexId(ctx, tenant_id, 'contacts', contact_id);
    if (invoiceVertexId && contactVertexId) {
      syncKgEdge(ctx, tenant_id, invoiceVertexId, contactVertexId, { tag: 'BelongsTo' });
    }
    if (company_id !== undefined && invoiceVertexId) {
      const companyVertexId = findKgVertexId(ctx, tenant_id, 'companies', company_id);
      if (companyVertexId) {
        syncKgEdge(ctx, tenant_id, invoiceVertexId, companyVertexId, { tag: 'RelatedTo' });
      }
    }
  }
);

export const updateInvoice = spacetimedb.reducer(
  {
    id: t.u64(),
    invoice_number: t.string(),
    issue_date: t.timestamp(),
    due_date: t.timestamp(),
    subtotal: t.u64(),
    tax_amount: t.u64(),
    total: t.u64(),
    currency: t.string(),
    status: invoiceStatus,
  },
  (ctx: any, { id, invoice_number, issue_date, due_date, subtotal, tax_amount, total, currency, status }) => {
    const invoice = ctx.db.invoices.id.find(id);
    if (!invoice) throw new Error('Invoice not found');
    requireTenant(ctx, invoice.tenant_id);
    ctx.db.invoices.id.update({
      ...invoice,
      invoice_number,
      issue_date,
      due_date,
      subtotal,
      tax_amount,
      total,
      currency,
      status,
      updated_at: ctx.timestamp,
    });
    syncKgVertex(ctx, invoice.tenant_id, { tag: 'Invoice' }, 'invoices', id, { invoice_number, total, currency, status: status.tag });
  }
);

export const deleteInvoice = spacetimedb.reducer(
  { id: t.u64() },
  (ctx: any, { id }) => {
    const invoice = ctx.db.invoices.id.find(id);
    if (!invoice) throw new Error('Invoice not found');
    requireTenant(ctx, invoice.tenant_id);
    // Delete line items
    for (const item of ctx.db.invoice_items.iter()) {
      if (item.invoice_id === id && item.tenant_id === invoice.tenant_id) {
        deleteKgVertex(ctx, 'invoice_items', item.id);
        ctx.db.invoice_items.id.delete(item.id);
      }
    }
    // Cascade delete payments and KB data
    deletePaymentsForInvoice(ctx, id);
    pruneEntityKnowledgeBase(ctx, 'invoices', id);
    deleteKgVertex(ctx, 'invoices', id);
    ctx.db.invoices.id.delete(id);
  }
);

export const addInvoiceItem = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    invoice_id: t.u64(),
    product_id: t.option(t.u64()),
    description: t.string(),
    quantity: t.u32(),
    unit_price: t.u64(),
    total: t.u64(),
  },
  (ctx: any, { tenant_id, invoice_id, product_id, description, quantity, unit_price, total }) => {
    requireTenant(ctx, tenant_id);
    const item = ctx.db.invoice_items.insert({
      id: 0n,
      tenant_id,
      invoice_id,
      product_id,
      description,
      quantity,
      unit_price,
      total,
    });
    syncKgVertex(ctx, tenant_id, { tag: 'InvoiceItem' }, 'invoice_items', item.id, { description, quantity, total });
    const itemVertexId = findKgVertexId(ctx, tenant_id, 'invoice_items', item.id);
    const invoiceVertexId = findKgVertexId(ctx, tenant_id, 'invoices', invoice_id);
    if (itemVertexId && invoiceVertexId) {
      syncKgEdge(ctx, tenant_id, itemVertexId, invoiceVertexId, { tag: 'PartOf' });
    }
    if (product_id !== undefined && itemVertexId) {
      const productVertexId = findKgVertexId(ctx, tenant_id, 'products', product_id);
      if (productVertexId) {
        syncKgEdge(ctx, tenant_id, itemVertexId, productVertexId, { tag: 'RelatedTo' });
      }
    }
  }
);

export const removeInvoiceItem = spacetimedb.reducer(
  { id: t.u64() },
  (ctx: any, { id }) => {
    const item = ctx.db.invoice_items.id.find(id);
    if (!item) throw new Error('Invoice item not found');
    requireTenant(ctx, item.tenant_id);
    ctx.db.invoice_items.id.delete(id);
  }
);

// ---------------------------------------------------------------------------
// Payment reducers
// ---------------------------------------------------------------------------

export const recordPayment = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    invoice_id: t.option(t.u64()),
    contact_id: t.u64(),
    amount: t.u64(),
    currency: t.string(),
    method: paymentMethod,
    gateway_reference: t.option(t.string()),
  },
  (ctx: any, { tenant_id, invoice_id, contact_id, amount, currency, method, gateway_reference }) => {
    requireTenant(ctx, tenant_id);
    const payment = ctx.db.payments.insert({
      id: 0n,
      tenant_id,
      invoice_id,
      contact_id,
      amount,
      currency,
      method,
      gateway_reference,
      status: { tag: 'Completed' },
      created_at: ctx.timestamp,
    });

    if (invoice_id !== undefined) {
      const invoice = ctx.db.invoices.id.find(invoice_id);
      if (invoice && invoice.tenant_id === tenant_id) {
        ctx.db.invoices.id.update({ ...invoice, status: { tag: 'Paid' }, updated_at: ctx.timestamp });
      }
    }

    syncKgVertex(ctx, tenant_id, { tag: 'Payment' }, 'payments', payment.id, { amount, currency, method: method.tag, status: 'Completed' });

    const paymentVertexId = findKgVertexId(ctx, tenant_id, 'payments', payment.id);
    const contactVertexId = findKgVertexId(ctx, tenant_id, 'contacts', contact_id);
    if (paymentVertexId && contactVertexId) {
      syncKgEdge(ctx, tenant_id, paymentVertexId, contactVertexId, { tag: 'Paid' });
    }
    if (invoice_id !== undefined && paymentVertexId) {
      const invoiceVertexId = findKgVertexId(ctx, tenant_id, 'invoices', invoice_id);
      if (invoiceVertexId) {
        syncKgEdge(ctx, tenant_id, paymentVertexId, invoiceVertexId, { tag: 'PaidFor' });
      }
    }
  }
);

export const refundPayment = spacetimedb.reducer(
  { id: t.u64() },
  (ctx: any, { id }) => {
    const payment = ctx.db.payments.id.find(id);
    if (!payment) throw new Error('Payment not found');
    requireTenant(ctx, payment.tenant_id);
    ctx.db.payments.id.update({ ...payment, status: { tag: 'Refunded' } });
  }
);

// ---------------------------------------------------------------------------
// Tenant membership admin
// ---------------------------------------------------------------------------

export const seedDemoData = spacetimedb.reducer(
  { language: t.string() },
  (ctx: any, { language }) => {
    const lang = language || 'en';
    const TENANT_ID = 1n;
    const now = ctx.timestamp;

    // Seed pipeline
    const pipeline = ctx.db.pipelines.insert({
      id: 0n, tenant_id: TENANT_ID, name: 'Sales Pipeline',
      created_at: now, updated_at: now,
    });

    // Seed stages
    const stages = [
      { name: 'Lead', order: 0, prob: 10 },
      { name: 'Qualified', order: 1, prob: 25 },
      { name: 'Proposal', order: 2, prob: 50 },
      { name: 'Negotiation', order: 3, prob: 75 },
      { name: 'Closed Won', order: 4, prob: 100 },
    ];
    const stageIds: bigint[] = [];
    for (const s of stages) {
      const st = ctx.db.pipeline_stages.insert({
        id: 0n, tenant_id: TENANT_ID, pipeline_id: pipeline.id,
        name: s.name, order_index: s.order, win_probability: s.prob,
        created_at: now, updated_at: now,
      });
      stageIds.push(st.id);
    }

    // Seed companies
    const companies = [
      { name: 'TechVenture Sdn Bhd', reg: '201901012345', industry: 'Technology', phone: '+603-2288-1000', email: 'hello@techventure.my', website: 'https://techventure.my', address: '{"street":"Level 12, Menara Global","city":"Kuala Lumpur","postcode":"50450","state":"Wilayah Persekutuan"}', notes: 'Long-term client. Interested in enterprise package.' },
      { name: 'GreenLeaf Catering', reg: '202003067890', industry: 'F&B', phone: '+603-7722-3300', email: 'orders@greenleaf.my', website: 'https://greenleaf.my', address: '{"street":"No 45, Jalan SS15/4","city":"Subang Jaya","postcode":"47500","state":"Selangor"}', notes: 'Catering for corporate events. Seasonal demand spikes.' },
      { name: 'Metro Logistics', reg: '201505012233', industry: 'Logistics', phone: '+603-5566-8800', email: 'biz@metrolog.my', website: 'https://metrolog.my', address: '{"street":"Lot 12, Jalan Kemajuan","city":"Shah Alam","postcode":"40150","state":"Selangor"}', notes: 'Wants integration with their WMS.' },
      { name: 'Durian Digital Marketing', reg: '202110054321', industry: 'Marketing', phone: '+6019-876-5432', email: 'hello@durian.digital', website: 'https://durian.digital', address: '{"street":"Co-labs, One Utama","city":"Petaling Jaya","postcode":"47800","state":"Selangor"}', notes: 'Referral from TechVenture. High growth startup.' },
      { name: 'Palm Oil Plantation Berhad', reg: '199805002211', industry: 'Agriculture', phone: '+609-555-1212', email: 'procurement@popb.my', website: 'https://popb.my', address: '{"street":"KM45, Jalan Kuantan","city":"Kuantan","postcode":"25200","state":"Pahang"}', notes: 'Large enterprise. Long sales cycle.' },
    ];
    const companyIds: bigint[] = [];
    for (const c of companies) {
      const co = ctx.db.companies.insert({
        id: 0n, tenant_id: TENANT_ID, name: c.name,
        registration_number: c.reg, industry: c.industry,
        phone: c.phone, email: c.email, website: c.website,
        address: c.address, billing_address: c.address,
        notes: c.notes,
        created_at: now, updated_at: now,
      });
      companyIds.push(co.id);
    }

    // Seed contacts
    const contacts = [
      { name: 'Ahmad bin Ismail', email: 'ahmad@techventure.my', phone: '+6012-345-6789', status: 'Lead', source: 'Website', companyIdx: 0 },
      { name: 'Siti Nurhaliza', email: 'siti@greenleaf.my', phone: '+6013-456-7890', status: 'Prospect', source: 'Whatsapp', companyIdx: 1 },
      { name: 'Rajesh Kumar', email: 'rajesh@metrolog.my', phone: '+6014-567-8901', status: 'Customer', source: 'Email', companyIdx: 2 },
      { name: 'Lim Mei Ling', email: 'meiling@techventure.my', phone: '+6015-678-9012', status: 'Lead', source: 'Tiktok', companyIdx: 0 },
      { name: 'Mohd Faizal', email: 'faizal@greenleaf.my', phone: '+6016-789-0123', status: 'Customer', source: 'Manual', companyIdx: 1 },
      { name: 'Wong Kah Wai', email: 'kahwai@durian.digital', phone: '+6017-890-1234', status: 'Prospect', source: 'Website', companyIdx: 3 },
      { name: 'Nurul Ain', email: 'nurul@popb.my', phone: '+6018-901-2345', status: 'Lead', source: 'Email', companyIdx: 4 },
      { name: 'Chen Wei Ming', email: 'weiming@techventure.my', phone: '+6019-012-3456', status: 'Customer', source: 'Referral', companyIdx: 0 },
    ];
    const contactIds: bigint[] = [];
    for (const c of contacts) {
      const co = ctx.db.contacts.insert({
        id: 0n, tenant_id: TENANT_ID, email: c.email, phone: c.phone, name: c.name,
        company_id: c.companyIdx !== undefined ? companyIds[c.companyIdx] : undefined,
        source: { tag: c.source }, status: { tag: c.status },
        assigned_to: undefined, custom_fields: '{}',
        created_at: now, updated_at: now,
      });
      contactIds.push(co.id);
    }

    // Seed deals
    const deals = [
      { name: 'TechVenture CRM License', contactIdx: 0, companyIdx: 0, stageIdx: 2, value: 1500000n },
      { name: 'GreenLeaf Annual Contract', contactIdx: 1, companyIdx: 1, stageIdx: 3, value: 850000n },
      { name: 'Metro Logistics Integration', contactIdx: 2, companyIdx: 2, stageIdx: 1, value: 2200000n },
      { name: 'TechVenture Support Package', contactIdx: 3, companyIdx: 0, stageIdx: 0, value: 450000n },
      { name: 'Durian Digital Onboarding', contactIdx: 5, companyIdx: 3, stageIdx: 2, value: 680000n },
      { name: 'POPB Enterprise License', contactIdx: 6, companyIdx: 4, stageIdx: 1, value: 5000000n },
      { name: 'GreenLeaf Event Package', contactIdx: 4, companyIdx: 1, stageIdx: 4, value: 320000n },
      { name: 'TechVenture Add-on Users', contactIdx: 7, companyIdx: 0, stageIdx: 3, value: 280000n },
    ];
    for (const d of deals) {
      ctx.db.deals.insert({
        id: 0n, tenant_id: TENANT_ID, name: d.name,
        contact_id: contactIds[d.contactIdx],
        company_id: d.companyIdx !== undefined ? companyIds[d.companyIdx] : undefined,
        pipeline_id: pipeline.id,
        stage_id: stageIds[d.stageIdx],
        value: d.value, currency: 'MYR',
        probability: stages[d.stageIdx].prob,
        expected_close: undefined, actual_close: undefined,
        status: { tag: 'Open' },
        created_at: now, updated_at: now,
      });
    }

    // Seed products
    const products = [
      { name: 'CRM Pro License', sku: 'CRM-PRO-01', price: 150000n },
      { name: 'Support Premium', sku: 'SUP-PREM-01', price: 45000n },
      { name: 'CRM Enterprise Bundle', sku: 'CRM-ENT-01', price: 450000n },
    ];
    for (const p of products) {
      ctx.db.products.insert({
        id: 0n, tenant_id: TENANT_ID, name: p.name, sku: p.sku,
        description: undefined, price: p.price, cost: undefined,
        currency: 'MYR', stock_quantity: undefined,
        created_at: now, updated_at: now,
      });
    }

    // Seed invoices
    const invoices = [
      { num: 'INV-2024-001', contactIdx: 2, total: 2200000n, status: 'Paid' },
      { num: 'INV-2024-002', contactIdx: 4, total: 320000n, status: 'Paid' },
      { num: 'INV-2024-003', contactIdx: 0, total: 750000n, status: 'Sent' },
      { num: 'INV-2024-004', contactIdx: 5, total: 340000n, status: 'Overdue' },
    ];
    for (const inv of invoices) {
      const issue = new Date(now.toDate().getTime() - 30 * 86400000);
      const due = new Date(issue.getTime() + 14 * 86400000);
      ctx.db.invoices.insert({
        id: 0n, tenant_id: TENANT_ID,
        invoice_number: inv.num,
        contact_id: contactIds[inv.contactIdx],
        issue_date: Timestamp.fromDate(issue),
        due_date: Timestamp.fromDate(due),
        subtotal: BigInt(Math.round(Number(inv.total) * 0.9)),
        tax_amount: BigInt(Math.round(Number(inv.total) * 0.1)),
        total: inv.total,
        currency: 'MYR',
        status: { tag: inv.status },
        lhdn_validation_status: { tag: 'Validated' },
        created_at: now, updated_at: now,
      });
    }

    // Seed activities
    const activities = [
      { contactIdx: 0, type: 'Call', desc: 'Initial discovery call with Ahmad' },
      { contactIdx: 1, type: 'Whatsapp', desc: 'Sent pricing brochure to Siti' },
      { contactIdx: 2, type: 'Meeting', desc: 'Quarterly review with Rajesh' },
      { contactIdx: 0, type: 'Email', desc: 'Follow-up on proposal' },
      { contactIdx: 3, type: 'Call', desc: 'Demo walkthrough for Mei Ling' },
      { contactIdx: 5, type: 'Meeting', desc: 'Kickoff with Durian Digital team' },
      { contactIdx: 6, type: 'Email', desc: 'Sent enterprise quote to Nurul' },
      { contactIdx: 7, type: 'Whatsapp', desc: 'Confirmed add-on license count' },
    ];
    for (const a of activities) {
      ctx.db.activities.insert({
        id: 0n, tenant_id: TENANT_ID,
        contact_id: contactIds[a.contactIdx],
        deal_id: undefined,
        type: { tag: a.type },
        description: a.desc,
        created_by: 1n,
        created_at: now,
      });
    }

    // Seed conversations
    const convs = [
      { contactIdx: 0, channel: 'Email', unread: 2 },
      { contactIdx: 1, channel: 'Whatsapp', unread: 1 },
      { contactIdx: 2, channel: 'Email', unread: 0 },
    ];
    const convIds: bigint[] = [];
    for (const cv of convs) {
      const c = ctx.db.conversations.insert({
        id: 0n, tenant_id: TENANT_ID,
        contact_id: contactIds[cv.contactIdx],
        channel: { tag: cv.channel },
        channel_conversation_id: `demo-${cv.contactIdx}`,
        status: { tag: 'Active' },
        unread_count: cv.unread,
        last_message_at: now,
        created_at: now, updated_at: now,
      });
      convIds.push(c.id);
    }

    // Seed messages
    const msgs = [
      { convIdx: 0, body: 'Hi, can we schedule a demo this week?', dir: 'Inbound' },
      { convIdx: 0, body: 'Sure, how about Thursday 2pm?', dir: 'Outbound' },
      { convIdx: 1, body: 'Thanks for the quote, we need to discuss internally.', dir: 'Inbound' },
      { convIdx: 2, body: 'Invoice INV-2024-001 has been paid. Thank you!', dir: 'Outbound' },
    ];
    for (const m of msgs) {
      ctx.db.messages.insert({
        id: 0n, tenant_id: TENANT_ID,
        conversation_id: convIds[m.convIdx],
        sender_type: { tag: m.dir === 'Inbound' ? 'Contact' : 'User' },
        sender_id: 1n,
        body: m.body,
        attachments: '[]',
        direction: { tag: m.dir },
        status: { tag: 'Read' },
        created_at: now,
      });
    }

    // Seed social campaigns
    const campaign = ctx.db.social_campaigns.insert({
      id: 0n, tenant_id: TENANT_ID,
      name: 'Q2 Digital Growth',
      theme: 'SME digital transformation stories',
      objective: { tag: 'Awareness' },
      platforms: '["TikTok","Whatsapp","Instagram"]',
      start_date: now,
      end_date: Timestamp.fromDate(new Date(now.toDate().getTime() + 30 * 86400000)),
      status: { tag: 'Active' },
      created_at: now, updated_at: now,
    });

    // Seed social posts
    const postContents = [
      { platform: 'TikTok', content: '[EN] 5 ways Malaysian SMEs are using CRM to close deals 2x faster 🚀 #SMEMalaysia #CRM [BM] 5 cara SME Malaysia guna CRM untuk tutup deal 2x lebih pantas!', hashtags: '["#SMEMalaysia","#CRM","#DigitalTransformation","#PerniagaanMalaysia"]' },
      { platform: 'Whatsapp', content: '[EN] Hi {{contact.name}}! We just helped a logistics company in Shah Alam save 15 hours/week with automation. Want to see how? Reply YES [BM] Hi {{contact.name}}! Kami baru bantu syarikat logistik di Shah Alam jimat 15 jam/minggu dengan automasi. Nak tahu caranya? Balas YA', hashtags: '[]' },
      { platform: 'Instagram', content: '[EN] Behind the scenes: How our team builds AI workflows for Malaysian F&B businesses ☕🇲🇾 [BM] Di sebalik tabir: Bagaimana pasukan kami bina workflow AI untuk perniagaan F&B Malaysia', hashtags: '["#AIForBusiness","#MalaysiaSME","#FBusiness","#TechMalaysia"]' },
    ];
    for (let i = 0; i < postContents.length; i++) {
      const p = postContents[i];
      const scheduled = Timestamp.fromDate(new Date(now.toDate().getTime() + (i + 1) * 86400000));
      ctx.db.social_posts.insert({
        id: 0n, tenant_id: TENANT_ID,
        campaign_id: campaign.id,
        platform: { tag: p.platform },
        content: p.content,
        image_url: undefined,
        hashtags: p.hashtags,
        scheduled_at: scheduled,
        published_at: undefined,
        status: { tag: 'Draft' },
        target_audience: 'SME owners 25-45 in Klang Valley',
        engagement_estimate: undefined,
        metadata: '{}',
        created_at: now, updated_at: now,
      });
    }

    // Seed rich inbox conversations (replaces basic convos above with 12 realistic scenarios)
    seedInboxData(ctx, { tenant_id: TENANT_ID, language: lang });

    console.info('Demo data seeded successfully');
  }
);

export const addTenantMember = spacetimedb.reducer(
  {
    identity: t.identity(),
    tenant_id: t.u64(),
  },
  (ctx: any, { identity, tenant_id }) => {
    ctx.db.tenant_member.insert({ identity, tenant_id });
  }
);

// ---------------------------------------------------------------------------
// Workflow reducers
// ---------------------------------------------------------------------------

export const createWorkflow = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    name: t.string(),
    description: t.string(),
    trigger_type: t.string(),
    trigger_config: t.string(),
    steps: t.string(),
  },
  (ctx: any, { tenant_id, name, description, trigger_type, trigger_config, steps }) => {
    const workflow = ctx.db.workflows.insert({
      id: 0n, tenant_id, name, description,
      trigger_type, trigger_config, steps,
      status: 'draft',
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
    syncKgVertex(ctx, tenant_id, { tag: 'Workflow' }, 'workflows', workflow.id, { name, trigger_type, status: 'draft' });
  }
);

export const updateWorkflow = spacetimedb.reducer(
  {
    id: t.u64(),
    name: t.string(),
    description: t.string(),
    trigger_type: t.string(),
    trigger_config: t.string(),
    steps: t.string(),
  },
  (ctx: any, { id, name, description, trigger_type, trigger_config, steps }) => {
    const wf = ctx.db.workflows.id.find(id);
    if (!wf) throw new Error('Workflow not found');
    ctx.db.workflows.id.update({
      ...wf, name, description, trigger_type, trigger_config, steps,
      updated_at: ctx.timestamp,
    });
  }
);

export const toggleWorkflowStatus = spacetimedb.reducer(
  {
    id: t.u64(),
    status: t.string(),
  },
  (ctx: any, { id, status }) => {
    const wf = ctx.db.workflows.id.find(id);
    if (!wf) throw new Error('Workflow not found');
    ctx.db.workflows.id.update({ ...wf, status, updated_at: ctx.timestamp });
  }
);

export const deleteWorkflow = spacetimedb.reducer(
  { id: t.u64() },
  (ctx: any, { id }) => {
    const wf = ctx.db.workflows.id.find(id);
    if (!wf) throw new Error('Workflow not found');
    ctx.db.workflows.id.delete(id);
  }
);

// ---------------------------------------------------------------------------
// Social Campaign reducers
// ---------------------------------------------------------------------------

export const createSocialCampaign = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    name: t.string(),
    theme: t.string(),
    objective: campaignObjective,
    platforms: t.string(),
    start_date: t.timestamp(),
    end_date: t.timestamp(),
  },
  (ctx: any, { tenant_id, name, theme, objective, platforms, start_date, end_date }) => {
    requireTenant(ctx, tenant_id);
    const campaign = ctx.db.social_campaigns.insert({
      id: 0n, tenant_id, name, theme, objective, platforms,
      start_date, end_date,
      status: { tag: 'Draft' },
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
    syncKgVertex(ctx, tenant_id, { tag: 'SocialCampaign' }, 'social_campaigns', campaign.id, { name, theme, objective: objective.tag, platforms: JSON.parse(platforms) });
  }
);

export const updateSocialCampaign = spacetimedb.reducer(
  {
    id: t.u64(),
    name: t.string(),
    theme: t.string(),
    objective: campaignObjective,
    platforms: t.string(),
    start_date: t.timestamp(),
    end_date: t.timestamp(),
    status: campaignStatus,
  },
  (ctx: any, { id, name, theme, objective, platforms, start_date, end_date, status }) => {
    const camp = ctx.db.social_campaigns.id.find(id);
    if (!camp) throw new Error('Campaign not found');
    requireTenant(ctx, camp.tenant_id);
    ctx.db.social_campaigns.id.update({
      ...camp, name, theme, objective, platforms, start_date, end_date, status,
      updated_at: ctx.timestamp,
    });
  }
);

export const deleteSocialCampaign = spacetimedb.reducer(
  { id: t.u64() },
  (ctx: any, { id }) => {
    const camp = ctx.db.social_campaigns.id.find(id);
    if (!camp) throw new Error('Campaign not found');
    requireTenant(ctx, camp.tenant_id);
    ctx.db.social_campaigns.id.delete(id);
  }
);

// ---------------------------------------------------------------------------
// Social Post reducers
// ---------------------------------------------------------------------------

export const createSocialPost = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    campaign_id: t.option(t.u64()),
    platform: socialPostPlatform,
    content: t.string(),
    image_url: t.option(t.string()),
    hashtags: t.string(),
    scheduled_at: t.timestamp(),
    target_audience: t.option(t.string()),
    metadata: t.string(),
  },
  (ctx: any, { tenant_id, campaign_id, platform, content, image_url, hashtags, scheduled_at, target_audience, metadata }) => {
    requireTenant(ctx, tenant_id);
    const post = ctx.db.social_posts.insert({
      id: 0n, tenant_id, campaign_id, platform, content,
      image_url, hashtags, scheduled_at,
      published_at: undefined,
      status: { tag: 'Draft' },
      target_audience, engagement_estimate: undefined,
      metadata,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
    syncKgVertex(ctx, tenant_id, { tag: 'SocialPost' }, 'social_posts', post.id, { platform: platform.tag, content: content.slice(0, 200), hashtags: JSON.parse(hashtags), status: 'Draft' });
    const postVertexId = findKgVertexId(ctx, tenant_id, 'social_posts', post.id);
    if (campaign_id !== undefined && postVertexId) {
      const campaignVertexId = findKgVertexId(ctx, tenant_id, 'social_campaigns', campaign_id);
      if (campaignVertexId) {
        syncKgEdge(ctx, tenant_id, postVertexId, campaignVertexId, { tag: 'PartOf' });
      }
    }
  }
);

export const updateSocialPost = spacetimedb.reducer(
  {
    id: t.u64(),
    campaign_id: t.option(t.u64()),
    platform: socialPostPlatform,
    content: t.string(),
    image_url: t.option(t.string()),
    hashtags: t.string(),
    scheduled_at: t.timestamp(),
    target_audience: t.option(t.string()),
    metadata: t.string(),
  },
  (ctx: any, { id, campaign_id, platform, content, image_url, hashtags, scheduled_at, target_audience, metadata }) => {
    const post = ctx.db.social_posts.id.find(id);
    if (!post) throw new Error('Post not found');
    requireTenant(ctx, post.tenant_id);
    ctx.db.social_posts.id.update({
      ...post, campaign_id, platform, content, image_url,
      hashtags, scheduled_at, target_audience, metadata,
      updated_at: ctx.timestamp,
    });
  }
);

export const deleteSocialPost = spacetimedb.reducer(
  { id: t.u64() },
  (ctx: any, { id }) => {
    const post = ctx.db.social_posts.id.find(id);
    if (!post) throw new Error('Post not found');
    requireTenant(ctx, post.tenant_id);
    ctx.db.social_posts.id.delete(id);
  }
);

export const publishSocialPost = spacetimedb.reducer(
  { id: t.u64() },
  (ctx: any, { id }) => {
    const post = ctx.db.social_posts.id.find(id);
    if (!post) throw new Error('Post not found');
    requireTenant(ctx, post.tenant_id);
    ctx.db.social_posts.id.update({
      ...post,
      status: { tag: 'Published' },
      published_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
  }
);

export const broadcastWhatsApp = spacetimedb.reducer(
  {
    post_id: t.u64(),
    contact_ids: t.string(), // JSON array of contact IDs
  },
  (ctx: any, { post_id, contact_ids }) => {
    const post = ctx.db.social_posts.id.find(post_id);
    if (!post) throw new Error('Post not found');
    requireTenant(ctx, post.tenant_id);

    const ids: bigint[] = JSON.parse(contact_ids);
    for (const contactId of ids) {
      // Find or create WhatsApp conversation
      let conv: any;
      for (const c of ctx.db.conversations.iter()) {
        if (c.tenant_id === post.tenant_id && c.contact_id === contactId) {
          conv = c;
          break;
        }
      }
      if (!conv || conv.channel.tag !== 'Whatsapp') {
        // Create a new WhatsApp conversation
        const newConv = ctx.db.conversations.insert({
          id: 0n,
          tenant_id: post.tenant_id,
          contact_id: contactId,
          channel: { tag: 'Whatsapp' },
          channel_conversation_id: `wa-${contactId}`,
          status: { tag: 'Active' },
          last_message_at: ctx.timestamp,
          unread_count: 0,
          created_at: ctx.timestamp,
          updated_at: ctx.timestamp,
        });
        conv = newConv;
      }

      // Send the broadcast message
      ctx.db.messages.insert({
        id: 0n,
        tenant_id: post.tenant_id,
        conversation_id: conv.id,
        sender_type: { tag: 'User' },
        sender_id: 1n,
        body: post.content,
        attachments: post.image_url ? JSON.stringify([{ url: post.image_url }]) : '[]',
        direction: { tag: 'Outbound' },
        status: { tag: 'Sent' },
        external_message_id: undefined,
        created_at: ctx.timestamp,
      });

      // Update conversation last message
      ctx.db.conversations.id.update({
        ...conv,
        last_message_at: ctx.timestamp,
        updated_at: ctx.timestamp,
      });
    }

    // Mark post as published
    ctx.db.social_posts.id.update({
      ...post,
      status: { tag: 'Published' },
      published_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
  }
);


// ---------------------------------------------------------------------------
// Document reducers
// ---------------------------------------------------------------------------

export const createDocument = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    title: t.string(),
    source_url: t.option(t.string()),
    content_text: t.string(),
    file_type: t.string(),
    extracted_summary: t.string(),
    extracted_keywords: t.string(),
    metadata: t.string(),
    uploaded_by: t.u64(),
    target_entity_table: t.option(t.string()),
    target_entity_id: t.option(t.u64()),
  },
  (ctx, args) => {
    requireTenant(ctx, args.tenant_id);
    const doc = ctx.db.documents.insert({
      id: 0n,
      tenant_id: args.tenant_id,
      title: args.title,
      source_url: args.source_url,
      content_text: args.content_text,
      file_type: args.file_type,
      extracted_summary: args.extracted_summary,
      extracted_keywords: args.extracted_keywords,
      metadata: args.metadata,
      uploaded_by: args.uploaded_by,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
    syncKgVertex(ctx, args.tenant_id, { tag: 'Document' }, 'documents', doc.id, {
      title: args.title,
      summary: args.extracted_summary,
      keywords: JSON.parse(args.extracted_keywords),
      file_type: args.file_type,
      content_text: args.content_text.slice(0, 500),
    });
    const docVertexId = findKgVertexId(ctx, args.tenant_id, 'documents', doc.id);
    if (docVertexId && args.target_entity_table !== undefined && args.target_entity_id !== undefined) {
      const targetVertexId = findKgVertexId(ctx, args.tenant_id, args.target_entity_table, args.target_entity_id);
      if (targetVertexId) {
        syncKgEdge(ctx, args.tenant_id, docVertexId, targetVertexId, { tag: 'About' });
        syncKgEdge(ctx, args.tenant_id, targetVertexId, docVertexId, { tag: 'HasDocument' });
        // Link to container
        const containerVertexId = findKgVertexId(ctx, args.tenant_id, 'memory_collections', args.target_entity_id);
        if (containerVertexId) {
          syncKgEdge(ctx, args.tenant_id, docVertexId, containerVertexId, { tag: 'ContainedIn' });
        }
      }
    }
  }
);

export const updateDocument = spacetimedb.reducer(
  {
    id: t.u64(),
    title: t.string(),
    extracted_summary: t.string(),
    extracted_keywords: t.string(),
    metadata: t.string(),
  },
  (ctx, { id, title, extracted_summary, extracted_keywords, metadata }) => {
    const doc = ctx.db.documents.id.find(id);
    if (!doc) throw new Error('Document not found');
    requireTenant(ctx, doc.tenant_id);
    ctx.db.documents.id.update({ ...doc, title, extracted_summary, extracted_keywords, metadata, updated_at: ctx.timestamp });
    syncKgVertex(ctx, doc.tenant_id, { tag: 'Document' }, 'documents', id, {
      title, summary: extracted_summary, keywords: JSON.parse(extracted_keywords), file_type: doc.file_type, content_text: doc.content_text.slice(0, 500),
    });
  }
);

export const deleteDocument = spacetimedb.reducer(
  { id: t.u64() },
  (ctx, { id }) => {
    const doc = ctx.db.documents.id.find(id);
    if (!doc) throw new Error('Document not found');
    requireTenant(ctx, doc.tenant_id);
    deleteKgVertex(ctx, 'documents', id);
    ctx.db.documents.id.delete(id);
  }
);

// ---------------------------------------------------------------------------
// Memory reducers
// ---------------------------------------------------------------------------

export const createMemory = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    title: t.string(),
    content: t.string(),
    memory_type: memoryType,
    source_table: t.option(t.string()),
    source_id: t.option(t.u64()),
    created_by: t.u64(),
  },
  (ctx, args) => {
    requireTenant(ctx, args.tenant_id);
    const mem = ctx.db.memories.insert({
      id: 0n,
      tenant_id: args.tenant_id,
      title: args.title,
      content: args.content,
      memory_type: args.memory_type,
      source_table: args.source_table,
      source_id: args.source_id,
      created_by: args.created_by,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
    syncKgVertex(ctx, args.tenant_id, { tag: 'Memory' }, 'memories', mem.id, {
      title: args.title,
      summary: args.content.slice(0, 200),
      memory_type: args.memory_type.tag,
      content_text: args.content,
    });
    const memVertexId = findKgVertexId(ctx, args.tenant_id, 'memories', mem.id);
    if (memVertexId && args.source_table !== undefined && args.source_id !== undefined) {
      const sourceVertexId = findKgVertexId(ctx, args.tenant_id, args.source_table, args.source_id);
      if (sourceVertexId) {
        syncKgEdge(ctx, args.tenant_id, memVertexId, sourceVertexId, { tag: 'About' });
        syncKgEdge(ctx, args.tenant_id, sourceVertexId, memVertexId, { tag: 'HasMemory' });
        const containerVertexId = findKgVertexId(ctx, args.tenant_id, 'memory_collections', args.source_id);
        if (containerVertexId) {
          syncKgEdge(ctx, args.tenant_id, memVertexId, containerVertexId, { tag: 'ContainedIn' });
        }
      }
    }
  }
);

export const updateMemory = spacetimedb.reducer(
  {
    id: t.u64(),
    title: t.string(),
    content: t.string(),
    memory_type: memoryType,
  },
  (ctx, { id, title, content, memory_type }) => {
    const mem = ctx.db.memories.id.find(id);
    if (!mem) throw new Error('Memory not found');
    requireTenant(ctx, mem.tenant_id);
    ctx.db.memories.id.update({ ...mem, title, content, memory_type, updated_at: ctx.timestamp });
    syncKgVertex(ctx, mem.tenant_id, { tag: 'Memory' }, 'memories', id, {
      title, summary: content.slice(0, 200), memory_type: memory_type.tag, content_text: content,
    });
  }
);

export const deleteMemory = spacetimedb.reducer(
  { id: t.u64() },
  (ctx, { id }) => {
    const mem = ctx.db.memories.id.find(id);
    if (!mem) throw new Error('Memory not found');
    requireTenant(ctx, mem.tenant_id);
    deleteKgVertex(ctx, 'memories', id);
    ctx.db.memories.id.delete(id);
  }
);

export const pruneOldMemories = spacetimedb.reducer(
  { tenant_id: t.u64(), days_old: t.u32() },
  (ctx, { tenant_id, days_old }) => {
    requireTenant(ctx, tenant_id);
    const cutoffMs = Number(ctx.timestamp) - days_old * 24 * 60 * 60 * 1000;
    const toDelete: bigint[] = [];
    for (const mem of ctx.db.memories.iter()) {
      if (mem.tenant_id !== tenant_id) continue;
      const memTime = Number(mem.created_at);
      if (memTime < cutoffMs) toDelete.push(mem.id);
    }
    for (const id of toDelete) {
      deleteKgVertex(ctx, 'memories', id);
      ctx.db.memories.id.delete(id);
    }
  }
);

// ---------------------------------------------------------------------------
// Collection reducers
// ---------------------------------------------------------------------------

export const createCollection = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    name: t.string(),
    description: t.string(),
  },
  (ctx, { tenant_id, name, description }) => {
    requireTenant(ctx, tenant_id);
    if (countCollectionsForTenant(ctx, tenant_id) >= MAX_COLLECTIONS_PER_TENANT) {
      throw new Error(`Collection limit reached (${MAX_COLLECTIONS_PER_TENANT}). Delete old containers first.`);
    }
    const coll = ctx.db.memory_collections.insert({
      id: 0n, tenant_id, name, description,
      collection_type: { tag: 'Manual' },
      source_table: undefined, source_id: undefined,
      created_at: ctx.timestamp, updated_at: ctx.timestamp,
    });
    syncKgVertex(ctx, tenant_id, { tag: 'Container' }, 'memory_collections', coll.id, {
      title: name, summary: description, keywords: [], topics: [], sentiment: 0, language: 'en', importance: 0.5,
      raw: { name, description, collection_type: 'Manual' }, extracted_facts: [], content_text: description,
    });
  }
);

export const updateCollection = spacetimedb.reducer(
  {
    id: t.u64(),
    name: t.string(),
    description: t.string(),
  },
  (ctx, { id, name, description }) => {
    const coll = ctx.db.memory_collections.id.find(id);
    if (!coll) throw new Error('Collection not found');
    requireTenant(ctx, coll.tenant_id);
    ctx.db.memory_collections.id.update({ ...coll, name, description, updated_at: ctx.timestamp });
    syncKgVertex(ctx, coll.tenant_id, { tag: 'Container' }, 'memory_collections', id, {
      title: name, summary: description, keywords: [], topics: [], sentiment: 0, language: 'en', importance: 0.5,
      raw: { name, description, collection_type: coll.collection_type.tag }, extracted_facts: [], content_text: description,
    });
  }
);

export const deleteCollection = spacetimedb.reducer(
  { id: t.u64() },
  (ctx, { id }) => {
    const coll = ctx.db.memory_collections.id.find(id);
    if (!coll) throw new Error('Collection not found');
    requireTenant(ctx, coll.tenant_id);
    deleteKgVertex(ctx, 'memory_collections', id);
    ctx.db.memory_collections.id.delete(id);
  }
);

export const addToCollection = spacetimedb.reducer(
  {
    collection_id: t.u64(),
    vertex_id: t.u64(),
  },
  (ctx, { collection_id, vertex_id }) => {
    const coll = ctx.db.memory_collections.id.find(collection_id);
    if (!coll) throw new Error('Collection not found');
    requireTenant(ctx, coll.tenant_id);
    syncKgEdge(ctx, coll.tenant_id, vertex_id, collection_id, { tag: 'ContainedIn' });
  }
);

export const removeFromCollection = spacetimedb.reducer(
  {
    collection_id: t.u64(),
    vertex_id: t.u64(),
  },
  (ctx, { collection_id, vertex_id }) => {
    const coll = ctx.db.memory_collections.id.find(collection_id);
    if (!coll) throw new Error('Collection not found');
    requireTenant(ctx, coll.tenant_id);
    deleteEdgesByRelation(ctx, vertex_id, collection_id, 'ContainedIn');
  }
);

export const pruneOrphanedContainers = spacetimedb.reducer(
  { tenant_id: t.u64() },
  (ctx, { tenant_id }) => {
    requireTenant(ctx, tenant_id);
    // Build sets of valid entity IDs
    const validContacts = new Set<bigint>();
    for (const c of ctx.db.contacts.iter()) validContacts.add(c.id);
    const validCompanies = new Set<bigint>();
    for (const c of ctx.db.companies.iter()) validCompanies.add(c.id);
    const validDeals = new Set<bigint>();
    for (const d of ctx.db.deals.iter()) validDeals.add(d.id);
    const validInvoices = new Set<bigint>();
    for (const inv of ctx.db.invoices.iter()) validInvoices.add(inv.id);

    const toDelete: bigint[] = [];
    for (const coll of ctx.db.memory_collections.iter()) {
      if (coll.tenant_id !== tenant_id) continue;
      // Manual collections (no source) are kept
      if (coll.source_table === undefined || coll.source_id === undefined) continue;

      let exists = false;
      const st = String(coll.source_table);
      const sid = BigInt(coll.source_id);
      if (st === 'contacts') exists = validContacts.has(sid);
      else if (st === 'companies') exists = validCompanies.has(sid);
      else if (st === 'deals') exists = validDeals.has(sid);
      else if (st === 'invoices') exists = validInvoices.has(sid);

      if (!exists) toDelete.push(coll.id);
    }
    for (const id of toDelete) {
      deleteKgVertex(ctx, 'memory_collections', id);
      ctx.db.memory_collections.id.delete(id);
    }
  }
);

// ---------------------------------------------------------------------------
// Knowledge Graph rebuild
// ---------------------------------------------------------------------------

export const rebuildKnowledgeGraph = spacetimedb.reducer(
  { tenant_id: t.u64() },
  (ctx, { tenant_id }) => {
    requireTenant(ctx, tenant_id);

    // --- Users ---
    for (const user of ctx.db.users.iter()) {
      if (user.tenant_id !== tenant_id) continue;
      syncKgVertex(ctx, tenant_id, { tag: 'User' }, 'users', user.id, {
        name: user.name, email: user.email, role: user.role.tag,
      });
    }

    // --- Companies ---
    for (const company of ctx.db.companies.iter()) {
      if (company.tenant_id !== tenant_id) continue;
      syncKgVertex(ctx, tenant_id, { tag: 'Company' }, 'companies', company.id, {
        name: company.name, industry: company.industry ?? undefined,
        phone: company.phone ?? undefined, email: company.email ?? undefined,
      });
    }

    // --- Contacts ---
    for (const contact of ctx.db.contacts.iter()) {
      if (contact.tenant_id !== tenant_id) continue;
      syncKgVertex(ctx, tenant_id, { tag: 'Contact' }, 'contacts', contact.id, {
        name: contact.name, email: contact.email, phone: contact.phone,
        status: contact.status.tag,
      });
      const contactVertexId = findKgVertexId(ctx, tenant_id, 'contacts', contact.id);
      if (!contactVertexId) continue;

      if (contact.company_id !== undefined) {
        const companyVertexId = findKgVertexId(ctx, tenant_id, 'companies', contact.company_id);
        if (companyVertexId) {
          syncKgEdge(ctx, tenant_id, contactVertexId, companyVertexId, { tag: 'WorksAt' });
        }
      }
      if (contact.assigned_to !== undefined) {
        const userVertexId = findKgVertexId(ctx, tenant_id, 'users', contact.assigned_to);
        if (userVertexId) {
          syncKgEdge(ctx, tenant_id, contactVertexId, userVertexId, { tag: 'AssignedTo' });
        }
      }
    }

    // --- Deals ---
    for (const deal of ctx.db.deals.iter()) {
      if (deal.tenant_id !== tenant_id) continue;
      syncKgVertex(ctx, tenant_id, { tag: 'Deal' }, 'deals', deal.id, {
        name: deal.name, value: deal.value, currency: deal.currency,
        status: deal.status.tag, probability: deal.probability,
      });
      const dealVertexId = findKgVertexId(ctx, tenant_id, 'deals', deal.id);
      if (!dealVertexId) continue;

      const contactVertexId = findKgVertexId(ctx, tenant_id, 'contacts', deal.contact_id);
      if (contactVertexId) {
        syncKgEdge(ctx, tenant_id, dealVertexId, contactVertexId, { tag: 'BelongsTo' });
      }
      if (deal.company_id !== undefined) {
        const companyVertexId = findKgVertexId(ctx, tenant_id, 'companies', deal.company_id);
        if (companyVertexId) {
          syncKgEdge(ctx, tenant_id, dealVertexId, companyVertexId, { tag: 'BelongsTo' });
        }
      }
      const stageVertexId = findKgVertexId(ctx, tenant_id, 'pipeline_stages', deal.stage_id);
      if (stageVertexId) {
        syncKgEdge(ctx, tenant_id, dealVertexId, stageVertexId, { tag: 'AtStage' });
      }
    }

    // --- Pipeline Stages ---
    for (const stage of ctx.db.pipeline_stages.iter()) {
      if (stage.tenant_id !== tenant_id) continue;
      syncKgVertex(ctx, tenant_id, { tag: 'PipelineStage' }, 'pipeline_stages', stage.id, {
        name: stage.name, order_index: stage.order_index, win_probability: stage.win_probability,
      });
    }

    // --- Invoices ---
    for (const invoice of ctx.db.invoices.iter()) {
      if (invoice.tenant_id !== tenant_id) continue;
      syncKgVertex(ctx, tenant_id, { tag: 'Invoice' }, 'invoices', invoice.id, {
        invoice_number: invoice.invoice_number, total: invoice.total,
        currency: invoice.currency, status: invoice.status.tag,
      });
      const invVertexId = findKgVertexId(ctx, tenant_id, 'invoices', invoice.id);
      if (!invVertexId) continue;

      const contactVertexId = findKgVertexId(ctx, tenant_id, 'contacts', invoice.contact_id);
      if (contactVertexId) {
        syncKgEdge(ctx, tenant_id, invVertexId, contactVertexId, { tag: 'BelongsTo' });
      }
      if (invoice.company_id !== undefined) {
        const companyVertexId = findKgVertexId(ctx, tenant_id, 'companies', invoice.company_id);
        if (companyVertexId) {
          syncKgEdge(ctx, tenant_id, invVertexId, companyVertexId, { tag: 'BelongsTo' });
        }
      }
    }

    // --- Invoice Items ---
    for (const item of ctx.db.invoice_items.iter()) {
      if (item.tenant_id !== tenant_id) continue;
      syncKgVertex(ctx, tenant_id, { tag: 'InvoiceItem' }, 'invoice_items', item.id, {
        description: item.description, quantity: item.quantity,
        unit_price: item.unit_price, total: item.total,
      });
      const itemVertexId = findKgVertexId(ctx, tenant_id, 'invoice_items', item.id);
      if (!itemVertexId) continue;

      const invVertexId = findKgVertexId(ctx, tenant_id, 'invoices', item.invoice_id);
      if (invVertexId) {
        syncKgEdge(ctx, tenant_id, itemVertexId, invVertexId, { tag: 'PartOf' });
      }
      if (item.product_id !== undefined) {
        const productVertexId = findKgVertexId(ctx, tenant_id, 'products', item.product_id);
        if (productVertexId) {
          syncKgEdge(ctx, tenant_id, itemVertexId, productVertexId, { tag: 'About' });
        }
      }
    }

    // --- Payments ---
    for (const payment of ctx.db.payments.iter()) {
      if (payment.tenant_id !== tenant_id) continue;
      syncKgVertex(ctx, tenant_id, { tag: 'Payment' }, 'payments', payment.id, {
        amount: payment.amount, currency: payment.currency,
        method: payment.method.tag, status: payment.status.tag,
      });
      const payVertexId = findKgVertexId(ctx, tenant_id, 'payments', payment.id);
      if (!payVertexId) continue;

      const contactVertexId = findKgVertexId(ctx, tenant_id, 'contacts', payment.contact_id);
      if (contactVertexId) {
        syncKgEdge(ctx, tenant_id, payVertexId, contactVertexId, { tag: 'Paid' });
      }
      if (payment.invoice_id !== undefined) {
        const invVertexId = findKgVertexId(ctx, tenant_id, 'invoices', payment.invoice_id);
        if (invVertexId) {
          syncKgEdge(ctx, tenant_id, payVertexId, invVertexId, { tag: 'PaidFor' });
        }
      }
    }

    // --- Products ---
    for (const product of ctx.db.products.iter()) {
      if (product.tenant_id !== tenant_id) continue;
      syncKgVertex(ctx, tenant_id, { tag: 'Product' }, 'products', product.id, {
        name: product.name, sku: product.sku ?? undefined,
        price: product.price, currency: product.currency,
      });
    }

    // --- Activities ---
    for (const activity of ctx.db.activities.iter()) {
      if (activity.tenant_id !== tenant_id) continue;
      syncKgVertex(ctx, tenant_id, { tag: 'Activity' }, 'activities', activity.id, {
        type: activity.type.tag, description: activity.description,
      });
      const actVertexId = findKgVertexId(ctx, tenant_id, 'activities', activity.id);
      if (!actVertexId) continue;

      if (activity.contact_id !== undefined) {
        const contactVertexId = findKgVertexId(ctx, tenant_id, 'contacts', activity.contact_id);
        if (contactVertexId) {
          syncKgEdge(ctx, tenant_id, actVertexId, contactVertexId, { tag: 'HadActivity' });
        }
      }
      if (activity.deal_id !== undefined) {
        const dealVertexId = findKgVertexId(ctx, tenant_id, 'deals', activity.deal_id);
        if (dealVertexId) {
          syncKgEdge(ctx, tenant_id, actVertexId, dealVertexId, { tag: 'RelatedTo' });
        }
      }
    }

    // --- Conversations ---
    for (const conv of ctx.db.conversations.iter()) {
      if (conv.tenant_id !== tenant_id) continue;
      syncKgVertex(ctx, tenant_id, { tag: 'Conversation' }, 'conversations', conv.id, {
        channel: conv.channel.tag, status: conv.status.tag,
        unread_count: conv.unread_count,
      });
      const convVertexId = findKgVertexId(ctx, tenant_id, 'conversations', conv.id);
      if (!convVertexId) continue;

      const contactVertexId = findKgVertexId(ctx, tenant_id, 'contacts', conv.contact_id);
      if (contactVertexId) {
        syncKgEdge(ctx, tenant_id, convVertexId, contactVertexId, { tag: 'CommunicatedWith' });
      }
    }

    // --- Messages ---
    for (const msg of ctx.db.messages.iter()) {
      if (msg.tenant_id !== tenant_id) continue;
      syncKgVertex(ctx, tenant_id, { tag: 'Message' }, 'messages', msg.id, {
        body: msg.body.slice(0, 200), direction: msg.direction.tag,
        status: msg.status.tag,
      });
      const msgVertexId = findKgVertexId(ctx, tenant_id, 'messages', msg.id);
      if (!msgVertexId) continue;

      const convVertexId = findKgVertexId(ctx, tenant_id, 'conversations', msg.conversation_id);
      if (convVertexId) {
        syncKgEdge(ctx, tenant_id, msgVertexId, convVertexId, { tag: 'ContainedIn' });
      }
    }

    // --- Documents ---
    for (const doc of ctx.db.documents.iter()) {
      if (doc.tenant_id !== tenant_id) continue;
      syncKgVertex(ctx, tenant_id, { tag: 'Document' }, 'documents', doc.id, {
        title: doc.title, file_type: doc.file_type,
        summary: doc.extracted_summary.slice(0, 200),
      });
    }

    // --- Memories ---
    for (const mem of ctx.db.memories.iter()) {
      if (mem.tenant_id !== tenant_id) continue;
      syncKgVertex(ctx, tenant_id, { tag: 'Memory' }, 'memories', mem.id, {
        title: mem.title, summary: mem.content.slice(0, 200),
        memory_type: mem.memory_type.tag,
      });
      const memVertexId = findKgVertexId(ctx, tenant_id, 'memories', mem.id);
      if (!memVertexId) continue;

      if (mem.source_table !== undefined && mem.source_id !== undefined) {
        const sourceVertexId = findKgVertexId(ctx, tenant_id, mem.source_table, mem.source_id);
        if (sourceVertexId) {
          syncKgEdge(ctx, tenant_id, memVertexId, sourceVertexId, { tag: 'About' });
          syncKgEdge(ctx, tenant_id, sourceVertexId, memVertexId, { tag: 'HasMemory' });
        }
        const containerVertexId = findKgVertexId(ctx, tenant_id, 'memory_collections', mem.source_id);
        if (containerVertexId) {
          syncKgEdge(ctx, tenant_id, memVertexId, containerVertexId, { tag: 'ContainedIn' });
        }
      }
    }

    // --- Social Campaigns ---
    for (const camp of ctx.db.social_campaigns.iter()) {
      if (camp.tenant_id !== tenant_id) continue;
      syncKgVertex(ctx, tenant_id, { tag: 'SocialCampaign' }, 'social_campaigns', camp.id, {
        name: camp.name, theme: camp.theme, objective: camp.objective.tag,
        status: camp.status.tag,
      });
    }

    // --- Social Posts ---
    for (const post of ctx.db.social_posts.iter()) {
      if (post.tenant_id !== tenant_id) continue;
      syncKgVertex(ctx, tenant_id, { tag: 'SocialPost' }, 'social_posts', post.id, {
        content: post.content.slice(0, 200), platform: post.platform.tag,
        status: post.status.tag,
      });
      const postVertexId = findKgVertexId(ctx, tenant_id, 'social_posts', post.id);
      if (!postVertexId) continue;

      if (post.campaign_id !== undefined) {
        const campVertexId = findKgVertexId(ctx, tenant_id, 'social_campaigns', post.campaign_id);
        if (campVertexId) {
          syncKgEdge(ctx, tenant_id, postVertexId, campVertexId, { tag: 'PartOf' });
        }
      }
    }
  }
);

// ---------------------------------------------------------------------------
// Embedding & Insight reducers
// ---------------------------------------------------------------------------

export const updateVertexEmbedding = spacetimedb.reducer(
  {
    vertex_id: t.u64(),
    embedding: t.array(t.f32()),
  },
  (ctx, { vertex_id, embedding }) => {
    const v = ctx.db.kg_vertex.id.find(vertex_id);
    if (v) {
      ctx.db.kg_vertex.id.update({ ...v, vector_embedding: embedding });
    }
  }
);

export const createSimilarityEdges = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    source_vertex_id: t.u64(),
    top_k: t.u8(),
  },
  (ctx, { tenant_id, source_vertex_id, top_k }) => {
    const source = ctx.db.kg_vertex.id.find(source_vertex_id);
    if (!source || !source.vector_embedding) return;
    const sourceVec = source.vector_embedding;
    const candidates = [];
    for (const v of ctx.db.kg_vertex.iter()) {
      if (v.tenant_id === tenant_id && v.id !== source_vertex_id && v.vector_embedding) {
        const vec = v.vector_embedding;
        let dot = 0;
        let sourceNorm = 0;
        let targetNorm = 0;
        for (let i = 0; i < sourceVec.length; i++) {
          dot += sourceVec[i] * vec[i];
          sourceNorm += sourceVec[i] * sourceVec[i];
          targetNorm += vec[i] * vec[i];
        }
        const similarity = dot / (Math.sqrt(sourceNorm) * Math.sqrt(targetNorm));
        candidates.push({ vertex_id: v.id, similarity });
      }
    }
    candidates.sort((a, b) => b.similarity - a.similarity);
    for (let i = 0; i < Math.min(top_k, candidates.length); i++) {
      const c = candidates[i];
      syncKgEdge(ctx, tenant_id, source_vertex_id, c.vertex_id, { tag: 'SimilarTo' }, { score: c.similarity }, c.similarity);
    }
  }
);

export const createAiInsight = spacetimedb.reducer(
  {
    tenant_id: t.u64(),
    title: t.string(),
    content: t.string(),
    memory_type: memoryType,
    source_vertex_ids: t.array(t.u64()),
    target_entity_table: t.option(t.string()),
    target_entity_id: t.option(t.u64()),
  },
  (ctx, args) => {
    requireTenant(ctx, args.tenant_id);
    const mem = ctx.db.memories.insert({
      id: 0n,
      tenant_id: args.tenant_id,
      title: args.title,
      content: args.content,
      memory_type: args.memory_type,
      source_table: args.target_entity_table,
      source_id: args.target_entity_id,
      created_by: 0n,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
    syncKgVertex(ctx, args.tenant_id, { tag: 'Memory' }, 'memories', mem.id, {
      title: args.title,
      summary: args.content.slice(0, 200),
      memory_type: args.memory_type.tag,
      content_text: args.content,
    });
    const memVertexId = findKgVertexId(ctx, args.tenant_id, 'memories', mem.id);
    if (memVertexId) {
      for (const sourceId of args.source_vertex_ids) {
        syncKgEdge(ctx, args.tenant_id, memVertexId, sourceId, { tag: 'ExtractedFrom' });
      }
      if (args.target_entity_table !== undefined && args.target_entity_id !== undefined) {
        const targetVertexId = findKgVertexId(ctx, args.tenant_id, args.target_entity_table, args.target_entity_id);
        if (targetVertexId) {
          syncKgEdge(ctx, args.tenant_id, memVertexId, targetVertexId, { tag: 'About' });
          syncKgEdge(ctx, args.tenant_id, targetVertexId, memVertexId, { tag: 'HasMemory' });
          const containerVertexId = findKgVertexId(ctx, args.tenant_id, 'memory_collections', args.target_entity_id);
          if (containerVertexId) {
            syncKgEdge(ctx, args.tenant_id, memVertexId, containerVertexId, { tag: 'ContainedIn' });
          }
        }
      }
    }
  }
);

// ---------------------------------------------------------------------------
// Deep Cleanup — deduplication, orphan pruning, KB consolidation
// ---------------------------------------------------------------------------

/** Deduplicate contacts by email (case-insensitive). Keeps the oldest (lowest id). */
export const deduplicateContacts = spacetimedb.reducer(
  { tenant_id: t.u64() },
  (ctx: any, { tenant_id }) => {
    requireTenant(ctx, tenant_id);
    const seen = new Map<string, bigint>(); // normalized email -> kept contact id
    const toDelete: bigint[] = [];

    for (const c of ctx.db.contacts.iter()) {
      if (c.tenant_id !== tenant_id) continue;
      const email = c.email.toLowerCase().trim();
      if (!email) continue;
      if (seen.has(email)) {
        toDelete.push(c.id);
      } else {
        seen.set(email, c.id);
      }
    }

    for (const dupId of toDelete) {
      const dup = ctx.db.contacts.id.find(dupId);
      if (!dup) continue;
      const email = dup.email.toLowerCase().trim();
      const keepId = seen.get(email);
      if (!keepId || keepId === dupId) continue;

      // Repoint foreign keys to the kept contact
      for (const d of ctx.db.deals.iter()) {
        if (d.contact_id === dupId) ctx.db.deals.id.update({ ...d, contact_id: keepId });
      }
      for (const inv of ctx.db.invoices.iter()) {
        if (inv.contact_id === dupId) ctx.db.invoices.id.update({ ...inv, contact_id: keepId });
      }
      for (const conv of ctx.db.conversations.iter()) {
        if (conv.contact_id === dupId) ctx.db.conversations.id.update({ ...conv, contact_id: keepId });
      }
      for (const p of ctx.db.payments.iter()) {
        if (p.contact_id === dupId) ctx.db.payments.id.update({ ...p, contact_id: keepId });
      }
      for (const act of ctx.db.activities.iter()) {
        if (act.entity_type?.tag === 'Contact' && act.entity_id === dupId) {
          ctx.db.activities.id.update({ ...act, entity_id: keepId });
        }
      }
      for (const m of ctx.db.memories.iter()) {
        if (m.source_table === 'contacts' && m.source_id === dupId) {
          ctx.db.memories.id.update({ ...m, source_id: keepId });
        }
      }
      for (const mc of ctx.db.memory_collections.iter()) {
        if (mc.source_table === 'contacts' && mc.source_id === dupId) {
          ctx.db.memory_collections.id.update({ ...mc, source_id: keepId });
        }
      }

      // Cascade delete duplicate + its dependent data
      pruneEntityKnowledgeBase(ctx, 'contacts', dupId);
      deleteActivitiesForContact(ctx, dupId);
      deleteConversationsForContact(ctx, dupId);
      deletePaymentsForContact(ctx, dupId);
      deleteKgVertex(ctx, 'contacts', dupId);
      ctx.db.contacts.id.delete(dupId);
    }
  }
);

/** Deduplicate companies by name (case-insensitive). Keeps the oldest. */
export const deduplicateCompanies = spacetimedb.reducer(
  { tenant_id: t.u64() },
  (ctx: any, { tenant_id }) => {
    requireTenant(ctx, tenant_id);
    const seen = new Map<string, bigint>(); // normalized name -> kept id
    const toDelete: bigint[] = [];

    for (const c of ctx.db.companies.iter()) {
      if (c.tenant_id !== tenant_id) continue;
      const name = c.name.toLowerCase().trim();
      if (!name) continue;
      if (seen.has(name)) {
        toDelete.push(c.id);
      } else {
        seen.set(name, c.id);
      }
    }

    for (const dupId of toDelete) {
      const dup = ctx.db.companies.id.find(dupId);
      if (!dup) continue;
      const name = dup.name.toLowerCase().trim();
      const keepId = seen.get(name);
      if (!keepId || keepId === dupId) continue;

      // Repoint foreign keys
      for (const c of ctx.db.contacts.iter()) {
        if (c.company_id === dupId) ctx.db.contacts.id.update({ ...c, company_id: keepId });
      }
      for (const d of ctx.db.deals.iter()) {
        if (d.company_id === dupId) ctx.db.deals.id.update({ ...d, company_id: keepId });
      }
      for (const inv of ctx.db.invoices.iter()) {
        if (inv.company_id === dupId) ctx.db.invoices.id.update({ ...inv, company_id: keepId });
      }
      for (const act of ctx.db.activities.iter()) {
        if (act.entity_type?.tag === 'Company' && act.entity_id === dupId) {
          ctx.db.activities.id.update({ ...act, entity_id: keepId });
        }
      }
      for (const m of ctx.db.memories.iter()) {
        if (m.source_table === 'companies' && m.source_id === dupId) {
          ctx.db.memories.id.update({ ...m, source_id: keepId });
        }
      }
      for (const mc of ctx.db.memory_collections.iter()) {
        if (mc.source_table === 'companies' && mc.source_id === dupId) {
          ctx.db.memory_collections.id.update({ ...mc, source_id: keepId });
        }
      }

      pruneEntityKnowledgeBase(ctx, 'companies', dupId);
      deleteKgVertex(ctx, 'companies', dupId);
      ctx.db.companies.id.delete(dupId);
    }
  }
);

/** Deduplicate deals by name + contact_id. Keeps the oldest. */
export const deduplicateDeals = spacetimedb.reducer(
  { tenant_id: t.u64() },
  (ctx: any, { tenant_id }) => {
    requireTenant(ctx, tenant_id);
    const seen = new Map<string, bigint>(); // "name|contact_id" -> kept id
    const toDelete: bigint[] = [];

    for (const d of ctx.db.deals.iter()) {
      if (d.tenant_id !== tenant_id) continue;
      const key = `${d.name.toLowerCase().trim()}|${d.contact_id}`;
      if (seen.has(key)) {
        toDelete.push(d.id);
      } else {
        seen.set(key, d.id);
      }
    }

    for (const dupId of toDelete) {
      const dup = ctx.db.deals.id.find(dupId);
      if (!dup) continue;
      const key = `${dup.name.toLowerCase().trim()}|${dup.contact_id}`;
      const keepId = seen.get(key);
      if (!keepId || keepId === dupId) continue;

      // Repoint activities, payments
      for (const act of ctx.db.activities.iter()) {
        if (act.entity_type?.tag === 'Deal' && act.entity_id === dupId) {
          ctx.db.activities.id.update({ ...act, entity_id: keepId });
        }
      }
      for (const m of ctx.db.memories.iter()) {
        if (m.source_table === 'deals' && m.source_id === dupId) {
          ctx.db.memories.id.update({ ...m, source_id: keepId });
        }
      }
      for (const mc of ctx.db.memory_collections.iter()) {
        if (mc.source_table === 'deals' && mc.source_id === dupId) {
          ctx.db.memory_collections.id.update({ ...mc, source_id: keepId });
        }
      }

      pruneEntityKnowledgeBase(ctx, 'deals', dupId);
      deleteKgVertex(ctx, 'deals', dupId);
      ctx.db.deals.id.delete(dupId);
    }
  }
);

/** Prune empty pipelines (no deals) and duplicate pipeline stages. */
export const prunePipelines = spacetimedb.reducer(
  { tenant_id: t.u64() },
  (ctx: any, { tenant_id }) => {
    requireTenant(ctx, tenant_id);

    // Delete empty pipelines
    const pipelineIdsWithDeals = new Set<bigint>();
    for (const d of ctx.db.deals.iter()) {
      if (d.tenant_id === tenant_id) pipelineIdsWithDeals.add(d.pipeline_id);
    }

    const emptyPipelines: bigint[] = [];
    for (const p of ctx.db.pipelines.iter()) {
      if (p.tenant_id !== tenant_id) continue;
      if (!pipelineIdsWithDeals.has(p.id)) emptyPipelines.push(p.id);
    }

    for (const id of emptyPipelines) {
      // Delete stages first
      for (const s of ctx.db.pipeline_stages.iter()) {
        if (s.pipeline_id === id) ctx.db.pipeline_stages.id.delete(s.id);
      }
      deleteKgVertex(ctx, 'pipelines', id);
      ctx.db.pipelines.id.delete(id);
    }

    // Deduplicate stages within each pipeline by name
    const pipelineStageMap = new Map<bigint, Map<string, bigint>>(); // pipeline_id -> name -> kept stage id
    const stagesToDelete: bigint[] = [];

    for (const s of ctx.db.pipeline_stages.iter()) {
      const p = ctx.db.pipelines.id.find(s.pipeline_id);
      if (!p || p.tenant_id !== tenant_id) continue;
      const name = s.name.toLowerCase().trim();
      if (!pipelineStageMap.has(s.pipeline_id)) {
        pipelineStageMap.set(s.pipeline_id, new Map());
      }
      const nameMap = pipelineStageMap.get(s.pipeline_id)!;
      if (nameMap.has(name)) {
        stagesToDelete.push(s.id);
      } else {
        nameMap.set(name, s.id);
      }
    }

    for (const dupId of stagesToDelete) {
      const dup = ctx.db.pipeline_stages.id.find(dupId);
      if (!dup) continue;
      const nameMap = pipelineStageMap.get(dup.pipeline_id);
      if (!nameMap) continue;
      const keepId = nameMap.get(dup.name.toLowerCase().trim());
      if (!keepId || keepId === dupId) continue;

      // Repoint deals
      for (const d of ctx.db.deals.iter()) {
        if (d.stage_id === dupId) ctx.db.deals.id.update({ ...d, stage_id: keepId });
      }
      deleteKgVertex(ctx, 'pipeline_stages', dupId);
      ctx.db.pipeline_stages.id.delete(dupId);
    }
  }
);

/** Prune orphaned activities whose entity no longer exists. */
export const pruneOrphanedActivities = spacetimedb.reducer(
  { tenant_id: t.u64() },
  (ctx: any, { tenant_id }) => {
    requireTenant(ctx, tenant_id);
    const toDelete: bigint[] = [];

    for (const act of ctx.db.activities.iter()) {
      if (act.tenant_id !== tenant_id) continue;
      let exists = false;
      const tag = act.entity_type?.tag;
      if (tag === 'Contact') exists = ctx.db.contacts.id.find(act.entity_id) !== undefined;
      else if (tag === 'Company') exists = ctx.db.companies.id.find(act.entity_id) !== undefined;
      else if (tag === 'Deal') exists = ctx.db.deals.id.find(act.entity_id) !== undefined;
      else if (tag === 'Invoice') exists = ctx.db.invoices.id.find(act.entity_id) !== undefined;
      else if (tag === 'Product') exists = ctx.db.products.id.find(act.entity_id) !== undefined;
      else if (tag === 'User') exists = ctx.db.users.id.find(act.entity_id) !== undefined;
      else if (tag === 'Conversation') exists = ctx.db.conversations.id.find(act.entity_id) !== undefined;
      else if (tag === 'Document') exists = ctx.db.documents.id.find(act.entity_id) !== undefined;
      else if (tag === 'Memory') exists = ctx.db.memories.id.find(act.entity_id) !== undefined;
      else if (tag === 'Workflow') exists = ctx.db.workflows.id.find(act.entity_id) !== undefined;
      else if (tag === 'SocialPost') exists = ctx.db.social_posts.id.find(act.entity_id) !== undefined;
      else if (tag === 'SocialCampaign') exists = ctx.db.social_campaigns.id.find(act.entity_id) !== undefined;
      else exists = true; // unknown type, keep

      if (!exists) toDelete.push(act.id);
    }

    for (const id of toDelete) {
      ctx.db.activities.id.delete(id);
    }
  }
);

/** Prune orphaned conversations whose contact no longer exists. */
export const pruneOrphanedConversations = spacetimedb.reducer(
  { tenant_id: t.u64() },
  (ctx: any, { tenant_id }) => {
    requireTenant(ctx, tenant_id);
    const toDelete: bigint[] = [];

    for (const conv of ctx.db.conversations.iter()) {
      if (conv.tenant_id !== tenant_id) continue;
      if (ctx.db.contacts.id.find(conv.contact_id) === undefined) {
        toDelete.push(conv.id);
      }
    }

    for (const id of toDelete) {
      deleteMessagesForConversation(ctx, id);
      deleteKgVertex(ctx, 'conversations', id);
      ctx.db.conversations.id.delete(id);
    }
  }
);

/** Deduplicate social posts by content hash (first 100 chars). Keeps oldest. */
export const deduplicateSocialPosts = spacetimedb.reducer(
  { tenant_id: t.u64() },
  (ctx: any, { tenant_id }) => {
    requireTenant(ctx, tenant_id);
    const seen = new Map<string, bigint>(); // content prefix -> kept id
    const toDelete: bigint[] = [];

    for (const p of ctx.db.social_posts.iter()) {
      if (p.tenant_id !== tenant_id) continue;
      const key = p.content.slice(0, 100).toLowerCase().trim();
      if (!key) continue;
      if (seen.has(key)) {
        toDelete.push(p.id);
      } else {
        seen.set(key, p.id);
      }
    }

    for (const dupId of toDelete) {
      deleteKgVertex(ctx, 'social_posts', dupId);
      ctx.db.social_posts.id.delete(dupId);
    }
  }
);

/** Prune duplicate social campaigns by name. Keeps oldest. */
export const deduplicateSocialCampaigns = spacetimedb.reducer(
  { tenant_id: t.u64() },
  (ctx: any, { tenant_id }) => {
    requireTenant(ctx, tenant_id);
    const seen = new Map<string, bigint>();
    const toDelete: bigint[] = [];

    for (const c of ctx.db.social_campaigns.iter()) {
      if (c.tenant_id !== tenant_id) continue;
      const key = c.name.toLowerCase().trim();
      if (!key) continue;
      if (seen.has(key)) {
        toDelete.push(c.id);
      } else {
        seen.set(key, c.id);
      }
    }

    for (const dupId of toDelete) {
      // Repoint posts
      for (const p of ctx.db.social_posts.iter()) {
        if (p.campaign_id === dupId) {
          const key = ctx.db.social_campaigns.id.find(dupId)?.name.toLowerCase().trim();
          const keepId = key ? seen.get(key) : undefined;
          if (keepId) ctx.db.social_posts.id.update({ ...p, campaign_id: keepId });
        }
      }
      deleteKgVertex(ctx, 'social_campaigns', dupId);
      ctx.db.social_campaigns.id.delete(dupId);
    }
  }
);

/** Prune duplicate documents by content_text hash (first 200 chars). Keeps oldest. */
export const deduplicateDocuments = spacetimedb.reducer(
  { tenant_id: t.u64() },
  (ctx: any, { tenant_id }) => {
    requireTenant(ctx, tenant_id);
    const seen = new Map<string, bigint>();
    const toDelete: bigint[] = [];

    for (const d of ctx.db.documents.iter()) {
      if (d.tenant_id !== tenant_id) continue;
      const key = d.content_text.slice(0, 200).toLowerCase().trim();
      if (!key) continue;
      if (seen.has(key)) {
        toDelete.push(d.id);
      } else {
        seen.set(key, d.id);
      }
    }

    for (const dupId of toDelete) {
      deleteKgVertex(ctx, 'documents', dupId);
      ctx.db.documents.id.delete(dupId);
    }
  }
);

/** Prune duplicate memories by content hash (first 200 chars). Keeps oldest. */
export const deduplicateMemories = spacetimedb.reducer(
  { tenant_id: t.u64() },
  (ctx: any, { tenant_id }) => {
    requireTenant(ctx, tenant_id);
    const seen = new Map<string, bigint>();
    const toDelete: bigint[] = [];

    for (const m of ctx.db.memories.iter()) {
      if (m.tenant_id !== tenant_id) continue;
      const key = `${m.source_table || ''}|${m.source_id || 0n}|${m.content.slice(0, 200).toLowerCase().trim()}`;
      if (seen.has(key)) {
        toDelete.push(m.id);
      } else {
        seen.set(key, m.id);
      }
    }

    for (const dupId of toDelete) {
      deleteKgVertex(ctx, 'memories', dupId);
      ctx.db.memories.id.delete(dupId);
    }
  }
);

/** Prune orphaned KG vertices whose source entity no longer exists. */
export const pruneOrphanedKgVertices = spacetimedb.reducer(
  { tenant_id: t.u64() },
  (ctx: any, { tenant_id }) => {
    requireTenant(ctx, tenant_id);
    const toDelete: bigint[] = [];

    for (const v of ctx.db.kg_vertex.iter()) {
      if (v.tenant_id !== tenant_id) continue;
      let exists = false;
      const table = v.source_table;
      const id = v.source_id;
      if (table === 'contacts') exists = ctx.db.contacts.id.find(id) !== undefined;
      else if (table === 'companies') exists = ctx.db.companies.id.find(id) !== undefined;
      else if (table === 'deals') exists = ctx.db.deals.id.find(id) !== undefined;
      else if (table === 'invoices') exists = ctx.db.invoices.id.find(id) !== undefined;
      else if (table === 'products') exists = ctx.db.products.id.find(id) !== undefined;
      else if (table === 'users') exists = ctx.db.users.id.find(id) !== undefined;
      else if (table === 'conversations') exists = ctx.db.conversations.id.find(id) !== undefined;
      else if (table === 'messages') exists = ctx.db.messages.id.find(id) !== undefined;
      else if (table === 'activities') exists = ctx.db.activities.id.find(id) !== undefined;
      else if (table === 'documents') exists = ctx.db.documents.id.find(id) !== undefined;
      else if (table === 'memories') exists = ctx.db.memories.id.find(id) !== undefined;
      else if (table === 'memory_collections') exists = ctx.db.memory_collections.id.find(id) !== undefined;
      else if (table === 'social_posts') exists = ctx.db.social_posts.id.find(id) !== undefined;
      else if (table === 'social_campaigns') exists = ctx.db.social_campaigns.id.find(id) !== undefined;
      else if (table === 'workflows') exists = ctx.db.workflows.id.find(id) !== undefined;
      else if (table === 'pipelines') exists = ctx.db.pipelines.id.find(id) !== undefined;
      else if (table === 'pipeline_stages') exists = ctx.db.pipeline_stages.id.find(id) !== undefined;
      else exists = true;

      if (!exists) toDelete.push(v.id);
    }

    for (const id of toDelete) {
      deleteKgEdgesForVertex(ctx, id);
      ctx.db.kg_vertex.id.delete(id);
    }
  }
);

/** Prune duplicate KG edges (same source, target, relation). Keeps oldest. */
export const pruneDuplicateKgEdges = spacetimedb.reducer(
  { tenant_id: t.u64() },
  (ctx: any, { tenant_id }) => {
    requireTenant(ctx, tenant_id);
    const seen = new Map<string, bigint>(); // "source|target|relation" -> kept id
    const toDelete: bigint[] = [];

    for (const e of ctx.db.kg_edge.iter()) {
      if (e.tenant_id !== tenant_id) continue;
      const key = `${e.source_vertex_id}|${e.target_vertex_id}|${e.relation_type?.tag}`;
      if (seen.has(key)) {
        toDelete.push(e.id);
      } else {
        seen.set(key, e.id);
      }
    }

    for (const id of toDelete) {
      ctx.db.kg_edge.id.delete(id);
    }
  }
);

/** Prune orphaned invoice items whose invoice no longer exists. */
export const pruneOrphanedInvoiceItems = spacetimedb.reducer(
  { tenant_id: t.u64() },
  (ctx: any, { tenant_id }) => {
    requireTenant(ctx, tenant_id);
    const toDelete: bigint[] = [];

    for (const item of ctx.db.invoice_items.iter()) {
      if (item.tenant_id !== tenant_id) continue;
      if (ctx.db.invoices.id.find(item.invoice_id) === undefined) {
        toDelete.push(item.id);
      }
    }

    for (const id of toDelete) {
      ctx.db.invoice_items.id.delete(id);
    }
  }
);

/** Prune orphaned payments whose invoice no longer exists. */
export const pruneOrphanedPayments = spacetimedb.reducer(
  { tenant_id: t.u64() },
  (ctx: any, { tenant_id }) => {
    requireTenant(ctx, tenant_id);
    const toDelete: bigint[] = [];

    for (const p of ctx.db.payments.iter()) {
      if (p.tenant_id !== tenant_id) continue;
      if (ctx.db.invoices.id.find(p.invoice_id) === undefined) {
        toDelete.push(p.id);
      }
    }

    for (const id of toDelete) {
      ctx.db.payments.id.delete(id);
    }
  }
);

/** Prune duplicate products by name. Keeps oldest. */
export const deduplicateProducts = spacetimedb.reducer(
  { tenant_id: t.u64() },
  (ctx: any, { tenant_id }) => {
    requireTenant(ctx, tenant_id);
    const seen = new Map<string, bigint>();
    const toDelete: bigint[] = [];

    for (const p of ctx.db.products.iter()) {
      if (p.tenant_id !== tenant_id) continue;
      const key = p.name.toLowerCase().trim();
      if (!key) continue;
      if (seen.has(key)) {
        toDelete.push(p.id);
      } else {
        seen.set(key, p.id);
      }
    }

    for (const dupId of toDelete) {
      deleteKgVertex(ctx, 'products', dupId);
      ctx.db.products.id.delete(dupId);
    }
  }
);

/** Prune orphaned workflow executions whose workflow no longer exists. */
export const pruneOrphanedWorkflowExecutions = spacetimedb.reducer(
  { tenant_id: t.u64() },
  (ctx: any, { tenant_id }) => {
    requireTenant(ctx, tenant_id);
    const toDelete: bigint[] = [];

    for (const we of ctx.db.workflow_executions.iter()) {
      if (we.tenant_id !== tenant_id) continue;
      if (ctx.db.workflows.id.find(we.workflow_id) === undefined) {
        toDelete.push(we.id);
      }
    }

    for (const id of toDelete) {
      ctx.db.workflow_executions.id.delete(id);
    }
  }
);

/** Prune orphaned deal stage history whose deal no longer exists. */
export const pruneOrphanedDealStageHistory = spacetimedb.reducer(
  { tenant_id: t.u64() },
  (ctx: any, { tenant_id }) => {
    requireTenant(ctx, tenant_id);
    const toDelete: bigint[] = [];

    for (const h of ctx.db.deal_stage_history.iter()) {
      if (h.tenant_id !== tenant_id) continue;
      if (ctx.db.deals.id.find(h.deal_id) === undefined) {
        toDelete.push(h.id);
      }
    }

    for (const id of toDelete) {
      ctx.db.deal_stage_history.id.delete(id);
    }
  }
);

/** Deep clean — run all deduplication and pruning reducers in sequence. */
export const deepClean = spacetimedb.reducer(
  { tenant_id: t.u64() },
  (ctx: any, { tenant_id }) => {
    requireTenant(ctx, tenant_id);

    // Phase 1: Deduplicate core entities
    deduplicateContacts(ctx, { tenant_id });
    deduplicateCompanies(ctx, { tenant_id });
    deduplicateDeals(ctx, { tenant_id });
    deduplicateProducts(ctx, { tenant_id });

    // Phase 2: Prune orphaned operational data
    pruneOrphanedActivities(ctx, { tenant_id });
    pruneOrphanedConversations(ctx, { tenant_id });
    pruneOrphanedPayments(ctx, { tenant_id });
    pruneOrphanedInvoiceItems(ctx, { tenant_id });
    pruneOrphanedWorkflowExecutions(ctx, { tenant_id });
    pruneOrphanedDealStageHistory(ctx, { tenant_id });

    // Phase 3: Clean social & content
    deduplicateSocialPosts(ctx, { tenant_id });
    deduplicateSocialCampaigns(ctx, { tenant_id });
    deduplicateDocuments(ctx, { tenant_id });
    deduplicateMemories(ctx, { tenant_id });

    // Phase 4: Clean pipelines
    prunePipelines(ctx, { tenant_id });

    // Phase 5: Clean containers (from earlier cleanup)
    pruneOrphanedContainers(ctx, { tenant_id });

    // Phase 6: Clean knowledge graph
    pruneOrphanedKgVertices(ctx, { tenant_id });
    pruneDuplicateKgEdges(ctx, { tenant_id });

    // Phase 7: Archive old messages (keep RAM lean)
    archiveMessages(ctx, { tenant_id, days_old: 7 });
    pruneOldActivities(ctx, { tenant_id, days_old: 30 });
  }
);
