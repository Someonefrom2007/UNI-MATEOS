// Grade Engine — deterministic weighted grade calculations.
// Grades on 0–10 scale. Weights as percentages (0–100).

export const GRADE_BANDS = [
  { min: 9.0, max: 10, label: "Sobresaliente", en: "Outstanding", cls: "text-emerald-400" },
  { min: 7.0, max: 8.999, label: "Notable", en: "Notable", cls: "text-cyan-400" },
  { min: 5.0, max: 6.999, label: "Aprobado", en: "Pass", cls: "text-amber-400" },
  { min: 0, max: 4.999, label: "Suspenso", en: "Fail", cls: "text-rose-400" },
];

export const gradeBand = (g) => {
  if (g === null || g === undefined || Number.isNaN(g)) return null;
  return GRADE_BANDS.find((b) => g >= b.min && g <= b.max) || GRADE_BANDS[3];
};

// Weighted course grade from assessments (grades + weights).
// assessments: [{ grade: number|null, weight: number }]
export const courseGrade = (assessments) => {
  const scored = assessments.filter((a) => a.grade !== null && a.grade !== undefined && !Number.isNaN(a.grade) && a.weight > 0);
  if (!scored.length) return null;
  const totalWeight = scored.reduce((s, a) => s + a.weight, 0);
  if (totalWeight === 0) return null;
  const weighted = scored.reduce((s, a) => s + a.grade * a.weight, 0);
  return weighted / totalWeight;
};

// Total weight of all defined assessments (graded + ungraded).
export const totalWeight = (assessments) => assessments.reduce((s, a) => s + (a.weight || 0), 0);

// Required grade on remaining assessments to reach a target.
export const requiredGrade = (assessments, target) => {
  const graded = assessments.filter((a) => a.grade !== null && a.grade !== undefined && !Number.isNaN(a.grade) && a.weight > 0);
  const remaining = assessments.filter((a) => (a.grade === null || a.grade === undefined || Number.isNaN(a.grade)) && a.weight > 0);
  if (!remaining.length) return null;
  const gradedWeight = graded.reduce((s, a) => s + a.weight, 0);
  const remainingWeight = remaining.reduce((s, a) => s + a.weight, 0);
  const gradedPoints = graded.reduce((s, a) => s + a.grade * a.weight, 0);
  const needed = (target * (gradedWeight + remainingWeight) - gradedPoints) / remainingWeight;
  return Math.max(0, Math.min(10, needed));
};

// Projected final if a hypothetical grade is achieved on remaining assessments.
export const projectedGrade = (assessments, hypothetical) => {
  const graded = assessments.filter((a) => a.grade !== null && a.grade !== undefined && !Number.isNaN(a.grade) && a.weight > 0);
  const remaining = assessments.filter((a) => (a.grade === null || a.grade === undefined || Number.isNaN(a.grade)) && a.weight > 0);
  const totalW = graded.reduce((s, a) => s + a.weight, 0) + remaining.reduce((s, a) => s + a.weight, 0);
  if (totalW === 0) return null;
  const points = graded.reduce((s, a) => s + a.grade * a.weight, 0) + remaining.reduce((s, a) => s + hypothetical * a.weight, 0);
  return points / totalW;
};

// ECTS-weighted average across courses.
// courses: [{ ects, grade: number|null }]
export const ectsAverage = (courses) => {
  const valid = courses.filter((c) => c.grade !== null && c.grade !== undefined && !Number.isNaN(c.grade) && c.ects > 0);
  if (!valid.length) return null;
  const totalEcts = valid.reduce((s, c) => s + c.ects, 0);
  const points = valid.reduce((s, c) => s + c.grade * c.ects, 0);
  return points / totalEcts;
};