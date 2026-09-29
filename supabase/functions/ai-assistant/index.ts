import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const isDate = (s) =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + "T00:00:00").getTime());

// Read a table defensively: any failure (e.g. a table not yet migrated in the
// hosted project) degrades to an empty list instead of taking the endpoint down.
const safeRead = async (supabase, table, userId) => {
  try {
    const { data } = await supabase.from(table).select("*").eq("user_id", userId);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

const fmtGrade = (g) =>
  g === null || g === undefined || Number.isNaN(g) ? "—" : Number(g).toFixed(2);

const fmtDuration = (minutes) => {
  if (!minutes || minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
};

const relativeExam = (dateStr, todayStr) => {
  if (!dateStr) return "date TBD";
  const today = new Date(todayStr + "T00:00:00");
  const d = new Date(dateStr + "T00:00:00");
  const n = Math.round((d - today) / 86400000);
  if (n < 0) return "past";
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  return `in ${n} days`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } }
    );
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (!user) return json({ error: "Unauthorized" }, 401);

    // Pro entitlement: the copilot is a paid feature, enforced server-side so a
    // modified client still can't call it on a free account.
    //
    // SECURITY: this must read a source the caller cannot write. It used to
    // read `user_metadata.plan`, which is part of the caller's own profile and
    // is client-writable via `supabase.auth.updateUser({ data: { plan } })` —
    // so the gate could be satisfied by the very client it was meant to stop.
    //
    // `subscriptions.tier` is the authoritative record: RLS grants SELECT-own
    // and no client INSERT/UPDATE, and it is written only by the
    // `lemon-squeezy` webhook using the service role.
    //
    // NOTE ON TRUST: this client carries the user's JWT in global.headers, so
    // every PostgREST call in this handler — including the one below and the
    // user's own courses/tasks/exams at line 24 — executes AS the user, under
    // RLS, not with the service role. That is the stronger arrangement, and it
    // is safe here: RLS pins reads to auth.uid() = user_id, and `user` is the
    // identity verified from that same JWT two lines up, so a caller can
    // neither read nor be denied another account's entitlement. The service
    // key is present on the client but no query in this function relies on it
    // to bypass RLS.
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("tier")
      .eq("user_id", user.id)
      .maybeSingle();
    const plan = String(sub?.tier || "free").toLowerCase();
    if (!["pro", "ultra", "ultimate"].includes(plan)) {
      return json({ locked: true, plan, error: "AI Assistant is a Pro feature" }, 402);
    }

    const body = await req.json().catch(() => ({}));
    const question = typeof body?.question === "string" ? body.question.trim().slice(0, 2000) : "";
    if (!question) return json({ error: "A question is required" }, 400);

    // Anchor "today" to the user's local day when the client provides it;
    // otherwise fall back to the server's UTC day.
    const todayStr = isDate(body?.today) ? body.today : isoDate(new Date());
    const weekAgo = new Date(todayStr + "T00:00:00");
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = isoDate(weekAgo);

    const [courses, tasks, exams, grades, focusSessions, topics] = await Promise.all([
      safeRead(supabase, "courses", user.id),
      safeRead(supabase, "tasks", user.id),
      safeRead(supabase, "exams", user.id),
      safeRead(supabase, "grades", user.id),
      safeRead(supabase, "focus_sessions", user.id),
      safeRead(supabase, "topics", user.id),
    ]);

    const activeCourses = courses.filter((c) => !c.archived);
    const openTasks = tasks.filter((t) => t.status !== "completed");
    const upcomingExams = exams.filter((e) => e.status !== "completed");
    const weekFocus = focusSessions.filter((s) => (s.date || "") >= weekAgoStr);

    // Deterministic weighted grade per course (same logic as the client Grade Engine)
    const courseGrades = activeCourses.map((c) => {
      const scored = [
        ...grades.filter((g) => g.course_id === c.id && g.grade !== null && g.grade !== undefined && g.weight > 0),
        ...exams.filter((e) => e.course_id === c.id && e.grade !== null && e.grade !== undefined && e.weight > 0),
      ];
      const totalWeight = scored.reduce((s, a) => s + a.weight, 0);
      const grade = totalWeight > 0 ? scored.reduce((s, a) => s + a.grade * a.weight, 0) / totalWeight : null;
      return { name: c.name, code: c.code, target: c.target_grade, ects: c.ects || 0, grade };
    });

    const graded = courseGrades.filter((c) => c.grade !== null && c.ects > 0);
    const gpa = graded.length
      ? graded.reduce((s, c) => s + c.grade * c.ects, 0) / graded.reduce((s, c) => s + c.ects, 0)
      : null;

    const topicStore = {};
    topics.forEach((tp) => {
      (topicStore[tp.course_id] = topicStore[tp.course_id] || []).push(tp);
    });
    const topicContext = activeCourses
      .map((c) => {
        const list = topicStore[c.id] || [];
        if (!list.length) return null;
        const avg = Math.round(list.reduce((s, tp) => s + (Number(tp.mastery) || 0), 0) / list.length);
        const weakest = list.slice().sort((a, b) => (Number(a.mastery) || 0) - (Number(b.mastery) || 0))[0];
        return `${c.name}: ${list.length} topic${list.length === 1 ? "" : "s"}, avg mastery ${avg}%, weakest "${weakest?.name || "unnamed"}"`;
      })
      .filter(Boolean);

    const context = [
      `Today is ${todayStr}.`,
      `Courses: ${courseGrades.map((c) => `${c.name}${c.code ? ` (${c.code})` : ""} — target ${fmtGrade(c.target)}, current ${c.grade !== null ? fmtGrade(c.grade) : "no grades yet"}, ${c.ects} ECTS`).join("; ") || "none"}.`,
      `Overall grade average (ECTS-weighted): ${gpa !== null ? fmtGrade(gpa) : "no grades yet"}.`,
      `Open tasks: ${openTasks.map((t) => `${t.title} (due ${t.due_date || "—"}, priority ${t.priority})`).join("; ") || "none"}.`,
      `Upcoming exams: ${upcomingExams.map((e) => `${e.name} on ${e.date || "TBD"} (${relativeExam(e.date, todayStr)})`).join("; ") || "none"}.`,
      `Focus sessions last 7 days: ${weekFocus.length}, total ${fmtDuration(weekFocus.reduce((s, f) => s + f.duration, 0))}.`,
      `Topic mastery: ${topicContext.join("; ") || "no topics recorded yet"}.`,
    ].join("\n");

    const sys = `You are the UNI·MATE academic copilot. You help a university student plan and understand their academic life. Use ONLY the provided real data — never invent grades, averages, deadlines, or statistics. If data is insufficient, say so honestly and suggest what to add. Be concise, calm, and specific. When you recommend something, briefly explain why based on the data.

Student's current UNI·MATE data:
${context}`;

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    let reply;
    if (apiKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: question },
          ],
          temperature: 0.4,
        }),
      });
      if (!res.ok) throw new Error("LLM request failed");
      const data = await res.json();
      reply = data.choices?.[0]?.message?.content?.trim() || "";
    }

    if (!reply) {
      // Deterministic fallback so the assistant still answers pre-launch.
      reply = "Here's what your semester looks like right now:\n\n"
        + `· ${courseGrades.length} active course${courseGrades.length === 1 ? "" : "s"} — ${gpa !== null ? `ECTS-weighted average of ${fmtGrade(gpa)}` : "no grades recorded yet"}.\n`
        + `· ${openTasks.length} open task${openTasks.length === 1 ? "" : "s"}${openTasks.length ? `, next due: ${openTasks.slice().sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))[0]?.due_date || "unscheduled"}` : ""}.\n`
        + `· ${upcomingExams.length} upcoming exam${upcomingExams.length === 1 ? "" : "s"}.\n`
        + `· ${weekFocus.length} focus session${weekFocus.length === 1 ? "" : "s"} in the last 7 days (${fmtDuration(weekFocus.reduce((s, f) => s + f.duration, 0))}).\n\n`
        + "Connect an LLM model (OPENAI_API_KEY) for tailored advice.";
    }

    return json({ reply });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});