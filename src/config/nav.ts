import { useMemo } from 'react';
import {
  Activity,
  Banknote,
  Building2,
  ClipboardList,
  Droplets,
  Headset,
  FileBarChart,
  FileText,
  GitCompareArrows,
  Landmark,
  LayoutDashboard,
  LockOpen,
  Milk,
  Radio,
  Receipt,
  Settings,
  ShieldAlert,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Tags,
  TrendingUp,
  UserRound,
  Users,
  UsersRound,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useNav, type NavSection } from '../components/layout/operations/nav';

export interface NavItem {
  id: string;
  to: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  built: boolean;
}

export interface NavGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  items: NavItem[];
}

// Icons are only decoration. Which pages exist, their order and their names all come from the menu API.
const ROUTE_ICON: Record<string, LucideIcon> = {
  '/': LayoutDashboard,
  '/live': Radio,
  '/collections': Users,
  '/reports/farmerwise': UserRound,
  '/reports/vlcc': Store,
  '/reports/unionwise': FileBarChart,
  '/reports/vlc-status': Activity,
  '/reports/variance': GitCompareArrows,
  '/reports/cleaning': FileText,
  '/reports/eko-calibration': SlidersHorizontal,
  '/transactions/vlc-milk-entry': Milk,
  '/transactions/farmer-milk-entry': Droplets,
  '/transactions/manage-collection': ClipboardList,
  '/transactions/sale-entry': ShoppingCart,
  '/transactions/deduction-entry': Banknote,
  '/master/vlc-master': Building2,
  '/master/farmer-master': UsersRound,
  '/master/excel-rate-upload': Tags,
  '/master/rate-status': TrendingUp,
  '/billing': Receipt,
  '/billing/farmer-bill': Receipt,
  '/billing/bank-payment-summary': Landmark,
  '/billing/cash-payment-summary': Banknote,
  '/billing/standard-deduction': Banknote,
  '/billing/vlc-standard-deduction': Banknote,
  '/billing/cattlefeed-farmer-bill': Receipt,
  '/billing/vlc-milk-bill': Receipt,
  '/settings/mobile-app': Settings,
  '/settings/dpu-settings': SlidersHorizontal,
  '/settings/eko-milk-settings': SlidersHorizontal,
  '/administrator/user-access': LockOpen,
  '/administrator/bill-unfreeze': LockOpen,
  '/farmers': UsersRound,
  '/centers': Store,
  '/rates': Tags,
  '/quality': ShieldAlert,
  '/pipeline': Workflow,
  '/settings': Settings,
  '/contact': Headset,
};

/** Turns the menu-API sections into SmartX groups. Every route appears once, so no page is listed twice.
 *  Nothing is added by hand: if the API does not return an entry, it is not shown. */
export function toGroups(sections: NavSection[]): NavGroup[] {
  const seen = new Set<string>();
  const groups: NavGroup[] = [];
  for (const s of sections) {
    const items: NavItem[] = [];
    for (const leaf of s.items) {
      if (seen.has(leaf.to)) continue;
      seen.add(leaf.to);
      items.push({
        id: `${s.id}:${leaf.to}`,
        to: leaf.to,
        label: leaf.label,
        hint: leaf.hint ?? s.title,
        icon: ROUTE_ICON[leaf.to] ?? leaf.icon ?? s.icon,
        built: leaf.built,
      });
    }
    if (items.length) groups.push({ id: s.id, title: s.title, icon: s.icon, items });
  }
  return groups;
}

/** The sidebar, search palette and breadcrumb all read this one list. */
export function useNavGroups(): NavGroup[] {
  const sections = useNav();
  return useMemo(() => toGroups(sections), [sections]);
}

export function findNavIn(groups: NavGroup[], pathname: string): { group: NavGroup; item: NavItem } | null {
  for (const group of groups) {
    const hit = group.items.find((i) => i.to === pathname);
    if (hit) return { group, item: hit };
  }
  for (const group of groups) {
    const hit = group.items.find((i) => i.to !== '/' && pathname.startsWith(`${i.to}/`));
    if (hit) return { group, item: hit };
  }
  return null;
}
