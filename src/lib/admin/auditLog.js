// UNI·MATE Control Center — audit logging.
//
// Every sensitive console action (suspend/restore/delete user, reconcile
// entitlement, change feature flag, moderate content, change announcements,
// change configuration, run a developer operation) funnels through logAudit().
// Entries are append-oriented: audit is written, never rewritten. In hosted
// mode the server enforces append-only (audit_log has no client policies and
// log_audit()/audit_recent() are SECURITY DEFINER + admin-checked); this module
// is the client-side contract and stays honest in the local workspace too.

export const EMPTY_AUDIT = { entries: [] };

const normalize = (meta) => {
  if (meta == null) return {};
  if (typeof meta === "string") {
    try { return JSON.parse(meta); } catch { return { message: meta }; }
  }
  return meta;
};

/**
 * Build an audit entry. `now` and `actor` are injectable for tests.
 * @param {object} opts
 * @param {string} opts.action
 * @param {string} [opts.targetType]
 * @param {string} [opts.targetId]
 * @param {string} [opts.result='success']  - 'success' | 'failed' | 'blocked' | 'cancelled'
 * @param {object} [opts.meta]
 * @param {string} [opts.actor]
 * @param {string|(() => string)} [opts.now] - ISO timestamp or a factory for it
 * @returns {object} a writeable audit_log row (snake_case ok via repo adapter)
 */
export const auditEntry = ({
  action,
  targetType,
  targetId,
  result = "success",
  meta,
  actor,
  now = () => new Date().toISOString(),
}) => {
  const row = {
    actor_id: actor || null,
    action,
    target_type: targetType || null,
    target_id: targetId != null ? String(targetId) : null,
    result,
    meta: normalize(meta),
    created_at: (typeof now === "function" ? now() : now) || new Date().toISOString(),
  };
  return row;
};

/**
 * Append an audit entry through a repository (create on the "AuditLog" table).
 * Never throws: console actions should still surface even if the ledger write
 * fails, and the returned boolean tells the caller.
 * @param {{ repo: object }} deps
 * @param {object} entry - from auditEntry()
 * @returns {Promise<boolean>} true when the entry was persisted
 */
export const logAudit = async ({ repo }, entry) => {
  if (!repo || !entry || !entry.action) return false;
  try {
    await repo.create("AuditLog", entry);
    return true;
  } catch {
    return false;
  }
};

/**
 * Action + audit in one step: run an async action, record the outcome, return
 * the action result. This keeps sensitive operations auditable by construction.
 * @param {{ repo: object }} deps
 * @param {object} entry - from auditEntry(); `result` may be patched by outcome
 * @param {() => Promise<{ ok?: boolean, error?: unknown, value?: unknown }>} run
 * @returns {Promise<{ ok: boolean, error?: unknown, audited: boolean, value?: unknown }>}
 */
export const withAudit = async ({ repo }, entry, run) => {
  let outcome;
  try {
    outcome = await run();
  } catch (error) {
    outcome = { ok: false, error };
  }
  const ok = outcome && outcome.ok !== false;
  const audited = await logAudit({ repo }, {
    ...entry,
    result: ok ? (entry.result || "success") : "failed",
    meta: {
      ...(entry.meta || {}),
      ...(ok ? {} : { error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error || "") }),
    },
  });
  return { ok, error: outcome && !ok ? outcome.error : undefined, audited, value: outcome?.value };
};

/**
 * Read recent audit entries (limit-truncated) from a repository.
 * @param {{ repo: object }} deps
 * @param {number} [limit=100]
 * @returns {Promise<{ entries: Array<object> }>}
 */
export const recentAudit = async ({ repo }, limit = 100) => {
  if (!repo) return { entries: [] };
  try {
    const rows = (await repo.list("AuditLog")) || [];
    return {
      entries: rows
        .slice()
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
        .slice(0, Math.max(0, limit)),
    };
  } catch {
    return { entries: [] };
  }
};

/**
 * Pure filter over audit entries — used by the Security screen and tests.
 * @param {Array<object>} entries
 * @param {{ action?: string, result?: string, q?: string }} [opts={}]
 * @returns {Array<object>}
 */
export const filterAudit = (entries = [], { action, result, q } = {}) =>
  entries.filter((e) => {
    if (action && e.action !== action) return false;
    if (result && e.result !== result) return false;
    if (q && !`${e.action} ${e.target_type || ""} ${e.target_id || ""} ${e.actor_id || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });