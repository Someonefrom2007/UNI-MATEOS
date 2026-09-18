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

const relativeExam = (dateStr) => {
  if (!dateStr) return "date TBD";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  d.setHours(0, 0, 0, 0);
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

    const body = await req.json().catch(() => ({}));
    const question = typeof body?.question === "string" ? body.question.trim().slice(0, 2000) : "";
    if (!question) return json({ error: "A question is required" }, 400);

    const [courses, tasks, exams, grades, focusSessions, notes, resources, goals, habitLogs] = await Promise.all([
      supabase.from("courses").select("*").eq("user_id", user.id),
      supabase.from("tasks").select("*").eq("user_id", user.id),
      supabase.from("exams").select("*").eq("user_id", user.id),
      supabase.from("grades").select("*").eq("user_id", user.id),
      supabase.from("focus_sessions").select("*").eq("user_id", user.id),
      supabase.from("notes").select("*").eq("user_id", user.id),
      supabase.from("resources").select("*").eq("user_id", user.id),
      supabase.from("goals").select("*").eq("user_id", user.id),
      supabase.from("habit_logs").select("*").eq("user_id", user.id),
    ]);

    const todayStr = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().slice(0, 10);

    const activeCourses = (courses.data || []).filter((c) => !c.archived);
    const openTasks = (tasks.data || []).filter((t) => t.status !== "completed");
    const upcomingExams = (exams.data || []).filter((e) => e.status !== "completed");
    const weekFocus = (focusSessions.data || []).filter((s) => (s.date || "") >= weekAgoStr);
    const activeNotes = (notes.data || []).filter((n) => !n.archived);
    const studyGoals = (goals.data || []).filter((g) => !g.completed);
    const habitsDoneToday = (habitLogs.data || []).filter((l) => l.date === todayStr && l.completed).length;
    const courseName = (id) => activeCourses.find((c) => c.id === id)?.name;

    // Notes and resources are the student's own study material. Only their
    // titles (and course) go into the prompt: the full text would swamp the
    // context, and titles are what let the copilot point at the right one.
    const noteLines = activeNotes
      .slice(0, 25)
      .map((n) => `${n.title}${n.course_id ? ` (${courseName(n.course_id) || "course"})` : ""}`);
    const resourceLines = (resources.data || [])
      .slice(0, 25)
      .map((r) => `${r.name} [${r.type}]${r.course_id ? ` (${courseName(r.course_id) || "course"})` : ""}`);

    // Deterministic weighted grade per course (same logic as the client Grade Engine)
    const courseGrades = activeCourses.map((c) => {
      const scored = [
        ...(grades.data || []).filter((g) => g.course_id === c.id && g.grade !== null && g.grade !== undefined && g.weight > 0),
        ...(exams.data || []).filter((e) => e.course_id === c.id && e.grade !== null && e.grade !== undefined && e.weight > 0),
      ];
      const totalWeight = scored.reduce((s, a) => s + a.weight, 0);
      const grade = totalWeight > 0 ? scored.reduce((s, a) => s + a.grade * a.weight, 0) / totalWeight : null;
      return { name: c.name, code: c.code, target: c.target_grade, ects: c.ects || 0, grade };
    });

    const graded = courseGrades.filter((c) => c.grade !== null && c.ects > 0);
    const gpa = graded.length
      ? graded.reduce((s, c) => s + c.grade * c.ects, 0) / graded.reduce((s, c) => s + c.ects, 0)
      : null;

    const context = [
      `Today is ${todayStr}.`,
      `Courses: ${courseGrades.map((c) => `${c.name}${c.code ? ` (${c.code})` : ""} — target ${fmtGrade(c.target)}, current ${c.grade !== null ? fmtGrade(c.grade) : "no grades yet"}, ${c.ects} ECTS`).join("; ") || "none"}.`,
      `Overall grade average (ECTS-weighted): ${gpa !== null ? fmtGrade(gpa) : "no grades yet"}.`,
      `Open tasks: ${openTasks.map((t) => `${t.title} (due ${t.due_date || "—"}, priority ${t.priority})`).join("; ") || "none"}.`,
      `Upcoming exams: ${upcomingExams.map((e) => `${e.name} on ${e.date || "TBD"} (${relativeExam(e.date)})`).join("; ") || "none"}.`,
      `Focus sessions last 7 days: ${weekFocus.length}, total ${fmtDuration(weekFocus.reduce((s, f) => s + f.duration, 0))}.`,
      `Habits completed today: ${habitsDoneToday}.`,
      `Study goals: ${studyGoals.map((g) => `${g.name} (${g.current}/${g.target}${g.unit || ""}${g.deadline ? `, by ${g.deadline}` : ""})`).join("; ") || "none"}.`,
      `Notes: ${noteLines.join("; ") || "none"}.`,
      `Resources: ${resourceLines.join("; ") || "none"}.`,
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
        + `· ${weekFocus.length} focus session${weekFocus.length === 1 ? "" : "s"} in the last 7 days (${fmtDuration(weekFocus.reduce((s, f) => s + f.duration, 0))}).\n`
        + `· ${activeNotes.length} note${activeNotes.length === 1 ? "" : "s"} and ${(resources.data || []).length} resource${(resources.data || []).length === 1 ? "" : "s"} saved.\n\n`
        + "Connect an LLM model (OPENAI_API_KEY) for tailored advice.";
    }

    return json({ reply });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});