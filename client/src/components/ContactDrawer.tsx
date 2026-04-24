import { useMemo } from 'react';
import {
  X, User, Phone, Mail, Building2, ClipboardList,
  Receipt, MessageSquare, Brain,
} from 'lucide-react';
import SupermemoryPanel from './SupermemoryPanel';
import { useTable } from '../spacetime/hooks';
import {
  Badge, Avatar, Card, CardBody, Tabs, Tab,
} from '@nextui-org/react';

interface ContactDrawerProps {
  contact: any | null;
  onClose: () => void;
}

function formatRM(cents: number) {
  return `RM ${(cents / 100).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;
}

export default function ContactDrawer({ contact, onClose }: ContactDrawerProps) {
  const [companies] = useTable('companies');
  const [deals] = useTable('deals');
  const [activities] = useTable('activities');
  const [invoices] = useTable('invoices');
  const [conversations] = useTable('conversations');
  const [stages] = useTable('pipeline_stages');

  const companyMap = useMemo(() => new Map(companies.map((c: any) => [c.id, c])), [companies]);
  const stageMap = useMemo(() => new Map(stages.map((s: any) => [s.id, s])), [stages]);

  const related = useMemo(() => {
    if (!contact) return { company: null, deals: [], activities: [], invoices: [], conversations: [] };
    return {
      company: contact.companyId ? companyMap.get(contact.companyId) : null,
      deals: deals.filter((d: any) => d.contactId === contact.id),
      activities: activities.filter((a: any) => a.contactId === contact.id),
      invoices: invoices.filter((i: any) => i.contactId === contact.id),
      conversations: conversations.filter((c: any) => c.contactId === contact.id),
    };
  }, [contact, companyMap, deals, activities, invoices, conversations]);

  const totalDealValue = related.deals.reduce((sum: number, d: any) => sum + Number(d.value), 0);

  if (!contact) return null;

  const statusColor: Record<string, string> = {
    Lead: 'bg-amber-50 text-amber-700 border-amber-200',
    Prospect: 'bg-brand-50 text-brand-700 border-brand-200',
    Customer: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Churned: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start gap-4">
          <Avatar
            name={contact.name}
            size="lg"
            className="bg-brand-100 text-brand-700 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 truncate">{contact.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge variant="flat" size="sm" className={statusColor[contact.status?.tag] ?? 'bg-slate-50 text-slate-600 border-slate-200'}>
                {contact.status?.tag}
              </Badge>
              <Badge variant="flat" size="sm" className="bg-slate-50 text-slate-600 border border-slate-200">
                {contact.source?.tag}
              </Badge>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <Tabs
            variant="underlined"
            classNames={{
              base: 'px-6 pt-2',
              tabList: 'gap-6',
              cursor: 'bg-brand-600',
              tab: 'text-sm font-medium text-slate-500',
              tabContent: 'group-data-[selected=true]:text-brand-600',
            }}
          >
            <Tab key="overview" title="Overview">
              <div className="px-6 py-4 space-y-5">
                {/* Contact info */}
                <Card className="border border-slate-100 shadow-sm">
                  <CardBody className="p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" /> Contact Info
                    </h3>
                    <div className="grid grid-cols-1 gap-2.5">
                      <div className="flex items-center gap-2.5 text-sm">
                        <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                        <a href={`mailto:${contact.email}`} className="text-brand-600 hover:underline">{contact.email}</a>
                      </div>
                      <div className="flex items-center gap-2.5 text-sm">
                        <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-slate-700">{contact.phone}</span>
                      </div>
                      {related.company && (
                        <div className="flex items-center gap-2.5 text-sm">
                          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-slate-700">{related.company.name}</span>
                          {related.company.industry && (
                            <Badge variant="flat" size="sm" className="bg-slate-50 text-slate-500 border border-slate-200">
                              {related.company.industry}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <Card className="border border-slate-100 shadow-sm">
                    <CardBody className="p-3 text-center">
                      <p className="text-lg font-bold text-slate-900">{related.deals.length}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Deals</p>
                    </CardBody>
                  </Card>
                  <Card className="border border-slate-100 shadow-sm">
                    <CardBody className="p-3 text-center">
                      <p className="text-lg font-bold text-slate-900">{related.invoices.length}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Invoices</p>
                    </CardBody>
                  </Card>
                  <Card className="border border-slate-100 shadow-sm">
                    <CardBody className="p-3 text-center">
                      <p className="text-lg font-bold text-brand-600">{formatRM(totalDealValue)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Pipeline</p>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>

            <Tab key="deals" title={`Deals (${related.deals.length})`}>
              <div className="px-6 py-4 space-y-3">
                {related.deals.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">No deals for this contact</div>
                ) : (
                  related.deals.map((d: any) => (
                    <Card key={d.id.toString()} className="border border-slate-100 shadow-sm">
                      <CardBody className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-800">{d.name}</p>
                          <Badge variant="flat" size="sm" className="bg-brand-50 text-brand-700 border border-brand-200">
                            {stageMap.get(d.stageId)?.name ?? '—'}
                          </Badge>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{formatRM(Number(d.value))}</p>
                        <p className="text-xs text-slate-500">{d.probability}% probability · {d.status?.tag}</p>
                      </CardBody>
                    </Card>
                  ))
                )}
              </div>
            </Tab>

            <Tab key="activity" title={`Activity (${related.activities.length})`}>
              <div className="px-6 py-4 space-y-3">
                {related.activities.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">No activity yet</div>
                ) : (
                  related.activities.map((a: any) => (
                    <div key={a.id.toString()} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <ClipboardList className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="flex-1 pb-3 border-b border-slate-50">
                        <p className="text-sm text-slate-800">{a.description}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{a.type?.tag} · {new Date(a.createdAt?.toDate?.() ?? a.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Tab>

            <Tab key="invoices" title={`Invoices (${related.invoices.length})`}>
              <div className="px-6 py-4 space-y-3">
                {related.invoices.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">No invoices</div>
                ) : (
                  related.invoices.map((inv: any) => (
                    <Card key={inv.id.toString()} className="border border-slate-100 shadow-sm">
                      <CardBody className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Receipt className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="text-sm font-medium text-slate-800">{inv.invoiceNumber}</p>
                            <p className="text-xs text-slate-500">{new Date(inv.issueDate).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">{formatRM(Number(inv.total))}</p>
                          <Badge
                            variant="flat"
                            size="sm"
                            className={
                              inv.status?.tag === 'Paid'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : inv.status?.tag === 'Overdue'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }
                          >
                            {inv.status?.tag}
                          </Badge>
                        </div>
                      </CardBody>
                    </Card>
                  ))
                )}
              </div>
            </Tab>

            <Tab key="conversations" title={`Conversations (${related.conversations.length})`}>
              <div className="px-6 py-4 space-y-3">
                {related.conversations.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">No conversations</div>
                ) : (
                  related.conversations.map((c: any) => (
                    <Card key={c.id.toString()} className="border border-slate-100 shadow-sm">
                      <CardBody className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <MessageSquare className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="text-sm font-medium text-slate-800">{c.channel?.tag} Conversation</p>
                            <p className="text-xs text-slate-500">{c.status?.tag}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {c.unreadCount > 0 && (
                            <Badge variant="flat" size="sm" className="bg-rose-50 text-rose-700 border border-rose-200">
                              {c.unreadCount} unread
                            </Badge>
                          )}
                          <p className="text-xs text-slate-400 mt-1">{new Date(c.lastMessageAt?.toDate?.() ?? c.lastMessageAt).toLocaleString()}</p>
                        </div>
                      </CardBody>
                    </Card>
                  ))
                )}
              </div>
            </Tab>

            <Tab key="supermemory" title={
              <span className="flex items-center gap-1">
                <Brain className="w-3.5 h-3.5" /> Supermemory
              </span>
            }>
              <div className="px-6 py-4">
                <SupermemoryPanel
                  tenantId={contact.tenantId}
                  entityTable="contacts"
                  entityId={contact.id}
                />
              </div>
            </Tab>
          </Tabs>
        </div>
      </div>
    </>
  );
}
