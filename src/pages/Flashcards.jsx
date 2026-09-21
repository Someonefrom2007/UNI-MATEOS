import { useEffect, useState, useCallback, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import PlanLocked from "@/components/PlanLocked";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import { usePlan } from "@/lib/usePlan";
import { isLocalWorkspace, getAppRepo } from "@/lib/repo/select";
import { todayISO } from "@/lib/format";
import { createDeck, createCard, gradeCard, sessionQueue, sessionStats, answerMatches } from "@/lib/flashcards";
import { Layers, Plus, Trash2, Play, Eye, ArrowRight } from "lucide-react";

const LOCAL = isLocalWorkspace();
const repo = getAppRepo();

const listOrZero = async (table) => {
  try {
    return (await repo.list(table)) || [];
  } catch {
    return [];
  }
};

const GRADE_META = {
  again: { label: "Again", cls: "border-hud-rose/40 text-hud-rose hover:bg-hud-rose/10" },
  hard: { label: "Hard", cls: "border-hud-amber/40 text-hud-amber hover:bg-hud-amber/10" },
  good: { label: "Good", cls: "border-hud-cyan/40 text-hud-cyan hover:bg-hud-cyan/10" },
  easy: { label: "Easy", cls: "border-hud-emerald/40 text-hud-emerald hover:bg-hud-emerald/10" },
};

const courseName = (courses, id) => (courses.find((c) => c.id === id) || {}).name || "No course";

export default function Flashcards() {
  const { t } = useI18n();
  const { can } = usePlan();
  const { toast } = useToast();

  const [decks, setDecks] = useState([]);
  const [cards, setCards] = useState([]);
  const [courses, setCourses] = useState([]);
  const [deckId, setDeckId] = useState("");
  const [deckTitle, setDeckTitle] = useState("");
  const [deckCourse, setDeckCourse] = useState("none");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [session, setSession] = useState(null);

  const load = useCallback(async () => {
    const [d, c, co] = await Promise.all([
      listOrZero("flashcard_decks"),
      listOrZero("flashcards"),
      listOrZero("courses"),
    ]);
    setDecks(d);
    setCards(c);
    setCourses(co);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const deck = decks.find((d) => d.id === deckId) || null;
  const deckCards = useMemo(() => cards.filter((c) => c.deck_id === deckId), [cards, deckId]);
  const stats = useMemo(() => sessionStats(deckCards, todayISO()), [deckCards]);

  const selectDeck = (id) => {
    setDeckId(id);
    setSession(null);
  };

  if (!can("flashcards")) {
    return (
      <>
        <PageHeader title={t("title.flashcards")} subtitle={t("title.flashcards.subtitle")} />
        <PlanLocked
          feature="flashcards"
          description="Turn course notes into spaced-repetition cards — a Pro feature that plans exactly what to review so each session lands. Your free plan keeps the whole organizing core."
        />
      </>
    );
  }

  const createDeckHandler = async () => {
    if (!deckTitle.trim()) return;
    await repo.create("flashcard_decks", createDeck({ title: deckTitle.trim(), courseId: deckCourse === "none" ? "" : deckCourse }));
    setDeckTitle("");
    setDeckCourse("none");
    await load();
  };

  const deleteDeckHandler = async (id) => {
    await repo.delete("flashcard_decks", id);
    try {
      await repo.deleteWhere("flashcards", (r) => r.deck_id === id);
    } catch { /* hosted FK cascades; local orphans cleaned above */ }
    if (deckId === id) setDeckId("");
    await load();
  };

  const addCard = async () => {
    if (!front.trim() || !back.trim()) return;
    if (!deckId) {
      toast({ title: "Pick a deck first" });
      return;
    }
    await repo.create("flashcards", createCard({ deckId, front: front.trim(), back: back.trim() }));
    setFront("");
    setBack("");
    await load();
  };

  const deleteCard = async (id) => {
    await repo.delete("flashcards", id);
    await load();
  };

  const startSession = () => {
    const queue = sessionQueue(deckCards, todayISO());
    if (!queue.length) {
      toast({ title: "Nothing to review yet", description: "Add a few cards, or come back when the next batch is due." });
      return;
    }
    setSession({ queue, i: 0, flipped: false, answer: "" });
  };

  const reveal = () => {
    if (!session || session.flipped) return;
    setSession({ ...session, flipped: true });
  };

  const gradeInSession = async (grade) => {
    if (!session) return;
    const current = session.queue[session.i];
    const next = gradeCard(current, grade, { now: () => new Date().toISOString() });
    try {
      await repo.update("flashcards", current.id, {
        ease: next.ease,
        interval: next.interval,
        due_date: next.due_date,
        reviews: next.reviews,
        streak: next.streak,
        last_result: next.last_result,
      });
    } catch { /* a lost update just retries next session */ }
    const queue = session.queue.map((c) => (c.id === current.id ? next : c));
    const last = session.i + 1 >= queue.length;
    setSession({ ...session, queue, i: session.i + 1, flipped: false, answer: "", done: last });
    if (last) await load();
  };

  const closeSession = () => {
    setSession(null);
    load();
  };

  const current = session && !session.done ? session.queue[session.i] : null;
  const gradeCounts = session?.done
    ? session.queue.reduce((acc, c) => {
        acc[c.last_result] = (acc[c.last_result] || 0) + 1;
        return acc;
      }, {})
    : {};

  return (
    <>
      <PageHeader title={t("title.flashcards")} subtitle={t("title.flashcards.subtitle")} />
      <div className="max-w-4xl grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        <div className="space-y-4 h-fit">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-hud-violet" />
              <h2 className="um-label">Decks</h2>
            </div>
            <div className="space-y-2">
              <Input value={deckTitle} onChange={(e) => setDeckTitle(e.target.value)} placeholder="New deck title" aria-label="Deck title" />
              <Select value={deckCourse} onValueChange={setDeckCourse}>
                <SelectTrigger aria-label="Deck course"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No course</SelectItem>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" className="w-full" onClick={createDeckHandler} disabled={!deckTitle.trim()}>
                <Plus className="w-4 h-4 mr-1" />Create deck
              </Button>
            </div>
            <div className="space-y-1 mt-4">
              {decks.map((d) => (
                <div key={d.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer text-sm ${deckId === d.id ? "bg-accent/10 text-foreground" : "hover:bg-muted text-muted-foreground"}`}>
                  <button className="flex-1 text-left truncate" onClick={() => selectDeck(d.id)}>
                    {d.title}
                  </button>
                  <span className="text-xs text-muted-foreground">{cards.filter((c) => c.deck_id === d.id).length}</span>
                  <button onClick={() => deleteDeckHandler(d.id)} aria-label={`Delete ${d.title}`} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {decks.length === 0 && <p className="text-xs text-muted-foreground pt-1">No decks yet — create one to start drilling.</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {session ? (
            <Card className="p-6">
              {session.done ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-2xl bg-hud-emerald/10 flex items-center justify-center mx-auto mb-4">
                    <Play className="w-6 h-6 text-hud-emerald" />
                  </div>
                  <h3 className="font-display text-lg font-semibold">Session complete</h3>
                  <p className="text-sm text-muted-foreground mt-1">{session.queue.length} card{session.queue.length === 1 ? "" : "s"} reviewed</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {Object.entries(GRADE_META).map(([g, meta]) => (
                      session.queue.some((c) => c.last_result === g) && (
                        <span key={g} className={`text-xs px-2.5 py-1 rounded-full border ${meta.cls}`}>{meta.label}: {gradeCounts[g] || 0}</span>
                      )
                    ))}
                  </div>
                  <Button className="mt-6" onClick={closeSession}>Back to deck</Button>
                </div>
              ) : current ? (
                <>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                    <span>{current.deck_id === deckId ? deck?.title || "Deck" : "Deck"}</span>
                    <span>{session.i + 1} / {session.queue.length}</span>
                  </div>
                  <div className="min-h-44 flex items-center justify-center rounded-xl border border-border bg-muted/20 p-6">
                    {session.flipped ? (
                      <div className="text-center w-full">
                        <div className="um-label mb-2">Answer</div>
                        <p className="text-lg font-medium whitespace-pre-wrap">{current.back}</p>
                        {session.answer && (
                          <p className={`text-xs mt-3 ${answerMatches(current.back, session.answer) ? "text-hud-emerald" : "text-hud-amber"}`}>
                            Your answer: “{session.answer}” — {answerMatches(current.back, session.answer) ? "close" : "not an exact match"}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-center w-full">
                        <div className="um-label mb-2">Question</div>
                        <p className="text-lg font-medium whitespace-pre-wrap">{current.front}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                    {session.flipped ? (
                      Object.entries(GRADE_META).map(([g, meta]) => (
                        <Button key={g} size="sm" variant="outline" className={meta.cls} onClick={() => gradeInSession(g)}>
                          {meta.label}
                        </Button>
                      ))
                    ) : (
                      <>
                        <Input
                          value={session.answer}
                          onChange={(e) => setSession({ ...session, answer: e.target.value })}
                          placeholder="Type your answer…"
                          aria-label="Your answer"
                          className="flex-1 min-w-40"
                          onKeyDown={(e) => { if (e.key === "Enter") reveal(); }}
                        />
                        <Button size="sm" onClick={reveal}><Eye className="w-4 h-4 mr-1" />Reveal</Button>
                      </>
                    )}
                  </div>
                  <div className="text-center mt-4">
                    <button onClick={closeSession} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto">
                      <ArrowRight className="w-3 h-3" />End session early
                    </button>
                  </div>
                </>
              ) : null}
            </Card>
          ) : deck ? (
            <>
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold">{deck.title}</h2>
                    <p className="text-xs text-muted-foreground">{courseName(courses, deck.course_id)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={startSession} disabled={!deckCards.length}><Play className="w-4 h-4 mr-2" />Study now</Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  {[["Total", stats.total], ["Due today", stats.due], ["New", stats.fresh], ["Mastered", stats.mastered]].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-border/70 p-3">
                      <div className="text-2xl font-semibold">{value}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Plus className="w-4 h-4 text-primary" />
                  <h2 className="um-label">Add a card</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Front</Label>
                    <Textarea value={front} onChange={(e) => setFront(e.target.value)} rows={3} placeholder="Define: basis of a vector space" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Back</Label>
                    <Textarea value={back} onChange={(e) => setBack(e.target.value)} rows={3} placeholder="A set of linearly independent vectors that span the space" />
                  </div>
                </div>
                <div className="flex justify-end mt-3">
                  <Button onClick={addCard} disabled={!front.trim() || !back.trim()}>Add card</Button>
                </div>
              </Card>

              <Card className="p-5">
                <h2 className="um-label mb-3">{deckCards.length} card{deckCards.length === 1 ? "" : "s"}</h2>
                <div className="space-y-2">
                  {deckCards.map((c) => (
                    <div key={c.id} className="flex items-start gap-2 rounded-lg border border-border/70 p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.front}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{c.back}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide ${c.last_result ? (c.last_result === "again" ? "bg-hud-rose/10 text-hud-rose" : "bg-hud-emerald/10 text-hud-emerald") : "bg-muted text-muted-foreground"}`}>
                          {c.last_result || "new"}
                        </span>
                        <span className="text-xs text-muted-foreground">{Number(c.reviews) || 0}×</span>
                        <button onClick={() => deleteCard(c.id)} aria-label="Delete card" className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {deckCards.length === 0 && <p className="text-sm text-muted-foreground">No cards yet — add your first one and hit Study.</p>}
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-10 text-center">
              <Layers className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="font-medium mt-4">Pick or create a deck</p>
              <p className="text-sm text-muted-foreground mt-1">Decks group cards by course so review sessions stay focused.</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}