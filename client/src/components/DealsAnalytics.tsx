import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { useTable } from '../spacetime/hooks';
import { TrendingUp, Target, Clock, Zap } from 'lucide-react';
import { Card, CardBody } from '@nextui-org/react';



function formatRM(cents: number) {
  return `RM ${(cents / 100).toLocaleString('en-MY', { minimumFractionDigits: 0 })}`;
}

export default function DealsAnalytics() {
  const [deals] = useTable('deals');
  const [stages] = useTable('pipeline_stages');
  const [history] = useTable('deal_stage_history');

  const stageMap = useMemo(() => new Map(stages.map((s: any) => [s.id, s])), [stages]);

  /* Stage distribution */
  const stageDistribution = useMemo(() => {
    const dist = new Map<string, { count: number; value: number }>();
    for (const d of deals as any[]) {
      const stage = stageMap.get(d.stageId);
      const name = stage?.name ?? 'Unknown';
      const curr = dist.get(name) ?? { count: 0, value: 0 };
      curr.count++;
      curr.value += Number(d.value);
      dist.set(name, curr);
    }
    return Array.from(dist.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      value: data.value,
    }));
  }, [deals, stageMap]);

  /* Pipeline value by stage */
  const pipelineValue = useMemo(() => {
    return stageDistribution.map((s) => ({
      name: s.name,
      value: Math.round(s.value / 100),
    }));
  }, [stageDistribution]);

  /* Win/loss stats */
  const winLossStats = useMemo(() => {
    const total = deals.length;
    const won = (deals as any[]).filter((d) => d.status?.tag === 'Won').length;
    const lost = (deals as any[]).filter((d) => d.status?.tag === 'Lost').length;
    const open = total - won - lost;
    return [
      { name: 'Won', value: won, color: '#10b981' },
      { name: 'Lost', value: lost, color: '#f43f5e' },
      { name: 'Open', value: open, color: '#0078d4' },
    ];
  }, [deals]);

  /* Conversion rates between stages */
  const conversionData = useMemo(() => {
    const sortedStages = [...stages].sort((a: any, b: any) => a.orderIndex - b.orderIndex);
    const result: { from: string; to: string; rate: number; moved: number; total: number }[] = [];
    for (let i = 0; i < sortedStages.length - 1; i++) {
      const fromStage = sortedStages[i];
      const toStage = sortedStages[i + 1];
      // Count deals that were ever in fromStage
      const everInFrom = new Set(
        (history as any[])
          .filter((h) => h.fromStageId === fromStage.id || h.toStageId === fromStage.id)
          .map((h) => h.dealId.toString())
      );
      // Add current deals in fromStage
      (deals as any[]).filter((d) => d.stageId === fromStage.id).forEach((d) => everInFrom.add(d.id.toString()));

      // Count deals that moved from fromStage to toStage
      const movedToNext = new Set(
        (history as any[])
          .filter((h) => h.fromStageId === fromStage.id && h.toStageId === toStage.id)
          .map((h) => h.dealId.toString())
      );
      // Also count deals currently in later stages
      (deals as any[])
        .filter((d) => {
          const currStage = sortedStages.find((s: any) => s.id === d.stageId);
          return currStage && currStage.orderIndex > fromStage.orderIndex;
        })
        .forEach((d) => movedToNext.add(d.id.toString()));

      const total = everInFrom.size;
      const moved = movedToNext.size;
      result.push({
        from: fromStage.name,
        to: toStage.name,
        rate: total > 0 ? Math.round((moved / total) * 100) : 0,
        moved,
        total,
      });
    }
    return result;
  }, [deals, stages, history]);

  /* Total pipeline metrics */
  const totalPipeline = (deals as any[]).reduce((sum, d) => sum + Number(d.value), 0);
  const weightedPipeline = (deals as any[]).reduce(
    (sum, d) => sum + Number(d.value) * (d.probability / 100),
    0
  );
  const avgDealSize = deals.length > 0 ? totalPipeline / deals.length : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-slate-100 shadow-sm">
          <CardBody className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Pipeline</p>
              <p className="text-lg font-bold text-slate-900">{formatRM(totalPipeline)}</p>
            </div>
          </CardBody>
        </Card>
        <Card className="border border-slate-100 shadow-sm">
          <CardBody className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Target className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Weighted Value</p>
              <p className="text-lg font-bold text-slate-900">{formatRM(Math.round(weightedPipeline))}</p>
            </div>
          </CardBody>
        </Card>
        <Card className="border border-slate-100 shadow-sm">
          <CardBody className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Avg Deal Size</p>
              <p className="text-lg font-bold text-slate-900">{formatRM(Math.round(avgDealSize))}</p>
            </div>
          </CardBody>
        </Card>
        <Card className="border border-slate-100 shadow-sm">
          <CardBody className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Deals</p>
              <p className="text-lg font-bold text-slate-900">{deals.length}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pipeline value by stage */}
        <Card className="border border-slate-100 shadow-sm">
          <CardBody className="p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Pipeline Value by Stage</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={pipelineValue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `RM${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: any) => [`RM ${Number(value).toLocaleString()}`, 'Value']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Bar dataKey="value" fill="#0078d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Win/Loss Distribution */}
        <Card className="border border-slate-100 shadow-sm">
          <CardBody className="p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Deal Outcomes</h3>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={winLossStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {winLossStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {winLossStats.map((s) => (
                <div key={s.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-xs text-slate-600">{s.name} ({s.value})</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Conversion Rates */}
      <Card className="border border-slate-100 shadow-sm">
        <CardBody className="p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Stage Conversion Rates</h3>
          {conversionData.length === 0 ? (
            <p className="text-sm text-slate-400">Not enough data to calculate conversion rates</p>
          ) : (
            <div className="space-y-4">
              {conversionData.map((c) => (
                <div key={c.from}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-slate-700">
                      {c.from} <span className="text-slate-400">→</span> {c.to}
                    </span>
                    <span className="font-semibold text-slate-900">{c.rate}%</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all duration-500"
                      style={{ width: `${c.rate}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{c.moved} of {c.total} deals moved forward</p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
