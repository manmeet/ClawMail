import { motion } from 'motion/react';
import { transitions } from '@/lib/motion';
import { X, Send, Paperclip, Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';

export function ReplyDock({ onClose, email }: { onClose: () => void, email: any }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <motion.div 
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={transitions.replyDock}
      className="absolute bottom-0 left-0 right-0 p-4 z-20"
    >
      <div className="max-w-3xl mx-auto bg-bg-surface border border-border-subtle rounded-[var(--radius-base)] shadow-[var(--shadow-base)] overflow-hidden glass-panel tech-glow">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-bg-base/50">
          <div className="text-xs font-mono text-text-secondary">
            Replying to <span className="text-text-primary">{email.sender}</span>
          </div>
          <button onClick={onClose} className="p-1 text-text-secondary hover:text-text-primary rounded-full hover:bg-bg-surface-hover">
            <X size={14} />
          </button>
        </div>
        
        <div className="p-4">
          <textarea 
            ref={textareaRef}
            className="w-full bg-transparent border-none outline-none resize-none text-text-primary placeholder:text-text-secondary/50 font-body min-h-[120px]"
            placeholder="Draft your reply... (Cmd+Enter to send)"
          />
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle bg-bg-base/50">
          <div className="flex gap-2">
            <button className="p-2 text-text-secondary hover:text-accent rounded-[var(--radius-base)] hover:bg-bg-surface-hover transition-colors">
              <Sparkles size={16} />
            </button>
            <button className="p-2 text-text-secondary hover:text-text-primary rounded-[var(--radius-base)] hover:bg-bg-surface-hover transition-colors">
              <Paperclip size={16} />
            </button>
          </div>
          <button className="flex items-center gap-2 bg-accent text-bg-base px-4 py-2 rounded-[var(--radius-base)] font-medium text-sm hover:opacity-90 transition-opacity">
            <span>Send</span>
            <Send size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
