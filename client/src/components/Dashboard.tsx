import { useMemo } from 'react';
import {
  Users, Banknote, Inbox, FileText,
  TrendingUp, Phone, Mail, MessageSquare, Calendar,
  ArrowRight
} from 'lucide-react';
import { useTable } from '../spacetime/hooks';
import { Card, CardBody, CardHeader, Button } from '@nextui-org/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import StatCard from './StatCard';

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  Call: Phone, Meeting: Calendar, Email: Mail, Whatsapp: MessageSquare,
  Note: FileText, Task: Calendar,
};

const ACTIVITY_COLORS: Record<string, string> = {
  Call: 'bg-brand-50 text-brand-600',
  Meeting: 'bg-sky-50 text-sky-600',
  Email: 'bg-amber-50 text-amber-600',
  Whatsapp: 'bg-emerald-50 text-emerald-600',
  Note: 'bg-slate-100 text-slate-600',
  Task: 'bg-rose-50 text-rose-600',
};

const PIE_COLORS = ['#4f46e5', '#10b981', '#f43f5e', '#f59e0b'];

export default function Dashboard() {
  const [contacts] = useTable('contacts');
  const [deals] = useTable('deals');
  const [stages] = useTable('pipeline_stages');
  const [conversations] = useTable('conversations');
  const [activities] = useTable('activities');
  const [users] = useTable('users');

  const openDeals = deals.filter((d: any) => d.status?.tag === 'Open');
  const wonDeals = deals.filter((d: any) => d.status?.tag === 'Won');
  const totalPipeline = openDeals.reduce((sum: number, d: any) => sum + Number(d.value), 0);
  const totalRevenue = wonDeals.reduce((sum: number, d: any) => sum + Number(d.value), 0);
  const unreadCount = conversations.reduce((sum: number, c: any) => sum + c.unreadCount, 0);

  const formatRM = (cents: number) =>
    `RM ${(cents / 100).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const userMap = new Map(users.map((u: any) => [u.id, u]));
  const contactMap = new Map(contacts.map((c: any) => [c.id, c]));

  // Pipeline bar chart data
  const pipelineData = useMemo(() => {
    const data: Record<string, { name: string; value: number; count: number }> = {};
    for (const s of stages) {
      data[s.name] = { name: s.name, value: 0, count: 0 };
    }
    for (const d of openDeals) {
      const stage = stages.find((s: any) => s.id === d.stageId);
      if (stage && data[stage.name]) {
        data[stage.name].value += Number(d.value);
        data[stage.name].count += 1;
      }
    }
    return Object.values(data).sort((a, b) => {
      const order = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won'];
      return order.indexOf(a.name) - order.indexOf(b.name);
    });
  }, [stages, openDeals]);

  // Deal status pie chart
  const statusData = useMemo(() => {
    const counts: Record<string, number> = { Open: 0, Won: 0, Lost: 0, Stalled: 0 };
    for (const d of deals) {
      const tag = d.status?.tag;
      if (tag && counts[tag] !== undefined) counts[tag]++;
    }
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [deals]);

  // Recent activities grouped
  const recentActivities = useMemo(() => {
    const sorted = [...activities].sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, 8);

    const groups: { label: string; items: any[] }[] = [];
    const now = new Date();

    for (const a of sorted) {
      const date = new Date(a.createdAt);
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      let label = 'Earlier';
      if (diffDays === 0) label = 'Today';
      else if (diffDays === 1) label = 'Yesterday';
      else if (diffDays < 7) label = 'This week';

      const group = groups.find((g) => g.label === label);
      if (group) group.items.push(a);
      else groups.push({ label, items: [a] });
    }
    return groups;
  }, [activities]);

  const quickActions = [
    { label: 'Add Contact', icon: Users, color: 'bg-brand-600' },
    { label: 'Create Deal', icon: Banknote, color: 'bg-emerald-600' },
    { label: 'New Invoice', icon: FileText, color: 'bg-sky-600' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Welcome */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold font-outfit text-slate-900">
            Good morning, Demo User
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {new Date().toLocaleDateString('en-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              size="sm"
              variant="flat"
              className="font-medium text-slate-600 bg-white border border-slate-200"
              startContent={<action.icon className="w-3.5 h-3.5" />}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Total Contacts" value={contacts.length} icon={Users} color="indigo" trend={12} trendLabel="vs last month" />
        <StatCard label="Open Pipeline" value={formatRM(totalPipeline)} icon={Banknote} color="amber" trend={8} trendLabel="vs last month" />
        <StatCard label="Won Revenue" value={formatRM(totalRevenue)} icon={TrendingUp} color="emerald" trend={23} trendLabel="this quarter" />
        <StatCard label="Unread Messages" value={unreadCount} icon={Inbox} color="rose" />
      </div>

      {/* Charts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline chart */}
        <Card className="lg:col-span-2 border border-slate-100">
          <CardHeader className="px-6 py-5 border-b border-slate-50">
            <div>
              <h3 className="text-base font-semibold font-outfit text-slate-900">Pipeline Overview</h3>
              <p className="text-xs text-slate-400 mt-0.5">Deal distribution by stage</p>
            </div>
          </CardHeader>
          <CardBody className="p-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `RM ${(v / 100000).toFixed(1)}K`} />
                  <ReTooltip
                    formatter={(value: any) => formatRM(value as number)}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        {/* Status donut */}
        <Card className="border border-slate-100">
          <CardHeader className="px-6 py-5 border-b border-slate-50">
            <div>
              <h3 className="text-base font-semibold font-outfit text-slate-900">Deal Status</h3>
              <p className="text-xs text-slate-400 mt-0.5">Breakdown by outcome</p>
            </div>
          </CardHeader>
          <CardBody className="p-6">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <ReTooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {statusData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[index] }} />
                  <span className="text-xs text-slate-500">{entry.name} ({entry.value})</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Activity Timeline */}
      <Card className="border border-slate-100">
        <CardHeader className="px-6 py-5 border-b border-slate-50 flex justify-between items-center">
          <div>
            <h3 className="text-base font-semibold font-outfit text-slate-900">Recent Activity</h3>
            <p className="text-xs text-slate-400 mt-0.5">Latest actions across your team</p>
          </div>
          <Button size="sm" variant="light" className="text-brand-600 font-medium" endContent={<ArrowRight className="w-3.5 h-3.5" />}>
            View all
          </Button>
        </CardHeader>
        <CardBody className="p-0">
          <div className="divide-y divide-slate-50">
            {recentActivities.map((group) => (
              <div key={group.label} className="px-6 py-4">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  {group.label}
                </p>
                <div className="space-y-4">
                  {group.items.map((a: any) => {
                    const contact = a.contactId ? contactMap.get(a.contactId) : null;
                    const user = userMap.get(a.createdBy);
                    const typeTag = a.type?.tag ?? a.type;
                    const ActivityIcon = ACTIVITY_ICONS[typeTag] ?? Calendar;
                    return (
                      <div key={a.id.toString()} className="flex items-start gap-3 group">
                        <div className={`p-2 rounded-lg shrink-0 ${ACTIVITY_COLORS[typeTag] ?? 'bg-slate-100 text-slate-600'}`}>
                          <ActivityIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700">
                            <span className="font-medium">{user?.name ?? 'Someone'}</span>
                            {' '}had a <span className="font-medium">{typeTag}</span>
                            {contact && <> with <span className="font-medium">{contact.name}</span></>}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{a.description}</p>
                        </div>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
