// Entity name (Base44 API surface) -> Supabase table (snake_case).
export const TABLE = {
  Course: "courses",
  ScheduleEvent: "schedule_events",
  Task: "tasks",
  Exam: "exams",
  Grade: "grades",
  Note: "notes",
  Resource: "resources",
  Topic: "topics",
  FocusSession: "focus_sessions",
  Goal: "goals",
  Habit: "habits",
  HabitLog: "habit_logs",
  Project: "projects",
  Attendance: "attendance",
  StickyNote: "sticky_notes",
  CommunityPost: "community_posts",
  CommunityReply: "community_replies",
  CommunityLike: "community_likes",
  CommunitySave: "community_saves",
  CommunityReport: "community_reports",
  Community: "communities",
  StudyGroup: "study_groups",
  CommunityMember: "community_members",
  FlashcardDeck: "flashcard_decks",
  Flashcard: "flashcards",
  Waitlist: "waitlist",
  StudyPlan: "study_plans",
  StudyPlanItem: "study_plan_items",
  User: "user_profiles",
  Subscription: "subscriptions",
  WebhookEvent: "webhook_events",
  AdminAccount: "admin_accounts",
  FeatureFlag: "feature_flags",
  Announcement: "announcements",
  AuditLog: "audit_log",
};

export const getTable = (entityName) => TABLE[entityName];

/**
 * Resolve any repo table argument to the real physical PostgreSQL table name.
 *
 * The repo takes a *table* name, but a lot of code (the whole admin console)
 * passes the *entity* name from the historical Base44 surface. Passing "User"
 * straight through produced a query against a table that does not exist — the
 * hosted 404 was swallowed by the admin pages' safeList() and rendered as
 * "no data", while local mode read a localStorage key named "User" that
 * nothing ever wrote. Both modes looked "empty" and nobody noticed.
 *
 * Resolution lives here, at the single boundary where a table name is
 * consumed, so it covers indirect cases too (arrays of entity names, loops)
 * that no call-site edit would reliably catch.
 *
 * Unknown names pass through UNCHANGED rather than throwing: callers that
 * already pass real snake_case table names (e.g. repo.create("waitlist"))
 * must keep working, and a genuine typo should still fail loudly at the
 * database instead of being silently rewritten to something else.
 *
 * @param {string} name - entity name ("User") or table name ("user_profiles")
 * @returns {string} the physical table name
 */
export const resolveTable = (name) => {
  if (typeof name !== "string" || !name) return name;
  return TABLE[name] || name;
};

/**
 * Tables whose primary key is `bigint GENERATED ALWAYS AS IDENTITY` — the
 * server assigns the value. Every other table in the schema is uuid
 * (gen_random_uuid() or auth.uid()), for which a client-generated id is
 * correct and harmless.
 *
 * Injecting a crypto.randomUUID() into a bigint column fails with Postgres
 * 22P02 "invalid input syntax for type bigint", which is how the hosted
 * waitlist signup and the audit-log writes were broken while local mode
 * (plain JSON) tolerated the wrong value silently.
 */
export const IDENTITY_PK_TABLES = Object.freeze(["waitlist", "audit_log"]);

/** True when the table's id is server-generated and must never be sent. */
export const usesIdentityPrimaryKey = (table) =>
  IDENTITY_PK_TABLES.includes(resolveTable(table));