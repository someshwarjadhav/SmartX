import type * as React from "react";
import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { AtSign, Lock, Smartphone, User } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { registerApi } from "../../services/auth/register.api";

type FormState = {
  username: string;
  email: string;
  password: string;
  repeat: string;
  mobile: string;
};
type Errors = Partial<Record<keyof FormState, string>>;

const EMPTY: FormState = { username: "", email: "", password: "", repeat: "", mobile: "" };

function validate(f: FormState): Errors {
  const e: Errors = {};
  if (!f.username) e.username = "Username is required";
  else if (!/^[A-Za-z0-9]+$/.test(f.username)) e.username = "Only letters and digits are allowed (no spaces)";
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter a valid email address";
  if (f.password.length < 4) e.password = "Password must be at least 4 characters";
  if (f.repeat !== f.password) e.repeat = "Passwords do not match";
  if (!/^\d{10}$/.test(f.mobile.trim())) e.mobile = "Mobile number must be 10 digits";
  return e;
}

interface GroupProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon: React.ReactNode;
  error?: string;
}


const InputGroup: React.FC<GroupProps> = ({ icon, error, className, ...rest }) => (
  <div>
    <div
      className={
        "flex h-12 overflow-hidden rounded-xl border bg-panel transition focus-within:ring-4 " +
        (error
          ? "border-danger focus-within:ring-danger/10"
          : "border-line focus-within:border-brand focus-within:ring-brand/15")
      }
    >
      <span className="grid w-12 shrink-0 place-items-center border-r border-line bg-soft text-ink">
        {icon}
      </span>
      <input
        aria-invalid={error ? true : undefined}
        className={
          "min-w-0 flex-1 bg-transparent px-3.5 text-base text-ink outline-none placeholder:text-mute/80 disabled:cursor-not-allowed disabled:opacity-70 sm:text-sm " +
          (className ?? "")
        }
        {...rest}
      />
    </div>
    {error && (
      <p role="alert" className="mt-1.5 text-xs font-semibold text-danger">
        {error}
      </p>
    )}
  </div>
);

interface Props {
 
  onBackToLogin: () => void;
 
  onRegistered: (email: string, message: string) => void;
}

export const RegisterForm: React.FC<Props> = ({ onBackToLogin, onRegistered }) => {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (key === "mobile") value = value.replace(/\D/g, "").slice(0, 10);
    if (key === "username") value = value.replace(/[^A-Za-z0-9]/g, ""); 
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setServerError("");

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      const message = await registerApi({
        username: form.username,
        email: form.email,
        password: form.password,
        mobile: form.mobile,
      });
      onRegistered(form.email.trim(), message);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Registration failed. Please try again.");
      setBusy(false);
    }
  };

  return (
    <motion.form
      onSubmit={submit}
      noValidate
      className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-6 lg:py-10"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
    >
      <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">Register to SmartX</h1>
      <p className="mt-3 text-mute">Register a New Membership</p>

      <div className="mt-8 space-y-4">
        <InputGroup
          icon={<User size={17} />}
          type="text"
          placeholder="DPU/Mobile App Username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={form.username}
          onChange={set("username")}
          error={errors.username}
          disabled={busy}
        />
        <InputGroup
          icon={<AtSign size={17} />}
          type="email"
          placeholder="Email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={form.email}
          onChange={set("email")}
          error={errors.email}
          disabled={busy}
        />
        <InputGroup
          icon={<Lock size={17} />}
          type="password"
          placeholder="Password"
          autoComplete="new-password"
          value={form.password}
          onChange={set("password")}
          error={errors.password}
          disabled={busy}
        />
        <InputGroup
          icon={<Lock size={17} />}
          type="password"
          placeholder="Repeat password"
          autoComplete="new-password"
          value={form.repeat}
          onChange={set("repeat")}
          error={errors.repeat}
          disabled={busy}
        />
        <InputGroup
          icon={<Smartphone size={17} />}
          type="tel"
          inputMode="numeric"
          placeholder="Mobile No"
          autoComplete="tel"
          maxLength={10}
          value={form.mobile}
          onChange={set("mobile")}
          error={errors.mobile}
          disabled={busy}
        />

        {serverError && (
          <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger">
            {serverError}
          </p>
        )}

        <Button type="submit" size="lg" loading={busy} className="w-full">
          Create Account
        </Button>

        <button
          type="button"
          onClick={onBackToLogin}
          disabled={busy}
          className="text-sm font-medium text-brand underline hover:opacity-80 disabled:opacity-60"
        >
          I have Already Membership
        </button>
      </div>
    </motion.form>
  );
};

export default RegisterForm;