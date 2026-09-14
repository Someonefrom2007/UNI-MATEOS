import { describe, it, expect } from "vitest";
import { parseICS, toScheduleEventRows, diffICS, icsKey, toLocalDateStr } from "@/lib/calendarSync";

describe("parseICS", () => {
  it("parses a basic VEVENT with UID, summary, location", () => {
    const { events, warnings } = parseICS([
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:abc-123",
      "SUMMARY:Calculus Lecture",
      "LOCATION:Aula B3",
      "DTSTART;TZID=Europe/Madrid:20260315T090000",
      "DTEND;TZID=Europe/Madrid:20260315T103000",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n"));
    expect(warnings).toEqual([]);
    expect(events).toHaveLength(1);
    expect(events[0].uid).toBe("abc-123");
    expect(events[0].summary).toBe("Calculus Lecture");
    expect(events[0].location).toBe("Aula B3");
    expect(events[0].allDay).toBe(false);
    expect(toLocalDateStr(events[0].start)).toBe("2026-03-15");
  });

  it("handles DURATION when DTEND is missing", () => {
    const { events, warnings } = parseICS("BEGIN:VEVENT\r\nUID:u1\r\nSUMMARY:Study block\r\nDTSTART:20260402T140000\r\nDURATION:PT1H30M\r\nEND:VEVENT");
    expect(warnings).toEqual([]);
    const diffMin = Math.round((events[0].end - events[0].start) / 60000);
    expect(diffMin).toBe(90);
  });

  it("parses UTC (Z) date-times", () => {
    const { events } = parseICS("BEGIN:VEVENT\r\nUID:u2\r\nSUMMARY:Office hours\r\nDTSTART:20260402T120000Z\r\nDTEND:20260402T130000Z\r\nEND:VEVENT");
    expect(events[0].start.toISOString()).toBe("2026-04-02T12:00:00.000Z");
  });

  it("parses all-day DATE events", () => {
    const { events } = parseICS("BEGIN:VEVENT\r\nUID:u3\r\nSUMMARY:Final exam week\r\nDTSTART;VALUE=DATE:20260518\r\nEND:VEVENT");
    expect(events[0].allDay).toBe(true);
  });

  it("unfolds folded description lines", () => {
    const ics = ["BEGIN:VEVENT", "UID:u4", "SUMMARY:Lab", "DTSTART:20260403T100000", "DESCRIPTION:a very long line that continues", "  over the fold", "END:VEVENT"].join("\r\n");
    const { events } = parseICS(ics);
    expect(events[0].description).toBe("a very long line that continues over the fold");
  });

  it("flags recurring events via RRULE", () => {
    const { events } = parseICS("BEGIN:VEVENT\r\nUID:u5\r\nSUMMARY:Weekly seminar\r\nDTSTART:20260403T100000\r\nRRULE:FREQ=WEEKLY\r\nEND:VEVENT");
    expect(events[0].recurring).toBe(true);
  });

  it("reports malformed VEVENTs as warnings instead of crashing", () => {
    const { events, warnings } = parseICS("BEGIN:VEVENT\r\nUID:u6\r\nSUMMARY:Broken\r\nEND:VEVENT");
    expect(events).toHaveLength(0);
    expect(warnings).toHaveLength(1);
  });

  it("returns empty on non-ICS garbage", () => {
    const { events, warnings } = parseICS("not an ics file at all");
    expect(events).toHaveLength(0);
  });
});

describe("toScheduleEventRows / diffICS", () => {
  const { events } = parseICS([
    "BEGIN:VEVENT",
    "UID:abc-123",
    "SUMMARY:Calculus Lecture",
    "LOCATION:Aula B3",
    "DTSTART:20260315T090000",
    "DTEND:20260315T103000",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:all-day",
    "SUMMARY:Holiday",
    "DTSTART;VALUE=DATE:20260320",
    "END:VEVENT",
  ].join("\r\n"));

  it("maps timeline events to schedule_events rows with an ics: source key", () => {
    const { rows, skippedAllDay } = toScheduleEventRows(events, "https://cal.example/feed.ics");
    expect(skippedAllDay).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Calculus Lecture",
      type: "personal",
      date: "2026-03-15",
      start_time: "09:00",
      end_time: "10:30",
      room: "Aula B3",
      google_event_id: "ics:https://cal.example/feed.ics:abc-123",
    });
  });

  it("diffICS dedupes already-imported occurrences", () => {
    const { rows } = toScheduleEventRows(events.slice(0, 1), "https://cal.example/feed.ics");
    const existing = [{ ...rows[0] }, { ...rows[0], google_event_id: "ics:https://cal.example/feed.ics:other" }];
    const { toCreate, skipped } = diffICS(existing, rows);
    expect(skipped).toBe(1);
    expect(toCreate).toHaveLength(0);
  });

  it("diffICS keeps duplicate keys unique across a batch", () => {
    const { rows } = toScheduleEventRows(events.slice(0, 1), "https://cal.example/feed.ics");
    const { toCreate, skipped } = diffICS([], [rows[0], rows[0]]);
    expect(skipped).toBe(1);
    expect(toCreate).toHaveLength(1);
  });

  it("icsKey is deterministic", () => {
    expect(icsKey("https://a/feed.ics", "u1")).toBe("ics:https://a/feed.ics:u1");
  });
});