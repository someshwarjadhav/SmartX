import type * as React from 'react';
import { useState, type FormEvent } from 'react';
import { CircleUserRound, Mail, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Fields';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';

const Settings: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSaved('');
    const result = updateProfile(name, email);
    if (result.ok) {
      setName(name.trim());
      setEmail(email.trim());
      setSaved(result.message);
    } else {
      setError(result.message);
    }
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your SmartX profile and account details." />
      <Panel title="Profile" subtitle="Update the name and email address associated with your account." className="max-w-3xl">
        <form onSubmit={submit} className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-soft p-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <CircleUserRound size={24} />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">{user?.name ?? 'Your profile'}</p>
              <p className="truncate text-sm text-mute">{user?.role ?? 'Account'}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="profile-name">
              <Input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                icon={<UserRound size={16} />}
                required
              />
            </Field>
            <Field label="Email address" htmlFor="profile-email">
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                inputMode="email"
                icon={<Mail size={16} />}
                required
              />
            </Field>
          </div>

          <div className="rounded-xl border border-line px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-mute">Account role</p>
            <p className="mt-1 text-sm font-medium">{user?.role ?? 'Not available'}</p>
          </div>

          {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger">{error}</p>}
          {saved && <p role="status" className="rounded-xl bg-brand/10 px-3 py-2.5 text-sm font-medium text-brand">{saved}</p>}

          <div className="flex justify-end">
            <Button type="submit">Save profile</Button>
          </div>
        </form>
      </Panel>
    </div>
  );
};

export default Settings;
