import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardBody } from '@nextui-org/react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: number;
  trendLabel?: string;
  color: 'indigo' | 'emerald' | 'rose' | 'amber' | 'sky';
  sparklineData?: number[];
}

const colorMap = {
  indigo: { bg: 'bg-brand-50', icon: 'text-brand-600', stroke: '#4f46e5', fill: '#eef2ff' },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', stroke: '#10b981', fill: '#ecfdf5' },
  rose: { bg: 'bg-rose-50', icon: 'text-rose-600', stroke: '#f43f5e', fill: '#fff1f2' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', stroke: '#f59e0b', fill: '#fffbeb' },
  sky: { bg: 'bg-sky-50', icon: 'text-sky-600', stroke: '#0ea5e9', fill: '#f0f9ff' },
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  color,
  sparklineData,
}: StatCardProps) {
  const colors = colorMap[color];
  const chartData = sparklineData
    ? sparklineData.map((v, i) => ({ i, v }))
    : [{ i: 0, v: 30 }, { i: 1, v: 45 }, { i: 2, v: 35 }, { i: 3, v: 55 }, { i: 4, v: 48 }, { i: 5, v: 62 }, { i: 6, v: 58 }];

  const isPositive = trend === undefined || trend >= 0;

  return (
    <Card className="hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 border border-slate-100">
      <CardBody className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-semibold font-outfit text-slate-900 mt-1">{value}</p>
            {trend !== undefined && (
              <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                <span>{Math.abs(trend)}%</span>
                {trendLabel && <span className="text-slate-400 font-normal ml-0.5">{trendLabel}</span>}
              </div>
            )}
          </div>
          <div className={`p-2.5 rounded-xl ${colors.bg} shrink-0 ml-4`}>
            <Icon className={`w-5 h-5 ${colors.icon}`} />
          </div>
        </div>
        <div className="h-10 mt-3 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <Area
                type="monotone"
                dataKey="v"
                stroke={colors.stroke}
                strokeWidth={2}
                fill={colors.fill}
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}
