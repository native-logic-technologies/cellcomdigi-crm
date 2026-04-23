import { useMemo } from 'react';
import {
  X, Building2, Phone, Mail, Globe, MapPin, FileText,
  ClipboardList, Receipt,
} from 'lucide-react';
import { useTable } from '../spacetime/hooks';
import {
  Badge, Avatar, Card, CardBody, Tabs, Tab,
} from '@nextui-org/react';

interface CompanyDrawerProps {
  company: any | null;
  onClose: () => void;
}

function formatRM(cents: number) {
  return `RM ${(cents / 100).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;
}

function tryParseJson(str: string) {
  try { return JSON.parse(str); } catch { return null; }
}

function formatAddress(addr: string) {
  const parsed = tryParseJson(addr);
  if (!parsed) return addr;
  const parts = [parsed.street, parsed.city, parsed.postcode, parsed.state].filter(Boolean);
  return parts.join(', ');
}

export default function CompanyDrawer({ company, onClose }: CompanyDrawerProps) {
  const [contacts] = useTable('contacts');
  const [deals] = useTable('deals');
  const [activities] = useTable('activities');
  const [invoices] = useTable('invoices');
  const [stages] = useTable('pipeline_stages');

  const stageMap = useMemo(() => new Map(stages.map((s: any) => [s.id, s])), [stages]);

  const related = useMemo(() => {
    if (!company) return { contacts: [], deals: [], activities: [], invoices: [] };
    const companyContacts = contacts.filter((c: any) => c.companyId === company.id);
    const companyDeals = deals.filter((d: any) => d.companyId === company.id);
    const contactIds = new Set(companyContacts.map((c: any) => c.id));
    const companyActivities = activities.filter((a: any) => contactIds.has(a.contactId));
    const companyInvoices = invoices.filter((i: any) => contactIds.has(i.contactId));
    return { contacts: companyContacts, deals: companyDeals, activities: companyActivities, invoices: companyInvoices };
  }, [company, contacts, deals, activities, invoices]);

  const totalDealValue = related.deals.reduce((sum: number, d: any) => sum + Number(d.value), 0);

  if (!company) return null;

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
            name={company.name}
            size="lg"
            className="bg-emerald-100 text-emerald-700 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 truncate">{company.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {company.industry && (
                <Badge variant="flat" size="sm" className="bg-slate-50 text-slate-600 border border-slate-200">
                  {company.industry}
                </Badge>
              )}
              <Badge variant="flat" size="sm" className="bg-emerald-50 text-emerald-700 border border-emerald-200">
                {related.contacts.length} contacts
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
                      <Building2 className="w-4 h-4 text-slate-400" /> Company Info
                    </h3>
                    <div className="grid grid-cols-1 gap-2.5">
                      {company.phone && (
                        <div className="flex items-center gap-2.5 text-sm">
                          <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-slate-700">{company.phone}</span>
                        </div>
                      )}
                      {company.email && (
                        <div className="flex items-center gap-2.5 text-sm">
                          <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                          <a href={`mailto:${company.email}`} className="text-brand-600 hover:underline">{company.email}</a>
                        </div>
                      )}
                      {company.website && (
                        <div className="flex items-center gap-2.5 text-sm">
                          <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                          <a href={company.website} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline truncate">{company.website}</a>
                        </div>
                      )}
                      {company.address && company.address !== '{}' && (
                        <div className="flex items-start gap-2.5 text-sm">
                          <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          <span className="text-slate-700">{formatAddress(company.address)}</span>
                        </div>
                      )}
                      {company.registrationNumber && (
                        <div className="flex items-center gap-2.5 text-sm">
                          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-slate-500">Reg. {company.registrationNumber}</span>
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
                      <p className="text-lg font-bold text-slate-900">{related.contacts.length}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Contacts</p>
                    </CardBody>
                  </Card>
                  <Card className="border border-slate-100 shadow-sm">
                    <CardBody className="p-3 text-center">
                      <p className="text-lg font-bold text-brand-600">{formatRM(totalDealValue)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Pipeline</p>
                    </CardBody>
                  </Card>
                </div>

                {/* Notes */}
                {company.notes && (
                  <Card className="border border-slate-100 shadow-sm">
                    <CardBody className="p-4">
                      <h3 className="text-sm font-semibold text-slate-800 mb-2">Notes</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{company.notes}</p>
                    </CardBody>
                  </Card>
                )}
              </div>
            </Tab>

            <Tab key="contacts" title={`Contacts (${related.contacts.length})`}>
              <div className="px-6 py-4 space-y-3">
                {related.contacts.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">No contacts linked to this company</div>
                ) : (
                  related.contacts.map((c: any) => (
                    <Card key={c.id.toString()} className="border border-slate-100 shadow-sm">
                      <CardBody className="p-3 flex items-center gap-3">
                        <Avatar name={c.name} size="sm" className="bg-brand-100 text-brand-700" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">{c.name}</p>
                          <p className="text-xs text-slate-500">{c.email}</p>
                        </div>
                        <Badge variant="flat" size="sm" className="bg-slate-50 text-slate-600 border border-slate-200">
                          {c.status?.tag}
                        </Badge>
                      </CardBody>
                    </Card>
                  ))
                )}
              </div>
            </Tab>

            <Tab key="deals" title={`Deals (${related.deals.length})`}>
              <div className="px-6 py-4 space-y-3">
                {related.deals.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">No deals for this company</div>
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
          </Tabs>
        </div>
      </div>
    </>
  );
}
