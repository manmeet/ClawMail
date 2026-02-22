import { motion } from 'motion/react';
import { Inbox, FileText, Send, Archive, Settings, Menu } from 'lucide-react';

function Logo() {
  return (
    <div className="mb-8 text-accent">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <motion.path
          d="M16 4L28 10V22L16 28L4 22V10L16 4Z"
          stroke="currentColor"
          strokeWidth="1.5"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />
        <motion.path
          d="M16 10L22 13V19L16 22L10 19V13L16 10Z"
          fill="currentColor"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.5 }}
          transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
        />
      </svg>
    </div>
  );
}

export function Rail({ onToggleDrawer, animationKey }: { onToggleDrawer: () => void, animationKey: string }) {
  return (
    <div className="w-16 h-full border-r border-border-subtle flex flex-col items-center py-6 bg-bg-base z-20 relative shrink-0">
      <Logo key={animationKey} />
      
      <button onClick={onToggleDrawer} className="p-3 rounded-[var(--radius-base)] hover:bg-bg-surface-hover transition-colors mb-4 text-text-secondary hover:text-text-primary">
        <Menu size={20} />
      </button>
      
      <div className="flex flex-col gap-4 flex-1">
        <NavItem icon={<Inbox size={20} />} active />
        <NavItem icon={<FileText size={20} />} />
        <NavItem icon={<Send size={20} />} />
        <NavItem icon={<Archive size={20} />} />
      </div>

      <div className="flex flex-col gap-4">
        <NavItem icon={<Settings size={20} />} />
      </div>
    </div>
  );
}

function NavItem({ icon, active }: { icon: React.ReactNode, active?: boolean }) {
  return (
    <button className={`p-3 rounded-[var(--radius-base)] transition-colors relative ${active ? 'text-text-primary bg-bg-surface' : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover'}`}>
      {icon}
      {active && (
        <motion.div 
          layoutId="rail-active"
          className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-accent rounded-r-full"
          initial={false}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
    </button>
  );
}
