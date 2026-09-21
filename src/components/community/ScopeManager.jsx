import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Users, Plus, Trash2, UserPlus, Check } from "lucide-react";
import { COMMUNITY_KINDS, isMember, ownedScope, scopeLabel } from "@/lib/communityData";

export default function ScopeManager({
  communities = [],
  groups = [],
  members = [],
  courses = [],
  userId = "",
  onCreateCommunity,
  onCreateGroup,
  onToggleMember,
  onDeleteScope,
}) {
  const [cName, setCName] = useState("");
  const [cKind, setCKind] = useState("course");
  const [cCourse, setCCourse] = useState("none");
  const [gName, setGName] = useState("");
  const [gCommunity, setGCommunity] = useState("none");
  const [gCourse, setGCourse] = useState("none");

  const submitCommunity = () => {
    if (!cName.trim()) return;
    onCreateCommunity({ kind: cKind, name: cName.trim(), courseId: cCourse === "none" ? "" : cCourse });
    setCName("");
    setCCourse("none");
  };

  const submitGroup = () => {
    if (!gName.trim()) return;
    onCreateGroup({ name: gName.trim(), communityId: gCommunity === "none" ? "" : gCommunity, courseId: gCourse === "none" ? "" : gCourse });
    setGName("");
    setGCommunity("none");
    setGCourse("none");
  };

  const renderScope = (scope, kind) => {
    const owned = ownedScope(scope, userId);
    const joined = isMember(members, kind, scope.id, userId);
    return (
      <div key={scope.id} className="flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2">
        <span className={`w-2 h-2 rounded-full ${owned ? "bg-primary" : "bg-hud-amber"}`} title={owned ? "You created this" : "Created by someone else"} />
        <span className="text-sm flex-1 truncate">{scopeLabel(scope)}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">{kind}</span>
        {owned ? (
          <Button size="sm" variant="ghost" onClick={() => onDeleteScope(scope, kind)} className="h-7 px-2 text-xs text-destructive hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
          </Button>
        ) : joined ? (
          <Button size="sm" variant="outline" onClick={() => onToggleMember(scope, kind)} className="h-7 px-2 text-xs">
            <Check className="w-3.5 h-3.5 mr-1" />Joined
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => onToggleMember(scope, kind)} className="h-7 px-2 text-xs">
            <UserPlus className="w-3.5 h-3.5 mr-1" />Join
          </Button>
        )}
      </div>
    );
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-primary" />
        <h2 className="um-label">Communities &amp; groups</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-3 rounded-xl border border-border/70 p-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Building2 className="w-4 h-4 text-hud-cyan" />
            Create a community
          </div>
          <div className="flex gap-2">
            <Select value={cKind} onValueChange={setCKind}>
              <SelectTrigger className="w-28" aria-label="Community kind"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMMUNITY_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder={cKind === "university" ? "Universitat de Barcelona" : "Algorithms community"} aria-label="Community name" />
          </div>
          {cKind === "course" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Linked course</Label>
              <Select value={cCourse} onValueChange={setCCourse}>
                <SelectTrigger aria-label="Linked course"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No course</SelectItem>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button size="sm" onClick={submitCommunity} disabled={!cName.trim()} className="w-full">
            <Plus className="w-4 h-4 mr-1" />Create community
          </Button>
        </div>

        <div className="space-y-3 rounded-xl border border-border/70 p-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Users className="w-4 h-4 text-hud-violet" />
            Create a study group
          </div>
          <Input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="Midterm squad" aria-label="Group name" />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Community</Label>
              <Select value={gCommunity} onValueChange={setGCommunity}>
                <SelectTrigger aria-label="Parent community"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {communities.map((c) => <SelectItem key={c.id} value={c.id}>{c.name || c.course_name || c.university_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Course</Label>
              <Select value={gCourse} onValueChange={setGCourse}>
                <SelectTrigger aria-label="Group course"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button size="sm" onClick={submitGroup} disabled={!gName.trim()} className="w-full">
            <Plus className="w-4 h-4 mr-1" />Create group
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 mt-4">
        {communities.map((c) => renderScope(c, "community"))}
      </div>
      <div className="grid grid-cols-1 gap-2 mt-2">
        {groups.map((g) => renderScope(g, "group"))}
      </div>
      {communities.length === 0 && groups.length === 0 && (
        <p className="text-sm text-muted-foreground mt-3">Nothing here yet — create a community to scope conversations, or a study group for a smaller circle.</p>
      )}
    </Card>
  );
}