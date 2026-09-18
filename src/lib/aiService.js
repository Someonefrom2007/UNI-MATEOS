import { supabase } from "@/lib/supabase";
import { isLocalWorkspace } from "@/lib/repo/select";

// The one place the UI talks to the assistant. Provider details (which Edge
// Function, which model, which request shape) live here so the page never
// grows a second provider call and swapping providers is a change to this
// file only. No provider key is ever referenced client-side — the request is
// authenticated by the user's session and the model key stays on the server.
//
// The transport is injectable for the same reason the data layer has adapters:
// the network boundary is the seam, so the surrounding logic (input handling,
// reply validation, error classification) is exercised for real in tests.

export const AI_UNAVAILABLE = "unavailable";
export const AI_UNREACHABLE = "unreachable";
export const AI_EMPTY = "empty";

export const MAX_QUESTION = 2000;

export class AiError extends Error {
  constructor(kind) {
    super(kind);
    this.name = "AiError";
    this.kind = kind;
  }
}

const defaultInvoke = (question) =>
  supabase.functions.invoke("ai-assistant", { body: { question } });

/**
 * Ask the UNI·MATE copilot a question.
 * @param {string} question
 * @param {{ invoke?: (question: string) => Promise<any>, isLocal?: () => boolean }} [deps]
 * @returns {Promise<string>} the assistant's reply text
 * @throws {AiError} with `.kind` of AI_EMPTY | AI_UNAVAILABLE | AI_UNREACHABLE
 */
export async function askAssistant(question, deps = {}) {
  const { invoke = defaultInvoke, isLocal = isLocalWorkspace } = deps;

  const trimmed = typeof question === "string" ? question.trim().slice(0, MAX_QUESTION) : "";
  if (!trimmed) throw new AiError(AI_EMPTY);

  // The copilot runs server-side; a local workspace has no connected account
  // and therefore no session to authenticate the call with.
  if (isLocal()) throw new AiError(AI_UNAVAILABLE);

  let res;
  try {
    res = await invoke(trimmed);
  } catch {
    throw new AiError(AI_UNREACHABLE);
  }

  // A missing or blank reply is a failure, not an empty message — rendering an
  // empty bubble would look like the assistant ignored the question.
  const reply = res?.data?.reply;
  if (res?.error || typeof reply !== "string" || !reply.trim()) {
    throw new AiError(AI_UNREACHABLE);
  }
  return reply.trim();
}
