import { useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/format";
import { UserCog, Loader2, Mail, Shield } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || "", phone: user?.phone || "", address: user?.address || "" });
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put("/users/profile", form);
      setUser(data.user);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const initials = (user?.name || "U").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-8" data-testid="profile-page">
      <div>
        <h1 className="font-heading text-3xl font-extrabold text-foreground">Profile</h1>
        <p className="mt-1 text-muted-foreground">Manage your personal information.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary font-heading text-2xl font-extrabold text-white">
            {initials}
          </div>
          <h2 className="mt-4 font-heading text-xl font-bold text-foreground">{user?.name}</h2>
          <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {user?.email}</p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold capitalize text-primary">
            <Shield className="h-3.5 w-3.5" /> {user?.role}
          </span>
          <p className="mt-4 text-xs text-muted-foreground">Member since {formatDate(user?.createdAt)}</p>
        </div>

        <form onSubmit={save} className="rounded-xl border border-border bg-white p-6 shadow-sm lg:col-span-2" data-testid="profile-form">
          <h2 className="mb-4 font-heading text-lg font-bold text-foreground">Personal details</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Full name</label>
              <input value={form.name} onChange={set("name")} data-testid="profile-name-input"
                className="w-full rounded-md border border-input bg-white px-3.5 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Email address</label>
              <input value={user?.email} disabled
                className="w-full cursor-not-allowed rounded-md border border-input bg-secondary px-3.5 py-2.5 text-muted-foreground" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">Phone</label>
                <input value={form.phone} onChange={set("phone")} data-testid="profile-phone-input"
                  className="w-full rounded-md border border-input bg-white px-3.5 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">Address</label>
                <input value={form.address} onChange={set("address")} data-testid="profile-address-input"
                  className="w-full rounded-md border border-input bg-white px-3.5 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="City, State" />
              </div>
            </div>
            <button type="submit" disabled={saving} data-testid="profile-save-button"
              className="flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 font-heading font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: "hsl(var(--primary))" }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCog className="h-4 w-4" />} Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
