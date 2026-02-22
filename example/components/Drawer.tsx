import { motion } from 'motion/react';
import { transitions } from '@/lib/motion';
import { Inbox, Star, Clock, Send, File, Archive, Trash } from 'lucide-react';

export function Drawer({ onClose }: { onClose: () => void }) {
  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-10 bg-black/20 backdrop-blur-sm sm:hidden"
        onClick={onClose}
      />
      <motion.div 
        initial={{ x: -240, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -240, opacity: 0 }}
        transition={transitions.pageEntry}
        className="w-60 h-full border-r border-border-subtle bg-bg-surface glass-panel absolute left-16 z-10 py-6 px-4 flex flex-col gap-6 shadow-[var(--shadow-base)]"
      >
        <div className="text-xs font-heading uppercase tracking-widest text-text-secondary px-2">Favorites</div>
        <div className="flex flex-col gap-1">
          <DrawerItem icon={<Inbox size={16} />} label="Inbox" count={12} active />
          <DrawerItem icon={<Star size={16} />} label="Starred" count={3} />
          <DrawerItem icon={<Clock size={16} />} label="Snoozed" />
        </div>
        
        <div className="text-xs font-heading uppercase tracking-widest text-text-secondary px-2 mt-4">Folders</div>
        <div className="flex flex-col gap-1">
          <DrawerItem icon={<Send size={16} />} label="Sent" />
          <DrawerItem icon={<File size={16} />} label="Drafts" count={5} />
          <DrawerItem icon={<Archive size={16} />} label="Archive" />
          <DrawerItem icon={<Trash size={16} />} label="Trash" />
        </div>
      </motion.div>
    </>
  );
}

function DrawerItem({ icon, label, count, active }: { icon: React.ReactNode, label: string, count?: number, active?: boolean }) {
  return (
    <button className={`flex items-center justify-between px-3 py-2 rounded-[var(--radius-base)] transition-colors ${active ? 'bg-bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary'}`}>
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      {count && <span className="text-xs font-mono bg-bg-base px-2 py-0.5 rounded-full">{count}</span>}
    </button>
  );
}
