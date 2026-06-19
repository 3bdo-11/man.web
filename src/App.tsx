import { useState, useEffect, lazy, Suspense, useRef, useCallback, useContext } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { offlineDb } from './lib/offlineDb.ts';
import { motion } from 'motion/react';
import {
  Home, BarChart2, Settings as SettingsIcon, Loader2,
  Heart
} from 'lucide-react';
import { PageSkeleton } from './components/ui/Skeleton.tsx';
import { UserSettings } from './types.ts';
import { EVENTS, STORAGE_KEYS } from './lib/constants.ts';
import { haptic } from './lib/haptic.ts';
import { cn } from './lib/cn.ts';
import { ToastContext, ToastProvider } from './components/layout/ToastProvider.tsx';
import { ErrorBoundary } from './components/layout/ErrorBoundary.tsx';
import { NavBtn } from './components/layout/NavBtn.tsx';
import { useNotifications } from './hooks/useNotifications.ts';
import { usePersistentScreenTime } from './hooks/usePersistentScreenTime.ts';

const DailyTracking = lazy(() => import('./pages/DailyTracking.tsx'));
const Analytics     = lazy(() => import('./pages/Analytics.tsx'));
const Settings      = lazy(() => import('./pages/Settings.tsx'));

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useContext(ToastContext);

  const [loading, setLoading]         = useState(true);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useNotifications(userSettings);
  usePersistentScreenTime();

  const pageTabs = [
    { path: '/',       label: 'DAILY',     icon: <Home size={20} /> },
    { path: '/analytics', label: 'ANALYTICS', icon: <BarChart2 size={20} /> },
    { path: '/settings',  label: 'SETTINGS',  icon: <SettingsIcon size={20} /> },
  ];

  const isActivePage = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  /* ── Initialization ── */
  useEffect(() => {
    let cancelled = false;

    const runIntegrityCheck = async () => {
      const report = await offlineDb.integrityCheck();
      if (report.warnings.length > 0) {
        report.warnings.forEach(w => console.warn('[Data Integrity]', w));
        const gapMsg = report.gaps.length > 0 ? `, ${report.gaps.length} gap(s)` : '';
        showToast(`Data: ${report.totalDays}/${report.expectedDays} days${gapMsg}`, 'error');
      } else if (report.totalDays > 0) {
        console.log(`[Data Integrity] ${report.totalDays}/${report.expectedDays} days (${report.pctComplete}%) — OK`);
      }
      if (report.totalDays === 0) {
        const backup = localStorage.getItem(STORAGE_KEYS.RECOVERY_BACKUP);
        const backupTime = localStorage.getItem(STORAGE_KEYS.RECOVERY_BACKUP_AT);
        if (backup && backupTime) {
          console.warn(`[Recovery] IndexedDB is empty but localStorage backup exists from ${backupTime}`);
          showToast('Local backup found. Use Settings > Import to restore.', 'error');
        }
      }
    };

    const runRecoveryBackup = () => {
      try {
        localStorage.setItem(STORAGE_KEYS.RECOVERY_BACKUP, offlineDb.exportData());
        localStorage.setItem(STORAGE_KEYS.RECOVERY_BACKUP_AT, new Date().toISOString());
      } catch { console.warn('[App] localStorage full — skipping backup'); }
    };

    const initApp = async () => {
      try {
        await offlineDb.init();
        if (cancelled) return;

        try { await runIntegrityCheck(); }
        catch { console.warn('[App] Integrity check failed'); }

        runRecoveryBackup();

        const settings = await offlineDb.getSettings();
        if (settings) setUserSettings(settings);
      } catch {
        if (!cancelled) showToast('Storage initialization failed', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    initApp();

    const handleStorageError = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      showToast(detail?.message || 'Storage Quota Exceeded', 'error');
    };
    const handleWriteStart = () => setSaveState('saving');
    const handleWriteEnd = () => {
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    };
    globalThis.addEventListener(EVENTS.STORAGE_ERROR, handleStorageError);
    globalThis.addEventListener(EVENTS.WRITE_START, handleWriteStart);
    globalThis.addEventListener(EVENTS.WRITE_END, handleWriteEnd);
    return () => {
      cancelled = true;
      globalThis.removeEventListener(EVENTS.STORAGE_ERROR, handleStorageError);
      globalThis.removeEventListener(EVENTS.WRITE_START, handleWriteStart);
      globalThis.removeEventListener(EVENTS.WRITE_END, handleWriteEnd);
    };
  }, []);

  /* ── Settings subscription ── */
  useEffect(() => {
    return offlineDb.subscribeToSettings((data) => {
      if (data) {
        setUserSettings(data);
      }
    });
  }, []);

  /* ── Periodic crash recovery backup ── */
  const recoveryBackupRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doRecoveryBackup = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.RECOVERY_BACKUP, offlineDb.exportData());
      localStorage.setItem(STORAGE_KEYS.RECOVERY_BACKUP_AT, new Date().toISOString());
    } catch { console.warn('[App] localStorage full — skipping periodic backup'); }
  }, []);

  useEffect(() => {
    doRecoveryBackup();
    const interval = setInterval(doRecoveryBackup, 300000);
    const handleDataChange = () => {
      if (recoveryBackupRef.current) clearTimeout(recoveryBackupRef.current);
      recoveryBackupRef.current = setTimeout(doRecoveryBackup, 5000);
    };
    globalThis.addEventListener('man_data_updated', handleDataChange);
    return () => {
      clearInterval(interval);
      globalThis.removeEventListener('man_data_updated', handleDataChange);
      if (recoveryBackupRef.current) clearTimeout(recoveryBackupRef.current);
    };
  }, [doRecoveryBackup]);

  /* ── Loading screen ── */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-[var(--brand-bg)]">
        <div className="w-16 h-16 bg-white rounded-[20px] flex items-center justify-center shadow-xl border border-slate-100">
          <span className="text-3xl font-black tracking-tighter text-slate-900">M.</span>
        </div>
        <Loader2 className="animate-spin text-slate-300" size={20} />
        <p className="text-[10px] font-semibold tracking-widest text-slate-300 uppercase">Initializing</p>
      </div>
    );
  }

  /* ── Onboarding ── */
  if (userSettings && !userSettings.onboarding_completed) {
    return (
      <Onboarding
        settings={userSettings}
        onFinish={(updates = {}) => {
          offlineDb.saveSettings({ ...userSettings, ...updates, onboarding_completed: true });
        }}
        showToast={showToast}
      />
    );
  }

  let saveDotAnim = {};
  let saveDotColor = 'bg-emerald-400';
  let saveLabel = 'Local Engine';
  let saveLabelColor = 'var(--brand-muted, #64748b)';
  if (saveState === 'saving') {
    saveDotAnim = { scale: [1, 1.3, 1] };
    saveDotColor = 'bg-amber-400';
    saveLabel = 'Saving...';
    saveLabelColor = '#d97706';
  } else if (saveState === 'saved') {
    saveDotAnim = { scale: [1, 1.2, 1] };
    saveDotColor = 'bg-emerald-500';
    saveLabel = 'Saved';
  }

  return (
    <div className="flex flex-col min-h-screen font-sans bg-[var(--brand-bg)] text-[var(--brand-text)]">
        {/* App Header */}
        <header className="px-4 pt-5 pb-2 flex items-center justify-between">
          <h1
            className="text-2xl font-black tracking-tighter select-none text-[var(--brand-text)]"
          >MAN.</h1>
          <div className="bg-white px-3 py-1.5 rounded-full border shadow-sm flex items-center gap-2"
               style={{ borderColor: 'var(--brand-border)' }}>
            <motion.div
              animate={saveDotAnim}
              transition={{ duration: 0.3 }}
              className={cn('w-2 h-2 rounded-full', saveDotColor)}
            />
            <motion.span
              key={saveState}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[9px] font-semibold tracking-widest italic"
              style={{ color: saveLabelColor }}
            >
              {saveLabel}
            </motion.span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 pb-24 overflow-y-auto scrollbar-hide">
          <ErrorBoundary>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={
                  <motion.div key={location.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                    <ErrorBoundary>
                      <DailyTracking settings={userSettings} />
                    </ErrorBoundary>
                  </motion.div>
                } />
                <Route path="/analytics" element={
                  <motion.div key={location.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                    <ErrorBoundary>
                      <Analytics settings={userSettings} />
                    </ErrorBoundary>
                  </motion.div>
                } />
                <Route path="/settings" element={
                  <motion.div key={location.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                    <ErrorBoundary>
                      <Settings settings={userSettings} />
                    </ErrorBoundary>
                  </motion.div>
                } />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 glass-nav border-t h-20 flex items-center justify-around px-4 z-[var(--z-dropdown)] safe-bottom"
             style={{ borderColor: 'var(--brand-border)' }}>
          {pageTabs.map(tab => (
            <NavBtn
              key={tab.path}
              active={isActivePage(tab.path)}
              onClick={() => { haptic.light(); navigate(tab.path); }}
              icon={tab.icon}
              label={tab.label}
            />
          ))}
        </nav>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </BrowserRouter>
  );
}

/* ── Onboarding Flow ── */
function Onboarding({
  settings,
  onFinish,
  showToast,
}: Readonly<{
  settings: UserSettings;
  onFinish: (updates?: Partial<UserSettings>) => void;
  showToast: (msg: string, type?: 'error' | 'success') => void;
}>) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6"
         style={{ backgroundColor: 'var(--brand-bg)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md bg-white rounded-[3rem] p-10 shadow-2xl shadow-slate-200/50 border border-slate-100 space-y-10"
      >
        <div className="space-y-6">
          <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center border border-slate-100 shadow-inner">
            <Heart size={32} className="text-sky-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Welcome.</h1>
            <p className="text-sm font-medium leading-relaxed text-slate-400">
              This app is built by Abdel-Rahman. Totally offline and free.
            </p>
          </div>
        </div>

        <button type="button"
          onClick={() => { onFinish(); haptic.success(); }}
          className="w-full py-5 rounded-[2rem] bg-slate-900 text-white text-xs font-bold uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all"
        >
          Go to Home
        </button>
      </motion.div>
    </div>
  );
}
