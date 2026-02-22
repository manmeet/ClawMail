import { motion, AnimatePresence } from 'motion/react';
import { Palette } from 'lucide-react';
import { useState } from 'react';

export function ThemeSwitcher({ currentTheme, onSelect }: { currentTheme: string, onSelect: (theme: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const themes = [
    { id: 'prestige', name: 'Prestige', desc: 'Dark Luxury' },
    { id: 'technical', name: 'Technical', desc: 'Data Grid' },
    { id: 'atmospheric', name: 'Atmospheric', desc: 'Immersive Media' },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <motion.div 
        initial={false}
        animate={isOpen ? "open" : "closed"}
        className="relative"
      >
        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="absolute bottom-full right-0 mb-4 w-48 bg-bg-surface border border-border-subtle rounded-[var(--radius-base)] shadow-2xl overflow-hidden glass-panel"
            >
              <div className="text-xs font-mono text-text-secondary px-4 py-2 border-b border-border-subtle uppercase tracking-widest">
                Visual System
              </div>
              <div className="p-1">
                {themes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { onSelect(t.id); setIsOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-[var(--radius-base)] text-sm flex flex-col transition-colors ${
                      currentTheme === t.id ? 'bg-bg-surface-hover text-accent' : 'text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary'
                    }`}
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="text-[10px] font-mono opacity-70">{t.desc}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-12 h-12 rounded-full bg-bg-surface border border-border-subtle shadow-xl flex items-center justify-center text-text-secondary hover:text-accent hover:border-accent transition-colors glass-panel"
        >
          <Palette size={20} />
        </button>
      </motion.div>
    </div>
  );
}
