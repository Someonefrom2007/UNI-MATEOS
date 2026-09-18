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
