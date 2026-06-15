import React from 'react';

interface PrayerDonutChartProps {
  percentage: number;
  strongest: string;
  weakest: string;
}

export const PrayerDonutChart = React.memo(function PrayerDonutChart({ percentage, strongest, weakest }: PrayerDonutChartProps) {
  const safePct = Number.isFinite(percentage) ? Math.max(0, Math.min(100, percentage)) : 0;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const filled = (safePct / 100) * circumference;
  const empty = circumference - filled;

  return (
    <section className="space-y-4">
      <h2 className="section-header">PRAYER</h2>
      <div className="card p-6 flex items-center gap-6">
        <div className="relative shrink-0">
          <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90" role="img" aria-label={`Prayer adherence: ${safePct} percent`}>
            <circle cx="48" cy="48" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="8" />
            <circle
              cx="48" cy="48" r={radius}
              fill="none" stroke="#10b981"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${empty}`}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-slate-900 tabular-nums" aria-hidden="true">{safePct}%</span>
          </div>
        </div>
        <div className="space-y-3 flex-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-label="Best prayer" />
            <div>
              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">BEST</p>
              <p className="text-xs font-bold text-emerald-600">{strongest}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" aria-label="Weakest prayer" />
            <div>
              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">WEAKEST</p>
              <p className="text-xs font-bold text-red-500">{weakest}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
