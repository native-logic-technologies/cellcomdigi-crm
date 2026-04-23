// This file documents the schema changes needed for the demo upgrade
// We'll apply these directly to index.ts

// 1. Companies table additions:
//    phone: t.option(t.string())
//    email: t.option(t.string())
//    website: t.option(t.string())
//    notes: t.string()  // JSON or plain text

// 2. New table: deal_stage_history
//    id: t.u64().primaryKey().autoInc()
//    tenant_id: t.u64().index('btree')
//    deal_id: t.u64().index('btree')
//    from_stage_id: t.option(t.u64())
//    to_stage_id: t.u64()
//    moved_by: t.option(t.u64())
//    moved_at: t.timestamp()

// 3. Update createCompany reducer to accept new fields
// 4. Update updateCompany reducer to accept new fields
// 5. Update moveDealStage to insert stage_history record
// 6. Expand seedDemoData
