import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { formatINR, formatDate } from "@/lib/format";
import { Spinner } from "@/components/States";
import { Wallet, Plus, Copy, Check, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState("savings");
  const [copied, setCopied] = useState("");

  const load = async () => {
    try {
      const { data } = await api.get("/accounts");
      setAccounts(data.accounts);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createAccount = async () => {
    setCreating(true);
    try {
      await api.post("/accounts", { accountType: type });
      toast.success("New account opened successfully");
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setCreating(false);
    }
  };

  const copy = (num) => {
    navigator.clipboard.writeText(num);
    setCopied(num);
    toast.success("Account number copied");
    setTimeout(() => setCopied(""), 1500);
  };

  if (loading) return <Spinner label="Loading accounts…" />;

  return (
    <div className="space-y-8" data-testid="accounts-page">
      <div>
        <h1 className="font-heading text-3xl font-extrabold text-foreground">My Accounts</h1>
        <p className="mt-1 text-muted-foreground">Manage your SecureBank accounts and open new ones.</p>
      </div>

      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 className="font-heading text-lg font-bold text-foreground">Open a new account</h2>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-foreground">Account type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} data-testid="account-type-select"
              className="rounded-md border border-input bg-white px-3.5 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
              <option value="savings">Savings</option>
              <option value="current">Current</option>
            </select>
          </div>
          <button onClick={createAccount} disabled={creating} data-testid="create-account-button"
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 font-heading text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
            style={{ backgroundColor: "hsl(var(--primary))" }}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Open account
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {accounts.map((a, i) => (
          <div key={a.id} data-testid={`account-card-${i}`}
            className="relative overflow-hidden rounded-xl border border-border p-6 text-white shadow-sm"
            style={{ background: "linear-gradient(135deg, #064E3B 0%, #065F46 55%, #047857 100%)" }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 opacity-80" />
                <span className="text-sm font-medium capitalize opacity-90">{a.accountType} Account</span>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${a.status === "active" ? "bg-emerald-400/20 text-emerald-100" : "bg-red-400/20 text-red-100"}`}>
                {a.status}
              </span>
            </div>
            <p className="mt-8 text-xs uppercase tracking-wider opacity-70">Available Balance</p>
            <p className="font-heading text-3xl font-extrabold tabular" data-testid={`account-balance-${i}`}>{formatINR(a.balance)}</p>
            <div className="mt-6 flex items-center justify-between">
              <div>
                <p className="text-xs opacity-70">Account Number</p>
                <p className="font-heading text-lg font-bold tracking-widest tabular">{a.accountNumber}</p>
              </div>
              <button onClick={() => copy(a.accountNumber)} className="rounded-lg bg-white/10 p-2.5 transition-colors hover:bg-white/20" data-testid={`copy-account-${i}`}>
                {copied === a.accountNumber ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-3 text-xs opacity-60">Opened on {formatDate(a.createdAt)}</p>
            <Wallet className="absolute -right-6 -top-6 h-28 w-28 opacity-5" />
          </div>
        ))}
      </div>
    </div>
  );
}
