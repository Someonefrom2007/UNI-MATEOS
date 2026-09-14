// Insight Engine — deterministic observations from real data. No fabrication.

export const generateInsights = ({ tasks = [], exams = [], focusSessions = [], courses = [], grades = [], habits = [], habitLogs = [] } = {}) => {
  const insights = [];

  // Task completion this week
  const now = new Date();
  const ws = new Date(now); ws.setDate(now.getDate() - now.getDay()); ws.setHours(0, 0, 0, 0);
  const wsStr = ws.toISOString().slice(0, 10);
  const weekTasks = tasks.filter((t) => t.completed_date && t.completed_date >= wsStr);
  const weekCreated = tasks.filter((t) => t.created_date && t.created_date.slice(0, 10) >= wsStr);
  if (weekCreated.length > 0) {
    const rate = Math.round((weekTasks.length / weekCreated.length) * 100);
    insights.push({
      id: "task-rate",
      category: "Productivity",
      text: `You completed ${weekTasks.length} of ${weekCreated.length} tasks this week (${rate}%).`,
      value: rate,
    });
  }

  // Focus trend (this week vs last week)
  const lastWs = new Date(ws); lastWs.setDate(lastWs.getDate() - 7);
  const lastWsStr = lastWs.toISOString().slice(0, 10);
  const thisWeekFocus = focusSessions.filter((s) => s.date >= wsStr).reduce((s, x) => s + x.duration, 0);
  const lastWeekFocus = focusSessions.filter((s) => s.date >= lastWsStr && s.date < wsStr).reduce((s, x) => s + x.duration, 0);
  if (lastWeekFocus > 0) {
    const pct = Math.round(((thisWeekFocus - lastWeekFocus) / lastWeekFocus) * 100);
    if (pct !== 0) {
      insights.push({
        id: "focus-trend",
        category: "Productivity",
        text: `Your focus time ${pct > 0 ? "increased" : "decreased"} ${Math.abs(pct)}% compared to last week.`,
        value: pct,
      });
    }
  }

  // Upcoming exam pressure
  const upcomingExams = exams.filter((e) => {
    if (e.status === "completed") return false;
    if (!e.date) return false;
    const n = Math.round((new Date(e.date + "T00:00:00").getTime() - now.getTime()) / 86400000);
    return n >= 0 && n <= 14;
  });
  if (upcomingExams.length) {
    const nearest = upcomingExams.sort((a, b) => a.date.localeCompare(b.date))[0];
    const course = courses.find((c) => c.id === nearest.course_id);
    const n = Math.round((new Date(nearest.date + "T00:00:00").getTime() - now.getTime()) / 86400000);
    insights.push({
      id: "exam-pressure",
      category: "Risk",
      text: `${course ? course.name + " — " : ""}${nearest.name} ${n === 0 ? "is today" : n === 1 ? "is tomorrow" : `in ${n} days`}.`,
      value: n,
    });
  }

  // Deadlines clustering
  const soon = tasks.filter((t) => {
    if (t.status === "completed" || !t.due_date) return false;
    const n = Math.round((new Date(t.due_date + "T00:00:00").getTime() - now.getTime()) / 86400000);
    return n >= 0 && n <= 5;
  });
  if (soon.length >= 3) {
    insights.push({
      id: "deadline-cluster",
      category: "Planning",
      text: `You have ${soon.length} deadlines within 5 days.`,
      value: soon.length,
    });
  }

  // Grade trend
  const graded = grades.filter((g) => g.grade !== null && g.grade !== undefined);
  if (graded.length >= 2) {
    const sorted = [...graded].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const recent = sorted.slice(-3);
    const older = sorted.slice(0, -3);
    if (older.length) {
      const rAvg = recent.reduce((s, g) => s + g.grade, 0) / recent.length;
      const oAvg = older.reduce((s, g) => s + g.grade, 0) / older.length;
      const diff = rAvg - oAvg;
      if (Math.abs(diff) >= 0.1) {
        insights.push({
          id: "grade-trend",
          category: "Academic",
          text: `Your average grade ${diff > 0 ? "increased" : "decreased"} from ${oAvg.toFixed(1)} to ${rAvg.toFixed(1)}.`,
          value: diff,
        });
      }
    }
  }

  // Habit consistency
  if (habits.length && habitLogs.length) {
    const completedToday = habitLogs.filter((l) => l.date === new Date().toISOString().slice(0, 10) && l.completed).length;
    if (completedToday > 0) {
      insights.push({
        id: "habits",
        category: "Productivity",
        text: `You've completed ${completedToday} of ${habits.length} habits today.`,
        value: completedToday,
      });
    }
  }

  return insights.sort((a, b) => (a.category === "Risk" ? -1 : 0));
};

// "What should I do now?" — explainable recommendation from real data.
export const recommendNow = ({ tasks, exams, courses, events }) => {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // 1. Critical: overdue tasks
  const overdue = tasks
    .filter((t) => t.status !== "completed" && t.due_date && t.due_date < todayStr)
    .sort((a, b) => (a.priority === "urgent" ? -1 : 1));
  if (overdue.length) {
    const t = overdue[0];
    return {
      title: t.title,
      course: courses.find((c) => c.id === t.course_id),
      estimate: t.estimated_duration || 30,
      reason: "This task is overdue.",
      taskId: t.id,
      kind: "task",
    };
  }

  // 2. Imminent exam — recommend weakest topic
  const upcomingExams = exams
    .filter((e) => e.status !== "completed" && e.date)
    .map((e) => ({ e, n: Math.round((new Date(e.date + "T00:00:00").getTime() - now.getTime()) / 86400000) }))
    .filter((x) => x.n >= 0 && x.n <= 7)
    .sort((a, b) => a.n - b.n);
  if (upcomingExams.length) {
    const { e, n } = upcomingExams[0];
    const course = courses.find((c) => c.id === e.course_id);
    const topics = (e.topics || []).filter((tp) => !tp.reviewed || (tp.mastery || 0) < 80);
    const topic = topics.sort((a, b) => (a.mastery || 0) - (b.mastery || 0))[0];
    return {
      title: topic ? `${e.name} — ${topic.name}` : e.name,
      course,
      estimate: 45,
      reason: `Exam ${n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`}${topic ? `; "${topic.name}" needs review` : ""}.`,
      examId: e.id,
      kind: "exam",
    };
  }

  // 3. Task due today/soon
  const dueSoon = tasks
    .filter((t) => t.status !== "completed" && t.due_date && t.due_date >= todayStr)
    .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
  if (dueSoon.length) {
    const t = dueSoon[0];
    return {
      title: t.title,
      course: courses.find((c) => c.id === t.course_id),
      estimate: t.estimated_duration || 30,
      reason: "This is your next deadline.",
      taskId: t.id,
      kind: "task",
    };
  }

  return null;
};