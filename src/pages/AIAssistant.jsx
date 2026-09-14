import { useState, useRef, useEffect } from "react";
import { useUserData } from "@/lib/useUserData";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Send, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

const SUGGESTIONS = [
  "What should I do today?",
  "What's coming up this week?",
  "How am I doing this semester?",
  "Which course needs attention?",
  "How much work do I have?",
  "What grade do I need on my next exam?",
];

export default function AIAssistant() {
  const { data } = useUserData();
  const { t } = useI18n();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const ask = async (prompt) => {
    if (!prompt.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", text: prompt }]);
    setInput("");
    setLoading(true);
    try {
      // The copilot runs server-side, grounded in your real UNI·MATE data
      const res = await supabase.functions.invoke("ai-assistant", {
        body: { question: prompt },
      });
      const reply = res.data?.reply;
      setMessages((m) => [...m, { role: "assistant", text: reply || "I couldn't answer that — try rephrasing or adding more data to UNI·MATE." }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "I couldn't reach the assistant right now. Please try again." }]);
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
            <h2 className="font-display text-xl font-medium">What can I help with?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {hasData
                ? "Ask about your schedule, workload, grades, or what to focus on next."
                : "Add a course or two first — the copilot only answers from your real data, never guesses."}
            </p>
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
                  <div className="whitespace-pre-wrap">{m.text}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-card border border-border px-4 py-3 rounded-2xl flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Thinking…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2 sticky bottom-4">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything about your semester…" className="flex-1 px-4 py-3 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-primary/40" />
          <Button type="submit" disabled={loading || !input.trim()} className="rounded-xl px-4"><Send className="w-4 h-4" /></Button>
        </form>
      </div>
    </>
  );
}