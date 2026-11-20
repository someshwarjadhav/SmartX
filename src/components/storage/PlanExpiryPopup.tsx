import type * as React from 'react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, Cloud, ShieldAlert, X } from 'lucide-react';
import { fmtDate, nf } from '../../lib/format';
import { PLAN_INCLUDED } from '../../config/storagePlan';
import { loadActivePlan, planState, type PlanState } from '../../services/storage/storagePlan.api';

/** Pages where the popup must not cover the screen: the renewal page itself and the support page. */
const QUIET_ROUTES = ['/storage-plan', '/contact'];
const SNOOZE_KEY = 'smartx.planpopup.snooze';

/**
 * Shows when the plan is about to end or has ended, and takes the customer to the Storage Plan page.
 *  - "soon"    : can be closed (comes back in the next session)
 *  - "expired" : stays until the customer goes to the Storage Plan page to renew
 */
export const PlanExpiryPopup: React.FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [info, setInfo] = useState<{ state: PlanState; days: number; on: string } | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadActivePlan().then((p) => {
      if (!alive || !p) return;
      const s = planState(p.expiresOn);
      if (s.state !== 'ok') setInfo({ ...s, on: p.expiresOn });
    });
    return () => {
      alive = false;
    };
  }, []);

  let snoozed = false;
  try {
    snoozed = window.sessionStorage.getItem(SNOOZE_KEY) === '1';
  } catch {
    /* ignore */
  }

  const quiet = QUIET_ROUTES.some((r) => pathname === r);
  const show = !!info && !quiet && !closed && !(info.state === 'soon' && snoozed);
  const expired = info?.state === 'expired';

  const later = () => {
    try {
      window.sessionStorage.setItem(SNOOZE_KEY, '1');
    } catch {
      /* ignore */
    }
    setClosed(true);
  };

  const renew = () => {
    setClosed(true);
    navigate('/storage-plan');
  };

  return (
    <AnimatePresence>
      {show && info && (
        <motion.div
          key="plan-popup"
          className="fixed inset-0 z-[70] grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-deep/70 backdrop-blur-sm" aria-hidden />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="plan-popup-title"
            initial={{ y: 16, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 8, opacity: 0 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-line bg-panel shadow-pop"
          >
            <div className={`h-1.5 ${expired ? 'bg-danger' : 'bg-warn'}`} aria-hidden />
            {!expired && (
              <button
                type="button"
                onClick={later}
                aria-label="Close"
                className="absolute right-3 top-4 grid h-8 w-8 place-items-center rounded-lg text-mute hover:bg-soft hover:text-ink"
              >
                <X size={16} aria-hidden />
              </button>
            )}
            <div className="p-6 text-center sm:p-7">
              <span
                className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${
                  expired ? 'bg-danger/10 text-danger' : 'bg-warn/15 text-warn'
                }`}
              >
                {expired ? <ShieldAlert size={28} aria-hidden /> : <CalendarClock size={28} aria-hidden />}
              </span>
              <h2 id="plan-popup-title" className="mt-4 font-display text-xl font-bold">
                {expired ? 'Your plan has expired' : 'Your plan is about to expire'}
              </h2>
              <p className="mt-2 text-sm text-mute">
                {expired
                  ? `It ended on ${fmtDate(info.on)}. Renew now to keep your collection, billing and old data safe.`
                  : info.days === 0
                    ? `It ends today (${fmtDate(info.on)}). Renew now so nothing stops.`
                    : `It ends on ${fmtDate(info.on)}, in ${nf(info.days)} day${info.days === 1 ? '' : 's'}. Renew now so nothing stops.`}
              </p>
              <p className="mx-auto mt-3 inline-flex rounded-full bg-ok/10 px-3 py-1 text-xs font-bold text-ok">
                {PLAN_INCLUDED.stations} Station IDs · {PLAN_INCLUDED.users} Users included in every plan
              </p>
              <button
                type="button"
                onClick={renew}
                className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-glow text-base font-semibold text-brand-ink shadow-card hover:brightness-110"
              >
                <Cloud size={18} aria-hidden /> View plans &amp; renew
              </button>
              {!expired && (
                <button type="button" onClick={later} className="mt-2 h-10 w-full text-sm font-semibold text-mute hover:text-ink">
                  Remind me later
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
