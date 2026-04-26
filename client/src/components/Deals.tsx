import { useState, useMemo } from 'react';
import { Pencil, Trash2, Calendar, User, Building2, GripVertical } from 'lucide-react';
import { useTable, useDb } from '../spacetime/hooks';
import { useToast } from '../hooks/useToast';
import PageHeader from './PageHeader';
import ConfirmDialog from './ConfirmDialog';
import DealDetailModal from './DealDetailModal';
import DealsAnalytics from './DealsAnalytics';
import {
  Button, Card, CardBody, Badge, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Input, Select, SelectItem, Tabs, Tab
} from '@nextui-org/react';

// DndKit
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface Deal {
  id: bigint;
  name: string;
  contactId: bigint;
  companyId?: bigint;
  stageId: bigint;
  value: bigint;
  currency: string;
  probability: number;
  expectedClose?: string;
  status: { tag: string };
}

interface Stage {
  id: bigint;
  name: string;
  orderIndex: number;
  winProbability: number;
  pipelineId: bigint;
}

/* ------------------------------------------------------------------ */
/* Draggable Deal Card                                                */
/* ------------------------------------------------------------------ */

function DraggableDealCard({
  deal,
  contactMap,
  companyMap,
  onEdit,
  onDelete,
  onView,
}: {
  deal: Deal;
  contactMap: Map<bigint, any>;
  companyMap: Map<bigint, any>;
  onEdit: (d: Deal) => void;
  onDelete: (id: bigint) => void;
  onView?: (d: Deal) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: deal.id.toString(), data: { deal } });

  const style: React.CSSProperties = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : {};

  const formatRM = (cents: number) =>
    `RM ${(cents / 100).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isDragging ? 'opacity-30' : 'opacity-100'} transition-opacity`}
    >
      <Card className="border border-slate-100 shadow-sm hover:shadow-md hover:shadow-slate-200/50 transition-shadow duration-200 bg-white">
        <CardBody className="p-4">
          {/* Drag handle + title row */}
          <div className="flex items-start gap-2">
            <button
              className="mt-0.5 p-1 rounded-md hover:bg-slate-100 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="w-4 h-4" />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <button
                  className="text-left"
                  onClick={() => onView?.(deal)}
                >
                  <h5 className="font-medium text-sm text-slate-800 leading-snug hover:text-brand-600 transition-colors">{deal.name}</h5>
                </button>
                <div className="flex gap-0.5 shrink-0" data-dnd-kit-disabled-dnd>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    className="text-slate-400 hover:text-slate-700 min-w-0 w-7 h-7"
                    onPress={() => onEdit(deal)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    className="text-slate-400 hover:text-rose-600 min-w-0 w-7 h-7"
                    onPress={() => onDelete(deal.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <p className="text-sm font-semibold text-slate-900 mt-1">
                {formatRM(Number(deal.value))}
              </p>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {contactMap.get(deal.contactId)?.name ?? '—'}
                </span>
                {deal.companyId != null && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {companyMap.get(deal.companyId)?.name ?? '—'}
                  </span>
                )}
              </div>

              {deal.expectedClose && (
                <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                  <Calendar className="w-3 h-3" />
                  {new Date(deal.expectedClose).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drag Overlay (preview while dragging)                              */
/* ------------------------------------------------------------------ */

function OverlayCard({ deal, contactMap }: { deal: Deal; contactMap: Map<bigint, any> }) {
  const formatRM = (cents: number) =>
    `RM ${(cents / 100).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;

  return (
    <Card className="border border-brand-200 shadow-2xl shadow-brand-100/50 bg-white rotate-2 scale-[1.03] w-[272px]">
      <CardBody className="p-4">
        <div className="flex items-start gap-2">
          <GripVertical className="w-4 h-4 text-slate-300 mt-0.5" />
          <div>
            <h5 className="font-medium text-sm text-slate-800">{deal.name}</h5>
            <p className="text-sm font-semibold text-slate-900 mt-1">
              {formatRM(Number(deal.value))}
            </p>
            <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
              <User className="w-3 h-3" />
              {contactMap.get(deal.contactId)?.name ?? '—'}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Droppable Stage Column                                             */
/* ------------------------------------------------------------------ */

function StageColumn({
  stage,
  deals,
  contactMap,
  companyMap,
  onEdit,
  onDelete,
  onView,
}: {
  stage: Stage;
  deals: Deal[];
  contactMap: Map<bigint, any>;
  companyMap: Map<bigint, any>;
  onEdit: (d: Deal) => void;
  onDelete: (id: bigint) => void;
  onView?: (d: Deal) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id.toString(),
    data: { stage },
  });

  const stageTotal = deals.reduce((sum, d) => sum + Number(d.value), 0);
  const formatRM = (cents: number) =>
    `RM ${(cents / 100).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[300px] w-[300px] flex flex-col gap-3 rounded-2xl p-3 transition-all duration-200 ${
        isOver
          ? 'bg-brand-50 ring-2 ring-brand-300 shadow-lg shadow-brand-100/30'
          : 'bg-slate-50/60'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h4 className="font-semibold text-sm text-slate-800">{stage.name}</h4>
          <p className="text-xs text-slate-500">
            {deals.length} deals · {formatRM(stageTotal)}
          </p>
        </div>
        <Badge
          variant="flat"
          size="sm"
          className="bg-white text-slate-600 border border-slate-100 font-medium"
        >
          {stage.winProbability}%
        </Badge>
      </div>

      {/* Deal list */}
      <div className="flex flex-col gap-2.5 min-h-[120px]">
        {deals.map((deal) => (
          <DraggableDealCard
            key={deal.id.toString()}
            deal={deal}
            contactMap={contactMap}
            companyMap={companyMap}
            onEdit={onEdit}
            onDelete={onDelete}
            onView={onView}
          />
        ))}
        {deals.length === 0 && (
          <div className="flex-1 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-8">
            <span className="text-xs text-slate-400 font-medium">Drop deals here</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Deals Component                                               */
/* ------------------------------------------------------------------ */

export default function Deals() {
  const db = useDb();
  const { success } = useToast();
  const [deals] = useTable('deals');
  const [stages] = useTable('pipeline_stages');
  const [pipelines] = useTable('pipelines');
  const [contacts] = useTable('contacts');
  const [companies] = useTable('companies');

  const [pipelineId, setPipelineId] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<bigint | null>(null);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [detailDeal, setDetailDeal] = useState<any | null>(null);
  const [dealView, setDealView] = useState<'pipeline' | 'analytics'>('pipeline');

  const [form, setForm] = useState({
    name: '',
    contactId: '',
    companyId: '',
    stageId: '',
    value: '',
    currency: 'MYR',
    probability: 10,
    expectedClose: '',
  });

  const activePipeline =
    pipelines.find((p: any) => p.id.toString() === pipelineId) ?? pipelines[0];
  const activePipelineId = activePipeline?.id;

  const pipelineStages = useMemo(() => {
    return stages
      .filter((s: any) => s.pipelineId === activePipelineId)
      .sort((a: any, b: any) => a.orderIndex - b.orderIndex);
  }, [stages, activePipelineId]);

  const contactMap = useMemo(
    () => new Map(contacts.map((c: any) => [c.id, c])),
    [contacts]
  );
  const companyMap = useMemo(
    () => new Map(companies.map((c: any) => [c.id, c])),
    [companies]
  );

  /* sensors */
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  /* CRUD */
  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      contactId: '',
      companyId: '',
      stageId: pipelineStages[0]?.id.toString() ?? '',
      value: '',
      currency: 'MYR',
      probability: 10,
      expectedClose: '',
    });
    setModalOpen(true);
  };

  const openEdit = (deal: any) => {
    setEditing(deal);
    setForm({
      name: deal.name,
      contactId: deal.contactId.toString(),
      companyId: deal.companyId?.toString() ?? '',
      stageId: deal.stageId.toString(),
      value: (Number(deal.value) / 100).toString(),
      currency: deal.currency,
      probability: deal.probability,
      expectedClose: deal.expectedClose
        ? new Date(deal.expectedClose).toISOString().split('T')[0]
        : '',
    });
    setModalOpen(true);
  };

  const save = () => {
    if (!db || !form.name || !form.contactId || !form.stageId) return;
    const value = BigInt(Math.round(parseFloat(form.value || '0') * 100));
    const expectedClose = form.expectedClose
      ? new Date(form.expectedClose).toISOString()
      : undefined;
    if (editing) {
      (db.reducers as any).updateDeal({
        id: editing.id,
        name: form.name,
        contactId: BigInt(form.contactId),
        companyId: form.companyId ? BigInt(form.companyId) : undefined,
        pipelineId: activePipelineId,
        stageId: BigInt(form.stageId),
        value,
        currency: form.currency,
        probability: form.probability,
        expectedClose,
      });
      success('Deal updated', `${form.name} has been updated.`);
    } else {
      (db.reducers as any).createDeal({
        tenantId: 1n,
        name: form.name,
        contactId: BigInt(form.contactId),
        companyId: form.companyId ? BigInt(form.companyId) : undefined,
        pipelineId: activePipelineId,
        stageId: BigInt(form.stageId),
        value,
        currency: form.currency,
        probability: form.probability,
        expectedClose,
      });
      success('Deal created', `${form.name} has been added to the pipeline.`);
    }
    setModalOpen(false);
  };

  const promptRemove = (id: bigint) => {
    setDeletingId(id);
    setConfirmOpen(true);
  };

  const remove = () => {
    if (!db || !deletingId) return;
    (db.reducers as any).deleteDeal({ id: deletingId });
    success('Deal deleted', 'The deal has been removed from the pipeline.');
    setDeletingId(null);
  };

  /* drag handlers */
  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals.find((d: any) => d.id.toString() === event.active.id);
    if (deal) setActiveDeal(deal as Deal);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over || !db) return;

    const draggedDeal = deals.find(
      (d: any) => d.id.toString() === active.id
    ) as Deal | undefined;
    if (!draggedDeal) return;

    const targetStageId = BigInt(over.id as string);
    if (targetStageId !== draggedDeal.stageId) {
      (db.reducers as any).moveDealStage({
        id: draggedDeal.id,
        stageId: targetStageId,
      });
      const stageName = pipelineStages.find((s: any) => s.id === targetStageId)?.name ?? 'new stage';
      success('Deal moved', `${draggedDeal.name} moved to ${stageName}.`);
    }
  };

  /* render */
  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        title="Deals"
        subtitle="Track your sales pipeline"
        actionLabel="Add Deal"
        onAction={openCreate}
      />

      <Tabs
        selectedKey={dealView}
        onSelectionChange={(k: any) => setDealView(k as 'pipeline' | 'analytics')}
        classNames={{
          base: 'w-full',
          tabList: 'gap-6 bg-transparent',
          cursor: 'bg-brand-600',
          tab: 'text-sm font-medium text-slate-500',
          tabContent: 'group-data-[selected=true]:text-brand-600',
          panel: 'px-0 py-0',
        }}
      >
        <Tab key="pipeline" title="Pipeline">
          {pipelines.length > 1 && (
            <Select
              className="max-w-xs mb-4"
              aria-label="Select pipeline"
              selectedKeys={
                pipelineId
                  ? [pipelineId]
                  : activePipeline
                    ? [activePipeline.id.toString()]
                    : []
              }
              onSelectionChange={(keys) =>
                setPipelineId((Array.from(keys)[0] as string) || '')
              }
            >
              {pipelines.map((p: any) => (
                <SelectItem key={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </Select>
          )}

          <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-5 overflow-x-auto pb-4 px-1">
          {pipelineStages.map((stage: any) => {
            const stageDeals = (deals as Deal[]).filter(
              (d) => d.stageId === stage.id && d.status?.tag === 'Open'
            );
            return (
              <StageColumn
                key={stage.id.toString()}
                stage={stage as Stage}
                deals={stageDeals}
                contactMap={contactMap}
                companyMap={companyMap}
                onEdit={openEdit}
                onDelete={promptRemove}
                onView={(d) => setDetailDeal(d)}
              />
            );
          })}
        </div>

          <DragOverlay dropAnimation={null}>
            {activeDeal ? (
              <OverlayCard deal={activeDeal} contactMap={contactMap} />
            ) : null}
          </DragOverlay>
        </DndContext>
        </Tab>
        <Tab key="analytics" title="Analytics">
          <DealsAnalytics />
        </Tab>
      </Tabs>

      {/* Modal */}
      <Modal isOpen={modalOpen} onOpenChange={setModalOpen} size="lg">
        <ModalContent>
          <ModalHeader className="text-slate-900 font-outfit">
            {editing ? 'Edit Deal' : 'New Deal'}
          </ModalHeader>
          <ModalBody className="gap-4">
            <Input
              label="Deal Name"
              value={form.name}
              onValueChange={(v) => setForm({ ...form, name: v })}
              isRequired
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Contact"
                selectedKeys={form.contactId ? [form.contactId] : []}
                onSelectionChange={(keys) =>
                  setForm({ ...form, contactId: Array.from(keys)[0] as string })
                }
                isRequired
                items={contacts.map((c: any) => ({
                  key: c.id.toString(),
                  label: c.name,
                }))}
              >
                {(item: any) => (
                  <SelectItem key={item.key} textValue={item.label}>
                    {item.label}
                  </SelectItem>
                )}
              </Select>
              <Select
                label="Company"
                selectedKeys={form.companyId ? [form.companyId] : []}
                onSelectionChange={(keys) =>
                  setForm({
                    ...form,
                    companyId: (Array.from(keys)[0] as string) || '',
                  })
                }
                items={[
                  { key: 'none', label: 'None' },
                  ...companies.map((c: any) => ({
                    key: c.id.toString(),
                    label: c.name,
                  })),
                ]}
              >
                {(item: any) => (
                  <SelectItem key={item.key} textValue={item.label}>
                    {item.label}
                  </SelectItem>
                )}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Value (RM)"
                type="number"
                step="0.01"
                value={form.value}
                onValueChange={(v) => setForm({ ...form, value: v })}
              />
              <Select
                label="Stage"
                selectedKeys={form.stageId ? [form.stageId] : []}
                onSelectionChange={(keys) =>
                  setForm({
                    ...form,
                    stageId: Array.from(keys)[0] as string,
                  })
                }
                isRequired
                items={pipelineStages.map((s: any) => ({
                  key: s.id.toString(),
                  label: s.name,
                }))}
              >
                {(item: any) => (
                  <SelectItem key={item.key} textValue={item.label}>
                    {item.label}
                  </SelectItem>
                )}
              </Select>
            </div>
            <Input
              label="Expected Close"
              type="date"
              value={form.expectedClose}
              onValueChange={(v) => setForm({ ...form, expectedClose: v })}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-brand-600" onPress={save}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={remove}
        title="Delete deal?"
        description="This will permanently remove the deal from your pipeline."
        confirmLabel="Delete"
      />

      <DealDetailModal deal={detailDeal} onClose={() => setDetailDeal(null)} />
    </div>
  );
}
