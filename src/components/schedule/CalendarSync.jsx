import { useState, useEffect, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { CalendarDays, RefreshCw, Unplug } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isLocalWorkspace } from "@/lib/repo/select";

const LOCAL = isLocalWorkspace();

export default function CalendarSync({ onSynced }) {
  const { toast } = useToast();
  const [connected, setConnected] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Connection status = whether the backend can reach the user's Google Calendar.
  const check = useCallback(async () => {
    if (LOCAL) {
      setLoading(false);
      return;
    }
    try {
      const res = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "check" },
      });
      setConfigured(Boolean(res.data?.configured));
      setConnected(Boolean(res.data?.connected));
      setEmail(res.data?.email || "");
    } catch {
      setConnected(false);
      setConfigured(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const landing = params.get("google");
    if (landing === "connected") {
      toast({ title: "Google Calendar connected", description: "Your events can now be pulled into the schedule." });
      const url = new URL(window.location.href);
      url.searchParams.delete("google");
      window.history.replaceState({}, "", url);
    } else if (landing === "error") {
      toast({ title: "Google connection didn't complete", description: "Close the tab and try again." });
      const url = new URL(window.location.href);
      url.searchParams.delete("google");
      window.history.replaceState({}, "", url);
    }
    if (!LOCAL) check();
  }, [check, toast]);

  const handleConnect = async () => {
    try {
      const res = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "connect" },
      });
      if (res.error) throw res.error;
      if (res.data?.redirectUrl) {
        window.location.href = res.data.redirectUrl;
        return;
      }
      setConnected(Boolean(res.data?.connected));
    } catch {
      toast({ title: "Couldn't start the Google connection. Try again." });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "sync" },
      });
      if (res.error) throw res.error;
      if (res.data?.connected === false) {
        toast({ title: "Google Calendar needs attention", description: res.data.message || "Reconnect to keep syncing." });
        setConnected(false);
      } else {
        toast({
          title: `Google Calendar synced — ${res.data?.created ?? 0} new, ${res.data?.updated ?? 0} updated.`,
          description: res.data?.skippedAllDay > 0 ? `${res.data.skippedAllDay} all-day events skipped (timetables are time-based).` : undefined,
        });
      }
      onSynced?.();
    } catch {
      toast({ title: "Sync failed. Try reconnecting Google Calendar." });
      setConnected(false);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "disconnect" },
      });
    } catch { /* already disconnected */ }
    setConnected(false);
    setEmail("");
    toast({ title: "Google Calendar disconnected." });
  };

  if (loading) {
    return <div className="surface-card h-[76px] mb-6 animate-pulse" />;
  }

  if (!configured && !LOCAL) {
    return (
      <div className="surface-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-medium">Google Calendar</div>
            <div className="text-xs text-muted-foreground">
              Not configured on this deployment — the sync function needs Google OAuth credentials server-side.
            </div>
          </div>
        </div>
        <span className="text-xs text-muted-foreground text-right sm:text-left">COMING SOON</span>
      </div>
    );
  }

  return (
    <div className="surface-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <CalendarDays className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="text-sm font-medium">Google Calendar</div>
          <div className="text-xs text-muted-foreground">
            {LOCAL
              ? "Available when connected to an account"
              : connected
                ? (email ? `Connected as ${email} — pull your upcoming Google events into this schedule.` : "Connected — pull your upcoming Google events into this schedule.")
                : "Connect your account to import upcoming Google events as personal events."}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:shrink-0">
        {LOCAL ? (
          <span className="text-xs text-muted-foreground text-right sm:text-left">Available when connected to an account</span>
        ) : connected ? (
          <>
            <Button size="sm" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleDisconnect}>
              <Unplug className="w-4 h-4" /> Disconnect
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={handleConnect}>
            <CalendarDays className="w-4 h-4" /> Connect
          </Button>
        )}
      </div>
    </div>
  );
}