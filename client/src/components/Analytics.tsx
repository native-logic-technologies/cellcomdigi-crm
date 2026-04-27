import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, Clock, Target, DollarSign, type LucideIcon } from 'lucide-react';
import { useTable } from '../spacetime/hooks';
import { Card, CardBody } from '@nextui-org/react';
import { useLanguage } from '../i18n/LanguageContext';
import PageHeader from './PageHeader';
import StatCard from './StatCard';

const COLORS = ['#0078d4', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];

function formatRM(cents: number) {
  return `RM ${(cents / 100).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;
}

export default function Analytics() {
  const { t } = useLanguage();
  const [deals] = useTable('deals');
  const [stages] = useTable('pipeline_stages');
  const [stageHistory] = useTable('deal_stage_history');
  const [contacts] = useTable('contacts');

  const stageMap = useMemo(() => new Map(stages.map((s: any) => [s.id, s])), [stages]);

  const openDeals = deals.filter((d: any) => d.status?.tag === 'Open');
  const wonDeals = deals.filter((d: any) => d.status?.tag === 'Won');
  const lostDeals = deals.filter((d: any) => d.status?.tag === 'Lost');

  const totalPipeline = openDeals.reduce((sum: number, d: any) => sum + Number(d.value), 0);
  const totalRevenue = wonDeals.reduce((sum: number, d: any) => sum + Number(d.value), 0);
  const avgDealSize = deals.length > 0
    ? deals.reduce((sum: number, d: any) => sum + Number(d.value), 0) / deals.length
    : 0;

  // Stage distribution
  const stageData = useMemo(() => {
    const sorted = [...stages].sort((a: any, b: any) => a.orderIndex - b.orderIndex);
    return sorted.map((s: any) => {
      const stageDeals = openDeals.filter((d: any) => d.stageId === s.id);
      const value = stageDeals.reduce((sum: number, d: any) => sum + Number(d.value), 0);
      return { name: s.name, deals: stageDeals.length, value: Math.round(value / 100) };
    });
  }, [stages, openDeals]);

  // Conversion funnel
  const funnelData = useMemo(() => {
    const total = deals.length;
    if (total === 0) return [];
    return [
      { name: 'Total Deals', value: total, pct: 100 },
      { name: 'Won', value: wonDeals.length, pct: Math.round((wonDeals.length / total) * 100) },
      { name: 'Lost', value: lostDeals.length, pct: Math.round((lostDeals.length / total) * 100) },
      { name: 'Open', value: openDeals.length, pct: Math.round((openDeals.length / total) * 100) },
    ];
  }, [deals, wonDeals, lostDeals, openDeals]);

  // Stage velocity (how many moves per stage)
  const velocityData = useMemo(() => {
    const counts = new Map<bigint, number>();
    for (const h of stageHistory) {
      const to = h.toStageId;
      counts.set(to, (counts.get(to) ?? 0) + 1);
    }
    return [...counts.entries()].map(([stageId, count]) => ({
      name: stageMap.get(stageId)?.name ?? 'Unknown',
      moves: count,
    }));
  }, [stageHistory, stageMap]);

  // Win rate by stage
  const winRate = deals.length > 0 ? Math.round((wonDeals.length / deals.length) * 100) : 0;

  // Contact source distribution
  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of contacts) {
      const tag = c.source?.tag ?? 'Unknown';
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [contacts]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
      <PageHeader title={t('analytics.title')} subtitle={t('analytics.subtitle')} />

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Pipeline"
          value={formatRM(totalPipeline)}
          icon={DollarSign as LucideIcon}
          color="indigo"
          trendLabel="Open deals"
        />
        <StatCard
          label="Revenue Won"
          value={formatRM(totalRevenue)}
          icon={TrendingUp as LucideIcon}
          color="emerald"
          trendLabel={`${wonDeals.length} deals closed`}
        />
        <StatCard
          label="Win Rate"
          value={`${winRate}%`}
          icon={Target as LucideIcon}
          color="amber"
          trendLabel={`${wonDeals.length} won / ${lostDeals.length} lost`}
        />
        <StatCard
          label="Avg Deal Size"
          value={formatRM(Math.round(avgDealSize))}
          icon={Clock as LucideIcon}
          color="sky"
          trendLabel={`${deals.length} total deals`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pipeline by stage */}
        <Card className="border border-slate-100 shadow-sm">
          <CardBody className="p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Pipeline Value by Stage</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={stageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(val: any, _name: any) => [`RM ${Number(val ?? 0).toLocaleString('en-MY')}`, 'Value']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="value" fill="#0078d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        {/* Deal count by stage */}
        <Card className="border border-slate-100 shadow-sm">
          <CardBody className="p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Deal Count by Stage</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={stageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="deals" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        {/* Conversion funnel */}
        <Card className="border border-slate-100 shadow-sm">
          <CardBody className="p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Conversion Overview</h3>
            <div className="h-64">
              {funnelData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">No deal data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={funnelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, pct }: any) => `${name}: ${pct}%`}
                    >
                      {funnelData.map((_: any, i: number) => (
                        <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Stage velocity */}
        <Card className="border border-slate-100 shadow-sm">
          <CardBody className="p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Stage Movement Velocity</h3>
            <div className="h-64">
              {velocityData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">No stage movements yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <LineChart data={velocityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <Line type="monotone" dataKey="moves" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Contact sources */}
        <Card className="border border-slate-100 shadow-sm lg:col-span-2">
          <CardBody className="p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Contact Sources</h3>
            <div className="h-64">
              {sourceData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">No contact data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={sourceData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
