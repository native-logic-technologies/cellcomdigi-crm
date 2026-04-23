import { useState, useMemo } from 'react';
import { Pencil, Trash2, Calendar, User, Building2, ArrowRightLeft } from 'lucide-react';
import { useTable, useDb } from '../spacetime/hooks';
import PageHeader from './PageHeader';
import ConfirmDialog from './ConfirmDialog';
import {
  Button, Card, CardBody, Badge, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Input, Select, SelectItem
} from '@nextui-org/react';

export default function Deals() {
  const db = useDb();
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
  const [form, setForm] = useState({ name: '', contactId: '', companyId: '', stageId: '', value: '', currency: 'MYR', probability: 10, expectedClose: '' });

  const activePipeline = pipelines.find((p: any) => p.id.toString() === pipelineId) ?? pipelines[0];
  const activePipelineId = activePipeline?.id;

  const pipelineStages = useMemo(() => {
    return stages
      .filter((s: any) => s.pipelineId === activePipelineId)
      .sort((a: any, b: any) => a.orderIndex - b.orderIndex);
  }, [stages, activePipelineId]);

  const contactMap = new Map(contacts.map((c: any) => [c.id, c]));
  const companyMap = new Map(companies.map((c: any) => [c.id, c]));

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', contactId: '', companyId: '', stageId: pipelineStages[0]?.id.toString() ?? '', value: '', currency: 'MYR', probability: 10, expectedClose: '' });
    setModalOpen(true);
  };

  const openEdit = (deal: any) => {
    setEditing(deal);
    setForm({
      name: deal.name, contactId: deal.contactId.toString(),
      companyId: deal.companyId?.toString() ?? '', stageId: deal.stageId.toString(),
      value: (Number(deal.value) / 100).toString(), currency: deal.currency,
      probability: deal.probability,
      expectedClose: deal.expectedClose ? new Date(deal.expectedClose).toISOString().split('T')[0] : '',
    });
    setModalOpen(true);
  };

  const save = () => {
    if (!db || !form.name || !form.contactId || !form.stageId) return;
    const value = BigInt(Math.round(parseFloat(form.value || '0') * 100));
    const expectedClose = form.expectedClose ? new Date(form.expectedClose).toISOString() : undefined;
    if (editing) {
      (db.reducers as any).updateDeal({
        id: editing.id, name: form.name, contactId: BigInt(form.contactId),
        companyId: form.companyId ? BigInt(form.companyId) : undefined,
        pipelineId: activePipelineId, stageId: BigInt(form.stageId),
        value, currency: form.currency, probability: form.probability, expectedClose,
      });
    } else {
      (db.reducers as any).createDeal({
        tenantId: 1n, name: form.name, contactId: BigInt(form.contactId),
        companyId: form.companyId ? BigInt(form.companyId) : undefined,
        pipelineId: activePipelineId, stageId: BigInt(form.stageId),
        value, currency: form.currency, probability: form.probability, expectedClose,
      });
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
    setDeletingId(null);
  };

  const moveDeal = (dealId: bigint, stageId: bigint) => {
    if (!db) return;
    (db.reducers as any).moveDealStage({ id: dealId, stageId });
  };

  const formatRM = (cents: number) => `RM ${(cents / 100).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
      <PageHeader title="Deals" subtitle="Track your sales pipeline" actionLabel="Add Deal" onAction={openCreate} />

      {pipelines.length > 1 && (
        <Select
          className="max-w-xs"
          aria-label="Select pipeline"
          selectedKeys={pipelineId ? [pipelineId] : activePipeline ? [activePipeline.id.toString()] : []}
          onSelectionChange={(keys) => setPipelineId(Array.from(keys)[0] as string || '')}
        >
          {pipelines.map((p: any) => (
            <SelectItem key={p.id.toString()}>{p.name}</SelectItem>
          ))}
        </Select>
      )}

      <div className="flex gap-5 overflow-x-auto pb-2">
        {pipelineStages.map((stage: any) => {
          const stageDeals = deals.filter((d: any) => d.stageId === stage.id && d.status?.tag === 'Open');
          const stageTotal = stageDeals.reduce((sum: number, d: any) => sum + Number(d.value), 0);
          return (
            <div key={stage.id.toString()} className="min-w-[300px] w-[300px] flex flex-col gap-3">
              <Card className="bg-slate-100 border-none shadow-none">
                <CardBody className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-sm text-slate-800">{stage.name}</h4>
                      <p className="text-xs text-slate-500">{stageDeals.length} deals &middot; {formatRM(stageTotal)}</p>
                    </div>
                    <Badge color="secondary" variant="flat" size="sm" className="bg-white text-slate-600">{stage.winProbability}%</Badge>
                  </div>
                </CardBody>
              </Card>

              <div className="space-y-2.5">
                {stageDeals.map((deal: any) => (
                  <Card key={deal.id.toString()} className="border border-slate-100 shadow-sm hover:shadow-md hover:shadow-slate-200/50 transition-all duration-200" isPressable>
                    <CardBody className="p-4">
                      <div className="flex items-start justify-between">
                        <h5 className="font-medium text-sm text-slate-800">{deal.name}</h5>
                        <div className="flex gap-1">
                          <Button isIconOnly size="sm" variant="light" className="text-slate-400 hover:text-slate-700 min-w-0 w-7 h-7" onPress={() => openEdit(deal)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button isIconOnly size="sm" variant="light" className="text-slate-400 hover:text-rose-600 min-w-0 w-7 h-7" onPress={() => promptRemove(deal.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 mt-1.5">{formatRM(Number(deal.value))}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {contactMap.get(deal.contactId)?.name ?? '—'}</span>
                        {deal.companyId && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {companyMap.get(deal.companyId)?.name ?? '—'}</span>}
                      </div>
                      {deal.expectedClose && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                          <Calendar className="w-3 h-3" /> {new Date(deal.expectedClose).toLocaleDateString()}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {pipelineStages.filter((s: any) => s.id !== stage.id).map((s: any) => (
                          <Button key={s.id.toString()} size="sm" variant="flat" className="h-6 min-w-0 px-2 text-[11px] bg-slate-50 text-slate-600 border border-slate-100" onPress={() => moveDeal(deal.id, s.id)}>
                            <ArrowRightLeft className="w-3 h-3 mr-1" /> {s.name}
                          </Button>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={modalOpen} onOpenChange={setModalOpen} size="lg">
        <ModalContent>
          <ModalHeader className="text-slate-900 font-outfit">{editing ? 'Edit Deal' : 'New Deal'}</ModalHeader>
          <ModalBody className="gap-4">
            <Input label="Deal Name" value={form.name} onValueChange={(v) => setForm({ ...form, name: v })} isRequired />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Contact" selectedKeys={form.contactId ? [form.contactId] : []} onSelectionChange={(keys) => setForm({ ...form, contactId: Array.from(keys)[0] as string })} isRequired items={contacts.map((c: any) => ({key: c.id.toString(), label: c.name}))}>
                {(item: any) => <SelectItem key={item.key} textValue={item.label}>{item.label}</SelectItem>}
              </Select>
              <Select label="Company" selectedKeys={form.companyId ? [form.companyId] : []} onSelectionChange={(keys) => setForm({ ...form, companyId: Array.from(keys)[0] as string || '' })} items={[{key: 'none', label: 'None'}, ...companies.map((c: any) => ({key: c.id.toString(), label: c.name}))]}>
                {(item: any) => <SelectItem key={item.key} textValue={item.label}>{item.label}</SelectItem>}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Value (RM)" type="number" step="0.01" value={form.value} onValueChange={(v) => setForm({ ...form, value: v })} />
              <Select label="Stage" selectedKeys={form.stageId ? [form.stageId] : []} onSelectionChange={(keys) => setForm({ ...form, stageId: Array.from(keys)[0] as string })} isRequired items={pipelineStages.map((s: any) => ({key: s.id.toString(), label: s.name}))}>
                {(item: any) => <SelectItem key={item.key} textValue={item.label}>{item.label}</SelectItem>}
              </Select>
            </div>
            <Input label="Expected Close" type="date" value={form.expectedClose} onValueChange={(v) => setForm({ ...form, expectedClose: v })} />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setModalOpen(false)}>Cancel</Button>
            <Button color="primary" className="bg-brand-600" onPress={save}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={remove} title="Delete deal?" description="This will permanently remove the deal from your pipeline." confirmLabel="Delete" />
    </div>
  );
}
