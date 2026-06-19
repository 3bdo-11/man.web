import React, { useState, useRef, useEffect } from 'react';
import { Check, Dumbbell, Footprints, Swords, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { offlineDb } from '../../lib/offlineDb.ts';
import { TrainingLog, TrainingType } from '../../types.ts';
import { cn } from '../../lib/cn.ts';
import { haptic } from '../../lib/haptic.ts';
import { format } from 'date-fns';

interface Props {
  trainings: TrainingLog[];
  dateStr: string;
}

const TRAINING_TYPES: TrainingType[] = ['gym', 'fighting', 'cardio'];

interface TrainingFormConfig {
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

const trainingConfig: Record<TrainingType, TrainingFormConfig> = {
  gym: { label: 'Gym', icon: Dumbbell },
  fighting: { label: 'Fighting', icon: Swords },
  cardio: { label: 'Cardio', icon: Footprints },
};

export default function TrainingSection({ trainings, dateStr }: Props) {
  const [confirmDelete, setConfirmDelete] = useState<TrainingType | null>(null);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
  }, []);

  const addTraining = (type: TrainingType) => {
    haptic.training();
    const now = new Date();
    const ts = new Date(format(now, "yyyy-MM-dd'T'HH:mm:ss"));
    offlineDb.addTraining(dateStr, {
      type,
      timestamp: ts.toISOString(),
      note: '',
    });
  };

  const handleDelete = (type: TrainingType) => {
    if (confirmDelete === type) {
      const existing = trainings.find((t) => t.type === type);
      if (existing?.id) {
        haptic.training();
        offlineDb.deleteTraining(dateStr, existing.id);
      }
      setConfirmDelete(null);
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    } else {
      setConfirmDelete(type);
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = setTimeout(() => setConfirmDelete(null), 2500);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="section-header">Training</h2>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {TRAINING_TYPES.map((type) => {
          const log = trainings.find((t) => t.type === type);
          const config = trainingConfig[type];
          const Icon = config.icon;

          return (
            <div key={type} className="relative">
              {confirmDelete === type && (
                <button type="button"
                  onClick={() => handleDelete(type)}
                  className="absolute inset-0 z-10 w-full aspect-square rounded-2xl bg-red-500 text-white flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95 transition-all"
                >
                  <Trash2 size={20} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Confirm?</span>
                </button>
              )}
              <button type="button"
                onClick={() => log ? handleDelete(type) : addTraining(type)}
                aria-pressed={!!log}
                aria-label={`${config.label} training: ${log ? 'trained' : 'not done'}`}
                className={cn(
                  'w-full aspect-square rounded-2xl border transition-all flex flex-col items-center justify-center gap-2 active:scale-95 group relative shadow-sm overflow-hidden',
                  log ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-white border-slate-100 text-slate-400'
                )}
              >
                <motion.span animate={log ? { scale: [1, 1.12, 1] } : {}} className="flex items-center justify-center">
                  <Icon size={24} />
                </motion.span>
                <span className="text-[10px] font-semibold tracking-tight uppercase">{config.label}</span>
                <span className={cn('text-[9px] font-semibold rounded-full px-2 py-0.5', log ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400')}>
                  {log ? 'TRAINED' : 'NOT DONE'}
                </span>
                {log && <Check size={12} className="absolute top-3 right-3 text-emerald-500" />}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
