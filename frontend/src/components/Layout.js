import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Wallet, ArrowLeftRight, Receipt, Users2, UserCog,
  ShieldAlert, LogOut, Landmark, Menu, X, ChevronRight,
} from "lucide-react";

const userNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/accounts", label: "Accounts", icon: Wallet },
  { to: "/banking", label: "Banking", icon: ArrowLeftRight },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/beneficiaries", label: "Beneficiaries", icon: Users2 },
  { to: "/profile", label: "Profile", icon: UserCog },
];

const adminNav = [
  { to: "/admin", label: "Admin Overview", icon: ShieldAlert },
];

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const nav = user?.role === "admin" ? [...adminNav, ...userNav] : userNav;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const initials = (user?.name || "U").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 transform bg-slate-900 text-slate-200 transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-800 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Landmark className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-heading text-lg font-extrabold leading-none text-white">SecureBank</p>
            <p className="text-[11px] text-slate-400">Trusted Digital Banking</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                data-testid={`nav-${item.label.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")}`}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`
                }
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                <ChevronRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-60" />
              </NavLink>
            );
          })}
        </nav>

        <div className="absolute inset-x-0 bottom-0 border-t border-slate-800 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-slate-800/60 px-3 py-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent font-heading text-sm font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white" data-testid="sidebar-user-name">{user?.name}</p>
              <p className="truncate text-xs text-slate-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            data-testid="logout-button"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-[18px] w-[18px]" /> Sign out
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-white/80 px-4 backdrop-blur-xl lg:px-8">
          <button
            className="rounded-md p-2 text-foreground hover:bg-secondary lg:hidden"
            onClick={() => setOpen((o) => !o)}
            data-testid="sidebar-toggle"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex-1">
            <p className="font-heading text-sm font-semibold text-muted-foreground">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          {user?.role === "admin" && (
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              Administrator
            </span>
          )}
        </header>
        <main className="flex-1 p-4 lg:p-8" key={location.pathname}>
          <div className="animate-fade-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
