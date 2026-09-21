// Waitlist capture — pure.
import { describe, it, expect } from "vitest";
import { isValidEmail, loadLocalWaitlist, addLocalWaitlist, isOnLocalWaitlist, WAITLIST_KEY } from "@/lib/waitlist";
import { createMemoryStorage } from "@/lib/repo/storage";

const storage = () => createMemoryStorage();

describe("isValidEmail", () => {
  it("accepts plain, dotted and international addresses", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("student.name+tag@universitat.edu")).toBe(true);
    expect(isValidEmail("  m@x.org ")).toBe(true);
  });

  it("rejects malformed input", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.d")).toBe(false);
    expect(isValidEmail("@c.d")).toBe(false);
    expect(isValidEmail(`${"a".repeat(300)}@x.co`)).toBe(false);
  });
});

describe("addLocalWaitlist", () => {
  it("stores a first-time email and reports no duplicate", () => {
    const s = storage();
    expect(addLocalWaitlist("nina@unimail.edu", "pro", s)).toEqual({ ok: true, duplicate: false });
    expect(isOnLocalWaitlist("NINA@unimail.edu", s)).toBe(true);
    expect(loadLocalWaitlist(s)).toHaveLength(1);
  });

  it("dedupes case-insensitively", () => {
    const s = storage();
    addLocalWaitlist("nina@unimail.edu", "pro", s);
    expect(addLocalWaitlist("Nina@UniMail.edu", "ultra", s)).toEqual({ ok: true, duplicate: true });
    expect(loadLocalWaitlist(s)).toHaveLength(1);
  });

  it("persists tier and source metadata", () => {
    const s = storage();
    addLocalWaitlist("nina@unimail.edu", "ultra", s);
    expect(loadLocalWaitlist(s)[0]).toMatchObject({ email: "nina@unimail.edu", tier: "ultra", source: "plans" });
  });

  it("rejects invalid emails without writing", () => {
    const s = storage();
    expect(addLocalWaitlist("nope", "pro", s)).toEqual({ ok: false });
    expect(addLocalWaitlist("", "pro", s)).toEqual({ ok: false });
    expect(loadLocalWaitlist(s)).toHaveLength(0);
  });

  it("is isolated per storage instance and survives JSON round-trips", () => {
    const a = storage();
    const b = storage();
    addLocalWaitlist("a@x.co", "pro", a);
    addLocalWaitlist("b@x.co", "pro", b);
    expect(loadLocalWaitlist(a)).toHaveLength(1);
    expect(loadLocalWaitlist(b)).toHaveLength(1);
    expect(loadLocalWaitlist(a)[0].email).toBe("a@x.co");
    expect(b.getItem(WAITLIST_KEY)).not.toBeNull();
  });
});