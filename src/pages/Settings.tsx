import { useState, useEffect, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { offlineDb } from '../lib/offlineDb.ts';
import { UserSettings } from '../types.ts';
import { LocalDayData } from '../lib/storageService.ts';
import {
  Download, Upload, Shield,
  FileSpreadsheet,
  Save, Trash2, RefreshCw,
  Bell, FileText, Info, Clock, Target,
  Brain, ChevronDown, Smartphone, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../services/notificationService.ts';

import { cn } from '../lib/cn.ts';
import { haptic } from '../lib/haptic.ts';
import { Modal } from '../components/layout/Modal.tsx';
import { useToast } from '../components/layout/ToastProvider.tsx';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { ScreenTime } from '../plugins/screenTimePlugin.ts';

interface Props {
  settings: UserSettings | null;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHour(h: number): string {
  if (h === 0) return '12AM';
  if (h < 12) return `${h}AM`;
  if (h === 12) return '12PM';
  return `${h - 12}PM`;
}

function formatScreenTarget(m: number): string {
  if (m < 60) return `${m}m`;
  if (m === 60) return '1h';
  return `${m / 60}h`;
}

function ToggleGroup<T extends string | number>({
  options,
  value,
  onChange,
}: Readonly<{
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}>) {
  return (
    <div className="flex gap-1.5">
      {options.map(opt => (
        <button type="button"
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 py-2.5 rounded-xl text-xs font-bold tabular-nums border transition-all active:scale-95",
            value === opt.value
              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
              : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  collapsed,
  summary,
  onToggle,
  children,
}: Readonly<{
  icon: React.ReactNode;
  title: string;
  collapsed: boolean;
  summary: string;
  onToggle: () => void;
  children: React.ReactNode;
}>) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-[var(--brand-card)] overflow-hidden">
      <button type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="w-full flex items-center gap-4 p-5 text-left"
      >
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900">{title}</p>
          {collapsed && (
            <p className="text-xs text-slate-400 truncate mt-0.5">{summary}</p>
          )}
        </div>
        <motion.div
          animate={{ rotate: collapsed ? 0 : 180 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-slate-300"
        >
          <ChevronDown size={18} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-0 space-y-5 border-t border-slate-50">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Settings({ settings: initialSettings }: Props) {
  const showToast = useToast();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<UserSettings>(initialSettings || {
    onboarding_completed: false,
    notifications_enabled: true,
    prayer_reminder_offset: 15,
    day_boundary_hour: 3,
    retention_months: 0,
    relapse_daily_target: 2,
    screen_time_target: 60,
    firstWeekday: 6,
  });

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    json: string,
    summary: { daysCount: number, firstDate: string, lastDate: string },
    contentSummary: { totalPrayers: number, totalRelapses: number, totalTrainings: number, hasWeights: boolean }
  } | null>(null);

  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);

  const [collapsedCards, setCollapsedCards] = useState({
    timing: true,
    targets: true,
    permissions: true,
    data: true,
    score: true,
  });

  const toggleCard = (card: keyof typeof collapsedCards) => {
    setCollapsedCards(prev => ({ ...prev, [card]: !prev[card] }));
    haptic.light();
  };

  const initialisedRef = useRef(false);
  useEffect(() => {
    if (initialSettings && !initialisedRef.current) {
      setSettings(initialSettings);
      initialisedRef.current = true;
    }
  }, [initialSettings]);

  const [usageAccessGranted, setUsageAccessGranted] = useState(false);

  useEffect(() => {
    notificationService.checkPermission().then(setNotifGranted);
    ScreenTime.hasUsageAccessPermission().then(r => setUsageAccessGranted(r.granted));
  }, []);

  useEffect(() => {
    let removeListener: (() => void) | undefined;
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        ScreenTime.hasUsageAccessPermission().then(r => {
          console.log('[ScreenTime] PERM:', r);
          setUsageAccessGranted(r.granted);
        });
      }
    }).then(h => { removeListener = h.remove; }).catch(() => {});
    return () => { if (removeListener) removeListener(); };
  }, []);

  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const updateSetting = useCallback(async (key: keyof UserSettings, value: UserSettings[keyof UserSettings]) => {
    const current = settingsRef.current;
    const newSettings = { ...current, [key]: value };
    setSettings(newSettings);
    setSaveStatus('saving');
    try {
      await offlineDb.saveSettings(newSettings);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e: any) {
      console.error(e);
      setSaveStatus('idle');
    }
  }, []);

  const openNotificationSettings = async () => {
    try {
      const granted = await notificationService.requestPermission();
      setNotifGranted(granted);
      if (!granted && Capacitor.isNativePlatform()) {
        /* User denied — they can re-enable from system settings */
      }
    } catch { setNotifGranted(false); }
  };

  const exportAllData = async () => {
    setExporting(true);
    try {
      const dailyLogs = offlineDb.getAllDays();
      const data = {
        exported_at: new Date().toISOString(),
        version: '1.0',
        settings,
        daily_logs: dailyLogs,
        relapses: Object.values(dailyLogs).flatMap(day => day.relapses?.map(item => ({ ...item, dayKey: day.dateStr })) || []),
        prayers: Object.values(dailyLogs).flatMap(day => Object.values(day.prayers || {}).map(item => ({ ...item, dayKey: day.dateStr }))),
        trainings: Object.values(dailyLogs).flatMap(day => day.trainings?.map(item => ({ ...item, dayKey: day.dateStr })) || []),
        weights: Object.values(dailyLogs).filter(day => day.weight !== null && day.weight !== undefined).map(day => ({ dayKey: day.dateStr, weightKg: day.weight, recordedAt: day.updated_at })),
        screen_time: Object.values(dailyLogs).map(day => ({ dayKey: day.dateStr, totalMinutes: day.total_screen_minutes || 0 }))
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HABIT_BACKUP_${format(new Date(), 'yyyyMMdd')}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      showToast('Export failed.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const importAllData = async (file: File) => {
    if (!file) return;
    try {
      const json = await file.text();
      const parsed = JSON.parse(json);
      const validation = offlineDb.validateImport(parsed);

      if (!validation.valid) {
        showToast(`Validation Error: ${validation.error}`, 'error');
        return;
      }

      const logs = parsed.daily_logs || parsed.logs || {};
      const logValues = Object.values(logs) as LocalDayData[];
      const contentSummary = {
        totalPrayers: logValues.reduce((s, d) => s + Object.keys(d.prayers || {}).length, 0),
        totalRelapses: logValues.reduce((s, d) => s + (d.relapses?.length || 0), 0),
        totalTrainings: logValues.reduce((s, d) => s + (d.trainings?.length || 0), 0),
        hasWeights: logValues.some(d => d.weight !== null && d.weight !== undefined),
      };

      setImportPreview({
        json,
        summary: {
          daysCount: validation.daysCount,
          firstDate: validation.firstDate,
          lastDate: validation.lastDate
        },
        contentSummary
      });
    } catch {
      showToast('Invalid JSON file.', 'error');
    }
  };

  const confirmImport = async (mode: 'merge' | 'replace') => {
    if (!importPreview) return;
    setImporting(true);
    try {
      const success = await offlineDb.importData(importPreview.json, mode);
      if (success) {
        showToast('Import successful.', 'success');
        navigate('/', { replace: true });
      } else {
        showToast('Import failed after validation. Check console.', 'error');
      }
    } finally {
      setImporting(false);
      setImportPreview(null);
    }
  };

  const handleResetData = async () => {
    try {
      await offlineDb.resetAllData();
    } catch (err) {
      console.error('Reset failed:', err);
      showToast('Failed to clear data.', 'error');
      return;
    }
    setShowResetConfirm(false);
    showToast('All data has been cleared.', 'success');
    navigate('/', { replace: true });
  };

  const exportReport = () => {
    const allData = offlineDb.getAllDays();
    const dates = Object.keys(allData).sort((a, b) => a.localeCompare(b));
    const lines = dates.map(ds => {
      const d = allData[ds];
      const prayed = Object.values(d.prayers || {}).filter(p => p.status === 'prayed').length;
      const relapses = d.relapses?.length || 0;
      const trainings = d.trainings?.length || 0;
      const weight = d.weight !== null && d.weight !== undefined ? `${d.weight}kg` : '--';
      return `${ds} | Prayers: ${prayed}/5 | Relapses: ${relapses} | Training: ${trainings} | Weight: ${weight}`;
    });
    const text = `MAN READABLE REPORT\n${'='.repeat(50)}\n\nGenerated: ${new Date().toISOString()}\n${'-'.repeat(50)}\n\n${lines.join('\n')}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MAN_REPORT_${format(new Date(), 'yyyyMMdd')}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const dayBoundary = settings.day_boundary_hour ?? 3;
  const firstWeekday = settings.firstWeekday ?? 6;
  const relapseTarget = settings.relapse_daily_target ?? 2;
  const screenTarget = settings.screen_time_target ?? 60;
  const reminderOffset = settings.prayer_reminder_offset ?? 15;
  const notifEnabled = settings.notifications_enabled ?? true;

  return (
    <div className="p-grid flex flex-col gap-grid mx-auto w-full max-w-app">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter text-slate-900 leading-none">SETTINGS</h1>
          <p className="text-xs font-semibold tracking-widest text-slate-400 mt-1">Version 1.0.0 — Local</p>
        </div>
        {saveStatus !== 'idle' && (
          <span className="text-xs font-semibold tracking-widest text-emerald-500 animate-pulse">
            {saveStatus === 'saved' ? 'Saved ✓' : 'Saving...'}
          </span>
        )}
      </header>

      <SectionCard
        icon={<Clock size={18} />}
        title="Timing Logic"
        collapsed={collapsedCards.timing}
        summary={`Day boundary: ${formatHour(dayBoundary)} · First day: ${WEEKDAY_LABELS[firstWeekday]}`}
        onToggle={() => toggleCard('timing')}
      >
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">Day Boundary</p>
          <p className="text-xs text-slate-400 leading-relaxed">The hour when a new behavioral day starts (default 3AM).</p>
        </div>
        <ToggleGroup
          options={[0, 1, 2, 3, 4, 5, 6].map(h => ({ value: h, label: formatHour(h) }))}
          value={dayBoundary}
          onChange={v => updateSetting('day_boundary_hour', v)}
        />
        <div className="space-y-1 pt-3 border-t border-slate-50">
          <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">First Day of Week</p>
        </div>
        <ToggleGroup
          options={WEEKDAY_LABELS.map((label, val) => ({ value: val, label }))}
          value={firstWeekday}
          onChange={v => updateSetting('firstWeekday', v)}
        />
      </SectionCard>

      <SectionCard
        icon={<Target size={18} />}
        title="Targets"
        collapsed={collapsedCards.targets}
        summary={`Relapse: ${relapseTarget === 0 ? 'Off' : relapseTarget} · Screen time: ${formatScreenTarget(screenTarget)}`}
        onToggle={() => toggleCard('targets')}
      >
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">Relapse Target</p>
          <p className="text-xs text-slate-400 leading-relaxed">Maximum relapses per day before score drops below zero. Set to Off for no target.</p>
        </div>
        <ToggleGroup
          options={[0, 1, 2, 3, 4, 5].map(n => ({ value: n, label: n === 0 ? 'Off' : String(n) }))}
          value={relapseTarget}
          onChange={v => updateSetting('relapse_daily_target', v)}
        />
        <div className="space-y-1 pt-3 border-t border-slate-50">
          <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">Screen Time Target</p>
          <p className="text-xs text-slate-400 leading-relaxed">Daily screen time goal. +5 if under target, -1 per minute over.</p>
        </div>
        <ToggleGroup
          options={[30, 60, 90, 120, 180, 240].map(n => ({ value: n, label: formatScreenTarget(n) }))}
          value={screenTarget}
          onChange={v => updateSetting('screen_time_target', v)}
        />
      </SectionCard>

      <SectionCard
        icon={<Shield size={18} />}
        title="Permissions"
        collapsed={collapsedCards.permissions}
        summary={`Notifications: ${notifGranted ? 'Active' : 'Inactive'} · Usage Access: ${usageAccessGranted ? 'Active' : 'Off'}`}
        onToggle={() => toggleCard('permissions')}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 flex items-center justify-center text-sky-600 shrink-0">
              <Bell size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">Notifications</p>
                  <p className="text-[10px] text-slate-500">Prayer reminders</p>
                </div>
                {notifGranted === null ? (
                  <RefreshCw size={14} className="animate-spin text-slate-300 shrink-0" />
                ) : notifGranted ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold shrink-0">
                    <Check size={10} /> Active
                  </span>
                ) : (
                  <button type="button" onClick={openNotificationSettings}
                    className="px-4 py-1.5 rounded-xl bg-sky-600 text-white text-[9px] font-bold active:scale-95 transition-all shrink-0"
                  >
                    Enable
                  </button>
                )}
              </div>
              {notifGranted === false && (
                <p className="text-[10px] text-sky-600 font-medium mt-1.5 leading-relaxed">
                  Notifications are disabled. Tap Enable to grant permission.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-1">
          <p className="section-header">Reminder Offset</p>
        </div>
        <ToggleGroup
          options={[5, 10, 15, 30].map(m => ({ value: m, label: `${m}m` }))}
          value={reminderOffset}
          onChange={v => updateSetting('prayer_reminder_offset', v)}
        />

        <div className="border-t border-slate-100 pt-5 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center text-violet-600 shrink-0">
              <Smartphone size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">Usage Access</p>
                  <p className="text-[10px] text-slate-500">Screen time tracking</p>
                </div>
                {usageAccessGranted ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold shrink-0">
                    <Check size={10} /> Active
                  </span>
                ) : (
                  <button type="button" onClick={async () => { await ScreenTime.requestUsageAccessPermission(); }}
                    className="px-4 py-1.5 rounded-xl bg-violet-600 text-white text-[9px] font-bold active:scale-95 transition-all shrink-0"
                  >
                    Enable
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                {usageAccessGranted
                  ? 'Tracking screen time across all apps. Data refreshes when the app opens.'
                  : 'Required to measure total screen time. Opens Android settings to grant access.'}
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={<Brain size={18} />}
        title="Scoring System"
        collapsed={collapsedCards.score}
        summary="Prayer (max 50) + Relapse (max 30) + Training (max 15) + Screen Time (max 5) = 100 max"
        onToggle={() => toggleCard('score')}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Prayer</p>
              <span className="text-xs font-black text-slate-900">50</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              <span className="text-[9px] text-emerald-600 font-semibold">F+S +10</span>
              <span className="text-[9px] text-emerald-500 font-semibold">Fard +9</span>
              <span className="text-[9px] text-amber-500 font-semibold">Late +5</span>
              <span className="text-[9px] text-emerald-400 font-semibold">Qada +3</span>
              <span className="text-[9px] text-red-400 font-semibold">Missed -10</span>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Relapse</p>
              <span className="text-xs font-black text-slate-900">30</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-orange-400 rounded-full" style={{ width: '60%' }} />
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              <span className="text-[9px] text-emerald-600 font-semibold">Zero +30</span>
              <span className="text-[9px] text-blue-500 font-semibold">Scaled</span>
              <span className="text-[9px] text-red-400 font-semibold">Over -10</span>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Training</p>
              <span className="text-xs font-black text-slate-900">15</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-violet-400 rounded-full" style={{ width: '30%' }} />
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              <span className="text-[9px] text-emerald-600 font-semibold">Gym +5</span>
              <span className="text-[9px] text-emerald-600 font-semibold">Cardio +5</span>
              <span className="text-[9px] text-emerald-600 font-semibold">Fight +5</span>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Screen Time</p>
              <span className="text-xs font-black text-slate-900">5</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-400 rounded-full" style={{ width: '10%' }} />
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              <span className="text-[9px] text-emerald-600 font-semibold">Under +5</span>
              <span className="text-[9px] text-red-400 font-semibold">Over -1/min</span>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Score Range</p>
          <div className="flex items-center h-5 rounded-full overflow-hidden text-[8px] font-bold">
            <div className="flex-1 h-full flex items-center justify-center bg-emerald-600 text-white">80+</div>
            <div className="flex-1 h-full flex items-center justify-center bg-emerald-400 text-white">50+</div>
            <div className="flex-1 h-full flex items-center justify-center bg-amber-400 text-white">20+</div>
            <div className="flex-1 h-full flex items-center justify-center bg-red-400 text-white">0+</div>
            <div className="flex-[0.6] h-full flex items-center justify-center bg-slate-300 text-white">Below</div>
          </div>
          <div className="flex justify-between text-[9px] font-semibold">
            <span className="text-emerald-700">Excellent</span>
            <span className="text-emerald-600">Good</span>
            <span className="text-amber-600">Average</span>
            <span className="text-red-500">Poor</span>
            <span className="text-slate-400">Critical</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={<Download size={18} />}
        title="Data"
        collapsed={collapsedCards.data}
        summary="Export, import, or reset your data"
        onToggle={() => toggleCard('data')}
      >
        <div className="bg-emerald-50/50 rounded-xl p-4 flex items-start gap-3">
          <Shield size={16} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-widest">100% Local & Encrypted</p>
            <p className="text-xs text-emerald-700 leading-relaxed mt-1">
              All data stays on this device. No cloud, no servers, no tracking.
              Export regularly as a backup — your data is irreplaceable.
            </p>
          </div>
        </div>
        <div className="divide-y divide-slate-50 border border-slate-100 rounded-xl overflow-hidden">
          <button type="button" onClick={exportAllData} disabled={exporting} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors active:bg-slate-100">
            <span className="text-xs font-bold text-slate-900 uppercase">Export All Data</span>
            <Download size={16} className="text-slate-300" />
          </button>
          <ImportDropZone onImport={importAllData} />
          <button type="button" onClick={exportReport} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors active:bg-slate-100">
            <span className="text-xs font-bold text-slate-900 uppercase">Export Readable Report</span>
            <FileSpreadsheet size={16} className="text-slate-300" />
          </button>
          <button type="button" onClick={() => setShowResetConfirm(true)} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors active:bg-slate-100">
            <span className="text-xs font-bold text-red-500 uppercase">Reset All Data</span>
            <Trash2 size={16} className="text-red-300" />
          </button>
        </div>
      </SectionCard>

      <section className="rounded-2xl border border-slate-100 bg-[var(--brand-card)] overflow-hidden">
        <div className="p-5 space-y-2">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-400">ABOUT</p>
          <p className="text-sm font-bold text-slate-900">Version 1.0.0</p>
          <p className="text-xs text-slate-400">Built by Abdel-Rahman to build A Man</p>
        </div>
      </section>

      <Modal show={showResetConfirm} onClose={() => setShowResetConfirm(false)}>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center mx-auto text-red-500"><Trash2 size={32} /></div>
          <h3 className="text-xl font-bold text-slate-900 uppercase">Clear All Data?</h3>
          <p className="text-xs text-slate-400 font-medium italic">This action is irreversible. All behavioral logs, prayers, and trainings will be permanently deleted.</p>
        </div>
        <div className="flex flex-col gap-3">
          <button type="button" onClick={handleResetData} className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold text-xs uppercase shadow-lg shadow-red-500/20 active:scale-95 transition-all">Clear Data</button>
          <button type="button" onClick={() => setShowResetConfirm(false)} className="w-full py-4 bg-slate-100 text-slate-900 rounded-2xl font-bold text-xs uppercase active:scale-95 transition-all">Cancel</button>
        </div>
      </Modal>

      {importPreview && (
        <Modal show onClose={() => setImportPreview(null)}>
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto text-emerald-500"><FileSpreadsheet size={32} /></div>
            <h3 className="text-xl font-bold text-slate-900 uppercase italic">Archive Found</h3>
            <div className="space-y-2 py-4 border-y border-slate-50">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-400 uppercase italic">Timeline span</span>
                <span className="text-xs font-bold text-slate-900 tabular-nums">{importPreview.summary.daysCount} Days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-400 uppercase italic">From</span>
                <span className="text-xs font-bold text-slate-900 tabular-nums">{importPreview.summary.firstDate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-400 uppercase italic">Until</span>
                <span className="text-xs font-bold text-slate-900 tabular-nums">{importPreview.summary.lastDate}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Content Preview</p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-50 rounded-xl p-2.5">
                  <p className="text-sm font-bold text-slate-900">{importPreview.contentSummary.totalPrayers}</p>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Prayers</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-2.5">
                  <p className="text-sm font-bold text-slate-900">{importPreview.contentSummary.totalRelapses}</p>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Relapses</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-2.5">
                  <p className="text-sm font-bold text-slate-900">{importPreview.contentSummary.totalTrainings}</p>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Trainings</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-2.5">
                  <p className="text-sm font-bold text-slate-900">{importPreview.contentSummary.hasWeights ? 'Yes' : 'No'}</p>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Weight</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 font-bold leading-relaxed">Choose whether to merge these days with your current archive or replace the current archive completely.</p>
          </div>
          <div className="flex flex-col gap-3">
            <button type="button" onClick={() => confirmImport('merge')} disabled={importing}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-xs shadow-lg shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-2">
              {importing ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              Merge With Existing
            </button>
            <button type="button" onClick={() => confirmImport('replace')} disabled={importing}
              className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
              Replace All Data
            </button>
            <button type="button" onClick={() => setImportPreview(null)} className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl font-bold text-xs uppercase active:scale-95 transition-all">Cancel</button>
          </div>
        </Modal>
      )}

    </div>
  );
}

function ImportDropZone({ onImport }: Readonly<{ onImport: (file: File) => void }>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.name.endsWith('.json')) {
      onImport(file);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImport(file);
    e.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Import data from JSON file"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      onKeyDown={handleKeyDown}
      className={cn(
        'w-full flex flex-col items-center justify-center gap-2 p-4 transition-all cursor-pointer',
        dragging ? 'bg-emerald-50' : 'hover:bg-slate-50 active:bg-slate-100'
      )}
    >
      <input ref={inputRef} type="file" onChange={handleChange} accept=".json" className="hidden" />
      <motion.div
        animate={dragging ? { scale: 1.1 } : {}}
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
          dragging ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-300'
        )}
      >
        <Upload size={18} />
      </motion.div>
      <div className="text-center">
        <p className="text-xs font-bold text-slate-900 uppercase">
          {dragging ? 'Drop file to import' : 'Import Data'}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {dragging ? 'Release to load backup' : 'Drop .json file or tap to browse'}
        </p>
      </div>
    </div>
  );
}
