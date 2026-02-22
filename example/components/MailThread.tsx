import { motion, AnimatePresence } from 'motion/react';
import { transitions } from '@/lib/motion';
import { ArrowLeft, Reply, MoreHorizontal, CornerUpLeft, CornerUpRight } from 'lucide-react';
import { ReplyDock } from './ReplyDock';

export function MailThread({ email, onBack, isReplying, onReply, onCloseReply }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={transitions.threadOpen}
      className="flex-1 h-full flex flex-col bg-bg-base relative"
    >
      <div className="h-16 border-b border-border-subtle flex items-center px-6 shrink-0 gap-4 glass-panel z-10">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-bg-surface transition-colors text-text-secondary hover:text-text-primary">
          <ArrowLeft size={18} />
        </button>
        <div className="flex gap-2 ml-auto">
          <button onClick={onReply} className="p-2 rounded-full hover:bg-bg-surface transition-colors text-text-secondary hover:text-text-primary" title="Reply (r)">
            <CornerUpLeft size={18} />
          </button>
          <button className="p-2 rounded-full hover:bg-bg-surface transition-colors text-text-secondary hover:text-text-primary" title="Reply All (a)">
            <CornerUpRight size={18} />
          </button>
          <button className="p-2 rounded-full hover:bg-bg-surface transition-colors text-text-secondary hover:text-text-primary">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 pb-32">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, ...transitions.pageEntry }}
          className="max-w-3xl mx-auto"
        >
          <h1 className="font-heading text-4xl mb-8 leading-tight">{email.subject}</h1>
          
          <div className="flex justify-between items-start mb-10 pb-6 border-b border-border-subtle dashed-border">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-bg-surface border border-border-subtle flex items-center justify-center font-heading text-lg text-accent">
                {email.sender.charAt(0)}
              </div>
              <div>
                <div className="font-medium text-text-primary">{email.sender}</div>
                <div className="text-sm text-text-secondary">{email.email}</div>
              </div>
            </div>
            <div className="text-sm font-mono text-text-secondary">{email.date}</div>
          </div>

          <div className="prose prose-invert max-w-none font-body text-text-primary leading-relaxed whitespace-pre-wrap">
            {email.body}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {isReplying && (
          <ReplyDock onClose={onCloseReply} email={email} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
