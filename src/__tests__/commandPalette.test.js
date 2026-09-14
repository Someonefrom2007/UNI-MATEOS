import { describe, it, expect } from "vitest";
import { norm, fuzzy, isPaletteShortcut, filterCommandPalette } from "@/lib/paletteSearch";

const COMMANDS = [
  { label: "Go to Dashboard", to: "/dashboard", type: "Go to" },
  { label: "Go to Tasks", to: "/tasks", type: "Go to" },
  { label: "Go to Grades", to: "/grades", type: "Go to" },
  { label: "Go to Schedule", to: "/schedule", type: "Go to" },
];

const ACTIONS = [
  { label: "Quick Add Task", sub: "capture a task instantly", action: "task", type: "Action" },
  { label: "New Note", sub: "a fresh page for a raw thought", action: "note", type: "Action" },
  { label: "Start Focus Session", sub: "deep-work timer, armed", action: "focus", type: "Action" },
];

const dataRows = [
  { type: "Course", label: "Linear Algebra", sub: "MATH101", to: "/courses/1" },
  { type: "Task", label: "Problem Set 3", sub: "2026-03-15", to: "/tasks" },
];

describe("Command Palette: ⌘K event capture", () => {
  it("matches Meta/Control + K (case-insensitive)", () => {
    expect(isPaletteShortcut({ metaKey: true, ctrlKey: false, key: "k" })).toBe(true);
    expect(isPaletteShortcut({ ctrlKey: true, metaKey: false, key: "K" })).toBe(true);
  });

  it("rejects other keys and missing modifiers", () => {
    expect(isPaletteShortcut({ metaKey: true, key: "x" })).toBe(false);
    expect(isPaletteShortcut({ key: "k" })).toBe(false);
    expect(isPaletteShortcut({ ctrlKey: true, key: "j" })).toBe(false);
    expect(isPaletteShortcut({ ctrlKey: true })).toBe(false);
  });
});

describe("Command Palette: fuzzy search scoring", () => {
  it("normalizes case and accents", () => {
    expect(norm("Introducción")).toBe("introduccion");
    expect(norm("  TASKS  ")).toBe("  tasks  ");
    expect(norm("")).toBe("");
  });

  it("scores contiguous prefix hits higher for earlier matches", () => {
    expect(fuzzy("Introduction to CS", "intro")).toBe(100);
    expect(fuzzy("Advanced Introduction", "intro")).toBe(91);
  });

  it("allows subsequence matching with a cost", () => {
    expect(fuzzy("dozen", "dz")).toBe(57);
    expect(fuzzy("databases", "db")).toBe(55);
    expect(fuzzy("introduction", "itrd")).toBeGreaterThan(0);
  });

  it("returns 0 on no match and on empty inputs", () => {
    expect(fuzzy("databases", "zz")).toBe(0);
    expect(fuzzy("databases", "")).toBe(0);
    expect(fuzzy("", "x")).toBe(0);
    expect(fuzzy(null, "x")).toBe(0);
  });
});

describe("Command Palette: filtering + selection routing", () => {
  it("shows all actions and commands when the query is empty", () => {
    const out = filterCommandPalette({ query: "", actions: ACTIONS, commands: COMMANDS });
    expect(out.map((i) => i.group)).toEqual(["action", "action", "action", "nav", "nav", "nav", "nav"]);
    expect(out.filter((i) => i.to).map((i) => i.to)).toEqual(["/dashboard", "/tasks", "/grades", "/schedule"]);
    expect(out.every((i) => i._score === undefined)).toBe(true);
  });

  it("matches commands and data rows by query and routes to their destinations", () => {
    const out = filterCommandPalette({ query: "problem set 3", actions: ACTIONS, commands: COMMANDS, dataRows });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ group: "data", type: "Task", label: "Problem Set 3", to: "/tasks" });
    expect(out[0]._score).toBe(100);
  });

  it("matches actions via subtitle", () => {
    const out = filterCommandPalette({ query: "capture", actions: ACTIONS, commands: COMMANDS });
    expect(out.some((i) => i.action === "task")).toBe(true);
  });

  it("ranks an exact data hit (100) above zero-scored nav/action rows", () => {
    const out = filterCommandPalette({ query: "linear", actions: ACTIONS, commands: COMMANDS, dataRows });
    expect(out[0]).toMatchObject({ group: "data", label: "Linear Algebra", to: "/courses/1", _score: 100 });
    expect(out.some((i) => i.label === "Go to Dashboard")).toBe(false);
  });

  it("lists title-matching commands and actions alongside scored data", () => {
    const out = filterCommandPalette({ query: "tasks", actions: ACTIONS, commands: COMMANDS, dataRows });
    expect(out.map((i) => i.label)).toContain("Go to Tasks");
    expect(out.map((i) => i.label)).toContain("Quick Add Task");
  });

  it("keeps navigable items stable with a `to` route on every command", () => {
    const out = filterCommandPalette({ query: "go to grades", actions: ACTIONS, commands: COMMANDS });
    const nav = out.filter((i) => i.group === "nav");
    expect(nav.map((i) => i.label)).toEqual(["Go to Grades"]);
    expect(nav.every((i) => i.to.startsWith("/") && i.type)).toBe(true);
  });

  it("returns actions only for unmatched queries without data noise", () => {
    const out = filterCommandPalette({ query: "zzzzz", actions: ACTIONS, commands: COMMANDS, dataRows });
    expect(out).toHaveLength(0);
  });
});