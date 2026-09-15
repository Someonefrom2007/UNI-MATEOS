-- UNI·MATE — Supabase schema (migration from base44/entities)
-- Generated from the 18 Base44 entity definitions. No application code changed.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- shared bits
-- ---------------------------------------------------------------------------

-- Auto-refresh updated_at on any UPDATE.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. user_profiles  (Base44 "User" entity — 1:1 with auth.users)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('admin', 'user')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles_select_own" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "user_profiles_insert_own" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "user_profiles_update_own" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "user_profiles_delete_own" ON public.user_profiles
  FOR DELETE USING (auth.uid() = id);

CREATE TRIGGER user_profiles_set_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. courses  (Base44 "Course")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.courses (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name               text NOT NULL,
  code               text,
  professor          text,
  ects               numeric NOT NULL DEFAULT 0,
  semester           text NOT NULL DEFAULT '1' CHECK (semester IN ('1', '2', 'full_year', 'custom')),
  academic_year      text,
  target_grade       numeric NOT NULL DEFAULT 7,
  color              text NOT NULL DEFAULT 'amber',
  attendance_required numeric NOT NULL DEFAULT 80,
  archived           boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courses_select_own" ON public.courses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "courses_insert_own" ON public.courses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "courses_update_own" ON public.courses
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "courses_delete_own" ON public.courses
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER courses_set_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. exams  (Base44 "Exam")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.exams (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text NOT NULL,
  course_id      uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  type           text NOT NULL DEFAULT 'exam'
                   CHECK (type IN ('exam', 'quiz', 'midterm', 'final', 'assignment', 'presentation', 'project', 'lab', 'oral', 'other')),
  date           date,
  time           text,
  weight         numeric NOT NULL DEFAULT 0,
  grade          numeric,
  expected_grade numeric,
  status         text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed')),
  topics         jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes          text,
  location       text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exams_select_own" ON public.exams
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "exams_insert_own" ON public.exams
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "exams_update_own" ON public.exams
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "exams_delete_own" ON public.exams
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER exams_set_updated_at
  BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. goals  (Base44 "Goal")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.goals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  category    text NOT NULL DEFAULT 'academic' CHECK (category IN ('academic', 'productivity', 'study', 'personal')),
  target      numeric NOT NULL DEFAULT 0,
  current     numeric NOT NULL DEFAULT 0,
  unit        text NOT NULL DEFAULT '',
  deadline    date,
  completed   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_select_own" ON public.goals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "goals_insert_own" ON public.goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goals_update_own" ON public.goals
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goals_delete_own" ON public.goals
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER goals_set_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. habits  (Base44 "Habit")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.habits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text NOT NULL,
  frequency      text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'custom')),
  icon           text NOT NULL DEFAULT 'Check',
  color          text NOT NULL DEFAULT 'amber',
  archived       boolean NOT NULL DEFAULT false,
  target_per_week numeric NOT NULL DEFAULT 7,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "habits_select_own" ON public.habits
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "habits_insert_own" ON public.habits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "habits_update_own" ON public.habits
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "habits_delete_own" ON public.habits
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER habits_set_updated_at
  BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. projects  (Base44 "Project")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.projects (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name              text NOT NULL,
  description       text,
  course_id         uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  deadline          date,
  estimated_duration numeric NOT NULL DEFAULT 0,
  actual_duration   numeric NOT NULL DEFAULT 0,
  progress          numeric NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'on_hold')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select_own" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "projects_insert_own" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "projects_update_own" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "projects_delete_own" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. tasks  (Base44 "Task")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tasks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title             text NOT NULL,
  description       text,
  course_id         uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  project_id        uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  exam_id           uuid REFERENCES public.exams(id) ON DELETE CASCADE,
  due_date          date,
  due_time          text,
  priority          text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status            text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed')),
  estimated_duration numeric NOT NULL DEFAULT 0,
  actual_duration   numeric NOT NULL DEFAULT 0,
  completed_date    date,
  tags              jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtasks          jsonb NOT NULL DEFAULT '[]'::jsonb,
  pinned            boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select_own" ON public.tasks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tasks_insert_own" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_update_own" ON public.tasks
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_delete_own" ON public.tasks
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. community_posts  (Base44 "CommunityPost")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.community_posts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  content    text NOT NULL,
  course_id  uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  type       text NOT NULL DEFAULT 'question' CHECK (type IN ('question', 'tip', 'win', 'resource')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_posts_select_own" ON public.community_posts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "community_posts_insert_own" ON public.community_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_posts_update_own" ON public.community_posts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_posts_delete_own" ON public.community_posts
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER community_posts_set_updated_at
  BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. community_likes  (Base44 "CommunityLike")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.community_likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id    uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);

ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_likes_select_own" ON public.community_likes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "community_likes_insert_own" ON public.community_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_likes_update_own" ON public.community_likes
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_likes_delete_own" ON public.community_likes
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER community_likes_set_updated_at
  BEFORE UPDATE ON public.community_likes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 10. community_replies  (Base44 "CommunityReply")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.community_replies (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id    uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_replies_select_own" ON public.community_replies
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "community_replies_insert_own" ON public.community_replies
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_replies_update_own" ON public.community_replies
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_replies_delete_own" ON public.community_replies
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER community_replies_set_updated_at
  BEFORE UPDATE ON public.community_replies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 11. attendance  (Base44 "Attendance")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.attendance (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id  uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  date       date NOT NULL,
  status     text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_select_own" ON public.attendance
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "attendance_insert_own" ON public.attendance
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "attendance_update_own" ON public.attendance
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "attendance_delete_own" ON public.attendance
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER attendance_set_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 12. focus_sessions  (Base44 "FocusSession")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id  uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  task_id    uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  exam_id    uuid REFERENCES public.exams(id) ON DELETE CASCADE,
  duration   numeric NOT NULL DEFAULT 0,
  date       date NOT NULL,
  completed  boolean NOT NULL DEFAULT true,
  interrupted boolean NOT NULL DEFAULT false,
  mode       text NOT NULL DEFAULT '25_5' CHECK (mode IN ('25_5', '50_10', 'custom')),
  label      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "focus_sessions_select_own" ON public.focus_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "focus_sessions_insert_own" ON public.focus_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "focus_sessions_update_own" ON public.focus_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "focus_sessions_delete_own" ON public.focus_sessions
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER focus_sessions_set_updated_at
  BEFORE UPDATE ON public.focus_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 13. grades  (Base44 "Grade")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.grades (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  course_id  uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  exam_id    uuid REFERENCES public.exams(id) ON DELETE CASCADE,
  weight     numeric NOT NULL DEFAULT 0,
  grade      numeric NOT NULL,
  date       date,
  type       text NOT NULL DEFAULT 'assignment' CHECK (type IN ('exam', 'quiz', 'assignment', 'project', 'participation', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grades_select_own" ON public.grades
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "grades_insert_own" ON public.grades
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "grades_update_own" ON public.grades
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "grades_delete_own" ON public.grades
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER grades_set_updated_at
  BEFORE UPDATE ON public.grades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 14. habit_logs  (Base44 "HabitLog")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.habit_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id   uuid NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  date       date NOT NULL,
  completed  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "habit_logs_select_own" ON public.habit_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "habit_logs_insert_own" ON public.habit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "habit_logs_update_own" ON public.habit_logs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "habit_logs_delete_own" ON public.habit_logs
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER habit_logs_set_updated_at
  BEFORE UPDATE ON public.habit_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 15. notes  (Base44 "Note")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  content    text,
  course_id  uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  exam_id    uuid REFERENCES public.exams(id) ON DELETE CASCADE,
  task_id    uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  pinned     boolean NOT NULL DEFAULT false,
  archived   boolean NOT NULL DEFAULT false,
  tags       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_select_own" ON public.notes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notes_insert_own" ON public.notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notes_update_own" ON public.notes
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notes_delete_own" ON public.notes
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER notes_set_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 16. resources  (Base44 "Resource")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.resources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  type        text NOT NULL DEFAULT 'link' CHECK (type IN ('pdf', 'doc', 'link', 'video', 'image', 'presentation', 'file')),
  course_id   uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  url         text,
  description text,
  tags        jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resources_select_own" ON public.resources
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "resources_insert_own" ON public.resources
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "resources_update_own" ON public.resources
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "resources_delete_own" ON public.resources
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER resources_set_updated_at
  BEFORE UPDATE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 17. schedule_events  (Base44 "ScheduleEvent")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.schedule_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title          text NOT NULL,
  type           text NOT NULL DEFAULT 'class' CHECK (type IN ('class', 'exam', 'task', 'study', 'personal', 'deadline')),
  course_id      uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  day_of_week    integer,
  start_time     text,
  end_time       text,
  date           date,
  room           text,
  professor      text,
  class_type     text,
  description    text,
  recurring      boolean NOT NULL DEFAULT true,
  google_event_id text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_events_select_own" ON public.schedule_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "schedule_events_insert_own" ON public.schedule_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "schedule_events_update_own" ON public.schedule_events
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "schedule_events_delete_own" ON public.schedule_events
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER schedule_events_set_updated_at
  BEFORE UPDATE ON public.schedule_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 18. sticky_notes  (Base44 "StickyNote")
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sticky_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content    text NOT NULL,
  color      text NOT NULL DEFAULT 'amber' CHECK (color IN ('amber', 'cyan', 'violet', 'emerald', 'rose', 'blue')),
  pinned     boolean NOT NULL DEFAULT false,
  rotation   numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sticky_notes_select_own" ON public.sticky_notes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sticky_notes_insert_own" ON public.sticky_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sticky_notes_update_own" ON public.sticky_notes
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sticky_notes_delete_own" ON public.sticky_notes
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER sticky_notes_set_updated_at
  BEFORE UPDATE ON public.sticky_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- indexes  (RLS scopes by user_id; FKs by referenced column)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS courses_user_id_idx            ON public.courses (user_id);
CREATE INDEX IF NOT EXISTS exams_user_id_idx              ON public.exams (user_id);
CREATE INDEX IF NOT EXISTS exams_course_id_idx            ON public.exams (course_id);
CREATE INDEX IF NOT EXISTS goals_user_id_idx              ON public.goals (user_id);
CREATE INDEX IF NOT EXISTS habits_user_id_idx             ON public.habits (user_id);
CREATE INDEX IF NOT EXISTS projects_user_id_idx           ON public.projects (user_id);
CREATE INDEX IF NOT EXISTS projects_course_id_idx         ON public.projects (course_id);
CREATE INDEX IF NOT EXISTS tasks_user_id_idx              ON public.tasks (user_id);
CREATE INDEX IF NOT EXISTS tasks_course_id_idx            ON public.tasks (course_id);
CREATE INDEX IF NOT EXISTS tasks_project_id_idx           ON public.tasks (project_id);
CREATE INDEX IF NOT EXISTS tasks_exam_id_idx              ON public.tasks (exam_id);
CREATE INDEX IF NOT EXISTS community_posts_user_id_idx    ON public.community_posts (user_id);
CREATE INDEX IF NOT EXISTS community_posts_course_id_idx  ON public.community_posts (course_id);
CREATE INDEX IF NOT EXISTS community_likes_user_id_idx    ON public.community_likes (user_id);
CREATE INDEX IF NOT EXISTS community_likes_post_id_idx    ON public.community_likes (post_id);
CREATE INDEX IF NOT EXISTS community_replies_user_id_idx  ON public.community_replies (user_id);
CREATE INDEX IF NOT EXISTS community_replies_post_id_idx  ON public.community_replies (post_id);
CREATE INDEX IF NOT EXISTS attendance_user_id_idx         ON public.attendance (user_id);
CREATE INDEX IF NOT EXISTS attendance_course_id_idx       ON public.attendance (course_id);
CREATE INDEX IF NOT EXISTS focus_sessions_user_id_idx     ON public.focus_sessions (user_id);
CREATE INDEX IF NOT EXISTS focus_sessions_course_id_idx   ON public.focus_sessions (course_id);
CREATE INDEX IF NOT EXISTS focus_sessions_task_id_idx     ON public.focus_sessions (task_id);
CREATE INDEX IF NOT EXISTS focus_sessions_exam_id_idx     ON public.focus_sessions (exam_id);
CREATE INDEX IF NOT EXISTS grades_user_id_idx             ON public.grades (user_id);
CREATE INDEX IF NOT EXISTS grades_course_id_idx           ON public.grades (course_id);
CREATE INDEX IF NOT EXISTS grades_exam_id_idx             ON public.grades (exam_id);
CREATE INDEX IF NOT EXISTS habit_logs_user_id_idx         ON public.habit_logs (user_id);
CREATE INDEX IF NOT EXISTS habit_logs_habit_id_idx        ON public.habit_logs (habit_id);
CREATE INDEX IF NOT EXISTS notes_user_id_idx              ON public.notes (user_id);
CREATE INDEX IF NOT EXISTS notes_course_id_idx            ON public.notes (course_id);
CREATE INDEX IF NOT EXISTS notes_exam_id_idx              ON public.notes (exam_id);
CREATE INDEX IF NOT EXISTS notes_task_id_idx              ON public.notes (task_id);
CREATE INDEX IF NOT EXISTS resources_user_id_idx          ON public.resources (user_id);
CREATE INDEX IF NOT EXISTS resources_course_id_idx        ON public.resources (course_id);
CREATE INDEX IF NOT EXISTS schedule_events_user_id_idx    ON public.schedule_events (user_id);
CREATE INDEX IF NOT EXISTS schedule_events_course_id_idx  ON public.schedule_events (course_id);
CREATE INDEX IF NOT EXISTS schedule_events_google_idx     ON public.schedule_events (google_event_id);
CREATE INDEX IF NOT EXISTS sticky_notes_user_id_idx       ON public.sticky_notes (user_id);

-- ---------------------------------------------------------------------------
-- profile auto-provisioning: mirror auth user -> user_profiles row
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Mission 5 (2026): community discovery upgrade — ADDITIVE and idempotent.
-- Apply to the hosted project to go live. Adds moderation states + author names
-- to posts and introduces saves/reports. Discovery reads of ACTIVE community
-- content are opened so the feed is community-wide while write control stays
-- strictly own-only (existing own policies still govern inserts/updates/deletes).
-- ---------------------------------------------------------------------------

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'hidden', 'removed'));

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS author_name text;

-- Community-wide discovery of active posts (own posts remain visible to their
-- author regardless of status via the pre-existing own-select policy).
CREATE POLICY IF NOT EXISTS "community_posts_select_discover" ON public.community_posts
  FOR SELECT USING (status = 'active');

-- Replies and likes must be readable to render threads and counts on others'
-- posts; every write (insert/update/delete) stays own-only.
CREATE POLICY IF NOT EXISTS "community_replies_select_discover" ON public.community_replies
  FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "community_likes_select_discover" ON public.community_likes
  FOR SELECT USING (true);

-- ---------------------------------------------------------------------------
-- Mission 5: community_saves  (bookmarks, multi-user ready)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.community_saves (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id    uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);

ALTER TABLE public.community_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_saves_select_own" ON public.community_saves
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "community_saves_insert_own" ON public.community_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_saves_update_own" ON public.community_saves
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_saves_delete_own" ON public.community_saves
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER community_saves_set_updated_at
  BEFORE UPDATE ON public.community_saves
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Mission 5: community_reports  (moderation intake, multi-user ready)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.community_reports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id    uuid REFERENCES public.community_posts(id) ON DELETE CASCADE,
  reply_id   uuid REFERENCES public.community_replies(id) ON DELETE CASCADE,
  reason     text NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'misinformation', 'other')),
  note       text,
  status     text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (post_id IS NOT NULL OR reply_id IS NOT NULL)
);

ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_reports_select_own" ON public.community_reports
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "community_reports_insert_own" ON public.community_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_reports_update_own" ON public.community_reports
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_reports_delete_own" ON public.community_reports
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER community_reports_set_updated_at
  BEFORE UPDATE ON public.community_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS community_posts_status_idx   ON public.community_posts (status);
CREATE INDEX IF NOT EXISTS community_saves_user_id_idx  ON public.community_saves (user_id);
CREATE INDEX IF NOT EXISTS community_saves_post_id_idx  ON public.community_saves (post_id);
CREATE INDEX IF NOT EXISTS community_reports_user_id_idx ON public.community_reports (user_id);
CREATE INDEX IF NOT EXISTS community_reports_post_id_idx ON public.community_reports (post_id);
CREATE INDEX IF NOT EXISTS community_reports_status_idx ON public.community_reports (status);
-- ---------------------------------------------------------------------------
-- Mission 5 follow-up (2026-09): first-class communities & study groups —
-- ADDITIVE and idempotent. Pending one-time apply to the hosted project.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.communities (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind           text NOT NULL DEFAULT 'course' CHECK (kind IN ('university', 'course')),
  name           text,
  university_name text,
  course_id      uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  course_name    text,
  description    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (name IS NOT NULL OR course_name IS NOT NULL OR university_name IS NOT NULL)
);

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "communities_select_own" ON public.communities
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "communities_insert_own" ON public.communities
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "communities_update_own" ON public.communities
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "communities_delete_own" ON public.communities
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER communities_set_updated_at
  BEFORE UPDATE ON public.communities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.study_groups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE,
  course_id    uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_groups_select_own" ON public.study_groups
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "study_groups_insert_own" ON public.study_groups
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "study_groups_update_own" ON public.study_groups
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "study_groups_delete_own" ON public.study_groups
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER study_groups_set_updated_at
  BEFORE UPDATE ON public.study_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Scope columns on posts (nullable — posts stay valid without a scope).
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES public.communities(id) ON DELETE SET NULL;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.study_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS communities_kind_idx           ON public.communities (kind);
CREATE INDEX IF NOT EXISTS communities_course_id_idx      ON public.communities (course_id);
CREATE INDEX IF NOT EXISTS study_groups_community_id_idx  ON public.study_groups (community_id);
CREATE INDEX IF NOT EXISTS study_groups_course_id_idx     ON public.study_groups (course_id);
CREATE INDEX IF NOT EXISTS community_posts_community_id_idx ON public.community_posts (community_id);
CREATE INDEX IF NOT EXISTS community_posts_group_id_idx    ON public.community_posts (group_id);
