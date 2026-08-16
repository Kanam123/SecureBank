import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Landmark, Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const HERO = "https://images.unsplash.com/photo-1574848296471-28f79a036f79?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBiYW5rJTIwYnVpbGRpbmclMjBhcmNoaXRlY3R1cmV8ZW58MHx8fHwxNzg2ODg1ODgxfDA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { login, apiError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) return setError("Please enter your email and password");
    setLoading(true);
    try {
      const u = await login(email, password);
      toast.success(`Welcome back, ${u.name.split(" ")[0]}!`);
      navigate(u.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left hero */}
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
            <h1 className="font-heading text-4xl font-extrabold leading-tight">
              Banking that puts<br />your security first.
            </h1>
            <p className="mt-4 max-w-md text-slate-300">
              Manage accounts, transfer funds and track every transaction with bank-grade encryption and real-time fraud monitoring.
            </p>
            <div className="mt-6 flex items-center gap-2 text-sm text-slate-300">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              256-bit encryption • JWT secured • Fraud detection
            </div>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Landmark className="h-5 w-5 text-white" />
              </div>
              <span className="font-heading text-xl font-extrabold">SecureBank</span>
            </div>
          </div>
          <h2 className="font-heading text-3xl font-extrabold text-foreground">Sign in</h2>
          <p className="mt-1 text-muted-foreground">Access your SecureBank dashboard.</p>

          <form onSubmit={submit} className="mt-8 space-y-5" data-testid="login-form">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email-input"
                className="w-full rounded-md border border-input bg-white px-3.5 py-2.5 text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="login-password-input"
                  className="w-full rounded-md border border-input bg-white px-3.5 py-2.5 pr-11 text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPw ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700" data-testid="login-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit-button"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 font-heading font-semibold text-white transition-transform hover:bg-primary-hover active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: "hsl(var(--primary))" }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New to SecureBank?{" "}
            <Link to="/register" className="font-semibold text-primary hover:underline" data-testid="link-register">
              Create an account
            </Link>
          </p>

          <div className="mt-6 rounded-lg border border-border bg-secondary/50 p-4 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Demo credentials</p>
            <p className="mt-1">User — demo@securebank.com / User@12345</p>
            <p>Admin — kanamkhushikumari1@gmail.com / Admin@12345</p>
          </div>
        </div>
      </div>
    </div>
  );
}
