import { useState, useRef, useEffect } from "react";
import { useUserData } from "@/lib/useUserData";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Send, Sparkles, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { askAssistant, AiError, AI_UNAVAILABLE, AI_UNREACHABLE, AI_EMPTY } from "@/lib/aiService";
import ErrorState from "@/components/ErrorState";

const SUGGESTION_KEYS = [
  "ai.suggestion.today",
  "ai.suggestion.week",
  "ai.suggestion.semester",
  "ai.suggestion.attention",
  "ai.suggestion.workload",
  "ai.suggestion.grade",
];

// Service error kinds → the sentence the student reads. A local workspace and
// an unreachable server are different problems with different fixes, so they
// must not share one message.
const ERROR_KEYS = {
  [AI_UNAVAILABLE]: "ai.error.unavailable",
  [AI_UNREACHABLE]: "ai.error.unreachable",
  [AI_EMPTY]: "ai.error.empty",
};

export default function AIAssistant() {
  const { data, error, refresh } = useUserData();
  const { t } = useI18n();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  if (error) return <ErrorState onRetry={refresh} />;

  const ask = async (prompt) => {
    if (!prompt.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", text: prompt }]);
    setInput("");
    setLoading(true);
    try {
      const reply = await askAssistant(prompt);
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    } catch (err) {
      // Store the failure kind, not the sentence: the student can switch
      // language after a message is on screen, and a stored sentence would
      // stay in the language it was raised in.
      const kind = err instanceof AiError ? err.kind : AI_UNREACHABLE;
      setMessages((m) => [...m, { role: "assistant", errorKind: kind }]);
    } finally {
      setLoading(false);
    }
  };

  const hasData = data && data.Course.length > 0;

  return (
    <>
      <PageHeader title={t("title.ai")} subtitle={t("title.ai.subtitle")} />
      <div className="max-w-3xl mx-auto">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <BrainCircuit className="w-7 h-7 text-primary" />
            </div>
            <h2 className="font-display text-xl font-medium">{t("ai.help.title")}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t(hasData ? "ai.help.withData" : "ai.help.noData")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6">
              {SUGGESTION_KEYS.map((key) => (
                <button key={key} onClick={() => ask(t(key))} className="text-left px-4 py-3 rounded-xl border border-border bg-card glow-hover hover:bg-accent/5 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary shrink-0" /> {t(key)}
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
                  <div className="whitespace-pre-wrap">
                    {m.errorKind ? t(ERROR_KEYS[m.errorKind] || "ai.error.unreachable") : m.text}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div aria-live="polite" className="flex justify-start">
                <div className="bg-card border border-border px-4 py-3 rounded-2xl flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> {t("ai.thinking")}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2 sticky bottom-4">
          <input value={input} onChange={(e) => setInput(e.target.value)} aria-label={t("ai.input.label")} placeholder={t("ai.input.placeholder")} className="flex-1 px-4 py-3 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-primary/40" />
          <Button type="submit" aria-label={t("ai.send")} disabled={loading || !input.trim()} className="rounded-xl px-4"><Send className="w-4 h-4" /></Button>
        </form>
      </div>
    </>
  );
}