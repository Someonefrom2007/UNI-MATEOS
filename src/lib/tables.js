// Entity name (Base44 API surface) -> Supabase table (snake_case).
export const TABLE = {
  Course: "courses",
  ScheduleEvent: "schedule_events",
  Task: "tasks",
  Exam: "exams",
  Grade: "grades",
  Note: "notes",
  Resource: "resources",
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
  User: "user_profiles",
};

export const getTable = (entityName) => TABLE[entityName];