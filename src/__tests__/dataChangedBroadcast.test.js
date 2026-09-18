import { describe, it, expect, afterEach } from "vitest";
import { DATA_CHANGED_EVENT, notifyDataChanged } from "@/lib/useUserData";

// The quick-add sheet writes straight to the repo instead of going through
// `mutate`, so mounted pages only learn about the new row from this event.
// A silent regression here shows up as a page that looks empty right after the
// user added something, which is exactly what these assertions guard.
describe("data-changed broadcast", () => {
  const realWindow = globalThis.window;

  afterEach(() => {
    globalThis.window = realWindow;
  });

  it("dispatches an event on window so mounted hooks can reload", () => {
    const seen = [];
    globalThis.window = {
      dispatchEvent: (e) => seen.push(e.type),
    };

    notifyDataChanged();

    expect(seen).toEqual([DATA_CHANGED_EVENT]);
  });

  it("is safe when there is no window (SSR / test import)", () => {
    globalThis.window = undefined;
    expect(() => notifyDataChanged()).not.toThrow();
  });
});
