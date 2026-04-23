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
]);

const relationType = t.enum('RelationType', [
  'BelongsTo', 'CommunicatedWith', 'Purchased',
  'WorksAt', 'Triggered', 'RelatedTo', 'Paid',
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
  kg_vertex: kgVertex,
  kg_edge: kgEdge,
  tenant_member: tenantMember,
  workflows,
  workflow_executions: workflowExecutions,
  deal_stage_history: dealStageHistory,
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

function syncKgVertex(
  ctx: any,
  tenantId: bigint,
  entityType: any,
  sourceTable: string,
  sourceId: bigint,
  properties: any
): void {
  const existing = ctx.db.kg_vertex.tenant_source.find([tenantId, sourceTable, sourceId]);
  if (existing) {
    ctx.db.kg_vertex.id.update({
      ...existing,
      properties: JSON.stringify(properties),
      updated_at: ctx.timestamp,
    });
  } else {
    ctx.db.kg_vertex.insert({
      id: 0n,
      tenant_id: tenantId,
      entity_type: entityType,
      source_table: sourceTable,
      source_id: sourceId,
      properties: JSON.stringify(properties),
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
    properties: JSON.stringify(properties ?? {}),
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
  }
);

export const deleteContact = spacetimedb.reducer(
  { id: t.u64() },
  (ctx: any, { id }) => {
    const contact = ctx.db.contacts.id.find(id);
    if (!contact) throw new Error('Contact not found');
    requireTenant(ctx, contact.tenant_id);
    deleteKgVertex(ctx, 'contacts', id);
    ctx.db.contacts.id.delete(id);
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
    deleteKgVertex(ctx, 'companies', id);
    ctx.db.companies.id.delete(id);
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
    ctx.db.pipeline_stages.insert({
      id: 0n,
      tenant_id,
      pipeline_id,
      name,
      order_index,
      win_probability,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
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
    ctx.db.activities.insert({
      id: 0n,
      tenant_id,
      contact_id,
      deal_id,
      type,
      description,
      created_by,
      created_at: ctx.timestamp,
    });
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
    ctx.db.conversations.insert({
      id: 0n,
      tenant_id,
      contact_id,
      channel,
      channel_conversation_id,
      status: { tag: 'Active' },
      last_message_at: ctx.timestamp,
      unread_count: 0,
    });
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
        ctx.db.invoice_items.id.delete(item.id);
      }
    }
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
    ctx.db.invoice_items.insert({
      id: 0n,
      tenant_id,
      invoice_id,
      product_id,
      description,
      quantity,
      unit_price,
      total,
    });
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
  {},
  (ctx: any) => {
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
    ctx.db.workflows.insert({
      id: 0n, tenant_id, name, description,
      trigger_type, trigger_config, steps,
      status: 'draft',
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
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
