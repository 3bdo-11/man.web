import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const TICK_STYLE = { fontSize: 10, fill: '#94a3b8' };
const TOOLTIP_STYLE: React.CSSProperties = { fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0' };
const DOT_PROPS = { r: 3, fill: '#8b5cf6' };

interface ChartItem {
  label: string;
  value: number;
}

function tooltipFormatter(value: any): [string, string] {
  return [`${value ?? 0} min`, 'Screen Time'];
}

export const ScreenTimeChart = React.memo(function ScreenTimeChart({ data }: { data: ChartItem[] }) {
  if (data.length === 0) return <div className="card p-6 text-center"><p className="text-xs text-slate-400">No screen time data for this period.</p></div>;

  const chartData = data.map(d => ({ label: d.label, minutes: d.value }));

  return (
    <div className="card p-6">
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} />
          <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} width={28} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter} />
          <Line type="monotone" dataKey="minutes" stroke="#8b5cf6" strokeWidth={2} dot={DOT_PROPS} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});
