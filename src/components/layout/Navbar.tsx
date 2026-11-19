import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  Cloud,
  LifeBuoy,
  LogOut,
  Menu,
  Search,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { findNavIn, useNavGroups } from "../../config/nav";
import { initials } from "../../lib/format";
import { useOutside } from "../../hooks/useOutside";
import { cn } from "../../lib/cn";
import { ModeToggle } from "./ModeToggle";
import { ShiftBadge } from "./ShiftBadge";

interface Props {
  onMenu: () => void;
  onSearch: () => void;
}

const popover =
  "fixed inset-x-3 top-[4.25rem] z-50 overflow-hidden rounded-2xl border border-line bg-panel shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-80";

const FixedTime: React.FC<{ value: string }> = ({ value }) => {
  const [clock = "", ap = ""] = value.split(" ");
  return (
    <span className="inline-flex items-baseline whitespace-nowrap">
      <span className="sr-only">{value}</span>
      <span aria-hidden className="inline-flex items-baseline">
        {[...clock].map((ch, i) => (
          <span
            key={i}
            className={cn(
              "inline-block text-center",
              /\d/.test(ch) ? "w-[0.64em]" : "w-[0.3em]",
            )}
          >
            {ch}
          </span>
        ))}
        {ap && (
          <span className="ml-1 inline-block w-[1.75em] text-left">{ap}</span>
        )}
      </span>
    </span>
  );
};

const DateTimeChip: React.FC = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const weekday = now.toLocaleDateString("en-GB", { weekday: "short" });
  const fullDate = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const shortDate = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const timeSec = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const dateOn = "hidden sm:inline md:hidden lg:inline xl:hidden";
  return (
    <time
      dateTime={now.toISOString()}
      title={`${weekday}, ${fullDate}, ${timeSec}`}
      className="tnum hidden h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-panel px-2 text-[11px] font-semibold min-[360px]:inline-flex sm:h-9 sm:px-2.5 sm:text-xs"
    >
      <CalendarDays
        size={14}
        aria-hidden
        className="hidden shrink-0 text-mute sm:block md:hidden lg:block"
      />
      <span className="hidden xl:inline">
        {weekday}, {fullDate}
      </span>
      <span className={dateOn}>{shortDate}</span>
      <span
        aria-hidden
        className="hidden text-mute/60 sm:inline md:hidden lg:inline"
      >
        ·
      </span>
      <span className="xl:hidden">
        <FixedTime value={time} />
      </span>
      <span className="hidden xl:inline">
        <FixedTime value={timeSec} />
      </span>
    </time>
  );
};

export const Navbar: React.FC<Props> = ({ onMenu, onSearch }) => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const groups = useNavGroups();
  const current = findNavIn(groups, pathname);
  const onStoragePlan = pathname === "/storage-plan";
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

        <nav
          aria-label="Breadcrumb"
          className="hidden min-w-0 items-center gap-1.5 text-sm md:flex"
        >
          <span
            className="min-w-0 max-w-[45%] shrink-0 truncate text-mute"
            title={onStoragePlan ? "SmartX" : (current?.group.title ?? "SmartX")}
          >
            {onStoragePlan ? "SmartX" : (current?.group.title ?? "SmartX")}
          </span>
          <ChevronRight
            size={14}
            className="shrink-0 text-mute/60"
            aria-hidden
          />
          <span
            className="min-w-0 truncate font-semibold"
            title={onStoragePlan ? "Storage Plan" : (current?.item.label ?? "Not found")}
          >
            {onStoragePlan ? "Storage Plan" : (current?.item.label ?? "Not found")}
          </span>
        </nav>

        <button
          onClick={onSearch}
          className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-panel px-3 text-left text-sm text-mute transition hover:border-brand/60 md:ml-auto md:max-w-xs md:flex-none md:basis-72"
        >
          <Search size={16} className="shrink-0" />
          <span className="truncate">Search pages</span>
          <kbd className="ml-auto hidden rounded-md bg-soft px-1.5 py-0.5 text-[11px] font-semibold lg:block">
            Ctrl K
          </kbd>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
          <Link
            to="/storage-plan"
            aria-label="Storage Plan"
            title="Storage Plan: cloud storage renewal"
            className="group relative inline-flex h-8 shrink-0 items-center gap-1.5 overflow-hidden rounded-lg bg-gradient-to-r from-brand to-glow px-2.5 text-xs font-bold text-brand-ink shadow-card transition hover:brightness-105 sm:h-10 sm:rounded-xl sm:px-3.5 sm:text-sm"
          >
            <Cloud size={16} aria-hidden className="transition group-hover:-translate-y-0.5 group-hover:scale-110" />
            <span className="hidden min-[420px]:inline">Storage Plan</span>
          </Link>
          <DateTimeChip />
          <ShiftBadge />
          <ModeToggle />

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenu((m) => !m)}
              aria-label="Account menu"
              aria-expanded={menu}
              className="flex h-10 items-center gap-2 rounded-xl border border-line bg-panel pl-1 pr-1 transition hover:border-brand/60 sm:pr-3"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-xs font-bold text-brand-ink">
                {initials(user?.name ?? "U")}
              </span>
              <span className="hidden text-sm font-semibold sm:block">
                {user?.name.split(" ")[0]}
              </span>
            </button>
            <AnimatePresence>
              {menu && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className={cn(popover, "p-2 sm:w-64")}
                >
                  <div className="px-3 py-2">
                    <p className="font-bold">{user?.name}</p>
                    <p className="truncate text-xs text-mute">{user?.email}</p>
                    <p className="mt-1 text-xs font-semibold text-brand">
                      {user?.role}
                    </p>
                  </div>
                  <Link
                    to="/portal/profile"
                    onClick={() => setMenu(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-soft"
                  >
                    <CircleUserRound size={16} />
                    Profile settings
                  </Link>
                  <Link
                    to="/contact"
                    onClick={() => setMenu(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-soft"
                  >
                    <LifeBuoy size={16} />
                    Contact us
                  </Link>
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-danger hover:bg-danger/10"
                  >
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
