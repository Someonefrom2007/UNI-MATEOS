// UNI·MATE Control Center — system pulse.
//
// Honest health classification. A service is ONLY "operational" when the caller
// can point at a real positive signal (reachable/healthy). Everything else is a
// degraded/unavailable/not-configured/unknown state, reported explicitly. No
// state is ever invented because a page loaded.

export const PULSE = Object.freeze({
  OPERATIONAL: "operational",
  DEGRADED: "degraded",
  UNAVAILABLE: "unavailable",
  NOT_CONFIGURED: "not_configured",
  UNKNOWN: "unknown",
});

export const PULSE_LABELS = Object.freeze({
  [PULSE.OPERATIONAL]: "Operational",
  [PULSE.DEGRADED]: "Degraded",
  [PULSE.UNAVAILABLE]: "Unavailable",
  [PULSE.NOT_CONFIGURED]: "Not configured",
  [PULSE.UNKNOWN]: "Unknown",
});

const rank = { operational: 4, degraded: 3, not_configured: 2, unavailable: 1, unknown: 0 };

/**
 * Classify a service from real signals. Rules (deterministic, tested):
 *  - reachable === true  → operational (the caller must have actually probed)
 *  - reachable === false → unavailable
 *  - configured === false → not_configured (we are not pretending)
 *  - degraded information present → degraded
 *  - nothing known → unknown
 * @param {object} s
 * @param {boolean} [s.configured]
 * @param {boolean} [s.reachable]
 * @param {boolean} [s.degraded]
 * @returns {string} PULSE value
 */
export const classify = ({ configured, reachable, degraded } = {}) => {
  if (reachable === true && degraded !== true) return PULSE.OPERATIONAL;
  if (degraded === true && reachable === true) return PULSE.DEGRADED;
  if (reachable === false) return PULSE.UNAVAILABLE;
  if (degraded === true) return PULSE.DEGRADED;
  if (configured === false) return PULSE.NOT_CONFIGURED;
  return PULSE.UNKNOWN;
};

export const worstOf = (statuses = []) =>
  statuses.reduce((worst, s) => (rank[s] < rank[worst] ? s : worst), PULSE.OPERATIONAL);

/**
 * Compose a pulse check result for display.
 * @param {object} opts
 * @returns {{ id: string, label: string, status: string, detail?: string, check?: object }}
 */
export const check = ({ id, label, status, detail, check: probe }) => ({
  id,
  label,
  status,
  detail,
  check: probe,
});

/**
 * Run a suite of individual checks into an { items, overall } shape.
 * @param {Array<() => { id, label, status, detail? }>} checkers
 * @returns {{ items: Array<{id,label,status,detail?}>, overall: string }}
 */
export const runPulse = (checkers = []) => {
  const items = checkers.map((fn) => fn());
  return { items, overall: worstOf(items.map((i) => i.status)) };
};

/** Overall label for the shell status pill. */
export const overallLabel = (overall) =>
  overall === PULSE.OPERATIONAL
    ? "ALL SYSTEMS OPERATIONAL"
    : `${PULSE_LABELS[overall] || overall}`.toUpperCase();

// The rest of the console builds pulse items from REAL signals:
//  - env presence checks (hasSupabaseEnv, hasEnv for providers)
//  - reachability probes (supabase rpc ping, provider checks) that only return
//    true when the actual call succeeded — never assumed.
export const envConfigured = ({ url, key }) => Boolean(url && key);