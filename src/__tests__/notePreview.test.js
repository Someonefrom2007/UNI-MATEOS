import { describe, it, expect } from "vitest";
import { notePreview } from "@/lib/format";

// Notes store HTML from the rich-text editor. A preview that leaks tags or
// entities looks broken in the list, so these cases pin the exact strings.
describe("notePreview", () => {
  it("strips the paragraph wrapper Quill writes", () => {
    expect(notePreview("<p>Hello world</p>")).toBe("Hello world");
  });

  it("decodes the entities Quill emits for spaces and symbols", () => {
    expect(notePreview("<p>a&nbsp;&amp;&nbsp;b</p>")).toBe("a & b");
  });

  it("separates adjacent blocks instead of fusing words", () => {
    expect(notePreview("<p>one</p><p>two</p>")).toBe("one two");
    expect(notePreview("first<br>second")).toBe("first second");
  });

  it("keeps list items readable", () => {
    expect(notePreview("<ul><li>alpha</li><li>beta</li></ul>")).toBe("alpha beta");
  });

  it("leaves plain-text notes untouched", () => {
    expect(notePreview("Hook → context → claim")).toBe("Hook → context → claim");
  });

  it("truncates with an ellipsis at the requested length", () => {
    const out = notePreview("<p>abcdefghij</p>", 4);
    expect(out).toBe("abcd…");
    expect(notePreview("<p>abc</p>", 10)).toBe("abc");
  });

  it("returns an empty string for missing content", () => {
    expect(notePreview(null)).toBe("");
    expect(notePreview(undefined)).toBe("");
    expect(notePreview("")).toBe("");
  });

  it("collapses whitespace so previews stay one line", () => {
    expect(notePreview("<p>a\n\n   b</p>")).toBe("a b");
  });
});
