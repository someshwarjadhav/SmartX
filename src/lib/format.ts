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

const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-03" -> "03 Nov 2026" (the date format of the STIPL portal tables and Excel sheets) */
export function fmtDateLong(iso: string): string {
  const [y, m, d] = iso.split('-');
  const mon = MON3[Number(m) - 1];
  return y && m && d && mon ? `${d} ${mon} ${y}` : iso;
}

/** "2026-11-03" -> "03.11.2026" (Collection Date column of the Excel export) */
export function fmtDateDots(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

/** "09:30 AM" / "7:05 pm" / "13:20" -> "09:30:00" / "19:05:00" / "13:20:00" (Collection Time column of the Excel export) */
export function time24(t: string): string {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(String(t ?? '').trim());
  if (!m) return String(t ?? '');
  let h = Number(m[1]);
  const ap = m[4]?.toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}:${m[3] ?? '00'}`;
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
