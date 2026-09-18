// Argument mapping for the data layer's mutate surface.
//
// The three operations have different arities: create takes the row to insert,
// update takes an id followed by a patch, delete takes an id. Deriving `id` and
// `payload` by position for all three silently dropped every field on create —
// rows persisted with only their injected metadata. Keeping the mapping in one
// tested place makes that class of mistake visible instead of invisible.

/**
 * @param {"create"|"update"|"delete"} op
 * @param {any[]} args
 * @returns {{ id: any, payload: any }}
 */
export const resolveMutationArgs = (op, args = []) => {
  if (op === "update") return { id: args[0], payload: args[1] };
  if (op === "delete") return { id: args[0], payload: undefined };
  return { id: args[0]?.id, payload: args[0] };
};

/**
 * Apply a positional mutation to a repository. Kept next to the arg mapping so
 * the local and hosted paths cannot disagree about what a call means.
 *
 * @param {{ create: Function, update: Function, delete: Function }} repo
 * @param {string} table
 * @param {"create"|"update"|"delete"} op
 * @param {any[]} args
 */
export const applyRepoMutation = (repo, table, op, args = [], transform = (v) => v) => {
  const { id, payload } = resolveMutationArgs(op, args);
  if (op === "create") return repo.create(table, transform(payload || {}));
  if (op === "update") return repo.update(table, id, transform(payload || {}));
  if (op === "delete") return repo.delete(table, id);
  throw new Error(`Unknown op: ${op}`);
};
