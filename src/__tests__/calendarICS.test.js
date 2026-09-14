import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  parseICS,
  toScheduleEventRows,
  diffICS,
  expandICS,
  expandForImport,
  parseRRULE,
  toLocalDateStr,
  toLocalTimeStr,
} from "@/lib/calendarSync";

const doc = (vevents) =>
  `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//test//EN\n${vevents}\nEND:VCALENDAR`;

describe("calendarSync: ICS parsing", () => {
  it("parses a basic VEVENT with alarm-free fields and derives end", () => {
    const { events, warnings } = parseICS(
      doc(`BEGIN:VEVENT\nUID:a@b\nDTSTART:20260310T090000\nDTEND:20260310T103000\nSUMMARY:Linear Algebra\nLOCATION:Aula 4\nDESCRIPTION:Chapter 5\nEND:VEVENT`)
    );
    expect(warnings).toEqual([]);
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.uid).toBe("a@b");
    expect(e.summary).toBe("Linear Algebra");
    expect(e.location).toBe("Aula 4");
    expect(e.description).toBe("Chapter 5");
    expect(e.allDay).toBe(false);
    expect(e.recurring).toBe(false);
    expect(e.end - e.start).toBe(90 * 60 * 1000);
  });

  it("uses DURATION when DTEND is missing", () => {
    const { events } = parseICS(doc(`BEGIN:VEVENT\nUID:dur\nDTSTART:20260310T090000\nDURATION:PT45M\nSUMMARY:Lab\nEND:VEVENT`));
    expect(events[0].end - events[0].start).toBe(45 * 60 * 1000);
  });

  it("derives end from all-day default (24h)", () => {
    const { events } = parseICS(doc(`BEGIN:VEVENT\nUID:ad\nDTSTART;VALUE=DATE:20260310\nSUMMARY:All day\nEND:VEVENT`));
    expect(events[0].allDay).toBe(true);
    expect(events[0].end - events[0].start).toBe(24 * 60 * 60 * 1000);
  });

  it("unfolds folded RFC-5545 continuation lines", () => {
    const { events } = parseICS(doc(`BEGIN:VEVENT\nUID:fold\nDTSTART:20260310T090000\nSUMMARY:Long \r\n name here\nEND:VEVENT`));
    expect(events[0].summary).toBe("Long name here");
  });

  it("tolerates binary/meta components (VCALENDAR, X- props) and missing UID hashing", () => {
    const { events, warnings } = parseICS(
      doc(`BEGIN:VTODO\nUID:x\nSUMMARY:skip me\nEND:VTODO\nBEGIN:VEVENT\nDTSTART:20260310T090000\nSUMMARY:No uid\nEND:VEVENT`)
    );
    expect(events).toHaveLength(1);
    expect(events[0].uid).toBeTruthy();
    expect(warnings).toHaveLength(0);
  });

  it("handles malformed entries without aborting", () => {
    const { events, warnings } = parseICS(doc(`BEGIN:VEVENT\nUID:bad\nSUMMARY:no start\nEND:VEVENT`));
    expect(events).toHaveLength(0);
    expect(warnings).toContain("Skipped a VEVENT without a parseable DTSTART.");
  });

  it("handles truncated/empty input gracefully", () => {
    expect(parseICS("").events).toHaveLength(0);
    const truncated = parseICS("BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:cut\nDTSTART:20260310T\nEND:V");
    expect(truncated.events).toHaveLength(0);
    expect(truncated.warnings.length).toBeGreaterThan(0);
  });
});

describe("calendarSync: timezone adjustments", () => {
  const originalTZ = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "America/New_York";
  });

  afterAll(() => {
    if (originalTZ) process.env.TZ = originalTZ;
    else delete process.env.TZ;
  });

  const startOf = (ics) => parseICS(ics).events[0].start;

  it("converts UTC (Z) times to the local clock", () => {
    expect(toLocalTimeStr(startOf(doc(`BEGIN:VEVENT\nUID:u1\nDTSTART:20260115T083000Z\nSUMMARY:x\nEND:VEVENT`)))).toBe("03:30");
    expect(toLocalDateStr(startOf(doc(`BEGIN:VEVENT\nUID:u2\nDTSTART:20260715T083000Z\nSUMMARY:x\nEND:VEVENT`)))).toBe("2026-07-15");
    expect(toLocalTimeStr(startOf(doc(`BEGIN:VEVENT\nUID:u3\nDTSTART:20260715T083000Z\nSUMMARY:x\nEND:VEVENT`)))).toBe("04:30");
  });

  it("keeps floating local times as typed (no shift)", () => {
    expect(toLocalTimeStr(startOf(doc(`BEGIN:VEVENT\nUID:f1\nDTSTART:20260715T150000\nSUMMARY:x\nEND:VEVENT`)))).toBe("15:00");
    expect(toLocalDateStr(startOf(doc(`BEGIN:VEVENT\nUID:f2\nDTSTART:20260715T150000\nSUMMARY:x\nEND:VEVENT`)))).toBe("2026-07-15");
  });

  it("buckets UTC events that cross midnight onto the correct local calendar day", () => {
    const crossing = parseICS(doc(`BEGIN:VEVENT\nUID:cross\nDTSTART:20260116T013000Z\nDTEND:20260116T033000Z\nSUMMARY:Overnight\nEND:VEVENT`));
    expect(toLocalDateStr(crossing.events[0].start)).toBe("2026-01-15");
    expect(crossing.events[0].end.getTime()).toBeGreaterThan(crossing.events[0].start.getTime());
  });
});

describe("calendarSync: recurring expansion (RRULE)", () => {
  it("parses RRULE parts", () => {
    expect(parseRRULE("FREQ=WEEKLY;INTERVAL=2;COUNT=10;BYDAY=MO,WE,FR")).toEqual({
      freq: "WEEKLY",
      interval: 2,
      count: 10,
      until: null,
      byday: ["MO", "WE", "FR"],
    });
    expect(parseRRULE("FREQ=DAILY;UNTIL=20260110T000000Z").until).toBeInstanceOf(Date);
  });

  const weekly = {
    uid: "r1",
    summary: "Lecture",
    start: new Date("2026-01-05T09:00:00"),
    end: new Date("2026-01-05T10:30:00"),
    allDay: false,
    recurring: true,
    rrule: "FREQ=WEEKLY;COUNT=3",
  };

  it("expands COUNT-bounded weekly recurrences", () => {
    const out = expandICS([weekly], { from: new Date("2026-01-05T00:00:00"), to: new Date("2026-01-31T00:00:00") });
    expect(out.map((o) => o.start.getDay())).toEqual([1, 1, 1]);
    expect(out).toHaveLength(3);
    expect(out[0].uid).toBe("r1#1");
    expect(out[2].uid).toBe("r1#3");
    expect(out[1].end - out[1].start).toBe(90 * 60 * 1000);
  });

  it("limits the window and counts matches occurring before it", () => {
    const out = expandICS([weekly], { from: new Date("2026-01-12T00:00:00"), to: new Date("2026-01-18T00:00:00") });
    expect(out).toHaveLength(1);
    expect(out[0].uid).toBe("r1#2");
    expect(out[0].start.getDate()).toBe(12);
  });

  it("expands BYDAY (multiple weekly meetings)", () => {
    const multi = {
      ...weekly,
      rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR",
    };
    const out = expandICS([multi], { from: new Date("2026-01-05T00:00:00"), to: new Date("2026-01-09T23:59:59") });
    expect(out).toHaveLength(3);
    expect(out.map((o) => o.start.getDate())).toEqual([5, 7, 9]);
  });

  it("respects INTERVAL=2 for weekly rules", () => {
    const bi = { ...weekly, rrule: "FREQ=WEEKLY;INTERVAL=2;COUNT=2" };
    const out = expandICS([bi], { from: new Date("2026-01-05T00:00:00"), to: new Date("2026-02-28T00:00:00") });
    expect(out.map((o) => o.start.getDate())).toEqual([5, 19]);
  });

  it("respects UNTIL for daily rules", () => {
    const daily = {
      uid: "d1",
      summary: "Standup",
      start: new Date("2026-01-05T09:00:00"),
      end: new Date("2026-01-05T09:15:00"),
      allDay: false,
      recurring: true,
      rrule: "FREQ=DAILY;UNTIL=20260108",
    };
    const out = expandICS([daily], { from: new Date("2026-01-05T00:00:00"), to: new Date("2026-01-31T00:00:00") });
    expect(out).toHaveLength(3);
  });

  it("caps expansion via maxEvents", () => {
    const daily = {
      uid: "cap",
      summary: "Brake",
      start: new Date("2026-01-01T09:00:00"),
      end: new Date("2026-01-01T09:05:00"),
      allDay: false,
      recurring: true,
      rrule: "FREQ=DAILY",
    };
    const out = expandICS([daily], { from: new Date("2026-01-01T00:00:00"), to: new Date("2026-01-31T00:00:00"), maxEvents: 5 });
    expect(out).toHaveLength(5);
  });

  it("keeps non-recurring events only inside the window", () => {
    const single = { uid: "s1", summary: "One", start: new Date("2026-06-01T10:00:00"), end: new Date("2026-06-01T11:00:00"), allDay: false, recurring: false, rrule: "" };
    const out = expandICS([single], { from: new Date("2026-05-01T00:00:00"), to: new Date("2026-06-02T00:00:00") });
    expect(out).toHaveLength(1);
    const outBefore = expandICS([single], { from: new Date("2026-07-01T00:00:00"), to: new Date("2026-08-01T00:00:00") });
    expect(outBefore).toHaveLength(0);
  });

  it("keeps a base occurrence for unsupported frequencies (MONTHLY)", () => {
    const monthly = { ...weekly, rrule: "FREQ=MONTHLY;COUNT=6" };
    const out = expandICS([monthly], { from: new Date("2026-01-05T00:00:00"), to: new Date("2026-01-06T00:00:00") });
    expect(out).toHaveLength(1);
    expect(out[0].uid).toBe("r1");
  });

  it("produces unique import keys per occurrence after expansion", () => {
    const expanded = expandICS([weekly], { from: new Date("2026-01-05T00:00:00"), to: new Date("2026-01-31T00:00:00") });
    const { rows } = toScheduleEventRows(expanded, "https://feed.example/lab.ics");
    const keys = rows.map((r) => r.google_event_id);
    expect(new Set(keys).size).toBe(rows.length);
    const { toCreate, skipped } = diffICS(rows.slice(0, 2), rows);
    expect(toCreate.length).toBe(1);
    expect(skipped).toBe(2);
  });

  it("expandForImport uses the standard 90-day window", () => {
    const parsed = parseICS(
      doc(`BEGIN:VEVENT\nUID:term\nDTSTART:20260105T090000\nDTEND:20260105T103000\nRRULE:FREQ=WEEKLY;COUNT=200\nSUMMARY:Seminar\nEND:VEVENT`)
    );
    const out = expandForImport(parsed.events, new Date("2026-01-01T12:00:00"));
    expect(out.length).toBeGreaterThan(0);
    const last = out[out.length - 1].start;
    expect(toLocalDateStr(last).length).toBe(10);
    expect(last < new Date("2026-04-02T00:00:00")).toBe(true);
  });
});