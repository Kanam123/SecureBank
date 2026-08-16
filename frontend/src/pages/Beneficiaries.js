import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { Spinner, EmptyState } from "@/components/States";
import { Users2, Plus, Trash2, Loader2, User } from "lucide-react";
import { toast } from "sonner";

export default function Beneficiaries() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", accountNumber: "", nickname: "" });
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/beneficiaries");
      setItems(data.beneficiaries);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!form.name || !form.accountNumber) return toast.error("Name and account number are required");
    setAdding(true);
    try {
      await api.post("/beneficiaries", form);
      toast.success("Beneficiary added");
      setForm({ name: "", accountNumber: "", nickname: "" });
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/beneficiaries/${id}`);
      toast.success("Beneficiary removed");
      setItems((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-8" data-testid="beneficiaries-page">
      <div>
        <h1 className="font-heading text-3xl font-extrabold text-foreground">Beneficiaries</h1>
        <p className="mt-1 text-muted-foreground">Save recipients for faster transfers.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <form onSubmit={add} className="rounded-xl border border-border bg-white p-6 shadow-sm" data-testid="beneficiary-form">
            <h2 className="font-heading text-lg font-bold text-foreground">Add beneficiary</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">Full name</label>
                <input value={form.name} onChange={set("name")} data-testid="beneficiary-name-input"
                  className="w-full rounded-md border border-input bg-white px-3.5 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Recipient name" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">Account number</label>
                <input value={form.accountNumber} onChange={set("accountNumber")} data-testid="beneficiary-account-input"
                  className="w-full rounded-md border border-input bg-white px-3.5 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="12-digit account number" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">Nickname <span className="font-normal text-muted-foreground">(optional)</span></label>
                <input value={form.nickname} onChange={set("nickname")} data-testid="beneficiary-nickname-input"
                  className="w-full rounded-md border border-input bg-white px-3.5 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="e.g. Landlord" />
              </div>
              <button type="submit" disabled={adding} data-testid="beneficiary-submit-button"
                className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-heading font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
                style={{ backgroundColor: "hsl(var(--primary))" }}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add beneficiary
              </button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-2">
          {loading ? (
            <Spinner label="Loading beneficiaries…" />
          ) : items.length === 0 ? (
            <EmptyState icon={Users2} title="No beneficiaries yet" description="Add a recipient to send money quickly." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2" data-testid="beneficiaries-list">
              {items.map((b) => (
                <div key={b.id} className="flex items-center gap-4 rounded-xl border border-border bg-white p-5 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading font-bold text-foreground">{b.nickname || b.name}</p>
                    {b.nickname && <p className="truncate text-xs text-muted-foreground">{b.name}</p>}
                    <p className="mt-0.5 text-sm tabular text-muted-foreground">{b.accountNumber}</p>
                  </div>
                  <button onClick={() => remove(b.id)} data-testid={`delete-beneficiary-${b.id}`}
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
