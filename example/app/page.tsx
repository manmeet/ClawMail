"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Rail } from '@/components/Rail';
import { Drawer } from '@/components/Drawer';
import { MailList } from '@/components/MailList';
import { MailThread } from '@/components/MailThread';
import { AIPanel } from '@/components/AIPanel';
import { CommandPalette } from '@/components/CommandPalette';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { EMAILS } from '@/lib/data';

export default function App() {
  const [theme, setTheme] = useState('prestige');
  const [activeTab, setActiveTab] = useState('personal');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputFocused = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';

      if (isCommandPaletteOpen) {
        if (e.key === 'Escape') setIsCommandPaletteOpen(false);
        return;
      }
      if (isReplying) {
        if (e.key === 'Escape') setIsReplying(false);
        // cmd+enter to send
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          setIsReplying(false);
        }
        return;
      }

      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      } else if (e.key === '/' && !isInputFocused) {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      } else if (e.key === 'j' && !isInputFocused) {
        if (!selectedThreadId) {
          setSelectedIndex(i => Math.min(i + 1, EMAILS.length - 1));
        }
      } else if (e.key === 'k' && !isInputFocused) {
        if (!selectedThreadId) {
          setSelectedIndex(i => Math.max(i - 1, 0));
        }
      } else if (e.key === 'Enter' && !isInputFocused) {
        if (!selectedThreadId) {
          setSelectedThreadId(EMAILS[selectedIndex].id);
        }
      } else if (e.key === 'Escape') {
        if (selectedThreadId) {
          setSelectedThreadId(null);
        }
      } else if (e.key === 'r' && !isInputFocused) {
        if (selectedThreadId) {
          e.preventDefault();
          setIsReplying(true);
        }
      } else if (e.key === 'a' && !isInputFocused) {
        if (selectedThreadId) {
          e.preventDefault();
          setIsReplying(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, isReplying, selectedThreadId, selectedIndex]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const animationKey = `${activeTab}-${selectedThreadId || 'list'}`;

  return (
     <div className="flex h-screen w-full overflow-hidden bg-bg-base text-text-primary selection:bg-accent selection:text-bg-base relative">
        {theme === 'atmospheric' && <div className="atmosphere-bg" />}
        
        <Rail 
          onToggleDrawer={() => setIsDrawerOpen(!isDrawerOpen)} 
          animationKey={animationKey}
        />
        
        <AnimatePresence>
          {isDrawerOpen && <Drawer onClose={() => setIsDrawerOpen(false)} />}
        </AnimatePresence>

        <div className="flex-1 flex flex-col min-w-0 z-10">
          <header className="h-12 border-b border-border-subtle flex items-end justify-between px-4 shrink-0 bg-bg-base/50 pt-2 glass-panel">
             <div className="flex items-center gap-2 h-full">
                <TopTab active={activeTab === 'personal'} label="Personal" onClick={() => { setActiveTab('personal'); setSelectedThreadId(null); }} />
                <TopTab active={activeTab === 'work'} label="Work" onClick={() => { setActiveTab('work'); setSelectedThreadId(null); }} />
                <TopTab active={activeTab === 'slack'} label="Slack" onClick={() => { setActiveTab('slack'); setSelectedThreadId(null); }} />
             </div>
             <div className="flex items-center gap-2 text-xs font-mono text-text-secondary pb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Google: Connected & Syncing</span>
             </div>
          </header>

          <div className="flex-1 relative flex overflow-hidden">
            <main className="flex-1 relative flex overflow-hidden">
              <AnimatePresence mode="wait">
                {!selectedThreadId ? (
                  <MailList 
                    key={`list-${activeTab}`}
                    emails={EMAILS} 
                    selectedIndex={selectedIndex} 
                    onSelect={(id) => setSelectedThreadId(id)} 
                  />
                ) : (
                  <MailThread 
                    key={`thread-${selectedThreadId}`}
                    email={EMAILS.find(e => e.id === selectedThreadId)!}
                    onBack={() => setSelectedThreadId(null)}
                    isReplying={isReplying}
                    onReply={() => setIsReplying(true)}
                    onCloseReply={() => setIsReplying(false)}
                  />
                )}
              </AnimatePresence>
            </main>

            <AIPanel />
          </div>
        </div>

        <AnimatePresence>
          {isCommandPaletteOpen && <CommandPalette onClose={() => setIsCommandPaletteOpen(false)} />}
        </AnimatePresence>

        <ThemeSwitcher currentTheme={theme} onSelect={setTheme} />
     </div>
  );
}

function TopTab({ active, label, onClick }: { active: boolean, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-1.5 text-sm rounded-t-[var(--radius-base)] border-b-2 transition-colors h-full flex items-center ${
        active ? 'border-accent text-text-primary bg-bg-surface' : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover'
      }`}
    >
      {label}
    </button>
  )
}
