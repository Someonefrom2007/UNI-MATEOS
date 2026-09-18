import { describe, it, expect } from "vitest";
import {
  askAssistant,
  AiError,
  AI_UNAVAILABLE,
  AI_UNREACHABLE,
  AI_EMPTY,
  MAX_QUESTION,
} from "@/lib/aiService";

// The assistant is the only part of UNI·MATE that can be wrong in a way the
// student cannot check, so the interesting behaviour is the failure paths: a
// blank reply must not render as an empty bubble, and an offline assistant
// must not look like a refused question. The transport is passed in so the
// real logic runs without a network or a provider.
const hosted = () => false;
const online = (reply) => async () => ({ data: { reply } });

const kindOf = async (promise) => {
  try {
    await promise;
    throw new Error("expected askAssistant to reject");
  } catch (err) {
    expect(err).toBeInstanceOf(AiError);
    return err.kind;
  }
};

describe("askAssistant", () => {
  it("returns the trimmed reply from the transport", async () => {
    const reply = await askAssistant("  What should I do today?  ", {
      invoke: online("  Review Chapter 4.\n"),
      isLocal: hosted,
    });
    expect(reply).toBe("Review Chapter 4.");
  });

  it("sends the question trimmed, not as typed", async () => {
    let seen;
    await askAssistant("   Plan my evening   ", {
      invoke: async (q) => { seen = q; return { data: { reply: "ok" } }; },
      isLocal: hosted,
    });
    expect(seen).toBe("Plan my evening");
  });

  it("caps the question length before it leaves the client", async () => {
    let seen;
    await askAssistant("x".repeat(MAX_QUESTION + 500), {
      invoke: async (q) => { seen = q; return { data: { reply: "ok" } }; },
      isLocal: hosted,
    });
    expect(seen).toHaveLength(MAX_QUESTION);
  });

  it("rejects a blank question without calling the transport", async () => {
    let called = false;
    const invoke = async () => { called = true; return { data: { reply: "ok" } }; };

    expect(await kindOf(askAssistant("", { invoke, isLocal: hosted }))).toBe(AI_EMPTY);
    expect(await kindOf(askAssistant("   ", { invoke, isLocal: hosted }))).toBe(AI_EMPTY);
    expect(await kindOf(askAssistant(null, { invoke, isLocal: hosted }))).toBe(AI_EMPTY);
    expect(await kindOf(askAssistant(undefined, { invoke, isLocal: hosted }))).toBe(AI_EMPTY);
    expect(called).toBe(false);
  });

  it("reports a local workspace as unavailable, not as a failed question", async () => {
    let called = false;
    const invoke = async () => { called = true; return { data: { reply: "ok" } }; };

    expect(await kindOf(askAssistant("anything", { invoke, isLocal: () => true }))).toBe(AI_UNAVAILABLE);
    expect(called).toBe(false);
  });

  it("reports a thrown transport error as unreachable", async () => {
    const invoke = async () => { throw new Error("network down"); };
    expect(await kindOf(askAssistant("anything", { invoke, isLocal: hosted }))).toBe(AI_UNREACHABLE);
  });

  it("reports an error payload as unreachable even when it carries a reply", async () => {
    const invoke = async () => ({ error: { message: "500" }, data: { reply: "partial" } });
    expect(await kindOf(askAssistant("anything", { invoke, isLocal: hosted }))).toBe(AI_UNREACHABLE);
  });

  it("treats a missing, non-string or blank reply as unreachable", async () => {
    for (const data of [undefined, {}, { reply: null }, { reply: "" }, { reply: "   " }, { reply: 42 }]) {
      const invoke = async () => ({ data });
      expect(await kindOf(askAssistant("anything", { invoke, isLocal: hosted }))).toBe(AI_UNREACHABLE);
    }
  });

  it("does not leak the transport error message to the caller", async () => {
    const invoke = async () => { throw new Error("sk-secret-key rejected"); };
    try {
      await askAssistant("anything", { invoke, isLocal: hosted });
      throw new Error("expected rejection");
    } catch (err) {
      expect(err.message).toBe(AI_UNREACHABLE);
      expect(err.message).not.toContain("sk-secret-key");
    }
  });
});
