// CRUD audit — fresh-state UI-driven create/read/update/delete per entity, with
// localStorage (local-workspace repo) persistence assertions and reload checks.
// Uses the QuickAdd dialog for creates and the dedicated pages for the rest.
import {
  launch, gap, goto,
  allowDialogs, clearAll, rowCount, tableRows, fillInput, fillByPlaceholder,
  chooseSelect, clickText, dialogChip, openQuickAdd, hasText, bodyText,
  RUN, check, resetRun, storeJson, summarize,
} from "./helpers.mjs";

const FUTURE_DATE = "2027-01-15";
const run = async () => {
  resetRun("crud");
  const { b, p } = await launch();
  const rec = { errorState: [] };
  let mon = null;

  // every page load wipes injected dialog overrides → re-apply after each nav
  const nav = async (_page, path, wait = 1400) => {
    await goto(p, path, wait);
    await allowDialogs(p);
  };

  const monitorStart = (pg) => {
    const m = { consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [] };
    pg.on("console", (x) => { if (x.type() === "error" && !/React DevTools|Sourcemap/i.test(x.text())) m.consoleErrors.push(x.text().slice(0, 160)); });
    pg.on("pageerror", (e) => m.pageErrors.push(String(e).slice(0, 160)));
    pg.on("requestfailed", (r) => m.failedRequests.push(r.url().slice(0, 120)));
    pg.on("response", (r) => { if (r.status() >= 400 && !/\.svg|\.png|favicon/i.test(r.url())) m.badResponses.push(`${r.status()} ${r.url().slice(0, 120)}`); });
    return m;
  };

  const setField = async (label, value) => {
    const ok = await p.evaluate(([a, v]) => {
      const els = [...document.querySelectorAll(`[aria-label="${a}"]`)];
      const n = els[els.length - 1];
      if (!n) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(n, v);
      n.dispatchEvent(new Event("input", { bubbles: true }));
      n.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, [label, value]);
    if (!ok) throw new Error(`CRUD: no [aria-label="${label}"] field`);
    await gap(120);
  };

  // robust click on element whose truncated text or name matches (cards w/ extra text)
  const clickFlex = async (needle, kind = "a, button, [role='button']") => {
    const ok = await p.evaluate(({ needle, kind }) => {
      const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
      const el = [...document.querySelectorAll(kind)].find((e) => {
        const t = norm(e.getAttribute("aria-label") || e.textContent);
        if (t === needle || t.startsWith(needle + " ") || t.endsWith(" " + needle)) return true;
        const kids = [...e.querySelectorAll("*")];
        return kids.some((d) => norm(d.textContent) === needle);
      });
      if (!el) return false;
      el.click();
      return true;
    }, { needle, kind });
    if (!ok) throw new Error(`CRUD hard-stop: could not click "${needle}"`);
    await gap(500);
    return ok;
  };

  const closeDlg = async () => {
    await p.keyboard.press("Escape");
    await gap(350);
  };

  const hardCheck = (k, cond, detail = "") => {
    check(k, !!cond, cond ? "" : detail);
    if (!cond && !rec.errorState.includes(k)) rec.errorState.push(k);
    if (!cond) {
      try { rec.fatal = detail; } catch {}
      throw new Error(`CRUD hard-stop: ${k}${detail ? " :: " + detail.slice(0, 200) : ""}`);
    }
  };

  try {
    await nav(p, "/dashboard", 2000);
    await allowDialogs(p);
    await clearAll(p);
    await nav(p, "/dashboard", 1800);
    const bootOk = (await p.evaluate(() => location.pathname)) === "/dashboard";
    check("QA-crud boot lands on dashboard after reset", bootOk);
    if (!bootOk) { await nav(p, "/login", 900); await nav(p, "/dashboard", 1500); }
    const today = await p.evaluate(() => new Date().toLocaleDateString("en-CA"));
    mon = monitorStart(p);

    // ---- Guard: empty QuickAdd task submit must NOT create a row ----
    await openQuickAdd(p, "Task");
    const guardPre = await rowCount(p, "tasks");
    await dialogChip(p, "Create Task");
    await gap(500);
    const guardPost = await rowCount(p, "tasks");
    check("QA-guard quickadd empty task not persisted", guardPost === guardPre, `${guardPre} -> ${guardPost}`);
    await closeDlg();

    // ---- Course ----
    await openQuickAdd(p, "Course");
    hardCheck("QA-crud course form opens", await fillInput(p, "Course name", "QACourse"), "no Course name input");
    await fillInput(p, "Code", "CS101");
    await fillInput(p, "ECTS", "6");
    await fillInput(p, "Target grade", "8.0");
    hardCheck("QA-crud course accent select", await chooseSelect(p, "Accent", "cyan"), "no Accent select");
    await dialogChip(p, "Create Course");
    await gap(700);
    check("QA-crud course navigates to /courses", (await p.evaluate(() => location.pathname)) === "/courses");
    const courses0 = await tableRows(p, "courses");
    const course0 = courses0.find((c) => c.name === "QACourse");
    hardCheck("QA-crud course persisted (name/code/color/ects/target)", course0 && course0.code === "CS101" && course0.color === "cyan" && Number(course0.ects) === 6 && Number(course0.target_grade) === 8, JSON.stringify(courses0));
    const courseId = course0.id;
    await nav(p, "/courses", 1400);
    hardCheck("QA-crud course survives reload", await hasText(p, "QACourse"));
    await clickFlex("QACourse");
    check("QA-crud course detail opens", (await p.evaluate(() => location.pathname)).startsWith("/courses/"));
    const detailTxt = (await bodyText(p)).toLowerCase();
    hardCheck("QA-crud course detail renders header + tabs", detailTxt.includes("cs101") && detailTxt.includes("at a glance") && detailTxt.includes("overview"), "missing detail text");
    await nav(p, "/dashboard", 1400);
    check("QA-crud dashboard hero empty state clears after course", !(await hasText(p, "Your semester starts here")));
    check("QA-crud dashboard PulseCard CTA is course-count aware (BUG: shows 'Add your first course' with courses present)", !(await hasText(p, "Add your first course")), "pulsecard CTA ignores course existence");
    await nav(p, "/courses", 1400);

    // ---- Task (linked) ----
    await openQuickAdd(p, "Task");
    hardCheck("QA-crud task form opens", await fillInput(p, "Title", "QATask"), "no Title input");
    hardCheck("QA-crud task course select", await chooseSelect(p, "Course", "QACourse"), "course select failed");
    await chooseSelect(p, "Priority", "high");
    await setField("Due", today);
    await dialogChip(p, "Create Task");
    await gap(700);
    check("QA-crud task navigates to /tasks", (await p.evaluate(() => location.pathname)) === "/tasks");
    const tasks1 = await tableRows(p, "tasks");
    const task1 = tasks1.find((t) => t.title === "QATask");
    hardCheck("QA-crud task persisted linked to course", task1 && task1.course_id === courseId && task1.priority === "high" && task1.due_date === today && task1.status === "todo", JSON.stringify(tasks1));
    await nav(p, "/tasks", 1400);
    hardCheck("QA-crud task survives reload (today view)", await hasText(p, "QATask"), (await bodyText(p)).slice(0, 200));
    await clickText(p, "Mark QATask as done");
    await gap(600);
    check("QA-crud task complete persists", (await tableRows(p, "tasks")).find((t) => t.id === task1.id)?.status === "completed");
    await clickText(p, "completed");
    await gap(400);
    await clickText(p, "Mark QATask as not done");
    await gap(500);
    check("QA-crud task uncomplete round-trip", (await tableRows(p, "tasks")).find((t) => t.id === task1.id)?.status === "todo");

    // ---- Exam (linked, must-have course+date) ----
    await openQuickAdd(p, "Exam");
    hardCheck("QA-crud exam form opens", await fillInput(p, "Exam name", "QAExam"), "no Exam name input");
    hardCheck("QA-crud exam course select", await chooseSelect(p, "Course", "QACourse"), "course select failed");
    await setField("Date", FUTURE_DATE);
    await fillInput(p, "Weight %", "30");
    await dialogChip(p, "Create Exam");
    await gap(700);
    check("QA-crud exam navigates to /exams", (await p.evaluate(() => location.pathname)) === "/exams");
    const exams1 = await tableRows(p, "exams");
    const exam1 = exams1.find((e) => e.name === "QAExam");
    hardCheck("QA-crud exam persisted linked + weighted", exam1 && exam1.course_id === courseId && exam1.date === FUTURE_DATE && Number(exam1.weight) === 30 && exam1.status === "upcoming", JSON.stringify(exams1));
    await nav(p, "/exams", 1400);
    hardCheck("QA-crud exam shows in Upcoming", await hasText(p, "QAExam"), "exam not on page");
    await p.evaluate(() => { window.prompt = () => "QATopicX"; });
    await clickFlex("QAExam");
    check("QA-crud exam detail opens", (await p.evaluate(() => location.pathname)).startsWith("/exams/"));
    await clickText(p, "Add topic");
    await gap(700);
    const exams2 = await tableRows(p, "exams");
    check("QA-crud exam topic added via prompt", Array.isArray(exams2.find((e) => e.id === exam1.id)?.topics) && exams2.find((e) => e.id === exam1.id).topics.some((t) => t.name === "QATopicX"), JSON.stringify(exams2.find((e) => e.id === exam1.id)?.topics));
    await clickText(p, "Mark QATopicX as reviewed");
    await gap(600);
    const topicRev = await tableRows(p, "exams").then((r) => r.find((e) => e.id === exam1.id)?.topics?.[0]);
    check("QA-crud exam topic reviewed pushes mastery to 100", topicRev?.reviewed === true && topicRev?.mastery === 100, JSON.stringify(topicRev));

    // ---- Grade (linked) ----
    await openQuickAdd(p, "Grade");
    hardCheck("QA-crud grade form opens", await fillInput(p, "Assessment name", "QAGrade"), "no Assessment name input");
    hardCheck("QA-crud grade course select", await chooseSelect(p, "Course", "QACourse"), "course select failed");
    await fillInput(p, "Grade (0–10)", "8.5");
    await fillInput(p, "Weight %", "20");
    await dialogChip(p, "Create Grade");
    await gap(700);
    check("QA-crud grade navigates to /grades", (await p.evaluate(() => location.pathname)) === "/grades");
    const grades1 = await tableRows(p, "grades");
    const grade1 = grades1.find((g) => g.name === "QAGrade");
    hardCheck("QA-crud grade persisted (grade/weight/course/type-default)", grade1 && Number(grade1.grade) === 8.5 && Number(grade1.weight) === 20 && grade1.course_id === courseId && grade1.type === "assignment", JSON.stringify(grades1));
    await nav(p, "/grades", 1400);
    hardCheck("QA-crud grade table shows linked course", await hasText(p, "QACourse"), "course row missing on /grades");

    // ---- Note (Quill autosave) ----
    await openQuickAdd(p, "Note");
    hardCheck("QA-crud note form opens", await fillInput(p, "Title", "QANote"), "no Title input");
    await chooseSelect(p, "Course", "QACourse");
    await dialogChip(p, "Create Note");
    await gap(700);
    check("QA-crud note navigates to /notes", (await p.evaluate(() => location.pathname)) === "/notes");
    const notes1 = await tableRows(p, "notes");
    const note1 = notes1.find((n) => n.title === "QANote");
    hardCheck("QA-crud note persisted empty + linked", note1 && note1.course_id === courseId && note1.content === "" && note1.archived === false, JSON.stringify(notes1));
    await nav(p, "/notes", 1400);
    hardCheck("QA-crud note survives reload", await hasText(p, "QANote"));
    await clickFlex("QANote");
    const notePath = await p.evaluate(() => location.pathname);
    check("QA-crud note detail opens", notePath.startsWith("/notes/"), notePath);
    const ql = await p.$(".um-quill .ql-editor");
    hardCheck("QA-crud note quill editor present", !!ql);
    await ql.click();
    await p.keyboard.type("Hello from the QA audit. ", { delay: 8 });
    await gap(1600);
    const notes2 = await tableRows(p, "notes");
    const savedContent = (notes2.find((n) => n.id === note1.id)?.content || "").replace(/&nbsp;/g, " ");
    check("QA-crud note quill autosave persists content", savedContent.includes("Hello from the QA audit."), JSON.stringify(savedContent));
    await fillInput(p, "Note title", "QANote v2");
    await gap(1600);
    check("QA-crud note title autosave", (await tableRows(p, "notes")).find((n) => n.id === note1.id)?.title === "QANote v2");
    await clickText(p, "Pin note");
    await gap(1600);
    check("QA-crud note pin persists", (await tableRows(p, "notes")).find((n) => n.id === note1.id)?.pinned === true);
    await nav(p, "/notes", 1400);
    check("QA-crud note rename reflects after reload", await hasText(p, "QANote v2"), "title missing on /notes");
    await nav(p, notePath, 1400);
    await clickText(p, "Delete note");
    await gap(800);
    check("QA-crud note delete navigates to /notes", (await p.evaluate(() => location.pathname)) === "/notes");
    check("QA-crud note delete removes row", await rowCount(p, "notes") === 0, "notes not empty");

    // ---- Resource (linked course, type) ----
    await openQuickAdd(p, "Resource");
    hardCheck("QA-crud resource form opens", await fillInput(p, "Name", "QAResource"), "no Name input");
    await fillInput(p, "URL", "https://example.com/qa");
    await chooseSelect(p, "Type", "pdf");
    await chooseSelect(p, "Course", "QACourse");
    await dialogChip(p, "Create Resource");
    await gap(700);
    check("QA-crud resource navigates to /resources", (await p.evaluate(() => location.pathname)) === "/resources");
    const res1 = await tableRows(p, "resources");
    const resRow = res1.find((r) => r.name === "QAResource");
    hardCheck("QA-crud resource persisted (type/url/course)", resRow && resRow.type === "pdf" && resRow.url === "https://example.com/qa" && resRow.course_id === courseId, JSON.stringify(res1));
    await nav(p, "/resources", 1400);
    hardCheck("QA-crud resource survives reload", await hasText(p, "QAResource"), "resource missing on page");

    // ---- Topic (linked course, mastery) ----
    await openQuickAdd(p, "Topic");
    hardCheck("QA-crud topic form opens", await fillInput(p, "Topic name", "QATopicA"), "no Topic name input");
    await chooseSelect(p, "Course", "QACourse");
    await dialogChip(p, "Create Topic");
    await gap(700);
    check("QA-crud topic navigates to /topics", (await p.evaluate(() => location.pathname)) === "/topics");
    const topics1 = await tableRows(p, "topics");
    const topic1 = topics1.find((t) => t.name === "QATopicA");
    hardCheck("QA-crud topic persisted (mastery 0, not reviewed)", topic1 && topic1.course_id === courseId && Number(topic1.mastery) === 0 && topic1.reviewed === false, JSON.stringify(topics1));
    await nav(p, "/topics", 1400);
    hardCheck("QA-crud topic appears grouped under course", await hasText(p, "QATopicA") && await hasText(p, "0% mastery"), (await bodyText(p)).slice(0, 240));
    const rangeOk = await p.evaluate(([name, v]) => {
      const el = document.querySelector(`input[aria-label="${name} mastery"]`);
      if (!el) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(v));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, ["QATopicA", "80"]);
    hardCheck("QA-crud topic mastery slider present", rangeOk, "no mastery range input");
    await gap(700);
    const topicAfter = await tableRows(p, "topics").then((r) => r.find((t) => t.id === topic1.id));
    check("QA-crud topic mastery + reviewed via slider", Number(topicAfter.mastery) === 80 && topicAfter.reviewed === true, JSON.stringify(topicAfter));

    // ---- Goal ----
    await openQuickAdd(p, "Goal");
    hardCheck("QA-crud goal form opens", await fillInput(p, "Goal", "QAGoal"), "no Goal input");
    await fillInput(p, "Target", "8");
    await dialogChip(p, "Create Goal");
    await gap(700);
    check("QA-crud goal navigates to /goals", (await p.evaluate(() => location.pathname)) === "/goals");
    const goals1 = await tableRows(p, "goals");
    const goal1 = goals1.find((g) => g.name === "QAGoal");
    hardCheck("QA-crud goal persisted (target 8, current 0)", goal1 && Number(goal1.target) === 8 && Number(goal1.current) === 0 && goal1.completed === false, JSON.stringify(goals1));
    await nav(p, "/goals", 1400);
    hardCheck("QA-crud goal page shows sheet 0/8", await hasText(p, "QAGoal") && await hasText(p, "0 / 8"), (await bodyText(p)).slice(0, 240));
    await clickText(p, "+1");
    await gap(600);
    check("QA-crud goal progress +1 persists", Number((await tableRows(p, "goals")).find((g) => g.id === goal1.id)?.current) === 1);

    // ---- Habit + log toggle ----
    await openQuickAdd(p, "Habit");
    hardCheck("QA-crud habit form opens", await fillInput(p, "Habit name", "QAHabit"), "no Habit name input");
    await dialogChip(p, "Create Habit");
    await gap(700);
    check("QA-crud habit navigates to /habits", (await p.evaluate(() => location.pathname)) === "/habits");
    const habits1 = await tableRows(p, "habits");
    const habit1 = habits1.find((h) => h.name === "QAHabit");
    hardCheck("QA-crud habit persisted (daily/7)", habit1 && habit1.frequency === "daily" && Number(habit1.target_per_week) === 7 && habit1.archived === false, JSON.stringify(habits1));
    await nav(p, "/habits", 1400);
    hardCheck("QA-crud habit survives reload", await hasText(p, "QAHabit"));
    hardCheck("QA-crud habit today cell present", await clickText(p, `Mark QAHabit done on ${today}`), "no today cell");
    await gap(700);
    const logs1 = await tableRows(p, "habit_logs");
    check("QA-crud habit toggle creates log row", !!logs1.find((l) => l.habit_id === habit1.id && l.date === today && l.completed === true), JSON.stringify(logs1));
    await clickText(p, `Mark QAHabit not done on ${today}`);
    await gap(600);
    check("QA-crud habit toggle removes log row", !(await tableRows(p, "habit_logs")).some((l) => l.habit_id === habit1.id && l.date === today));

    // ---- Sticky note ----
    await nav(p, "/stickies", 1400);
    await fillInput(p, "New sticky note", "QA sticky");
    await clickText(p, "Stick it");
    await gap(700);
    const st1 = await tableRows(p, "sticky_notes");
    const sticky1 = st1.find((s) => s.content === "QA sticky");
    hardCheck("QA-crud sticky persisted (amber)", sticky1 && sticky1.color === "amber" && !sticky1.pinned, JSON.stringify(st1));
    await nav(p, "/stickies", 1400);
    hardCheck("QA-crud sticky survives reload", await hasText(p, "QA sticky"));
    await clickFlex("QA sticky", "p[role='button']");
    await gap(250);
    hardCheck("QA-crud sticky edit field", await fillInput(p, "Edit note", "QA sticky v2"), "no edit textarea");
    await p.keyboard.press("Enter");
    await gap(600);
    check("QA-crud sticky edit persists", (await tableRows(p, "sticky_notes")).find((s) => s.id === sticky1.id)?.content === "QA sticky v2", "content not updated");
    const pinOk = await p.evaluate(() => {
      const btn = [...document.querySelectorAll("button[title='Pin']")][0];
      if (btn) { btn.click(); return true; }
      return false;
    });
    check("QA-crud sticky pin control present", pinOk);
    await gap(500);
    check("QA-crud sticky pin persists", (await tableRows(p, "sticky_notes")).find((s) => s.id === sticky1.id)?.pinned === true);
    const trashOk = await p.evaluate(() => {
      const btn = [...document.querySelectorAll("button[title='Throw away']")][0];
      if (btn) { btn.click(); return true; }
      return false;
    });
    check("QA-crud sticky delete control present", trashOk);
    await gap(600);
    check("QA-crud sticky delete removes row", await rowCount(p, "sticky_notes") === 0, "sticky remains");

    // ---- Schedule event ----
    await nav(p, "/schedule", 1400);
    await openQuickAdd(p, "Event");
    hardCheck("QA-crud event form opens", await fillInput(p, "Title", "QAEvent"), "no Title input");
    await chooseSelect(p, "Type", "study");
    await setField("Date", today);
    await setField("Start", "09:00");
    await setField("End", "10:30");
    await fillInput(p, "Location", "QA Library");
    await dialogChip(p, "Create Event");
    await gap(700);
    check("QA-crud event navigates to /schedule", (await p.evaluate(() => location.pathname)) === "/schedule");
    const events1 = await tableRows(p, "schedule_events");
    const event1 = events1.find((e) => e.title === "QAEvent");
    hardCheck("QA-crud event persisted (type/start/end/room)", event1 && event1.type === "study" && event1.start_time === "09:00" && event1.end_time === "10:30" && event1.room === "QA Library", JSON.stringify(events1));
    await nav(p, "/schedule", 1400);
    check("QA-crud schedule page renders after event", (await bodyText(p)).length > 200, "schedule page empty");

    // ---- Focus session (real 60s block) ----
    await nav(p, "/focus", 1400);
    await fillByPlaceholder(p, "What are you working on?", "QA focus block");
    await clickText(p, "Start");
    await gap(600);
    hardCheck("QA-crud focus timer starts", await hasText(p, "Focusing"));
    console.log("   [focus] waiting 61s for a real completed block…");
    await gap(61000);
    await clickText(p, "End");
    await gap(900);
    const focusRows = await tableRows(p, "focus_sessions");
    const focus1 = focusRows.find((f) => f.label === "QA focus block");
    hardCheck("QA-crud focus session persisted with duration", focus1 && Number(focus1.duration) >= 1 && focus1.date === today && focus1.completed === true, JSON.stringify(focusRows));
    await nav(p, "/focus", 1400);
    check("QA-crud focus recent session visible", await hasText(p, "QA focus block"), "recent label missing");

    // ---- Community post ----
    await nav(p, "/community", 1400);
    await clickText(p, "Share a question, tip, win, resource or event…");
    await gap(300);
    hardCheck("QA-crud post title field", await fillByPlaceholder(p, "How do you memorize formulas fast?", "QAPost"), "no post title input");
    hardCheck("QA-crud post body field", await fillByPlaceholder(p, "Give your classmates some context…", "QA post body for the audit"), "no post body textarea");
    await clickText(p, "Post");
    await gap(900);
    const posts1 = await tableRows(p, "community_posts");
    const post1 = posts1.find((x) => x.title === "QAPost");
    hardCheck("QA-crud community post persisted", post1 && (post1.content || "").includes("QA post body"), JSON.stringify(posts1));
    hardCheck("QA-crud post visible in feed", await hasText(p, "QAPost"), "post not rendered");
    await clickText(p, "Like post");
    await gap(700);
    check("QA-crud post like persists", (await tableRows(p, "community_likes")).some((l) => l.post_id === post1.id), "no like row");
    await clickText(p, "Remove like");
    await gap(600);
    check("QA-crud post unlike removes row", !(await tableRows(p, "community_likes")).some((l) => l.post_id === post1.id));
    await p.evaluate(() => { const b = [...document.querySelectorAll("article button")].find((x) => x.classList.contains("ml-auto")); if (b) b.click(); });
    await gap(500);
    hardCheck("QA-crud community post delete confirm two-step", await clickText(p, "Delete?"), "no Delete? confirm step");
    await gap(800);
    check("QA-crud community post delete removes row", !(await tableRows(p, "community_posts")).some((x) => x.id === post1.id), "post still present");

    // ---- Reload persistence sweep for all surviving entities ----
    for (const [table, needle] of [["courses", "QACourse"], ["tasks", "QATask"], ["exams", "QAExam"], ["grades", "QAGrade"], ["resources", "QAResource"], ["topics", "QATopicA"], ["goals", "QAGoal"], ["habits", "QAHabit"], ["schedule_events", "QAEvent"], ["focus_sessions", "QA focus block"]]) {
      const rows = await tableRows(p, table);
      check(`QA-crud survive-reload sweep [${table}] → ${needle}`, rows.some((r) => JSON.stringify(r).includes(needle)), `row missing in ${table}`);
    }

    // ---- Course delete (linked children remain unlinked — documented behavior) ----
    await nav(p, `/courses/${courseId}`, 1400);
    await clickText(p, "Delete course");
    await gap(900);
    check("QA-crud course delete removes course row", await rowCount(p, "courses") === 0, "course still present");
    check("QA-crud course delete leaves linked task unlinked (not cascade)", (await tableRows(p, "tasks")).some((t) => t.title === "QATask"), "task was cascade-deleted");

    const s = summarize(mon);
    rec.totals = s;
    check("QA-crud zero console/page errors", s.consoleErrors === 0 && s.pageErrors === 0, JSON.stringify(s.errors));
    check("QA-crud zero failed/bad requests", s.failedRequests === 0 && s.badResponses === 0, JSON.stringify({ failed: s.failedRequests, bad: s.badResponses }));
  } catch (err) {
    rec.fatal = String((err && err.stack) || err);
    if (!rec.errorState.length) rec.errorState.push("fatal");
  } finally {
    try { await p.screenshot({ path: new URL(`crud-${Date.now()}.png`, import.meta.url).pathname, fullPage: true }); } catch {}
    await b.close();
  }
  rec.final = { passed: RUN.checks.filter((c) => c.ok).length, failed: RUN.checks.filter((c) => !c.ok).length, total: RUN.checks.length };
  await storeJson("crud-report.json", rec);
  process.stdout.write(`\nCRUD audit done: ${rec.final.passed}/${rec.final.total} passed, ${rec.final.failed} failed${rec.fatal ? "\nFATAL: " + rec.fatal.slice(0, 400) : ""}\n`);
};

await run();