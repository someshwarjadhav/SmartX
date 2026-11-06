import type * as React from 'react';
import { Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { findNavIn, useNavGroups } from '../../config/nav';
// import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../ui/PageLoader';
import { CommandPalette } from './CommandPalette';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

const COLLAPSE_KEY = 'smartx-collapsed';

const AppShell: React.FC = () => {
  const { pathname } = useLocation();
  // const { user } = useAuth();
  const groups = useNavGroups();
  // const plant = user?.mccName || user?.dairyName || 'SmartX dairy';
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
    }
  }, [collapsed]);

  useEffect(() => setDrawer(false), [pathname]);

  useEffect(() => {
    const page = findNavIn(groups, pathname)?.item.label;
    document.title = page ? `${page} · SmartX` : 'SmartX · Dairy operations';
  }, [groups, pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawer]);

  return (
    <div className="min-h-dvh overflow-x-clip">
      <aside className={`fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-300 lg:block ${collapsed ? 'w-[76px]' : 'w-[256px]'}`}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </aside>

      <AnimatePresence>
        {drawer && (
          <motion.div key="drawer" className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-deep/60 backdrop-blur-sm" onClick={() => setDrawer(false)} aria-hidden />
            <motion.div
              className="absolute inset-y-0 left-0 w-[280px] max-w-[86vw] shadow-pop"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            >
              <Sidebar mobile collapsed={false} onToggle={() => undefined} onNavigate={() => setDrawer(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`min-w-0 transition-[padding] duration-300 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-[256px]'}`}>
        <Navbar onMenu={() => setDrawer(true)} onSearch={() => setPalette(true)} />
        <main className="mx-auto w-full min-w-0 max-w-[1560px] px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
          <Suspense fallback={<PageLoader />}>
            <motion.div key={pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
              <Outlet />
            </motion.div>
          </Suspense>
        </main>
        <footer className="safe-bottom px-6 pb-6 pt-2 text-center text-xs text-mute">SmartX · <Link to="/contact" className="font-semibold text-brand hover:underline">Contact support</Link></footer>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
};

export default AppShell;
