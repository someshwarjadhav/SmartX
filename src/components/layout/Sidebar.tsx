import type * as React from 'react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftRight, Banknote, ChevronDown, Database, FileBarChart, LayoutDashboard, LayoutGrid, Milk, PanelLeftClose, PanelLeftOpen, Receipt, Settings, ShieldCheck, Wallet, X, type LucideIcon } from 'lucide-react';
import { findNavIn, useNavGroups } from '../../config/nav';
import { useAuth } from '../../context/AuthContext';
import { LogoMark, Wordmark } from '../brand/Logo';
import { cn } from '../../lib/cn';

/** Icon in front of every menu heading (the menu API only gives the names) */
const GROUP_ICON: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  collection: Milk,
  report: FileBarChart,
  reports: FileBarChart,
  master: Database,
  masters: Database,
  transactions: ArrowLeftRight,
  transaction: ArrowLeftRight,
  billing: Receipt,
  account: Wallet,
  accounts: Wallet,
  administrator: ShieldCheck,
  admin: ShieldCheck,
  settings: Settings,
  setting: Settings,
  payment: Banknote,
};
const groupIcon = (title: string, fallback: LucideIcon): LucideIcon => GROUP_ICON[title.trim().toLowerCase()] ?? fallback ?? LayoutGrid;

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  mobile?: boolean;
  onNavigate?: () => void;
}

export const Sidebar: React.FC<Props> = ({ collapsed, onToggle, mobile, onNavigate }) => {
  const { pathname } = useLocation();
  useAuth();
  const NAV = useNavGroups();
  const activeGroup = findNavIn(NAV, pathname)?.group.id;
  const [open, setOpen] = useState<Set<string>>(() => new Set(['dashboard', activeGroup ?? 'dashboard']));

  useEffect(() => {
    if (activeGroup) setOpen((prev) => (prev.has(activeGroup) ? prev : new Set(prev).add(activeGroup)));
  }, [activeGroup]);

  const toggleGroup = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const rail = collapsed && !mobile;

  return (
    <nav
      aria-label="Main"
      className="relative flex h-full flex-col overflow-hidden text-deep-ink"
      style={{ background: 'linear-gradient(185deg, rgb(var(--deep)) 0%, rgb(var(--deep) / .96) 55%, rgb(var(--brand) / .55) 220%)' }}
    >
      <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-glow/25 blur-3xl" aria-hidden />

      <div className={cn('relative flex h-16 shrink-0 items-center gap-3 px-4', rail && 'justify-center px-0')}>
        <LogoMark size={34} />
        {!rail && <Wordmark tone="light" />}
        {mobile && (
          <button onClick={onNavigate} aria-label="Close menu" className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-deep-ink/70 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="thin-scrollbar relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 pb-4 pt-1">
        {NAV.map((group) => {
          const isOpen = rail || open.has(group.id);
          return (
            <div key={group.id} className="mb-1">
              {rail ? (
                <div className="mx-3 my-2 h-px bg-white/10" aria-hidden />
              ) : (
                <button
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold text-white/85 transition-colors duration-200 hover:bg-glow/15 hover:text-white"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {(() => { const GroupIcon = groupIcon(group.title, group.icon); return <GroupIcon size={18} className="shrink-0 text-glow/90" aria-hidden />; })()}
                    <span className="truncate">{group.title}</span>
                  </span>
                  <ChevronDown size={14} className={cn('transition-transform duration-300 ease-out', isOpen ? 'rotate-0' : '-rotate-90')} />
                </button>
              )}
              <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="items"
                  initial={rail ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ height: { duration: 0.32, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.22 } }}
                  className="-mx-3 overflow-hidden px-3"
                >
                <ul className="space-y-0.5 pb-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.id}>
                        <NavLink
                          to={item.to}
                          end
                          title={rail ? item.label : undefined}
                          onClick={onNavigate}
                          className={({ isActive }) =>
                            cn(
                              'group relative flex min-h-10 items-center gap-3 rounded-xl py-2 text-sm font-medium transition-all duration-200 ease-out',
                              rail ? 'justify-center px-0' : 'px-3',
                              isActive
                                ? 'bg-brand/30 text-white shadow-sm shadow-glow/20 ring-1 ring-glow/30'
                                : 'text-white/85 hover:bg-glow/20 hover:text-white',
                            )
                          }
                        >
                          {({ isActive }) => (
                            <>
                              {isActive && <span className="absolute -left-3 top-2.5 h-6 w-1 rounded-r-full bg-glow" aria-hidden />}
                              <Icon size={18} className={cn('shrink-0 self-start mt-0.5', isActive && 'text-glow')} />
                              {!rail && <span className="min-w-0 break-words leading-tight">{item.label}</span>}
                            </>
                          )}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <div className="relative shrink-0 border-t border-white/10 p-3">
        {!rail && (
          <div className="mb-2 flex items-center gap-3 rounded-xl bg-white/8 px-3 py-2.5">
            <span className="relative grid h-2.5 w-2.5 place-items-center" aria-hidden>
              <span className="absolute h-2.5 w-2.5 animate-pulseDot rounded-full bg-ok" />
              <span className="h-2.5 w-2.5 rounded-full bg-ok" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">SmartX</p>
              <p className="text-xs text-white/75">Live · portal API</p>
            </div>
          </div>
        )}
        {!mobile && (
          <button
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn('flex h-10 w-full items-center gap-3 rounded-xl text-sm font-medium text-white/85 transition hover:bg-white/8 hover:text-white', rail ? 'justify-center' : 'px-3')}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!rail && 'Collapse'}
          </button>
        )}
      </div>
    </nav>
  );
};