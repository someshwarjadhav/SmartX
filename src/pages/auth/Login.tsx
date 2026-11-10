import type * as React from "react";
import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  Snowflake,
  Scale,
  FlaskConical,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { LogoMark, Wordmark } from "../../components/brand/Logo";
import { Tanker } from "../../components/brand/Tanker";
import { ModeToggle } from "../../components/layout/ModeToggle";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Fields";
import { DEV_EMAIL, DEV_PASSWORD } from "../../services/config";

const FACTS = [
  {
    icon: Snowflake,
    title: "Chilled at the centre",
    text: "Milk is cooled to 4°C before it is loaded.",
  },
  {
    icon: Scale,
    title: "Weighed at the bridge",
    text: "Every tanker is weighed in and out of the plant.",
  },
  {
    icon: FlaskConical,
    title: "Tested before unloading",
    text: "Fat, SNF and adulteration are checked in the lab.",
  },
];

const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState(DEV_EMAIL);
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await login(email.trim(), password);
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(440px,0.85fr)_1.15fr]">
      <div className="safe-top relative overflow-hidden bg-deep px-5 pb-2 pt-5 text-white lg:hidden">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-glow/30 blur-3xl"
          aria-hidden
        />
        <div
          className="grid-dots pointer-events-none absolute inset-0 opacity-60"
          aria-hidden
        />
        <div className="relative mx-auto max-w-md">
          <div className="flex items-center gap-2.5">
            <LogoMark size={34} />
            <Wordmark tone="light" />
          </div>
          <Tanker autoPlay className="mx-auto mt-3 max-h-[190px] w-full" />
        </div>
      </div>

      <div className="safe-bottom flex flex-col px-5 py-8 sm:px-12 lg:py-10">
        <div className="flex items-center justify-between gap-3">
          <div className="hidden items-center gap-3 lg:flex">
            <LogoMark size={40} />
            <Wordmark className="text-2xl" />
          </div>
          <ModeToggle className="ml-auto" />
        </div>

        <motion.form
          onSubmit={submit}
          noValidate
          className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-6 lg:py-10"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
            Sign in to SmartX
          </h1>
          <p className="mt-3 text-mute">
            Follow milk from the collection centres to the plant gate.
          </p>

          <div className="mt-8 space-y-4">
            <Field label="Email" htmlFor="login-email">
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail size={16} />}
                placeholder="you@company.com"
                disabled={busy}
              />
            </Field>
            <Field label="Password" htmlFor="login-password">
              <div className="relative">
                <Input
                  id="login-password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock size={16} />}
                  placeholder="••••••••"
                  className="pr-11"
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-mute hover:text-ink"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger"
              >
                {error}
              </p>
            )}

            <Button type="submit" size="lg" loading={busy} className="w-full">
              Sign in
            </Button>

            <p className="rounded-xl bg-soft px-3.5 py-3 text-xs leading-relaxed text-mute">
              Sign in with your MilkShell portal account. Your credentials are
              checked by the connected portal API.
            </p>
          </div>
        </motion.form>

        <p className="text-center text-xs text-mute sm:text-left">
          © {new Date().getFullYear()} SmartX · Need help?{" "}
          <a
            href="mailto:support@smartx.in"
            className="font-semibold text-brand hover:underline"
          >
            support@smartx.in
          </a>
        </p>
      </div>

      <div className="relative hidden overflow-hidden bg-deep text-white lg:block">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(640px 460px at 75% 18%, rgb(var(--glow) / .42), transparent 65%), radial-gradient(520px 380px at 8% 92%, rgb(var(--brand) / .35), transparent 62%)",
          }}
          aria-hidden
        />
        <div className="grid-dots absolute inset-0" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <div className="max-w-md">
            <h2 className="font-display text-3xl font-bold leading-tight xl:text-4xl">
              From the village can to the plant tank.
            </h2>
            <p className="mt-3 text-white/70">
              SmartX keeps collection, tankers and quality in one place, so the
              morning shift starts with answers.
            </p>
          </div>

          <div className="mx-auto w-full max-w-[680px]">
            <Tanker autoPlay />
          </div>

          <ul className="grid gap-3 xl:grid-cols-3 ">
            {FACTS.map((f) => {
              const Icon = f.icon;
              return (
                <li
                  key={f.title}
                  className="rounded-2xl border border-white/10 bg-white/7 p-4 backdrop-blur-sm"
                >
                  <Icon size={18} className="text-glow" />
                  <p className="mt-2 text-sm font-semibold">{f.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/65">
                    {f.text}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Login;
