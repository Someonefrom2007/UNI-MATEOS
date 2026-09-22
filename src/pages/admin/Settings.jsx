import { useState } from "react";
import { Settings, Save, ShieldAlert } from "lucide-react";

import { useAdmin } from "@/lib/admin/useAdmin";
import { can, PERMISSIONS, permissionsFor, ROLES } from "@/lib/admin/permissions";
import { SECTIONS } from "@/lib/admin/sections";
import { loadPrefs, savePrefs } from "@/lib/admin/prefs";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AdminSettings() {
  const { principal } = useAdmin();
  const { toast } = useToast();
  const mayManage = can(principal, PERMISSIONS.SETTINGS_MANAGE);

  const [prefs, setPrefs] = useState(loadPrefs);

  const save = () => {
    const ok = savePrefs(prefs);
    toast({
      title: ok ? "Preferences saved" : "Browser refused to store",
      description: ok
        ? "Applied immediately to this browser's console."
        : "localStorage is unavailable — the preferences won't persist.",
    });
  };

  const landing = SECTIONS.find((s) => s.id === prefs.landing) ? prefs.landing : "overview";
  const landingOptions = SECTIONS.filter((s) => s.id !== "overview");

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-teal-400/80">configure</div>
        <h1 className="font-display text-2xl font-semibold text-slate-50 mt-1 flex items-center gap-2">
          <Settings className="w-6 h-6 text-teal-400" /> Console settings
        </h1>
        <p className="text-sm text-slate-400 mt-1">Preferences for this browser's console. Product-wide configuration lives server-side, not here.</p>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4 max-w-xl">
        <label className="block text-sm">
          <span className="text-slate-400">Console display name</span>
          <Input
            value={prefs.displayName}
            onChange={(e) => setPrefs({ ...prefs, displayName: e.target.value })}
            className="mt-1"
            disabled={!mayManage}
          />
          <span className="text-[11px] text-slate-600 mt-1 block">Shown as the Control Center title in the console sidebar.</span>
        </label>

        <label className="block text-sm">
          <span className="text-slate-400">Default section</span>
          <select
            value={landing}
            onChange={(e) => setPrefs({ ...prefs, landing: e.target.value })}
            disabled={!mayManage}
            className="mt-1 w-full h-9 rounded-md border border-white/10 bg-[#0c1426] px-2 text-sm"
          >
            <option value="overview">Overview (default)</option>
            {landingOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <span className="text-[11px] text-slate-600 mt-1 block">Opening the console root goes here instead of Overview.</span>
        </label>

        <Button onClick={save} disabled={!mayManage} className="bg-teal-600 hover:bg-teal-500">
          <Save className="w-4 h-4 mr-1.5" /> Save preferences
        </Button>

        <p className="text-[11px] text-slate-600 font-mono">
          Stored in localStorage (unimate:admin-prefs) per browser. Not audited — display preferences carry no security meaning.
        </p>
        {!mayManage && (
          <p className="text-[11px] text-amber-500/80 font-mono flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Read-only: settings.manage required.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5 max-w-xl">
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-400 mb-3">your access</div>
        <p className="text-sm text-slate-400">
          Signed in as <span className="font-mono text-xs text-slate-200">{principal?.id || "—"}</span>
        </p>
        <p className="text-sm text-slate-400 mt-1">
          Role: <span className="font-mono text-xs text-teal-300">{principal?.role || "none"}</span> ({principal?.source || "none"})
          {principal?.role === ROLES.SUPER_ADMIN && " — all permissions implied"}
        </p>
        <p className="text-sm text-slate-400 mt-1">
          Effective permissions: <span className="font-mono text-xs text-slate-300">{permissionsFor(principal?.role).join(", ") || "—"}</span>
        </p>
        <p className="text-[11px] text-slate-600 font-mono mt-3">
          Changing your own role is impossible from the console (guard_admin_role trigger). Roles are granted server-side only.
        </p>
      </section>
    </div>
  );
}