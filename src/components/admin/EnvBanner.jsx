import { ShieldCheck, FlaskConical } from "lucide-react";

// Environment strip for the Control Center. Always visible so every operator
// knows what they are operating on. "Enforced" means the server (RLS +
// admin_accounts) verified this principal — the local workspace has no server
// and says so outright, on every screen.

const ENV_LOGO = {
  local: FlaskConical,
  preview: FlaskConical,
  production: ShieldCheck,
};

export default function EnvBanner({ env, localLabel = "LOCAL WORKSPACE" }) {
  const Icon = ENV_LOGO[env?.name] || ShieldCheck;
  const local = !env?.hosted;
  const style = local
    ? "bg-amber-500/15 text-amber-300 border-amber-400/30"
    : env?.name === "production"
      ? "bg-teal-500/10 text-teal-300 border-teal-400/30"
      : "bg-sky-500/10 text-sky-300 border-sky-400/30";

  return (
    <div className={`px-4 py-1.5 border-b text-[11px] font-mono tracking-wide flex items-center gap-2 ${style}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="uppercase tracking-[0.25em]">{local ? localLabel : env.label}</span>
      <span className="mx-1 opacity-50">·</span>
      {local ? (
        <span className="opacity-80">auth is DEV-ONLY — NOT server-enforced</span>
      ) : (
        <span className="opacity-80 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" /> server-enforced admin gate active
        </span>
      )}
    </div>
  );
}