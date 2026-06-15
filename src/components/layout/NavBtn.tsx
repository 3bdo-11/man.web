import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/cn.ts';

export function NavBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; key?: string }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      whileTap={{ scale: 0.9 }}
      transition={{ duration: 0.12 }}
      className={cn(
        'flex flex-col items-center justify-center w-24 h-full gap-1 select-none touch-manipulation',
        active ? 'text-slate-900' : 'text-slate-400'
      )}
    >
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={cn('p-2 rounded-xl', active ? 'bg-slate-100' : '')}
      >
        {icon}
      </motion.div>
      <span className={cn('text-[10px] font-semibold tracking-widest', active ? 'opacity-100' : 'opacity-60')}>
        {label}
      </span>
    </motion.button>
  );
}
