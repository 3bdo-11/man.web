import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn.ts';

export type PeriodType = 'weekly' | 'monthly' | 'yearly';

interface PeriodNavigationProps {
  periodType: PeriodType;
  periodLabel: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onTypeChange: (type: PeriodType) => void;
  onPrev: () => void;
  onNext: () => void;
}

const PERIOD_TABS: { value: PeriodType; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export const PeriodNavigation = React.memo(function PeriodNavigation({
  periodType, periodLabel,
  canGoBack, canGoForward,
  onTypeChange, onPrev, onNext,
}: PeriodNavigationProps) {
  return (
    <div className="space-y-4">
      <div className="flex bg-slate-100/50 p-1 rounded-2xl w-full border border-slate-200/50" role="tablist">
        {PERIOD_TABS.map(tab => (
          <button type="button"
            key={tab.value}
            role="tab"
            aria-selected={periodType === tab.value}
            onClick={() => onTypeChange(tab.value)}
            className={cn(
              "flex-1 px-4 py-2 text-xs font-bold tracking-widest rounded-xl transition-all touch-manipulation active:scale-95",
              periodType === tab.value
                ? "bg-white text-slate-950 shadow-md shadow-slate-200/50"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between bg-white p-3 rounded-3xl border border-slate-100 shadow-sm">
        <button type="button"
          onClick={onPrev}
          disabled={!canGoBack}
          aria-label="Previous period"
          className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-900 rounded-2xl active:scale-90 transition-transform disabled:opacity-20"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-xs font-semibold tracking-widest text-slate-950">
            {periodLabel}
          </p>
        </div>
        <button type="button"
          onClick={onNext}
          disabled={!canGoForward}
          aria-label="Next period"
          className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-900 rounded-2xl active:scale-90 transition-transform disabled:opacity-20"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
});
