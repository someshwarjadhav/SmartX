import type * as React from 'react';
import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronDown, Clock, Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Field, Input, Textarea } from '../../components/ui/Fields';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/cn';

const CHANNELS = [
  { icon: Phone, title: 'Call us', value: '+91 98765 43210', href: 'tel:+919876543210', note: 'Mon to Sat, 8 am to 8 pm' },
  { icon: MessageCircle, title: 'WhatsApp', value: '+91 98765 43210', href: 'https://wa.me/919876543210', note: 'Replies within the hour' },
  { icon: Mail, title: 'Email', value: 'support@smartx.in', href: 'mailto:support@smartx.in', note: 'We answer within one working day' },
  { icon: MapPin, title: 'Visit', value: 'Kolhapur, Maharashtra 416001', href: undefined, note: 'By appointment' },
];

const TOPICS = [
  { value: 'support', label: 'Need help with SmartX' },
  { value: 'demo', label: 'Request a demo' },
  { value: 'billing', label: 'Billing question' },
  { value: 'feedback', label: 'Feedback or idea' },
];

const FAQ = [
  { q: 'How do I add a farmer collection entry?', a: 'Open Collection, then Farmer collection, and choose New entry. Pick the farmer, enter litres, fat and SNF, and the amount is calculated for you.' },
  { q: 'Can I switch to dark mode?', a: 'Yes. Use the sun and moon button in the top bar. The theme button next to it lets you pick a different colour set.' },
  { q: 'Is the data on the dashboard real?', a: 'Not yet. This build shows sample numbers so you can review the screens. It will read your plant data once the backend is connected.' },
  { q: 'Who can I call for urgent plant issues?', a: 'Call the support number above during working hours. For tanker or gate problems, say so at the start and we will route you first.' },
];

const Faq: React.FC = () => {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ul className="divide-y divide-line/70">
      {FAQ.map((f, i) => {
        const isOpen = open === i;
        return (
          <li key={f.q}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 py-3.5 text-left text-sm font-semibold transition hover:text-brand"
            >
              {f.q}
              <ChevronDown size={16} className={cn('shrink-0 text-mute transition-transform', isOpen && 'rotate-180')} />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                  <p className="pb-4 text-sm leading-relaxed text-mute">{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
};

const Contact: React.FC = () => {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [topic, setTopic] = useState('support');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Enter a valid email.';
    if (message.trim().length < 10) next.message = 'Write at least 10 characters.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 800));
    setBusy(false);
    setSent(true);
  };

  const reset = () => {
    setMessage('');
    setSent(false);
  };

  return (
    <div>
      <PageHeader title="Contact" subtitle="Questions, a demo, or something not working? Reach the SmartX team." />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:gap-5 xl:grid-cols-12">
        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-5 xl:grid-cols-1">
          {CHANNELS.map((c, i) => {
            const Icon = c.icon;
            const body = (
              <>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-brand-ink">
                  <Icon size={20} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-mute">{c.title}</span>
                  <span className="block truncate font-semibold">{c.value}</span>
                  <span className="mt-0.5 block text-xs text-mute">{c.note}</span>
                </span>
              </>
            );
            const cls = 'group flex items-center gap-4 rounded-2xl border border-line bg-panel p-4 shadow-card transition';
            return (
              <motion.div key={c.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.3 }}>
                {c.href ? (
                  <a href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={cn(cls, 'hover:-translate-y-0.5 hover:border-brand/60')}>
                    {body}
                  </a>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </motion.div>
            );
          })}
          <div className="flex items-center gap-3 rounded-2xl bg-soft px-4 py-3 text-sm text-mute sm:col-span-2 xl:col-span-1">
            <Clock size={16} className="shrink-0 text-brand" aria-hidden />
            Contact details shown here are sample values. Replace them with your own.
          </div>
        </div>

        <div className="xl:col-span-7">
          <Panel title="Send a message" subtitle="We reply to the email you enter below.">
            <AnimatePresence mode="wait" initial={false}>
              {sent ? (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="grid place-items-center py-10 text-center">
                  <div className="max-w-xs">
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 220, delay: 0.1 }} className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ok/15 text-ok">
                      <CheckCircle2 size={34} aria-hidden />
                    </motion.span>
                    <h2 className="mt-4 font-display text-xl font-bold">Message sent</h2>
                    <p className="mt-1.5 text-sm text-mute">Thanks, {name.split(' ')[0] || 'there'}. We will reply to {email} soon.</p>
                    <Button variant="soft" className="mt-5" onClick={reset}>
                      Send another
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.form key="form" onSubmit={submit} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name" htmlFor="ct-name">
                      <Input id="ct-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
                      {errors.name && <p role="alert" className="mt-1.5 text-xs font-semibold text-danger">{errors.name}</p>}
                    </Field>
                    <Field label="Email" htmlFor="ct-email">
                      <Input id="ct-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
                      {errors.email && <p role="alert" className="mt-1.5 text-xs font-semibold text-danger">{errors.email}</p>}
                    </Field>
                  </div>
                  <div>
                    <label htmlFor="ct-topic" className="mb-1.5 block text-sm font-semibold">Topic</label>
                    <Select label="Topic" value={topic} onChange={setTopic} options={TOPICS} className="[&_button]:h-12" />
                  </div>
                  <Field label="Message" htmlFor="ct-message">
                    <Textarea id="ct-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us what you need" />
                    {errors.message && <p role="alert" className="mt-1.5 text-xs font-semibold text-danger">{errors.message}</p>}
                  </Field>
                  <Button type="submit" size="lg" loading={busy} icon={<Send size={16} />} className="w-full sm:w-auto">
                    Send message
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </Panel>
        </div>

        <div className="xl:col-span-12">
          <Panel title="Common questions">
            <Faq />
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default Contact;
