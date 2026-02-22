import { motion } from 'motion/react';
import { transitions } from '@/lib/motion';
import { Sparkles, ArrowRight } from 'lucide-react';

export function AIPanel() {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={transitions.pageEntry}
      className="w-80 h-full border-l border-border-subtle bg-bg-surface glass-panel flex flex-col shrink-0 z-20"
    >
      <div className="h-16 border-b border-border-subtle flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2 text-accent">
          <Sparkles size={18} />
          <span className="font-heading font-medium tracking-wide">Claw Agent</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="bg-bg-base border border-border-subtle p-4 rounded-[var(--radius-base)] dashed-border">
          <div className="text-xs font-mono text-text-secondary mb-2 uppercase tracking-widest">Suggested Action</div>
          <div className="text-sm text-text-primary mb-3">Draft a polite decline to the Board of Directors regarding the Q2 schedule.</div>
          <button className="text-xs font-mono text-accent flex items-center gap-1 hover:underline">
            Generate Draft <ArrowRight size={12} />
          </button>
        </div>

        <div className="bg-bg-base border border-border-subtle p-4 rounded-[var(--radius-base)] dashed-border">
          <div className="text-xs font-mono text-text-secondary mb-2 uppercase tracking-widest">Summary</div>
          <div className="text-sm text-text-primary leading-relaxed">
            Elon needs a review of the life support schematics by Friday. Sarah wants to meet in the bunker at 14:00 today.
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-border-subtle">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Ask AI to search, draft, or summarize..." 
            className="w-full bg-bg-base border border-border-subtle rounded-[var(--radius-base)] py-2 pl-3 pr-10 text-sm text-text-primary placeholder:text-text-secondary/50 outline-none focus:border-accent transition-colors"
          />
          <button className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-accent">
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
