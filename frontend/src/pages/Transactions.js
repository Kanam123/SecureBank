import { useEffect, useState, useCallback } from "react";
import api, { apiError } from "@/lib/api";
import { formatINR, formatDateTime } from "@/lib/format";
import { Spinner, EmptyState } from "@/components/States";
import { RiskBadge, TXN_META } from "@/components/Badges";
import { Search, Filter, Receipt, ArrowDownLeft, ArrowUpRight, X } from "lucide-react";

const TYPES = [
  { key: "all", label: "All" },
  { key: "deposit", label: "Deposits" },
  { key: "withdraw", label: "Withdrawals" },
  { key: "transfer_out", label: "Sent" },
  { key: "transfer_in", label: "Received" },
];

export default function Transactions() {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (type !== "all") params.type = type;
      if (minAmount) params.minAmount = minAmount;
      if (maxAmount) params.maxAmount = maxAmount;
      if (from) params.from = from;
      if (to) params.to = to;
      const { data } = await api.get("/transactions", { params });
      setTxns(data.transactions);
    } catch (err) {
      apiError(err);
    } finally {
      setLoading(false);
    }
  }, [q, type, minAmount, maxAmount, from, to]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const clearFilters = () => {
    setQ(""); setType("all"); setMinAmount(""); setMaxAmount(""); setFrom(""); setTo("");
  };

  const hasFilters = q || type !== "all" || minAmount || maxAmount || from || to;

  return (
    <div className="space-y-6" data-testid="transactions-page">
      <div>
        <h1 className="font-heading text-3xl font-extrabold text-foreground">Transaction History</h1>
        <p className="mt-1 text-muted-foreground">Search and filter all your transactions.</p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} data-testid="transaction-search-input"
            className="w-full rounded-md border border-input bg-white py-2.5 pl-10 pr-3.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Search by description, name or account number…" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button key={t.key} onClick={() => setType(t.key)} data-testid={`filter-type-${t.key}`}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                type === t.key ? "border-primary bg-primary text-white" : "border-border bg-white text-muted-foreground hover:border-primary"
              }`} style={type === t.key ? { backgroundColor: "hsl(var(--primary))" } : {}}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Min amount</label>
            <input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} data-testid="filter-min-amount"
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary" placeholder="₹0" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Max amount</label>
            <input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} data-testid="filter-max-amount"
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary" placeholder="₹100000" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">From date</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="filter-from-date"
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">To date</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="filter-to-date"
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary" />
          </div>
        </div>

        {hasFilters && (
          <button onClick={clearFilters} data-testid="clear-filters-button"
            className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {loading ? (
          <Spinner label="Loading transactions…" />
        ) : txns.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={hasFilters ? Filter : Receipt}
              title={hasFilters ? "No matching transactions" : "No transactions yet"}
              description={hasFilters ? "Try adjusting your filters." : "Your transactions will appear here."} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="transactions-table">
              <thead>
                <tr className="border-b border-border bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-6 py-3 font-semibold">Description</th>
                  <th className="px-6 py-3 font-semibold">Type</th>
                  <th className="px-6 py-3 font-semibold">Date</th>
                  <th className="px-6 py-3 font-semibold">Risk</th>
                  <th className="px-6 py-3 text-right font-semibold">Amount</th>
                  <th className="px-6 py-3 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => {
                  const meta = TXN_META[t.type];
                  return (
                    <tr key={t.id} className="border-b border-border transition-colors hover:bg-secondary/40" data-testid="transaction-row">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${meta.sign === "+" ? "bg-emerald-100" : "bg-red-100"}`}>
                            {meta.sign === "+" ? <ArrowDownLeft className="h-4 w-4 text-emerald-700" /> : <ArrowUpRight className="h-4 w-4 text-red-600" />}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{t.description || meta.label}</p>
                            {t.counterpartyName && <p className="text-xs text-muted-foreground">{t.counterpartyName} • {t.counterpartyAccount}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{meta.label}</td>
                      <td className="px-6 py-4 text-muted-foreground">{formatDateTime(t.createdAt)}</td>
                      <td className="px-6 py-4">{t.flagged ? <RiskBadge level={t.riskLevel} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                      <td className={`px-6 py-4 text-right font-heading font-bold tabular ${meta.tone}`}>{meta.sign}{formatINR(t.amount)}</td>
                      <td className="px-6 py-4 text-right tabular text-muted-foreground">{formatINR(t.balanceAfter)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
