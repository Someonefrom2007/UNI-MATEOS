import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

import { Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { isLocalWorkspace, loadLocalProfile, saveLocalProfile } from "@/lib/repo/select";

export default function Profile() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
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
        toast({ title: "Profile saved on this device" });
        return;
      }
      const { error } = await supabase.auth.updateUser({ data: form });
      if (error) throw error;
      toast({ title: "Profile saved" });
    } catch {
      toast({ title: "Couldn't save profile" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Profile" subtitle="Your academic identity and preferences." />
      <div className="max-w-2xl space-y-5">
        <Card className="p-5">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xl font-semibold text-white">
              {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-medium">{user?.full_name || "Student"}</div>
              <div className="text-sm text-muted-foreground">{user?.email}</div>
            </div>
          </div>
          {local && (
            <p className="text-xs text-muted-foreground mb-4">
              Local workspace — your profile is stored on this device only, so it opens even when you're offline.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-xs">University</Label><Input value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} aria-label="University" placeholder="Universitat de Barcelona" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Degree</Label><Input value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} aria-label="Degree" placeholder="Computer Science" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Year</Label>
              <Select value={form.year} onValueChange={(v) => setForm({ ...form, year: v })}>
                <SelectTrigger aria-label="Year"><SelectValue /></SelectTrigger>
                <SelectContent>{["1", "2", "3", "4", "5+"].map((y) => <SelectItem key={y} value={y}>Year {y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Target average</Label><Input type="number" step="0.1" max="10" value={form.target_gpa} onChange={(e) => setForm({ ...form, target_gpa: Number(e.target.value) })} aria-label="Target average" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Preferred focus (min)</Label>
              <Select value={String(form.preferred_focus)} onValueChange={(v) => setForm({ ...form, preferred_focus: Number(v) })}>
                <SelectTrigger aria-label="Preferred focus minutes"><SelectValue /></SelectTrigger>
                <SelectContent>{[25, 50, 90].map((m) => <SelectItem key={m} value={String(m)}>{m} min</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Language</Label>
              <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                <SelectTrigger aria-label="Language"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="es">Español</SelectItem><SelectItem value="ca">Català</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end mt-5">
            <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-2" />{saving ? "Saving…" : "Save"}</Button>
          </div>
        </Card>
      </div>
    </>
  );
}