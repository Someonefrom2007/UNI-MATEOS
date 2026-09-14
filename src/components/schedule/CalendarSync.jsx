import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { CalendarDays, RefreshCw, Unplug } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function CalendarSync({ onSynced }) {
  const { toast } = useToast();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Connection status = whether the backend can reach the user's Google Calendar.
  const check = async () => {
    try {
      const res = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "check" },
      });
      setConnected(Boolean(res.data?.connected));
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    check();
  }, []);

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
      toast({
        title: `Google Calendar synced — ${res.data?.created ?? 0} new, ${res.data?.updated ?? 0} updated.`,
      });
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
    toast({ title: "Google Calendar disconnected." });
  };

  if (loading) {
    return <div className="surface-card h-[76px] mb-6 animate-pulse" />;
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
            {connected
              ? "Connected — pull your upcoming Google events into this schedule."
              : "Connect your account to import upcoming Google events as personal events."}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:shrink-0">
        {connected ? (
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