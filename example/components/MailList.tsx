import { motion } from 'motion/react';
import { transitions } from '@/lib/motion';

export function MailList({ emails, selectedIndex, onSelect }: { emails: any[], selectedIndex: number, onSelect: (id: string) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={transitions.pageEntry}
      className="flex-1 h-full flex flex-col bg-bg-base"
    >
      <div className="h-16 border-b border-border-subtle flex items-center px-8 shrink-0 glass-panel">
        <h1 className="font-heading text-2xl tracking-tight">Inbox</h1>
        <div className="ml-auto flex items-center gap-4 text-xs text-text-secondary font-mono uppercase tracking-widest">
          <span>{emails.length} Messages</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {emails.map((email, i) => (
          <motion.div
            key={email.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, ...transitions.pageEntry }}
            onClick={() => onSelect(email.id)}
            className={`group relative p-4 rounded-[var(--radius-base)] cursor-pointer transition-all border dashed-border ${
              i === selectedIndex 
                ? 'bg-bg-surface border-border-subtle tech-glow' 
                : 'border-transparent hover:bg-bg-surface-hover'
            }`}
          >
            {i === selectedIndex && (
              <motion.div 
                layoutId="list-selection"
                className="absolute inset-0 border border-accent rounded-[var(--radius-base)] pointer-events-none"
                initial={false}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            
            <div className="flex justify-between items-baseline mb-1">
              <span className={`font-medium ${email.unread ? 'text-text-primary' : 'text-text-secondary'}`}>
                {email.sender}
              </span>
              <span className="text-xs font-mono text-text-secondary">{email.date}</span>
            </div>
            <div className={`text-sm mb-2 ${email.unread ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
              {email.subject}
            </div>
            <div className="text-sm text-text-secondary line-clamp-1 opacity-70">
              {email.preview}
            </div>
            
            {email.tags && (
              <div className="flex gap-2 mt-3">
                {email.tags.map((tag: string) => (
                  <span key={tag} className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full border border-border-subtle text-text-secondary">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
