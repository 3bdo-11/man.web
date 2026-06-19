import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const TICK_STYLE = { fontSize: 10, fill: '#94a3b8' };
const TOOLTIP_STYLE: React.CSSProperties = { fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0' };
const DOT_PROPS = { r: 3, fill: '#3b82f6' };
const ACTIVE_DOT_PROPS = { r: 5 };

interface ChartItem {
  label: string;
  value: number | null;
}

export const WeightChart = React.memo(function WeightChart({ data }: { data: ChartItem[] }) {
  const chartData = data.map(d => ({ label: d.label, weight: d.value }));
  const hasData = chartData.some(d => d.weight != null);
  if (!hasData) return <div className="card p-6 text-center"><p className="text-xs text-slate-400">No weight data for this period.</p></div>;

  return (
    <div className="card p-6">
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} />
          <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tick={TICK_STYLE} axisLine={false} tickLine={false} width={28} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} dot={DOT_PROPS} activeDot={ACTIVE_DOT_PROPS} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});
