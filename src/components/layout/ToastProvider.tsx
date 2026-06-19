import React, { useState, useCallback, createContext, useContext, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn.ts';

export const ToastContext = createContext<(msg: string, type?: 'error' | 'success') => void>(undefined as unknown as (msg: string, type?: 'error' | 'success') => void);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (ctx === undefined) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ msg, type });
    timerRef.current = setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <AnimatePresence>
        {toast && (
          <motion.div
            role="alert"
            aria-live="polite"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              'fixed top-8 left-4 right-4 max-w-md mx-auto z-[var(--z-toast)] p-4 rounded-2xl shadow-2xl flex items-center gap-3',
              toast.type === 'error'
                ? 'bg-slate-900 text-white'
                : 'bg-emerald-600 text-white'
            )}
          >
            <p className="text-xs font-bold flex-1">{toast.msg}</p>
            <button type="button" onClick={() => { setToast(null); if (timerRef.current) clearTimeout(timerRef.current); }} aria-label="Dismiss">
              <X size={14} className="opacity-60" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}
