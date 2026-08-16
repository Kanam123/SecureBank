export const RISK_STYLES = {
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
  HIGH: "bg-red-100 text-red-800 border-red-200",
};

export function RiskBadge({ level }) {
  const style = RISK_STYLES[level] || RISK_STYLES.LOW;
  return (
    <span
      data-testid={`risk-badge-${level}`}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}
    >
      {level}
    </span>
  );
}

export const TXN_META = {
  deposit: { label: "Deposit", tone: "text-emerald-700", sign: "+" },
  transfer_in: { label: "Received", tone: "text-emerald-700", sign: "+" },
  withdraw: { label: "Withdrawal", tone: "text-red-600", sign: "-" },
  transfer_out: { label: "Transfer", tone: "text-red-600", sign: "-" },
};
