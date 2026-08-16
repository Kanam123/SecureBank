import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Landmark, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const HERO = "https://images.unsplash.com/photo-1574848296471-28f79a036f79?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBiYW5rJTIwYnVpbGRpbmclMjBhcmNoaXRlY3R1cmV8ZW58MHx8fHwxNzg2ODg1ODgxfDA&ixlib=rb-4.1.0&q=85";

export default function Register() {
  const { register, apiError } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.email || !form.password) return setError("All fields are required");
    if (form.password.length < 6) return setError("Password must be at least 6 characters");
    if (form.password !== form.confirm) return setError("Passwords do not match");
    setLoading(true);
    try {
      const u = await register(form.name, form.email, form.password);
      toast.success("Account created! A savings account was opened for you.");
      navigate(u.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img src={HERO} alt="Bank" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-slate-900/60" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Landmark className="h-5 w-5" />
            </div>
            <span className="font-heading text-xl font-extrabold">SecureBank</span>
          </div>
          <div>
            <h1 className="font-heading text-4xl font-extrabold leading-tight">Open your account<br />in seconds.</h1>
            <ul className="mt-6 space-y-2.5 text-slate-200">
              {["Instant savings account on sign-up", "Free transfers to any SecureBank user", "Real-time fraud monitoring", "Detailed analytics & statements"].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md">
          <h2 className="font-heading text-3xl font-extrabold text-foreground">Create account</h2>
          <p className="mt-1 text-muted-foreground">Join SecureBank today. It's free.</p>

          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="register-form">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Full name</label>
              <input value={form.name} onChange={set("name")} data-testid="register-name-input"
                className="w-full rounded-md border border-input bg-white px-3.5 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Khushi Kumari" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Email address</label>
              <input type="email" value={form.email} onChange={set("email")} data-testid="register-email-input"
                className="w-full rounded-md border border-input bg-white px-3.5 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="you@example.com" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Password</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} value={form.password} onChange={set("password")} data-testid="register-password-input"
                  className="w-full rounded-md border border-input bg-white px-3.5 py-2.5 pr-11 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Minimum 6 characters" />
                <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPw ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Confirm password</label>
              <input type={showPw ? "text" : "password"} value={form.confirm} onChange={set("confirm")} data-testid="register-confirm-input"
                className="w-full rounded-md border border-input bg-white px-3.5 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Re-enter password" />
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700" data-testid="register-error">{error}</div>
            )}

            <button type="submit" disabled={loading} data-testid="register-submit-button"
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-heading font-semibold text-white transition-transform hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: "hsl(var(--primary))" }}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Creating…" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline" data-testid="link-login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
