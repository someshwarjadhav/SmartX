const IN = 'en-IN';

export function nf(value: number, digits = 0): string {
  return new Intl.NumberFormat(IN, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

export function compactIN(value: number, digits = 1): string {
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${nf(value / 1e7, 2)} Cr`;
  if (abs >= 1e5) return `${nf(value / 1e5, 2)} L`;
  if (abs >= 1e3) return `${nf(value / 1e3, digits)}K`;
  return nf(value);
}

export const rupees = (v: number): string => `₹${compactIN(v)}`;
export const litres = (v: number): string => `${nf(v)} L`;

export function pct(value: number, digits = 1): string {
  return `${value > 0 ? '+' : ''}${nf(value, digits)}%`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  const a = parts[0]?.[0] ?? '';
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (a + b).toUpperCase();
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(IN, { day: '2-digit', month: 'short' });
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

export function longDate(date = new Date()): string {
  return date.toLocaleDateString(IN, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'user';
  const name = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
  return name || 'User';
}
