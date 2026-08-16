import { useEffect, useState, useCallback } from "react";
import api, { apiError } from "@/lib/api";
import { formatINR, formatDateTime, formatDate } from "@/lib/format";
import { Spinner, EmptyState } from "@/components/States";
import { RiskBadge, TXN_META } from "@/components/Badges";
import {
  Users, Wallet, Receipt, ShieldAlert, Search, Ban, CheckCircle2,
  IndianRupee, Activity, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "users", label: "Users" },
  { key: "accounts", label: "Accounts" },
  { key: "transactions", label: "Transactions" },
  { key: "suspicious", label: "Suspicious" },
];

function StatCard({ icon: Icon, label, value, tone, testid }) {
  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm" data-testid={testid}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      <p className="mt-4 font-heading text-2xl font-extrabold tabular text-foreground">{value}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [txns, setTxns] = useState([]);
  const [suspicious, setSuspicious] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");

  const loadOverview = useCallback(async () => {
    const { data } = await api.get("/admin/stats");
    setStats(data);
  }, []);

  const loadTab = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "overview") await loadOverview();
      else if (tab === "users") setUsers((await api.get("/admin/users", { params: q ? { q } : {} })).data.users);
      else if (tab === "accounts") setAccounts((await api.get("/admin/accounts")).data.accounts);
      else if (tab === "transactions") setTxns((await api.get("/admin/transactions", { params: riskFilter !== "all" ? { riskLevel: riskFilter } : {} })).data.transactions);
      else if (tab === "suspicious") setSuspicious((await api.get("/admin/suspicious")).data.transactions);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [tab, q, riskFilter, loadOverview]);

  useEffect(() => {
    const t = setTimeout(loadTab, tab === "users" ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadTab, tab]);

  const toggleStatus = async (u) => {
    const status = u.status === "active" ? "suspended" : "active";
    try {
      await api.put(`/admin/users/${u.id}`, { status });
      toast.success(`User ${status}`);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, status } : x)));
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-page">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary">
          <ShieldAlert className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-foreground">Admin Console</h1>
          <p className="text-muted-foreground">Monitor users, accounts and suspicious activity.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-white p-1.5 shadow-sm">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} data-testid={`admin-tab-${t.key}`}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.key ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"
            }`} style={tab === t.key ? { backgroundColor: "hsl(var(--primary))" } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner label="Loading…" />
      ) : tab === "overview" && stats ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard testid="admin-stat-users" icon={Users} label="Total Users" tone="bg-primary/10 text-primary" value={stats.userCount} />
          <StatCard testid="admin-stat-accounts" icon={Wallet} label="Bank Accounts" tone="bg-sky-100 text-sky-700" value={stats.accountCount} />
          <StatCard testid="admin-stat-txns" icon={Receipt} label="Transactions" tone="bg-violet-100 text-violet-700" value={stats.txnCount} />
          <StatCard testid="admin-stat-deposits" icon={IndianRupee} label="Total Deposits Held" tone="bg-emerald-100 text-emerald-700" value={formatINR(stats.totalDeposits)} />
          <StatCard testid="admin-stat-volume" icon={Activity} label="Transaction Volume" tone="bg-amber-100 text-amber-700" value={formatINR(stats.totalVolume)} />
          <StatCard testid="admin-stat-flagged" icon={AlertTriangle} label="Flagged / High Risk" tone="bg-red-100 text-red-600" value={`${stats.flaggedCount} / ${stats.highRisk}`} />
        </div>
      ) : tab === "users" ? (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} data-testid="admin-user-search"
              className="w-full rounded-md border border-input bg-white py-2.5 pl-10 pr-3.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Search users by name or email…" />
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="admin-users-table">
                <thead>
                  <tr className="border-b border-border bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-6 py-3 font-semibold">User</th>
                    <th className="px-6 py-3 font-semibold">Role</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 text-right font-semibold">Balance</th>
                    <th className="px-6 py-3 font-semibold">Joined</th>
                    <th className="px-6 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border hover:bg-secondary/40" data-testid="admin-user-row">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-foreground">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="px-6 py-4"><span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold capitalize">{u.role}</span></td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>{u.status}</span>
                      </td>
                      <td className="px-6 py-4 text-right tabular font-semibold text-foreground">{formatINR(u.totalBalance)}</td>
                      <td className="px-6 py-4 text-muted-foreground">{formatDate(u.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        {u.role !== "admin" && (
                          <button onClick={() => toggleStatus(u)} data-testid={`toggle-user-${u.id}`}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                              u.status === "active" ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}>
                            {u.status === "active" ? <><Ban className="h-3.5 w-3.5" /> Suspend</> : <><CheckCircle2 className="h-3.5 w-3.5" /> Activate</>}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : tab === "accounts" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="admin-accounts-table">
              <thead>
                <tr className="border-b border-border bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-6 py-3 font-semibold">Account Number</th>
                  <th className="px-6 py-3 font-semibold">Owner</th>
                  <th className="px-6 py-3 font-semibold">Type</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-border hover:bg-secondary/40" data-testid="admin-account-row">
                    <td className="px-6 py-4 tabular font-semibold text-foreground">{a.accountNumber}</td>
                    <td className="px-6 py-4"><p className="font-medium text-foreground">{a.ownerName}</p><p className="text-xs text-muted-foreground">{a.ownerEmail}</p></td>
                    <td className="px-6 py-4 capitalize text-muted-foreground">{a.accountType}</td>
                    <td className="px-6 py-4"><span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">{a.status}</span></td>
                    <td className="px-6 py-4 text-right tabular font-bold text-foreground">{formatINR(a.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === "transactions" || tab === "suspicious" ? (
        <div className="space-y-4">
          {tab === "transactions" && (
            <div className="flex flex-wrap gap-2">
              {["all", "LOW", "MEDIUM", "HIGH"].map((r) => (
                <button key={r} onClick={() => setRiskFilter(r)} data-testid={`admin-risk-filter-${r}`}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    riskFilter === r ? "border-primary bg-primary text-white" : "border-border bg-white text-muted-foreground hover:border-primary"
                  }`} style={riskFilter === r ? { backgroundColor: "hsl(var(--primary))" } : {}}>
                  {r === "all" ? "All Risk" : r}
                </button>
              ))}
            </div>
          )}
          <AdminTxnTable rows={tab === "suspicious" ? suspicious : txns} showReasons={tab === "suspicious"} />
        </div>
      ) : null}
    </div>
  );
}

function AdminTxnTable({ rows, showReasons }) {
  if (!rows || rows.length === 0) {
    return <EmptyState icon={ShieldAlert} title="Nothing to show" description="No transactions match this view." />;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="admin-transactions-table">
          <thead>
            <tr className="border-b border-border bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-6 py-3 font-semibold">User</th>
              <th className="px-6 py-3 font-semibold">Type</th>
              <th className="px-6 py-3 font-semibold">Date</th>
              <th className="px-6 py-3 font-semibold">Risk</th>
              {showReasons && <th className="px-6 py-3 font-semibold">Reasons</th>}
              <th className="px-6 py-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const meta = TXN_META[t.type];
              return (
                <tr key={t.id} className="border-b border-border align-top hover:bg-secondary/40" data-testid="admin-txn-row">
                  <td className="px-6 py-4"><p className="font-medium text-foreground">{t.ownerName}</p><p className="text-xs text-muted-foreground">{t.accountNumber}</p></td>
                  <td className="px-6 py-4 text-muted-foreground">{meta.label}</td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDateTime(t.createdAt)}</td>
                  <td className="px-6 py-4"><RiskBadge level={t.riskLevel} /></td>
                  {showReasons && (
                    <td className="px-6 py-4">
                      <ul className="list-inside list-disc text-xs text-muted-foreground">
                        {(t.fraudReasons || []).map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </td>
                  )}
                  <td className={`px-6 py-4 text-right font-heading font-bold tabular ${meta.tone}`}>{meta.sign}{formatINR(t.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
