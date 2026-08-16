import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { Spinner, EmptyState } from "@/components/States";
import { RiskBadge } from "@/components/Badges";
import { ArrowDownCircle, ArrowUpCircle, Send, Loader2, Wallet, Users2 } from "lucide-react";
import { toast } from "sonner";

const TABS = [
  { key: "deposit", label: "Deposit", icon: ArrowDownCircle },
  { key: "withdraw", label: "Withdraw", icon: ArrowUpCircle },
  { key: "transfer", label: "Transfer", icon: Send },
];

export default function Banking() {
  const [tab, setTab] = useState("deposit");
  const [accounts, setAccounts] = useState([]);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [toAccountNumber, setToAccountNumber] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const load = async () => {
    try {
      const [accRes, benRes] = await Promise.all([api.get("/accounts"), api.get("/beneficiaries")]);
      setAccounts(accRes.data.accounts);
      setBeneficiaries(benRes.data.beneficiaries);
      if (accRes.data.accounts[0]) setAccountId(accRes.data.accounts[0].id);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const selectedAccount = accounts.find((a) => a.id === accountId);

  const reset = () => { setAmount(""); setToAccountNumber(""); setDescription(""); };

  const submit = async (e) => {
    e.preventDefault();
    setResult(null);
    const amt = Number(amount);
    if (!accountId) return toast.error("Select an account");
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (tab === "transfer" && !toAccountNumber) return toast.error("Enter recipient account number");

    setSubmitting(true);
    try {
      let res;
      if (tab === "deposit") res = await api.post("/transactions/deposit", { accountId, amount: amt, description });
      else if (tab === "withdraw") res = await api.post("/transactions/withdraw", { accountId, amount: amt, description });
      else res = await api.post("/transactions/transfer", { fromAccountId: accountId, toAccountNumber, amount: amt, description });

      toast.success(`${TABS.find((t) => t.key === tab).label} successful`);
      setResult(res.data.transaction);
      reset();
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner label="Loading banking…" />;

  if (accounts.length === 0) {
    return <EmptyState icon={Wallet} title="No account found" description="You need an account to make transactions." />;
  }

  const Icon = TABS.find((t) => t.key === tab).icon;

  return (
    <div className="space-y-8" data-testid="banking-page">
      <div>
        <h1 className="font-heading text-3xl font-extrabold text-foreground">Move Money</h1>
        <p className="mt-1 text-muted-foreground">Deposit, withdraw, or transfer funds securely.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-white shadow-sm">
            {/* Tabs */}
            <div className="flex border-b border-border p-2">
              {TABS.map((t) => {
                const TIcon = t.icon;
                return (
                  <button key={t.key} onClick={() => { setTab(t.key); setResult(null); }} data-testid={`tab-${t.key}`}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                      tab === t.key ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"
                    }`} style={tab === t.key ? { backgroundColor: "hsl(var(--primary))" } : {}}>
                    <TIcon className="h-4 w-4" /> {t.label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={submit} className="space-y-5 p-6" data-testid="banking-form">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">{tab === "transfer" ? "From account" : "Account"}</label>
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} data-testid="banking-account-select"
                  className="w-full rounded-md border border-input bg-white px-3.5 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.accountNumber} — {a.accountType} ({formatINR(a.balance)})</option>
                  ))}
                </select>
              </div>

              {tab === "transfer" && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-foreground">Recipient account number</label>
                  <input value={toAccountNumber} onChange={(e) => setToAccountNumber(e.target.value)} data-testid="banking-recipient-input"
                    className="w-full rounded-md border border-input bg-white px-3.5 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="12-digit account number" />
                  {beneficiaries.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {beneficiaries.map((b) => (
                        <button key={b.id} type="button" onClick={() => setToAccountNumber(b.accountNumber)}
                          className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary">
                          <Users2 className="h-3 w-3" /> {b.nickname || b.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">Amount (₹)</label>
                <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="banking-amount-input"
                  className="w-full rounded-md border border-input bg-white px-3.5 py-2.5 text-lg font-semibold tabular outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="0.00" />
                {selectedAccount && (tab === "withdraw" || tab === "transfer") && (
                  <p className="mt-1.5 text-xs text-muted-foreground">Available: <span className="font-semibold">{formatINR(selectedAccount.balance)}</span></p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">Description <span className="font-normal text-muted-foreground">(optional)</span></label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} data-testid="banking-description-input"
                  className="w-full rounded-md border border-input bg-white px-3.5 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g. Rent, Salary, Groceries" />
              </div>

              <button type="submit" disabled={submitting} data-testid="banking-submit-button"
                className="flex w-full items-center justify-center gap-2 rounded-lg py-3 font-heading font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
                style={{ backgroundColor: "hsl(var(--primary))" }}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                {submitting ? "Processing…" : `Confirm ${TABS.find((t) => t.key === tab).label}`}
              </button>
            </form>
          </div>
        </div>

        {/* Side summary / result */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">Selected account balance</p>
            <p className="mt-2 font-heading text-3xl font-extrabold tabular text-primary" data-testid="banking-current-balance">
              {formatINR(selectedAccount?.balance || 0)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{selectedAccount?.accountNumber}</p>
          </div>

          {result && (
            <div className="rounded-xl border border-border bg-white p-6 shadow-sm" data-testid="banking-result">
              <div className="flex items-center justify-between">
                <p className="font-heading font-bold text-foreground">Transaction complete</p>
                {result.flagged && <RiskBadge level={result.riskLevel} />}
              </div>
              <p className="mt-3 font-heading text-2xl font-extrabold tabular text-foreground">{formatINR(result.amount)}</p>
              <p className="text-sm text-muted-foreground">New balance: {formatINR(result.balanceAfter)}</p>
              {result.flagged && result.fraudReasons?.length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-800">Flagged for review:</p>
                  <ul className="mt-1 list-inside list-disc text-xs text-amber-700">
                    {result.fraudReasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
