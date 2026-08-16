import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatINR } from "@/lib/format";
import { Spinner, EmptyState } from "@/components/States";
import { RiskBadge, TXN_META } from "@/components/Badges";
import {
  Wallet, ArrowDownLeft, ArrowUpRight, ShieldAlert, TrendingUp, Receipt,
  ArrowLeftRight, PlusCircle,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar,
} from "recharts";

function StatCard({ icon: Icon, label, value, tone, testid }) {
  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm" data-testid={testid}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      <p className="mt-4 font-heading text-2xl font-extrabold tracking-tight text-foreground tabular">{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/transactions/analytics");
        setData(data);
      } catch (err) {
        setError(apiError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner label="Loading your dashboard…" />;
  if (error) return <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>;

  const currency = (v) => `₹${new Intl.NumberFormat("en-IN").format(Math.round(v))}`;

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-foreground">
            Hello, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-muted-foreground">Here's your financial overview.</p>
        </div>
        <Link to="/banking" data-testid="dashboard-quick-transfer"
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 font-heading text-sm font-semibold text-white transition-transform active:scale-[0.98]"
          style={{ backgroundColor: "hsl(var(--primary))" }}>
          <ArrowLeftRight className="h-4 w-4" /> New Transaction
        </Link>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard testid="stat-balance" icon={Wallet} label="Total Balance" tone="bg-primary/10 text-primary" value={formatINR(data.totalBalance)} />
        <StatCard testid="stat-received" icon={ArrowDownLeft} label="Money Received" tone="bg-emerald-100 text-emerald-700" value={formatINR(data.totalReceived)} />
        <StatCard testid="stat-transferred" icon={ArrowUpRight} label="Money Transferred" tone="bg-amber-100 text-amber-700" value={formatINR(data.totalTransferred)} />
        <StatCard testid="stat-flagged" icon={ShieldAlert} label="Flagged Transactions" tone="bg-red-100 text-red-600" value={data.flaggedCount} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Trend chart */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:col-span-3" data-testid="chart-monthly-trend">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg font-bold text-foreground">Monthly Trends</h2>
              <p className="text-sm text-muted-foreground">Money in vs money out (last 6 months)</p>
            </div>
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.monthlyTrend} margin={{ left: -10, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" vertical={false} />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={currency} />
              <Tooltip formatter={(v) => formatINR(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 13 }} />
              <Line type="monotone" dataKey="moneyIn" name="Money In" stroke="#064E3B" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} animationDuration={900} />
              <Line type="monotone" dataKey="moneyOut" name="Money Out" stroke="#D97706" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} animationDuration={900} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Breakdown bar */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:col-span-2" data-testid="chart-type-breakdown">
          <h2 className="mb-1 font-heading text-lg font-bold text-foreground">By Category</h2>
          <p className="mb-4 text-sm text-muted-foreground">Total value per transaction type</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.typeBreakdown} margin={{ left: -10, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={currency} />
              <Tooltip formatter={(v) => formatINR(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 13 }} />
              <Bar dataKey="value" name="Amount" fill="#064E3B" radius={[6, 6, 0, 0]} animationDuration={900} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="rounded-xl border border-border bg-white shadow-sm" data-testid="recent-transactions">
        <div className="flex items-center justify-between border-b border-border p-6">
          <h2 className="font-heading text-lg font-bold text-foreground">Recent Activity</h2>
          <Link to="/transactions" className="text-sm font-semibold text-primary hover:underline">View all</Link>
        </div>
        {data.recentTransactions.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={Receipt} title="No transactions yet" description="Make a deposit or transfer to see activity here."
              action={<Link to="/banking" className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: "hsl(var(--primary))" }}><PlusCircle className="h-4 w-4" /> Start banking</Link>} />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data.recentTransactions.map((t) => {
              const meta = TXN_META[t.type];
              return (
                <div key={t.id} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-secondary/40">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${meta.sign === "+" ? "bg-emerald-100" : "bg-red-100"}`}>
                    {meta.sign === "+" ? <ArrowDownLeft className="h-5 w-5 text-emerald-700" /> : <ArrowUpRight className="h-5 w-5 text-red-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{t.description || meta.label}</p>
                    <p className="text-xs text-muted-foreground">{meta.label}{t.counterpartyName ? ` • ${t.counterpartyName}` : ""}</p>
                  </div>
                  {t.flagged && <RiskBadge level={t.riskLevel} />}
                  <p className={`font-heading font-bold tabular ${meta.tone}`}>{meta.sign}{formatINR(t.amount)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
