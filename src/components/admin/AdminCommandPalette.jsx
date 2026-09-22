import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, ArrowRight, CornerDownLeft } from "lucide-react";
import { can } from "@/lib/admin/permissions";
import { commandIndex, searchIndex, pushRecent } from "@/lib/admin/search";

const ROUTE_LINK = (path, to) => (to ? `${path}${to}` : path);
const RECENT_KEY = "unimate:admin-recent";

const loadRecent = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
};

/**
 * Console ⌘K. Searches only the registry built from SECTIONS — every result
 * carries the permission needed to open it and is filtered by the caller's
 * principal, so restricted sections never even appear.
 */
export default function AdminCommandPalette({ open, onClose, principal, sections }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [recent, setRecent] = useState(loadRecent);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const index = useMemo(
    () => commandIndex({ routeLink: ROUTE_LINK, sections: sections || [] }),
    [sections]
  );

  const results = useMemo(() => {
    const visible = index.filter((i) => can(principal, i.permission));
    if (q.trim()) return searchIndex(visible, q);
    return recent
      .map((href) => visible.find((i) => i.href === href))
      .filter(Boolean)
      .slice(0, 6);
  }, [index, q, recent, principal]);

  useEffect(() => setSel(0), [q, results.length]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 40);
    else setQ("");
  }, [open]);

  const run = useCallback((item) => {
    if (!item) return;
    setRecent(pushRecent(loadRecent(), item.href));
    localStorage.setItem(RECENT_KEY, JSON.stringify(pushRecent(loadRecent(), item.href)));
    navigate(item.href);
    onClose();
  }, [navigate, onClose]);

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); run(results[sel]); }
  };

  let lastGroup = null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search console sections…"
            aria-label="Search Control Center"
            className="border-0 focus-visible:ring-0 h-14 text-base"
          />
          <span className="hud-mono text-muted-foreground/70 hidden sm:inline-flex">⌘K</span>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {!q.trim() && recent.length > 0 && (
            <div className="hud-mono px-3 pt-2 pb-1 text-muted-foreground/60">RECENT</div>
          )}
          {results.length === 0 && (
            <div aria-live="polite" className="px-3 py-8 text-center text-sm text-muted-foreground">
              {q.trim() ? `No results for "${q}"` : "Type to search"}
            </div>
          )}
          {results.map((item, i) => {
            const showHeader = item.group !== lastGroup && Boolean(q.trim());
            lastGroup = item.group;
            return (
              <div key={`${item.group}-${item.id}-${item.label}`}>
                {showHeader && (
                  <div className="hud-mono px-3 pt-2 pb-1 text-muted-foreground/60">{item.group}</div>
                )}
                <button
                  onMouseEnter={() => setSel(i)}
                  onClick={() => run(item)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${i === sel ? "bg-accent/10 ring-1 ring-accent/30" : "hover:bg-muted"}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.label}</div>
                    <div className="text-xs text-muted-foreground truncate font-mono">{item.href}</div>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.group}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
          <span>↑↓ navigate</span><span>↵ select</span><span>esc close</span>
          <span className="ml-auto"><CornerDownLeft className="w-3 h-3 inline" /></span>
        </div>
      </DialogContent>
    </Dialog>
  );
}