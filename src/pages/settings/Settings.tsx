import type * as React from 'react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff, ImagePlus, LogOut, Pencil, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLoginData } from '../../hooks/useSessionData';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Fields';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { initials } from '../../lib/format';
import { ApiError } from '../../services/http/errors';
import {
  getProfileFromSession,
  getVillageInfo,
  updateProfile,
  validateProfile,
  type Profile,
  type ProfileErrors,
} from '../../services/profile/profile.api';

const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const login = useLoginData();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const initial = useMemo(
    () =>
      getProfileFromSession({
        id: login?.userId ?? '',
        username: user?.name ?? '',
        mccname: login?.mccName ?? '',
        email: user?.email ?? '',
        SessionID: login?.vlccIds?.[0] ?? '',
      }),
    [login, user],
  );

  const [loaded, setLoaded] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Profile>(initial);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  
  useEffect(() => {
    const id = initial.id;
    if (!id) return;
    let alive = true;
    setLoading(true);
    console.log('[profile] calling GetVillage, loginid =', id);
    getVillageInfo(id, initial)
      .then((p) => { if (alive) setLoaded(p); })
      .catch((e) => {
        if (alive) toast(e instanceof ApiError ? e.message : 'Could not load the profile from the server', 'warn');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id]);

  useEffect(() => setForm(loaded ?? initial), [loaded, initial]);

  useEffect(() => {
    if (!form.logo) { setPreview(null); return; }
    const url = URL.createObjectURL(form.logo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [form.logo]);

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const found = validateProfile(form);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      toast('Please correct the highlighted fields', 'warn');
      return;
    }
    setSaving(true);
    try {
      const message = await updateProfile(form);
      toast(message);
      const saved = { ...form, logoUrl: preview ?? form.logoUrl, logo: null };
      setForm(saved);
      setLoaded(saved);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'The profile could not be updated', 'warn');
    } finally {
      setSaving(false);
    }
  };

  const display = form.username || user?.name || 'User';
  const photo = preview || form.logoUrl;

  return (
    <div>
      <PageHeader title="Profile" subtitle="View and update your account details." />

      <Panel title="Edit Profile" subtitle={loading ? 'Loading your profile…' : undefined} bodyClassName="pt-5">
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
       
          <aside className="flex flex-col items-center self-start rounded-2xl bg-soft p-6 text-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Change logo"
              className="group relative grid h-32 w-32 place-items-center overflow-hidden rounded-full bg-brand text-4xl font-extrabold text-brand-ink ring-4 ring-panel"
            >
              {photo ? (
                <img
                  src={photo}
                  alt="Logo"
                  className="h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                initials(display)
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition group-hover:opacity-100">
                <ImagePlus size={26} className="text-white" />
              </span>
            </button>

            <p className="mt-4 break-all font-display text-xl font-extrabold uppercase text-brand">{display}</p>
            <p className="mt-1 break-all text-xs text-mute">{form.email}</p>
            <hr className="my-5 w-full border-line" />

            <Button className="w-full" icon={<Pencil size={16} />} onClick={() => nameRef.current?.focus()}>Edit Profile</Button>
            <Button variant="danger" className="mt-3 w-full" icon={<LogOut size={16} />} onClick={logout}>Log Out</Button>
          </aside>

         
          <form onSubmit={submit} noValidate className="grid min-w-0 gap-x-6 gap-y-4 sm:grid-cols-2">
            <Field label="Id" htmlFor="pf-id">
              <Input id="pf-id" value={form.id} onChange={(e) => set('id', e.target.value)} />
            </Field>
            <Field label="Username" htmlFor="pf-username" error={errors.username}>
              <Input id="pf-username" ref={nameRef} value={form.username} onChange={(e) => set('username', e.target.value)} />
            </Field>

            <Field label="MCC Name" htmlFor="pf-mcc" error={errors.mccname}>
              <Input id="pf-mcc" value={form.mccname} onChange={(e) => set('mccname', e.target.value)} />
            </Field>
            <Field label="Email" htmlFor="pf-email" error={errors.email}>
              <Input id="pf-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </Field>

            <Field label="Password" htmlFor="pf-password" error={errors.password}>
              <div className="relative">
                <Input
                  id="pf-password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                 
                  placeholder="Leave blank to keep current password"
                  className="pr-11"
                  onChange={(e) => set('password', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-ink"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            <Field label="Mobile No." htmlFor="pf-mobile" error={errors.mobile}>
              <Input
                id="pf-mobile"
                inputMode="numeric"
                maxLength={10}
                value={form.mobile}
               
                onChange={(e) => set('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
              />
            </Field>

            <Field label="Address" htmlFor="pf-address">
              <Input id="pf-address" value={form.Address} onChange={(e) => set('Address', e.target.value)} />
            </Field>
            <Field label="GST" htmlFor="pf-gst" error={errors.GST}>
              <Input id="pf-gst" maxLength={15} value={form.GST} onChange={(e) => set('GST', e.target.value.toUpperCase())} />
            </Field>

            <Field label="Session ID" htmlFor="pf-session">
              <Input id="pf-session" value={form.SessionID} onChange={(e) => set('SessionID', e.target.value)} />
            </Field>
            <Field label="Logo" htmlFor="pf-logo" error={errors.logo}>
              <input
                id="pf-logo"
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(e) => set('logo', e.target.files?.[0] ?? null)}
                className="block h-12 w-full cursor-pointer rounded-xl border border-line bg-panel text-sm text-mute file:mr-3 file:h-full file:cursor-pointer file:border-0 file:border-r file:border-line file:bg-soft file:px-4 file:font-semibold file:text-ink"
              />
            </Field>

            <div className="sm:col-span-2">
              <Button type="submit" size="lg" className="w-full" loading={saving} icon={<Save size={18} />}>
                Submit
              </Button>
            </div>
          </form>
        </div>
      </Panel>
    </div>
  );
};

export default Settings;