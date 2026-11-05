import type * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, ImagePlus, LogOut, Pencil, Save, UserRound, X } from 'lucide-react';
import { Card, CardHeader } from '../../components/operations/ui/Card';
import { Button } from '../../components/operations/ui/Button';
import { Field, Input } from '../../components/operations/ui/Fields';
import { CardTitle, ReportPage, Reveal } from '../../components/operations/ReportKit';
import { useAuth } from '../../context/portal/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLoginData } from '../../hooks/useSessionData';
import { initials } from '../../lib/portal/format';
import { ApiError } from '../../services/http/errors';
import {
  getProfileFromSession,
  updateProfile,
  validateProfile,
  type Profile,
  type ProfileErrors,
} from '../../services/profile/profile.api';

const Err: React.FC<{ msg?: string }> = ({ msg }) =>
  msg ? <span className="mt-1 block text-xs font-semibold text-danger">{msg}</span> : null;

const ProfileSettings: React.FC = () => {
  const { user, logout } = useAuth();
  const login = useLoginData();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

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

  const [form, setForm] = useState<Profile>(initial);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => { if (!editing) setForm(initial); }, [initial, editing]);

  const startEdit = () => { setEditing(true); setErrors({}); };
  const cancelEdit = () => {
    setEditing(false);
    setErrors({});
    setForm(initial);
    if (fileRef.current) fileRef.current.value = '';
  };

  useEffect(() => {
    if (!form.logo) { setPreview(null); return; }
    const url = URL.createObjectURL(form.logo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [form.logo]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
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
      // keep what was just saved on screen; the new logo (if any) stays as the preview
      setForm((f) => ({ ...f, logoUrl: preview ?? f.logoUrl, logo: null }));
      setEditing(false);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'The profile could not be updated', 'warn');
    } finally {
      setSaving(false);
    }
  };

  const display = form.username || user?.name || 'User';

  return (
    <ReportPage title="Profile" subtitle="View and update your account details.">
      <Reveal delay={0.05}>
        <Card>
          <CardHeader title={<CardTitle icon={UserRound}>Edit Profile</CardTitle>} />
          <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            {/* ---------- left: avatar card ---------- */}
            <aside className="flex flex-col items-center self-start rounded-2xl bg-soft/70 p-6 text-center shadow-card">
              <button
                type="button"
                onClick={() => editing && fileRef.current?.click()}
                aria-label="Change logo"
                className="group relative grid h-32 w-32 place-items-center overflow-hidden rounded-full bg-deep text-4xl font-extrabold text-white ring-4 ring-panel dark:bg-brand dark:text-[#06222a]"
              >
                {preview || form.logoUrl ? (
                  <img
                    src={preview || form.logoUrl}
                    alt="Logo"
                    className="h-full w-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  initials(display)
                )}
                {editing && (
                  <span className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition group-hover:opacity-100">
                    <ImagePlus size={26} className="text-white" />
                  </span>
                )}
              </button>
              <p className="mt-4 break-all font-display text-xl font-extrabold uppercase text-brand">{display}</p>
              <p className="mt-1 break-all text-xs text-mute">{form.email}</p>
              <hr className="my-5 w-full border-line" />
              {editing ? (
                <Button type="button" variant="outline" className="w-full" onClick={cancelEdit} icon={<X />}>
                  Cancel
                </Button>
              ) : (
                <Button type="button" className="w-full" onClick={startEdit} icon={<Pencil />}>
                  Edit Profile
                </Button>
              )}
              <Button type="button" variant="danger" className="mt-3 w-full" onClick={logout} icon={<LogOut />}>
                Log Out
              </Button>
            </aside>

            {/* ---------- right: form ---------- */}
            <form onSubmit={submit} noValidate className="grid min-w-0 gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field label="Id">
                <Input value={form.id} readOnly disabled />
              </Field>
              <Field label="Username">
                <Input disabled={!editing} value={form.username} onChange={(e) => set('username', e.target.value)} />
                <Err msg={errors.username} />
              </Field>

              <Field label="MCC Name">
                <Input disabled={!editing} value={form.mccname} onChange={(e) => set('mccname', e.target.value)} />
                <Err msg={errors.mccname} />
              </Field>
              <Field label="Email">
                <Input type="email" disabled={!editing} value={form.email} onChange={(e) => set('email', e.target.value)} />
                <Err msg={errors.email} />
              </Field>

              <Field label="Password">
                <div className="relative">
                  <Input
                    type={showPass ? 'text' : 'password'}
                    autoComplete="new-password"
                    disabled={!editing}
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    className="pr-11"
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
                <Err msg={errors.password} />
              </Field>
              <Field label="Mobile No.">
                <Input
                  inputMode="numeric"
                  disabled={!editing}
                  maxLength={10}
                  value={form.mobile}
                  onChange={(e) => set('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                />
                <Err msg={errors.mobile} />
              </Field>

              <Field label="Address">
                <Input disabled={!editing} value={form.Address} onChange={(e) => set('Address', e.target.value)} />
              </Field>
              <Field label="GST">
                <Input
                  maxLength={15}
                  disabled={!editing}
                  value={form.GST}
                  onChange={(e) => set('GST', e.target.value.toUpperCase())}
                />
                <Err msg={errors.GST} />
              </Field>

              <Field label="Session ID">
                <Input value={form.SessionID} readOnly disabled />
              </Field>
              <Field label="Logo">
                <input
                  ref={fileRef}
                  type="file"
                  disabled={!editing}
                  accept="image/*"
                  onChange={(e) => set('logo', e.target.files?.[0] ?? null)}
                  className="block h-11 w-full cursor-pointer rounded-xl border border-line bg-panel text-sm text-mute file:mr-3 file:h-full file:cursor-pointer file:border-0 file:border-r file:border-line file:bg-soft file:px-4 file:font-semibold file:text-ink"
                />
                <Err msg={errors.logo} />
              </Field>

              <div className="sm:col-span-2">
                <Button type="submit" size="lg" className="w-full" loading={saving} disabled={!editing} icon={<Save />}>
                  Submit
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </Reveal>
    </ReportPage>
  );
};

export default ProfileSettings;