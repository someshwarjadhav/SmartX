import type * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { nf } from '../../lib/format';
import { cn } from '../../lib/cn';

export const HERO_CLASS = {
  receipt: 'bg-gradient-to-r from-ok to-brand',
  payment: 'bg-gradient-to-r from-brand to-glow',
} as const;

interface VoucherSummaryProps {
  tone: keyof typeof HERO_CLASS;
  icon: LucideIcon;
  heading: string;
  amount: number;
  farmerId: string;
  farmerName: string;
  details: Array<[string, string]>;
  count: number;
  total: number;
}

export const VoucherSummary: React.FC<VoucherSummaryProps> = ({
  tone,
  icon: Icon,
  heading,
  amount,
  farmerId,
  farmerName,
  details,
  count,
  total,
}) => (
  <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
    <header className={cn('flex items-center gap-3 px-5 py-4 text-white', HERO_CLASS[tone])}>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15">
        <Icon size={20} aria-hidden />
      </span>
      <div>
        <h2 className="font-display text-base font-bold">{heading}</h2>
        <p className="text-sm text-white/75">Voucher overview</p>
      </div>
    </header>

    <div className="space-y-5 p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-mute">Current amount</p>
        <p className="mt-1 font-display text-3xl font-extrabold tnum">₹{nf(amount, 2)}</p>
      </div>

      <div className="rounded-xl bg-soft/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-mute">Farmer</p>
        <p className="mt-1 font-semibold">{farmerName || farmerId || 'No farmer selected'}</p>
        {farmerName && farmerId && <p className="mt-0.5 text-xs text-mute">{farmerId}</p>}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
        {details.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-mute">{label}</dt>
            <dd className="mt-0.5 truncate font-medium">{value || '—'}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
        <div>
          <p className="text-xs text-mute">Vouchers today</p>
          <p className="mt-1 font-semibold tnum">{count}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-mute">Total today</p>
          <p className="mt-1 font-semibold tnum">₹{nf(total, 2)}</p>
        </div>
      </div>
    </div>
  </section>
);
