// Syllabus / LMS importer parser. Accepts a CSV paste (comma- or semicolon-
// separated, with or without a header row) or a JSON array of objects, and
// normalizes the rows into { courses, tasks, exams } ready for bulk insert.

const strip = (s) => (s === null || s === undefined ? "" : String(s).trim());
const lower = (s) => strip(s).toLowerCase();

export const parseDate = (v) => {
  const s = strip(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const splitLine = (line, sep) => {
  const out = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === sep && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map(strip);
};

const pickSep = (lines) => {
  const first = splitLine(lines[0], ",");
  const second = splitLine(lines[0], ";");
  return second.length > first.length ? ";" : ",";
};

const COLS = {
  0: "type",
  1: "name",
  2: "course",
  3: "code",
  4: "professor",
  5: "ects",
  6: "target",
  7: "color",
  8: "date",
  9: "weight",
  10: "priority",
  11: "duration",
};

const hasHeader = (row) => {
  const types = ["course", "task", "exam"];
  const first = lower(row[0]);
  return !types.includes(first);
};

const toRow = (cells) => {
  const out = {};
  cells.forEach((cell, i) => {
    const key = COLS[i];
    if (key && cell) out[key] = cell;
  });
  return out;
};

const normalize = (raw, errors) => {
  const row = {};
  const pick = (keys) => {
    for (const k of keys) if (raw[k] !== undefined && raw[k] !== null && strip(raw[k])) return raw[k];
    return "";
  };
  row.type = lower(pick(["type", "kind"]));
  row.name = pick(["name", "title"]);
  row.course = pick(["course", "courseCode", "course_code", "code"]);
  row.code = pick(["code", "courseCode", "course_code"]);
  row.professor = pick(["professor", "instructor", "teacher"]);
  row.ects = pick(["ects", "credits"]);
  row.target = pick(["target", "targetGrade", "target_grade", "goal"]);
  row.color = lower(pick(["color", "accent"]));
  row.date = pick(["date", "dueDate", "due_date", "deadline", "examDate", "exam_date"]);
  row.weight = pick(["weight"]);
  row.priority = lower(pick(["priority", "importance"]));
  row.duration = pick(["duration", "estimatedMinutes", "estimated_duration", "minutes"]);

  if (!row.type || !["course", "task", "exam"].includes(row.type)) {
    errors.push(`Row skipped — missing valid "type" (use course | task | exam): ${JSON.stringify(raw)}`);
    return null;
  }
  if (!row.name) {
    errors.push("Row skipped — a name/title is required for every row.");
    return null;
  }
  if (!row.code && !row.course && row.type !== "course") {
    errors.push(`Row "${row.name}" skipped — need a course code to link its deadline/exam.`);
    return null;
  }
  return row;
};

export const parseSyllabus = (text) => {
  const errors = [];
  const courses = [];
  const tasks = [];
  const exams = [];
  const trimmed = strip(text);

  if (!trimmed) return { courses, tasks, exams, errors: ["Nothing to import — the paste is empty."] };

  let rows = [];
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      if (!Array.isArray(arr)) throw new Error("not array");
      rows = arr;
    } catch {
      errors.push("Could not parse the JSON paste — expected an array of objects.");
      return { courses, tasks, exams, errors };
    }
  } else if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed);
      rows = Array.isArray(obj) ? obj : obj.rows || obj.items || [obj];
    } catch {
      errors.push("Could not parse the JSON paste.");
      return { courses, tasks, exams, errors };
    }
  } else {
    const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const sep = pickSep(lines);
    const matrix = lines.map((l) => splitLine(l, sep));
    const start = matrix.length && hasHeader(matrix[0]) ? 1 : 0;
    rows = matrix.slice(start).map(toRow);
  }

  rows.forEach((raw) => {
    const row = normalize(raw, errors);
    if (!row) return;
    const code = row.type === "course" ? (row.code || row.name) : (row.course || row.code);
    const date = parseDate(row.date);
    if (row.type === "course") {
      courses.push({
        name: row.name,
        code: strip(row.code),
        professor: row.professor,
        ects: Number(row.ects) || 0,
        target_grade: Number(row.target) || 7,
        color: ["amber", "cyan", "purple", "green", "rose", "blue"].includes(row.color) ? row.color : "amber",
        semester: "1",
        academic_year: "2025/26",
        archived: false,
        _link: lower(code),
      });
    } else if (row.type === "task") {
      tasks.push({
        title: row.name,
        course_link: lower(code),
        due_date: date,
        priority: ["low", "medium", "high", "urgent"].includes(row.priority) ? row.priority : "medium",
        estimated_duration: Number(row.duration) || 0,
        status: "todo",
      });
    } else {
      exams.push({
        name: row.name,
        course_link: lower(code),
        date,
        weight: Number(row.weight) || 0,
        type: "exam",
        status: "upcoming",
        topics: [],
      });
    }
  });

  return { courses, tasks, exams, errors };
};