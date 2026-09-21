// Goal progress — shared math for the Goals surface. `current` is clamped to
// the target so progress can never overflow 100%, and `achieved` is derived
// (a goal is complete at or past its target).
/**
 * @param {{target?: number, current?: number}} goal
 * @returns {{ pct: number, remaining: number, achieved: boolean }}
 */
export const goalProgress = (goal) => {
  const target = Math.max(0, Number(goal?.target) || 0);
  const current = Math.max(0, Number(goal?.current) || 0);
  const pct = target ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const remaining = Math.max(0, target - current);
  return { pct, remaining, achieved: target > 0 && current >= target };
};