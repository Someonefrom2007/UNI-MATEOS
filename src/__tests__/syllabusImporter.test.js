import { describe, it, expect } from "vitest";
import { parseSyllabus, parseDate } from "@/lib/syllabusParser";
import { prepareSyllabusImport, resolveCourseId, unmappedLinks } from "@/lib/syllabusImporter";

describe("syllabus importer: delimiter formats", () => {
  it("parses comma-separated rows with a header", () => {
    const r = parseSyllabus(
      "type,name,course,code,professor,ects,target,color,date\n" +
        "course,Linear Algebra,Math,MATH101,,6,8,amber\n" +
        "exam,Final,Math,MATH101,Smith,6,8,amber,2026-06-10"
    );
    expect(r.courses).toHaveLength(1);
    expect(r.exams).toHaveLength(1);
    expect(r.errors).toEqual([]);
  });

  it("parses semicolon-separated rows", () => {
    const r = parseSyllabus("type;name;course;code;weight\ntask;Problem Set 3;MATH101;MATH101;10");
    expect(r.tasks).toHaveLength(1);
    expect(r.tasks[0].course_link).toBe("math101");
  });

  it("auto-detects delimiter and handles headerless rows", () => {
    const r = parseSyllabus("course,Linear Algebra,Linear Algebra,MATH101,6,10\ntask,Problem Set 3,MATH101,MATH101,,2026-03-15,medium,60");
    expect(r.courses).toHaveLength(1);
    expect(r.tasks).toHaveLength(1);
    expect(r.tasks[0].title).toBe("Problem Set 3");
  });

  it("handles quoted fields containing separators", () => {
    const r = parseSyllabus('type,name,course\ntask,"Analysis, Part 1",ANAL101');
    expect(r.tasks[0].title).toBe("Analysis, Part 1");
  });

  it("decodes JSON array input with alternative keys", () => {
    const r = parseSyllabus(JSON.stringify([{ kind: "course", title: "Calculus", ects: 9 }, { kind: "exam", title: "Midterm", dueDate: "2026-06-01", course: "Calculus" }]));
    expect(r.courses).toHaveLength(1);
    expect(r.exams).toHaveLength(1);
  });
});

describe("syllabus importer: date formats", () => {
  it("keeps ISO yyyy-mm-dd dates", () => {
    expect(parseDate("2026-06-20")).toBe("2026-06-20");
  });

  it("normalizes dd/mm/yyyy into ISO", () => {
    expect(parseDate("20/06/2026")).toBe("2026-06-20");
    expect(parseDate("05/03/2026")).toBe("2026-03-05");
  });

  it("normalizes other slash/dot delimiters too", () => {
    expect(parseDate("20.06.2026")).toBe("2026-06-20");
    expect(parseDate("20-06-2026")).toBe("2026-06-20");
  });

  it("returns null for unparseable dates without crashing", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("someday")).toBeNull();
  });
});

describe("syllabus importer: course linking", () => {
  const sample = () =>
    parseSyllabus(
      [
        "course,Linear Algebra,LA,LA101,6",
        "course,Discrete Math,DM,DM101,6",
        "task,Problem Set 1,LA101,LA101,,2026-03-01,medium,45",
        "task,Homework 2,DM101,DM101,,2026-03-08,high,60",
        "exam,Final Exam,LA101,LA101,,2026-06-10,high,180",
      ].join("\n")
    );

  it("prepares bundles stripping linking keys from DB payloads", () => {
    const { courseBundles, taskBundles, examBundles } = prepareSyllabusImport(sample());
    expect(courseBundles).toHaveLength(2);
    expect(taskBundles).toHaveLength(2);
    expect(examBundles).toHaveLength(1);
    expect(courseBundles[0].payload._link).toBeUndefined();
    expect(taskBundles[0].payload.course_link).toBeUndefined();
    expect(courseBundles[0].link).toBe("la101");
    expect(taskBundles[0].courseLink).toBe("la101");
  });

  it("resolves matching course_link values once courses are created", () => {
    const { courseBundles, taskBundles, examBundles, linkMap } = prepareSyllabusImport(sample());
    for (const { link } of courseBundles) linkMap[link] = `${link}-id`;
    expect(resolveCourseId(linkMap, taskBundles[0].courseLink)).toBe("la101-id");
    expect(resolveCourseId(linkMap, examBundles[0].courseLink)).toBe("la101-id");
  });

  it("nulls out non-matching course links (course not in the parsed set)", () => {
    const { linkMap, taskBundles } = prepareSyllabusImport(sample());
    taskBundles.push({ payload: {}, courseLink: "nofound-course" });
    expect(resolveCourseId(linkMap, taskBundles[2].courseLink)).toBeNull();
    expect(resolveCourseId({}, "")).toBeNull();
  });

  it("surfaces unmapped course links for a warning", () => {
    const parsed = parseSyllabus("exam,Orphan Exam,NOTEXISTS,NOTEXISTS,,2026-06-10\ncourse,LA,MATH,LA101");
    const bundles = prepareSyllabusImport(parsed);
    expect(unmappedLinks({ ...bundles, courseBundles: [{ link: "la101" }] })).toEqual(["notexists"]);
    expect(unmappedLinks(bundles)).toEqual(["notexists"]);
  });
});