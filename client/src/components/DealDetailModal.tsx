import { useMemo } from 'react';
import {
  X, User, Building2, Handshake, Calendar, TrendingUp,
  ArrowRight, Clock,
} from 'lucide-react';
import { useTable } from '../spacetime/hooks';
import {
  Badge, Card, CardBody, Modal, ModalContent,
} from '@nextui-org/react';

interface DealDetailModalProps {
  deal: any | null;
  onClose: () => void;
}

function formatRM(cents: number) {
  return `RM ${(cents / 100).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;
}

export default function DealDetailModal({ deal, onClose }: DealDetailModalProps) {
  const [contacts] = useTable('contacts');
  const [companies] = useTable('companies');
  const [stages] = useTable('pipeline_stages');
  const [pipelines] = useTable('pipelines');
  const [stageHistory] = useTable('deal_stage_history');
  const [activities] = useTable('activities');

  const contactMap = useMemo(() => new Map(contacts.map((c: any) => [c.id, c])), [contacts]);
  const companyMap = useMemo(() => new Map(companies.map((c: any) => [c.id, c])), [companies]);
  const stageMap = useMemo(() => new Map(stages.map((s: any) => [s.id, s])), [stages]);
  const pipelineMap = useMemo(() => new Map(pipelines.map((p: any) => [p.id, p])), [pipelines]);

  const history = useMemo(() => {
    if (!deal) return [];
    return stageHistory
      .filter((h: any) => h.dealId === deal.id)
      .sort((a: any, b: any) => {
        const da = new Date(a.movedAt?.toDate?.() ?? a.movedAt).getTime();
        const db = new Date(b.movedAt?.toDate?.() ?? b.movedAt).getTime();
        return da - db;
      });
  }, [deal, stageHistory]);

  const dealActivities = useMemo(() => {
    if (!deal) return [];
    return activities
      .filter((a: any) => a.dealId === deal.id)
      .sort((a: any, b: any) => {
        const da = new Date(a.createdAt?.toDate?.() ?? a.createdAt).getTime();
        const db = new Date(b.createdAt?.toDate?.() ?? b.createdAt).getTime();
        return db - da;
      });
  }, [deal, activities]);

  if (!deal) return null;

  const contact = contactMap.get(deal.contactId);
  const company = deal.companyId ? companyMap.get(deal.companyId) : null;
  const currentStage = stageMap.get(deal.stageId);
  const pipeline = pipelineMap.get(deal.pipelineId);

  return (
    <Modal isOpen={!!deal} onOpenChange={(open) => !open && onClose()} size="2xl">
      <ModalContent className="max-h-[85vh] overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-semibold text-slate-900">{deal.name}</h2>
                <Badge
                  variant="flat"
                  size="sm"
                  className={
                    deal.status?.tag === 'Open'
                      ? 'bg-brand-50 text-brand-700 border border-brand-200'
                      : deal.status?.tag === 'Won'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }
                >
                  {deal.status?.tag}
                </Badge>
              </div>
              <p className="text-sm text-slate-500">{pipeline?.name ?? 'Sales Pipeline'}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Left column */}
              <div className="space-y-5">
                {/* Value card */}
                <Card className="border border-slate-100 shadow-sm bg-gradient-to-br from-brand-50/50 to-white">
                  <CardBody className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Deal Value</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">{formatRM(Number(deal.value))}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Probability</p>
                        <p className="text-2xl font-bold text-brand-600 mt-1">{deal.probability}%</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Weighted Value</p>
                      <p className="text-lg font-semibold text-slate-800 mt-0.5">
                        {formatRM(Math.round(Number(deal.value) * (deal.probability / 100)))}
                      </p>
                    </div>
                  </CardBody>
                </Card>

                {/* Details */}
                <Card className="border border-slate-100 shadow-sm">
                  <CardBody className="p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-800">Details</h3>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2.5 text-sm">
                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-slate-500">Contact:</span>
                        <span className="text-slate-800 font-medium">{contact?.name ?? '—'}</span>
                      </div>
                      {company && (
                        <div className="flex items-center gap-2.5 text-sm">
                          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-slate-500">Company:</span>
                          <span className="text-slate-800 font-medium">{company.name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2.5 text-sm">
                        <Handshake className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-slate-500">Stage:</span>
                        <Badge variant="flat" size="sm" className="bg-brand-50 text-brand-700 border border-brand-200">
                          {currentStage?.name ?? '—'}
                        </Badge>
                      </div>
                      {deal.expectedClose && (
                        <div className="flex items-center gap-2.5 text-sm">
                          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-slate-500">Expected Close:</span>
                          <span className="text-slate-800">{new Date(deal.expectedClose).toLocaleDateString()}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2.5 text-sm">
                        <TrendingUp className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-slate-500">Created:</span>
                        <span className="text-slate-800">{new Date(deal.createdAt?.toDate?.() ?? deal.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* Activity */}
                <Card className="border border-slate-100 shadow-sm">
                  <CardBody className="p-4">
                    <h3 className="text-sm font-semibold text-slate-800 mb-3">Recent Activity</h3>
                    {dealActivities.length === 0 ? (
                      <p className="text-sm text-slate-400">No activity recorded</p>
                    ) : (
                      <div className="space-y-3">
                        {dealActivities.slice(0, 5).map((a: any) => (
                          <div key={a.id.toString()} className="flex gap-3">
                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-slate-800">{a.description}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{a.type?.tag}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>

              {/* Right column - Stage History */}
              <div>
                <Card className="border border-slate-100 shadow-sm h-full">
                  <CardBody className="p-4">
                    <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-slate-400" /> Stage History
                    </h3>
                    {history.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-slate-400">No stage changes yet</p>
                        <p className="text-xs text-slate-300 mt-1">Stage movements will appear here</p>
                      </div>
                    ) : (
                      <div className="relative pl-4">
                        {/* Timeline line */}
                        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-slate-200" />
                        <div className="space-y-4">
                          {history.map((h: any) => {
                            const fromStage = h.fromStageId ? stageMap.get(h.fromStageId) : null;
                            const toStage = stageMap.get(h.toStageId);
                            const date = new Date(h.movedAt?.toDate?.() ?? h.movedAt);
                            return (
                              <div key={h.id.toString()} className="relative flex gap-3">
                                <div className="relative z-10 w-[22px] h-[22px] rounded-full bg-brand-100 border-2 border-brand-300 flex items-center justify-center shrink-0 mt-0.5">
                                  <div className="w-2 h-2 rounded-full bg-brand-500" />
                                </div>
                                <div className="flex-1 pb-4">
                                  <p className="text-sm text-slate-800">
                                    {fromStage ? (
                                      <>
                                        Moved from <span className="font-medium">{fromStage.name}</span>
                                        <ArrowRight className="w-3 h-3 inline mx-1 text-slate-400" />
                                        <span className="font-medium">{toStage?.name ?? '—'}</span>
                                      </>
                                    ) : (
                                      <>
                                        Created in <span className="font-medium">{toStage?.name ?? '—'}</span>
                                      </>
                                    )}
                                  </p>
                                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {date.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
