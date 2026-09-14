// Grade simulator helpers — slider clamping and target-feasibility logic
// separated from the pinned gradeEngine so Grades.jsx component state is
// deterministic and testable.
import { requiredGrade } from "@/lib/gradeEngine";

// Clamp a raw slider value into the 0–10 range.
export const clampGrade = (v, min = 0, max = 10) => Math.max(min, Math.min(max, Number(v) || 0));

// Immutable update of a course → target map.
export const updateTargets = (targets = {}, id, value) => ({ ...targets, [id]: clampGrade(value) });

// Feasibility analysis for a target grade: the raw unclamped required score,
// whether the target is achievable, and the 0–10 clamped display value.
// Returns { remainingWeight, required, rawRequired, feasible }
export const targetFeasibility = (assessments = [], target = 8) => {
  const graded = assessments.filter((a) => a.grade !== null && a.grade !== undefined && !Number.isNaN(a.grade) && a.weight > 0);
  const remaining = assessments.filter((a) => (a.grade === null || a.grade === undefined || Number.isNaN(a.grade)) && a.weight > 0);
  const remainingWeight = remaining.reduce((s, a) => s + a.weight, 0);
  if (remainingWeight === 0) return { remainingWeight: 0, required: null, rawRequired: null, feasible: true };
  const gradedWeight = graded.reduce((s, a) => s + a.weight, 0);
  const gradedPoints = graded.reduce((s, a) => s + a.grade * a.weight, 0);
  const rawRequired = (target * (gradedWeight + remainingWeight) - gradedPoints) / remainingWeight;
  const required = Math.max(0, Math.min(10, rawRequired));
  const feasible = rawRequired <= 10 + 1e-9 && rawRequired >= -1e-9;
  return { remainingWeight, required, rawRequired, feasible };
};