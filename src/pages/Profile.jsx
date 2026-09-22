import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

import { Save, Crown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { isLocalWorkspace, loadLocalProfile, saveLocalProfile } from "@/lib/repo/select";
import { usePlan } from "@/lib/usePlan";

export default function Profile() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const { tier } = usePlan();
  const local = isLocalWorkspace();
  const [form, setForm] = useState({ university: "", degree: "", year: "", target_gpa: 8, preferred_focus: 25, language: "en" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (local) {
      const p = loadLocalProfile() || {};
      setForm({
        university: p.university || "",
        degree: p.degree || "",
        year: p.year || "1",
        target_gpa: p.target_gpa ?? 8,
        preferred_focus: p.preferred_focus ?? 25,
        language: p.language || "en",
      });
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user?.user_metadata || {};
      setForm({
        university: u.university || "",
        degree: u.degree || "",
        year: u.year || "1",
        target_gpa: u.target_gpa ?? 8,
        preferred_focus: u.preferred_focus ?? 25,
        language: u.language || "en",
      });
    }).catch(() => {});
  }, [local]);

  const save = async () => {
    setSaving(true);
    try {
      if (local) {
        saveLocalProfile(form);
        toast({ title: t("profile.savedLocal") });
        return;
      }
      const { error } = await supabase.auth.updateUser({ data: form });
      if (error) throw error;
      toast({ title: t("profile.saved") });
    } catch {
      toast({ title: t("profile.couldntSave") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title={t("title.profile")} subtitle={t("title.profile.subtitle")} />
      <div className="max-w-2xl space-y-5">
        <Card className="p-5">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xl font-semibold text-white">
              {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-medium">{user?.full_name || t("profile.student")}</div>
              <div className="text-sm text-muted-foreground">{user?.email}</div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-hud-violet/10 text-hud-violet border border-hud-violet/30 flex items-center gap-1">
                  <Crown className="w-3 h-3" />{tier.label}
                </span>
                <Link to="/plans" className="text-xs text-hud-cyan hover:underline">{t("profile.managePlan")}</Link>
              </div>
            </div>
          </div>
          {local && (
            <p className="text-xs text-muted-foreground mb-4">
              {t("profile.localNote")}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-xs">{t("profile.fields.university")}</Label><Input value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} aria-label={t("profile.fields.university")} placeholder={t("profile.ph.university")} /></div>
            <div className="space-y-1.5"><Label className="text-xs">{t("profile.fields.degree")}</Label><Input value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} aria-label={t("profile.fields.degree")} placeholder={t("profile.ph.degree")} /></div>
            <div className="space-y-1.5"><Label className="text-xs">{t("profile.fields.year")}</Label>
              <Select value={form.year} onValueChange={(v) => setForm({ ...form, year: v })}>
                <SelectTrigger aria-label={t("profile.fields.year")}><SelectValue /></SelectTrigger>
                <SelectContent>{["1", "2", "3", "4", "5+"].map((y) => <SelectItem key={y} value={y}>{t("profile.yearValue")} {y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">{t("profile.fields.targetAverage")}</Label><Input type="number" step="0.1" max="10" value={form.target_gpa} onChange={(e) => setForm({ ...form, target_gpa: Number(e.target.value) })} aria-label={t("profile.fields.targetAverage")} /></div>
            <div className="space-y-1.5"><Label className="text-xs">{t("profile.fields.preferredFocus")}</Label>
              <Select value={String(form.preferred_focus)} onValueChange={(v) => setForm({ ...form, preferred_focus: Number(v) })}>
                <SelectTrigger aria-label={t("profile.fields.preferredFocus")}><SelectValue /></SelectTrigger>
                <SelectContent>{[25, 50, 90].map((m) => <SelectItem key={m} value={String(m)}>{m} min</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">{t("profile.fields.language")}</Label>
              <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                <SelectTrigger aria-label={t("profile.fields.language")}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="es">Español</SelectItem><SelectItem value="ca">Català</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end mt-5">
            <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-2" />{saving ? t("profile.saving") : t("profile.save")}</Button>
          </div>
        </Card>
      </div>
    </>
  );
}