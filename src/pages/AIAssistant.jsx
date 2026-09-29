import { useState, useRef, useEffect } from "react";
import { useUserData } from "@/lib/useUserData";
import PageHeader from "@/components/PageHeader";
import PlanLocked from "@/components/PlanLocked";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Send, Sparkles, Loader2, WifiOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isLocalWorkspace } from "@/lib/repo/select";
import { todayISO } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { usePlan } from "@/lib/usePlan";
import { useFeatureFlags } from "@/lib/useFeatureFlags";
import ErrorState from "@/components/ErrorState";
import { AI_STATUS, classifyInvokeResult, isHeuristic, offlineResponse } from "@/lib/aiAssistant";

const SUGGESTIONS = [
  "What should I do today?",
  "Build me a study plan",
  "Summarise my notes",
  "Make flashcards",
  "What's coming up this week?",
  "How much work do I have?",
];

export default function AIAssistant() {
  const { data, error, refresh } = useUserData();
  const { t } = useI18n();
  const { can } = usePlan();
  const { features, loaded } = useFeatureFlags();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // null until we know: OFFLINE_HEURISTIC from the start in local workspace,
  // ONLINE once a real reply lands, DEGRADED/UNAVAILABLE when it does not.
  // Annotated because useState would otherwise pin the literal type of the
  // initializer and reject every other status we assign below.
  const [status, setStatus] = useState(
    /** @type {string | null} */ (isLocalWorkspace() ? AI_STATUS.OFFLINE_HEURISTIC : null),
  );
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  if (error) return <ErrorState onRetry={refresh} />;

  /** Everything the heuristic generators may read, from the local workspace. */
  const localContext = () => ({
    tasks: data?.Task || [],
    courses: data?.Course || [],
    exams: data?.Exam || [],
    notes: data?.Note || [],
    stickies: data?.StickyNote || [],
    focusSessions: data?.FocusSession || [],
    todayStr: todayISO(),
    hasData: Boolean(data && data.Course && data.Course.length),
  });

  // Server-side copilot is a Pro feature; the edge function enforces the same
  // rule, this screen just keeps the lock honest before a request is sent.
  if (!can("ai_assistant")) {
    return (
      <>
        <PageHeader title={t("title.ai")} subtitle={t("title.ai.subtitle")} />
        <PlanLocked
          feature="ai_assistant"
          description="The AI copilot answers from your real schedule, workload and grades, so it runs on UNI·MATE's servers — a Pro feature. Your free plan keeps everything you need to organize the semester."
        />
      </>
    );
  }

  // Operational flag/rollout gate (this is NOT an upgrade gate): the assistant
  // is temporarily unavailable for this account/environment while the flag is
  // off or the rollout hasn't reached it yet.
  const flagOpen = loaded ? Boolean(features.ai_assistant?.enabled) : true;
  if (!flagOpen) {
    return (
      <>
        <PageHeader title={t("title.ai")} subtitle={t("title.ai.subtitle")} />
        <div className="max-w-2xl rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-hud-amber/10 p-3 shrink-0">
              <BrainCircuit className="w-6 h-6 text-hud-amber" />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold">AI Assistant is temporarily unavailable</h2>
              <p className="text-sm text-muted-foreground mt-1">
                The assistant is rolling out in stages and hasn't reached your account yet. Your plan and data are unaffected — check back soon.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const ask = async (prompt) => {
    if (!prompt.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", text: prompt }]);
    setInput("");

    // Local workspace has no server at all, so the heuristic path is the only
    // path — answer from local data instead of refusing outright.
    if (isLocalWorkspace()) {
      const res = offlineResponse(prompt, localContext());
      setStatus(res.status);
      setMessages((m) => [...m, { role: "assistant", text: res.text, heuristic: res.heuristic }]);
      return;
    }

    setLoading(true);
    try {
      // The copilot runs server-side, grounded in your real UNI·MATE data.
      // The local "today" anchors its date math to the user's own timezone.
      const res = await supabase.functions.invoke("ai-assistant", {
        body: { question: prompt, today: todayISO() },
      });
      // invoke() resolves with {data, error} on a non-2xx; it only throws on a
      // transport failure. Classify both so a server 500 degrades to a local
      // answer instead of "try rephrasing".
      const outcome = classifyInvokeResult(res);
      if (outcome.status === AI_STATUS.ONLINE) {
        setStatus(AI_STATUS.ONLINE);
        setMessages((m) => [...m, { role: "assistant", text: outcome.reply }]);
      } else {
        const fallback = offlineResponse(prompt, { ...localContext(), status: outcome.status });
        setStatus(fallback.status);
        setMessages((m) => [...m, { role: "assistant", text: fallback.text, heuristic: true }]);
      }
    } catch {
      // Only a transport failure lands here.
      const fallback = offlineResponse(prompt, { ...localContext(), status: AI_STATUS.UNAVAILABLE });
      setStatus(fallback.status);
      setMessages((m) => [...m, { role: "assistant", text: fallback.text, heuristic: true }]);
    } finally {
      setLoading(false);
    }
  };

  const hasData = data && data.Course.length > 0;

  return (
    <>
      <PageHeader title={t("title.ai")} subtitle={t("title.ai.subtitle")} />
      <div className="max-w-3xl mx-auto">
        {status && isHeuristic(status) && (
          <div
            role="status"
            className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl border border-hud-amber/30 bg-hud-amber/5 text-xs text-hud-amber"
          >
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold tracking-wide">{status}</span>
            <span className="text-muted-foreground">
              — answers below are computed on this device from your own data, not by a model.
            </span>
          </div>
        )}
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <BrainCircuit className="w-7 h-7 text-primary" />
            </div>
            <h2 className="font-display text-xl font-medium">What can I help with?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {hasData
                ? "Ask about your schedule, workload, grades, or what to focus on next."
                : "Add a course or two first — the copilot only answers from your real data, never guesses."}
            </p>
            {status && isHeuristic(status) && (
              <p className="text-xs text-hud-amber mt-2">
                Still useful without a server: ask for a priority order, a study plan, or flashcards.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} className="text-left px-4 py-3 rounded-xl border border-border bg-card glow-hover hover:bg-accent/5 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary shrink-0" /> {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div className="space-y-4 mb-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                  {m.heuristic && (
                    <div className="text-[10px] uppercase tracking-wide text-hud-amber mb-1.5 font-semibold">
                      Heuristic · on-device
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{m.text}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div aria-live="polite" className="flex justify-start">
                <div className="bg-card border border-border px-4 py-3 rounded-2xl flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Thinking…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2 sticky bottom-4">
          <input value={input} onChange={(e) => setInput(e.target.value)} aria-label="Ask anything about your semester" placeholder="Ask anything about your semester…" className="flex-1 px-4 py-3 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-primary/40" />
          <Button type="submit" aria-label="Send question" disabled={loading || !input.trim()} className="rounded-xl px-4"><Send className="w-4 h-4" /></Button>
        </form>
      </div>
    </>
  );
}