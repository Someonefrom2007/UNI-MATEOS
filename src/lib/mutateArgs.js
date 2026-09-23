// Argument shaping for useUserData().mutate.
//
// The historical hosted API surface accepted every op with positional slots
// (update/delete = (id, payload)/(id)), while create call sites pass a single
// payload object. Normalize once here so no caller can silently drop data.

export const normalizeMutateArgs = (op, args) => {
  if (op === "create") {
    const [first, second] = args;
    const payload = second !== undefined ? second : first;
    return { id: undefined, payload: payload || {} };
  }
  const [id, payload] = args;
  if (op === "update") return { id, payload: payload || {} };
  return { id, payload: undefined };
};