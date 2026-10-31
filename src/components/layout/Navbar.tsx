import type * as React from 'react';
import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, CircleUserRound, LifeBuoy, LogOut, Menu, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { findNavIn, useNavGroups } from '../../config/nav';
import { initials } from '../../lib/format';
import { useOutside } from '../../hooks/useOutside';
import { cn } from '../../lib/cn';
import { ModeToggle } from './ModeToggle';

interface Props {
  onMenu: () => void;
  onSearch: () => void;
}

const popover =
  'fixed inset-x-3 top-[4.25rem] z-50 overflow-hidden rounded-2xl border border-line bg-panel shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-80';

export const Navbar: React.FC<Props> = ({ onMenu, onSearch }) => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const groups = useNavGroups();
  const current = findNavIn(groups, pathname);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useOutside(menuRef, () => setMenu(false), menu);

  return (
    <header className="safe-top sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <button
          onClick={onMenu}
          aria-label="Open menu"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-panel text-mute hover:text-ink lg:hidden"
        >
          <Menu size={18} />
        </button>

        <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
          <span className="text-mute">{current?.group.title ?? 'SmartX'}</span>
          <ChevronRight size={14} className="text-mute/60" aria-hidden />
          <span className="truncate font-semibold">{current?.item.label ?? 'Not found'}</span>
        </nav>

        <button
          onClick={onSearch}
          className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-panel px-3 text-left text-sm text-mute transition hover:border-brand/60 md:ml-auto md:max-w-xs md:flex-none md:basis-72"
        >
          <Search size={16} className="shrink-0" />
          <span className="truncate">Search pages</span>
          <kbd className="ml-auto hidden rounded-md bg-soft px-1.5 py-0.5 text-[11px] font-semibold lg:block">Ctrl K</kbd>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
          <ModeToggle />

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenu((m) => !m)}
              aria-label="Account menu"
              aria-expanded={menu}
              className="flex h-10 items-center gap-2 rounded-xl border border-line bg-panel pl-1 pr-1 transition hover:border-brand/60 sm:pr-3"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-xs font-bold text-brand-ink">{initials(user?.name ?? 'U')}</span>
              <span className="hidden text-sm font-semibold sm:block">{user?.name.split(' ')[0]}</span>
            </button>
            <AnimatePresence>
              {menu && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className={cn(popover, 'p-2 sm:w-64')}>
                  <div className="px-3 py-2">
                    <p className="font-bold">{user?.name}</p>
                    <p className="truncate text-xs text-mute">{user?.email}</p>
                    <p className="mt-1 text-xs font-semibold text-brand">{user?.role}</p>
                  </div>
                  <Link to="/settings" onClick={() => setMenu(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-soft">
                    <CircleUserRound size={16} />
                    Profile settings
                  </Link>
                  <Link to="/contact" onClick={() => setMenu(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-soft">
                    <LifeBuoy size={16} />
                    Contact us
                  </Link>
                  <button onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-danger hover:bg-danger/10">
                    <LogOut size={16} />
                    Sign out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};
