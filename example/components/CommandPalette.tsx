import { motion } from 'motion/react';
import { Search, Mail, Edit3, Settings } from 'lucide-react';
import { useEffect, useRef } from 'react';

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-xl bg-bg-surface border border-border-subtle rounded-xl shadow-2xl overflow-hidden relative z-10 glass-panel tech-glow"
      >
        <div className="flex items-center px-4 py-3 border-b border-border-subtle">
          <Search size={18} className="text-text-secondary mr-3" />
          <input 
            ref={inputRef}
            type="text" 
            placeholder="Type a command or search..." 
            className="flex-1 bg-transparent border-none outline-none text-text-primary font-body placeholder:text-text-secondary/50"
          />
          <div className="text-xs font-mono text-text-secondary bg-bg-base px-2 py-1 rounded">ESC</div>
        </div>
        
        <div className="p-2">
          <div className="text-xs font-mono text-text-secondary px-3 py-2 uppercase tracking-widest">Actions</div>
          <PaletteItem icon={<Edit3 size={16} />} label="Compose new email" shortcut="c" />
          <PaletteItem icon={<Mail size={16} />} label="Mark all as read" shortcut="Shift+I" />
          <PaletteItem icon={<Settings size={16} />} label="Settings" shortcut="," />
        </div>
      </motion.div>
    </div>
  );
}

function PaletteItem({ icon, label, shortcut }: { icon: React.ReactNode, label: string, shortcut: string }) {
  return (
    <button className="w-full flex items-center justify-between px-3 py-3 rounded-[var(--radius-base)] hover:bg-bg-surface-hover hover:text-text-primary text-text-secondary transition-colors group">
      <div className="flex items-center gap-3">
        <div className="text-text-secondary group-hover:text-accent transition-colors">{icon}</div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-xs font-mono bg-bg-base px-2 py-1 rounded text-text-secondary group-hover:text-text-primary transition-colors">{shortcut}</span>
    </button>
  );
}
