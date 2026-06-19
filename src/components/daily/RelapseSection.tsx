import React, { useState, useRef, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { Trash2, Star, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { offlineDb } from '../../lib/offlineDb.ts';
import { RelapseEvent, UserSettings } from '../../types.ts';
import { safeParseDate } from '../../lib/dateUtils.ts';
import { cn } from '../../lib/cn.ts';
import { haptic } from '../../lib/haptic.ts';

interface Props {
  relapses: RelapseEvent[];
  dateStr: string;
  viewDate: Date;
  settings: UserSettings | null;
}

export default function RelapseSection({ relapses, dateStr, viewDate, settings }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tapped, setTapped] = useState(false);
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
  }, []);

  const sortedRelapses = useMemo(() =>
    [...relapses].sort((a, b) =>
      safeParseDate(b.timestamp).getTime() - safeParseDate(a.timestamp).getTime()
    ),
    [relapses]
  );

  const logRelapse = () => {
    haptic.relapse();
    setTapped(true);
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => setTapped(false), 300);
    const now = new Date();
    const ts = new Date(viewDate);
    ts.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    offlineDb.addRelapse(dateStr, {
      timestamp: ts.toISOString(),
    });
  };

  const openEdit = (relapse: RelapseEvent) => {
    if (editingId === relapse.id) { setEditingId(null); return; }
    setEditingId(relapse.id!);
    setEditTime(format(safeParseDate(relapse.timestamp), 'HH:mm'));
  };

  const saveEdit = (id: string) => {
    const [h, m] = editTime.split(':').map(Number);
    const d = new Date(viewDate);
    d.setHours(h, m, 0, 0);
    offlineDb.updateRelapse(dateStr, id, {
      timestamp: d.toISOString(),
      edited_at: new Date().toISOString(),
    });
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (deletingId === id) {
      offlineDb.deleteRelapse(dateStr, id);
      setDeletingId(null);
      return;
    }
    setDeletingId(id);
    if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
    deleteTimeoutRef.current = setTimeout(() => setDeletingId(null), 2500);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="section-header">Relapse Log</h2>
        <div className="flex items-center gap-2">
          {settings?.relapse_daily_target ? (
            <span className="text-[10px] font-semibold text-slate-400 tabular-nums uppercase tracking-widest flex items-center gap-1">
              <Target size={11} />
              {relapses.length}/{settings.relapse_daily_target}
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-slate-400 tabular-nums uppercase tracking-widest">
              {relapses.length === 0 ? 'CLEAN ✓' : `TODAY: ${relapses.length}`}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-xl shadow-slate-900/20 space-y-5 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none"
             style={{ background: 'radial-gradient(circle at 50% 0%, #4A90E2 0%, transparent 70%)' }} />

        <div className="flex flex-col items-center gap-4 py-3 relative z-10">
          <motion.button
            onClick={logRelapse}
            whileTap={{ scale: 0.85 }}
            animate={tapped ? { scale: [1, 0.85, 1] } : {}}
            transition={{ duration: 0.15 }}
            className="w-[88px] h-[88px] rounded-full bg-white/10 border border-white/10 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white/30"
            aria-label="Log relapse"
          >
            <span className={cn("text-2xl font-black tabular-nums", !settings?.relapse_daily_target ? 'text-white' : relapses.length > settings.relapse_daily_target ? 'text-red-400' : relapses.length === settings.relapse_daily_target ? 'text-slate-500' : 'text-emerald-400')}>{relapses.length}</span>
          </motion.button>
          <div className="text-center">
            <h3 className="text-base font-bold tracking-[0.1em] uppercase">LOG RELAPSE</h3>
          </div>
        </div>

        {relapses.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 py-2 border-t border-white/5"
          >
            <Star size={13} className="text-amber-300" />
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Clean day</p>
            <Star size={13} className="text-amber-300" />
          </motion.div>
        )}

        {relapses.length > 0 && (
          <div className="space-y-2 pt-4 border-t border-white/5">
            <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest mb-3">Today's Log</p>
            {sortedRelapses.map(relapse => (
                <div key={relapse.id} className="space-y-2">
                <div
                  onClick={() => openEdit(relapse)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(relapse); } }}
                  className="w-full flex items-center justify-between text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[12px] font-mono text-slate-500 shrink-0">
                      {format(safeParseDate(relapse.timestamp), 'hh:mm a').toUpperCase()}
                    </span>
                    <span className="text-sm font-bold text-slate-200 uppercase tracking-tight truncate">
                      Relapse
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(relapse.id!); }}
                      aria-label={deletingId === relapse.id ? 'Confirm delete' : 'Delete relapse'}
                      className={cn(
                        'p-2 rounded-xl transition-all text-xs font-semibold min-w-[36px]',
                        deletingId === relapse.id
                          ? 'bg-red-500 text-white px-3'
                          : 'text-slate-500 hover:text-red-400'
                      )}
                    >
                      {deletingId === relapse.id ? 'Confirm' : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {editingId === relapse.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-slate-50 rounded-2xl p-4 space-y-3 text-slate-900">
                        <label className="block space-y-1">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Time</span>
                          <input
                            type="time"
                            value={editTime}
                            onChange={e => setEditTime(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none text-slate-900"
                          />
                        </label>

                        <div className="flex gap-2 pt-1">
                          <button type="button"
                            onClick={() => saveEdit(relapse.id!)}
                            className="flex-1 bg-slate-900 text-white rounded-xl py-3 text-[10px] font-bold uppercase active:scale-95 transition-all"
                          >
                            Save Changes
                          </button>
                          <button type="button"
                            onClick={() => setEditingId(null)}
                            className="px-4 text-slate-400 text-[10px] font-semibold uppercase"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
