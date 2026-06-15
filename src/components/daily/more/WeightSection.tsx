import { useRef } from 'react';
import { haptic } from '../../../lib/haptic.ts';

const MIN = 30;
const MAX = 250;

export default function WeightSection({ weightInput, lastKnownWeight, onWeightChange, onWeightSave }: {
  weightInput: string;
  lastKnownWeight?: number;
  onWeightChange: (val: string) => void;
  onWeightSave: (val: number) => void;
}) {
  const hasWeight = weightInput !== '' && !isNaN(parseFloat(weightInput));
  const effectiveKg = hasWeight ? parseFloat(weightInput) : (lastKnownWeight ?? 0);
  const lastSavedRef = useRef(hasWeight ? effectiveKg : -1);

  const commitWeight = (kg: number) => {
    const clamped = Math.max(MIN, Math.min(MAX, Math.round(kg * 10) / 10));
    onWeightChange(clamped.toString());
    if (Math.abs(clamped - lastSavedRef.current) >= 0.1) {
      onWeightSave(clamped);
      lastSavedRef.current = clamped;
    }
  };

  const step = (delta: number) => {
    commitWeight(effectiveKg + delta);
    haptic.weight();
  };

  return (
    <section className="space-y-4">
      <h2 className="section-header">Weight</h2>
      <div className="card bg-white border-slate-100 shadow-sm">
        <div className="flex items-center justify-center gap-6 py-2">
          <button
            onClick={() => step(-0.5)}
            aria-label="Decrease weight by 0.5 kg"
            className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 active:scale-90 transition-all text-xl font-light hover:bg-slate-100"
          >
            −
          </button>
          <div className="flex items-baseline gap-1 min-w-[100px] justify-center">
            <span className="text-2xl font-bold tabular-nums text-[var(--brand-text)]">
              {hasWeight ? effectiveKg.toFixed(1) : '--'}
            </span>
            <span className="text-sm font-semibold text-slate-400">kg</span>
          </div>
          <button
            onClick={() => step(0.5)}
            aria-label="Increase weight by 0.5 kg"
            className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 active:scale-90 transition-all text-xl font-light hover:bg-slate-100"
          >
            +
          </button>
        </div>
      </div>
    </section>
  );
}
