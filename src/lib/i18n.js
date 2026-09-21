// Lightweight i18n store. Three languages (en | ca | es), English default,
// persisted under 'unimate-lang'. Components subscribe through useI18n() and
// re-render instantly when the language changes (a window CustomEvent mirrors
// the useDeskMode pattern so no context provider is required).

import { useState, useEffect } from "react";

const STORAGE_KEY = "unimate-lang";
const EVENT = "unimate:lang";

export const LANGUAGES = [
  { code: "en", label: "EN", name: "English" },
  { code: "ca", label: "CA", name: "Català" },
  { code: "es", label: "ES", name: "Español" },
];

const DICT = {
  en: {
    // Navigation sections
    "nav.overview": "Overview",
    "nav.academics": "Academics",
    "nav.productivity": "Productivity",
    "nav.community": "Community",
    "nav.intelligence": "Intelligence",
    "nav.account": "Account",
    // Navigation items
    "nav.dashboard": "Dashboard",
    "nav.courses": "Courses",
    "nav.schedule": "Schedule",
    "nav.timeline": "Timeline",
    "timeline.title": "Academic Timeline",
    "timeline.subtitle": "Every week of the semester that actually exists in your recorded schedule.",
    "timeline.errorTitle": "Timeline unavailable",
    "timeline.errorDesc": "We could not load your semester's schedule right now.",
    "timeline.emptyTitle": "Nothing scheduled yet",
    "timeline.emptyDesc": "Record lectures, seminars and exams so the weeks have real classes to show.",
    "timeline.thisWeek": "This week",
    "timeline.quiet": "Nothing planned for this week",
    "timeline.now": "Now",
    "nav.tasks": "Tasks",
    "nav.exams": "Exams",
    "nav.grades": "Grades",
    "nav.notes": "Notes",
    "nav.stickies": "Sticky Wall",
    "nav.resources": "Resources",
    "nav.focus": "Focus",
    "nav.goals": "Goals",
    "nav.habits": "Habits",
    "nav.topics": "Topics",
    "nav.workload": "Workload",
    "nav.insights": "Insights",
    "nav.ai": "AI Assistant",
    "nav.flashcards": "Flashcards",
    "nav.studyPlan": "Study Planner",
    "nav.analytics": "Analytics",
    "nav.profile": "Profile",
    "nav.settings": "Settings",
    "nav.plans": "Plans",
    "nav.integrations": "Integrations",
    "nav.home": "Home",
    // AppShell HUD / chrome
    "shell.sysOnline": "Sys · online",
    "shell.search": "Search or jump to…",
    "shell.quickAdd": "Quick Add",
    "shell.menu": "Menu",
    "shell.logout": "Log out",
    "shell.student": "Student",
    // Notifications center
    "notify.title": "Notifications",
    "notify.markAll": "Mark all read",
    "notify.empty": "You're all caught up",
    "notify.emptySub": "Alerts from your real classes, deadlines, and progress show up here.",
    "notify.group.academic": "Academic",
    "notify.group.milestone": "Milestones",
    "notify.group.community": "Community",
    // Desk mode
    "desk.tidy": "Tidy desk",
    "desk.chaos": "Chaos mode",
    // Tasks page
    "tasks.clutter": "Current clutter",
    "tasks.open": "open",
    "tasks.overdue": "overdue",
    "tasks.panicToggle": "Panic / Triage",
    "tasks.panicOn": "Panic mode on",
    "tasks.panicMode": "Panic / triage mode",
    "tasks.next48h": "in next 48h",
    "tasks.views.today": "today",
    "tasks.views.upcoming": "upcoming",
    "tasks.views.overdue": "overdue",
    "tasks.views.all": "all",
    "tasks.views.completed": "completed",
    // Section titles
    "title.dashboard": "Dashboard",
    "title.courses": "Courses",
    "title.schedule": "Schedule",
    "title.tasks": "Tasks",
    "title.exams": "Exams",
    "title.focus": "Focus",
    "title.grades": "Grades",
    "title.notes": "Notes",
    "title.stickies": "Sticky Wall",
    "title.resources": "Resources",
    "title.topics": "Topics",
    "title.goals": "Goals",
    "title.habits": "Habits",
    "title.workload": "Workload",
    "title.insights": "Insights",
    "title.community": "Community",
    "title.ai": "AI Assistant",
    "title.flashcards": "Flashcards & quizzes",
    "title.studyPlan": "Smart study planner",
    "title.analytics": "Advanced analytics",
    "title.profile": "Profile",
    "title.settings": "Settings",
    "title.plans": "Plans",
    "title.integrations": "Integrations",
    // Section subtitles
    "title.courses.subtitle": "Everything you're studying this semester.",
    "title.schedule.subtitle": "Your time, three ways to see it.",
    "title.tasks.subtitle": "Everything that needs your attention.",
    "title.tasks.subtitle.empty": "Your first task should be effortless.",
    "title.exams.subtitle": "Countdowns and preparation, all in one place.",
    "title.focus.subtitle": "Deep work, timed and tracked across your courses.",
    "title.grades.subtitle": "Weighted assessments and grade averages — all calculated for you.",
    "title.notes.subtitle": "A first-class place for everything you write down.",
    "title.stickies.subtitle": "Half-formed thoughts welcome — stick them here before they escape.",
    "title.resources.subtitle": "Your study materials, linked to courses and notes.",
    "title.topics.subtitle": "Master the concepts behind your courses, one topic at a time.",
    "title.goals.subtitle": "Set targets and watch your progress fill in.",
    "title.habits.subtitle": "Consistency compounds. Track it without the noise.",
    "title.workload.subtitle": "How much work is really ahead of you this week.",
    "title.insights.subtitle": "Honest observations from your real data — no fabricated metrics.",
    "title.community.subtitle": "Questions, tips and wins from everyone on UNI·MATE.",
    "title.ai.subtitle": "Your academic copilot — grounded in your real UNI·MATE data.",
    "title.flashcards.subtitle": "Spaced repetition for the concepts you actually need to keep.",
    "title.studyPlan.subtitle": "A day-by-day prep schedule built from real course mastery data.",
    "title.analytics.subtitle": "Long-range numbers on the habits that move your marks.",
    "title.profile.subtitle": "Your academic identity and preferences.",
    "title.settings.subtitle": "Make UNI·MATE yours.",
    "title.plans.subtitle": "Free organizes. Pro helps. Ultra works with you.",
    "title.integrations.subtitle": "The outside world, wired into your planner.",
  },
  ca: {
    // Navigation sections
    "nav.overview": "Visió general",
    "nav.academics": "Acadèmic",
    "nav.productivity": "Productivitat",
    "nav.community": "Comunitat",
    "nav.intelligence": "Intel·ligència",
    "nav.account": "Compte",
    // Navigation items
    "nav.dashboard": "Taulell",
    "nav.courses": "Cursos",
    "nav.schedule": "Horari",
    "nav.timeline": "Línia temporal",
    "timeline.title": "Línia temporal acadèmica",
    "timeline.subtitle": "Cada setmana del semestre, construïda a partir de l'horari que realment has registrat.",
    "timeline.errorTitle": "Línia temporal no disponible",
    "timeline.errorDesc": "No hem pogut carregar l'horari del teu semestre ara mateix.",
    "timeline.emptyTitle": "Encara no hi ha res planificat",
    "timeline.emptyDesc": "Registra classes, seminaris i exàmens perquè les setmanes tinguin classes reals.",
    "timeline.thisWeek": "Aquesta setmana",
    "timeline.quiet": "Res planificat per a aquesta setmana.",
    "timeline.now": "Avui",
    "nav.tasks": "Tasques",
    "nav.exams": "Exàmens",
    "nav.grades": "Qualificacions",
    "nav.notes": "Notes",
    "nav.stickies": "Mur adhesiu",
    "nav.resources": "Recursos",
    "nav.focus": "Focus",
    "nav.goals": "Objectius",
    "nav.habits": "Hàbits",
    "nav.topics": "Temes",
    "nav.workload": "Càrrega",
    "nav.insights": "Perspectives",
    "nav.ai": "Assistent IA",
    "nav.flashcards": "Flashcards",
    "nav.studyPlan": "Planificador",
    "nav.analytics": "Analítiques",
    "nav.profile": "Perfil",
    "nav.settings": "Configuració",
    "nav.plans": "Plans",
    "nav.integrations": "Integracions",
    "nav.home": "Inici",
    // AppShell HUD / chrome
    "shell.sysOnline": "Sys · en línia",
    "shell.search": "Cerca o salta a…",
    "shell.quickAdd": "Afegir ràpid",
    "shell.menu": "Menú",
    "shell.logout": "Tanca sessió",
    "shell.student": "Estudiant",
    // Notifications center
    "notify.title": "Notificacions",
    "notify.markAll": "Marca-ho tot com a llegit",
    "notify.empty": "Estàs al dia",
    "notify.emptySub": "Aquí hi apareixen els avisos reals de classes, terminis i progressos.",
    "notify.group.academic": "Acadèmic",
    "notify.group.milestone": "Fites",
    "notify.group.community": "Comunitat",
    // Desk mode
    "desk.tidy": "Escriptori net",
    "desk.chaos": "Mode caos",
    // Tasks page
    "tasks.clutter": "Desordre actual",
    "tasks.open": "obertes",
    "tasks.overdue": "vençudes",
    "tasks.panicToggle": "Pànic / Triatge",
    "tasks.panicOn": "Mode pànic actiu",
    "tasks.panicMode": "Mode pànic / triatge",
    "tasks.next48h": "en les pròximes 48h",
    "tasks.views.today": "avui",
    "tasks.views.upcoming": "properes",
    "tasks.views.overdue": "vençudes",
    "tasks.views.all": "totes",
    "tasks.views.completed": "completades",
    // Section titles
    "title.dashboard": "Taulell",
    "title.courses": "Cursos",
    "title.schedule": "Horari",
    "title.tasks": "Tasques",
    "title.exams": "Exàmens",
    "title.focus": "Focus",
    "title.grades": "Qualificacions",
    "title.notes": "Notes",
    "title.stickies": "Mur adhesiu",
    "title.resources": "Recursos",
    "title.topics": "Temes",
    "title.goals": "Objectius",
    "title.habits": "Hàbits",
    "title.workload": "Càrrega",
    "title.insights": "Perspectives",
    "title.community": "Comunitat",
    "title.ai": "Assistent IA",
    "title.flashcards": "Flashcards i qüestionaris",
    "title.studyPlan": "Planificador d'estudi",
    "title.analytics": "Analítica avançada",
    "title.profile": "Perfil",
    "title.settings": "Configuració",
    "title.plans": "Plans",
    "title.integrations": "Integracions",
    // Section subtitles
    "title.courses.subtitle": "Tot el que estudies aquest semestre.",
    "title.schedule.subtitle": "El teu temps, de tres maneres.",
    "title.tasks.subtitle": "Tot el que necessita la teva atenció.",
    "title.tasks.subtitle.empty": "La teva primera tasca hauria de ser senzilla.",
    "title.exams.subtitle": "Comptes enrere i preparació, tot en un lloc.",
    "title.focus.subtitle": "Feina profunda, cronometrada i registrada als teus cursos.",
    "title.grades.subtitle": "Avaluacions ponderades i mitjanes — tot calculat per a tu.",
    "title.notes.subtitle": "Un lloc de primera per a tot el que apuntes.",
    "title.stickies.subtitle": "Pensaments a mitges benvinguts — enganxa'ls aquí abans que escapin.",
    "title.resources.subtitle": "Els teus materials d'estudi, enllaçats a cursos i notes.",
    "title.topics.subtitle": "Domina els conceptes clau dels teus cursos, tema a tema.",
    "title.goals.subtitle": "Defineix objectius i mira com s'omple el teu progrés.",
    "title.habits.subtitle": "La constància suma. Segueix-la sense soroll.",
    "title.workload.subtitle": "Quanta feina tens realment aquesta setmana.",
    "title.insights.subtitle": "Observacions honestes de les teves dades reals — sense mètriques inventades.",
    "title.community.subtitle": "Preguntes, consells i victòries de tothom a UNI·MATE.",
    "title.ai.subtitle": "El teu copilot acadèmic — basat en les teves dades reals d'UNI·MATE.",
    "title.studyPlan.subtitle": "Un pla de preparació dia a dia creat a partir del teu domini real de la matèria.",
    "title.analytics.subtitle": "Números a llarg termini sobre els hàbits que mouen les teves notes.",
    "title.flashcards.subtitle": "Repetició espaiada per als conceptes que realment necessites retenir.",
    "title.profile.subtitle": "La teva identitat acadèmica i preferències.",
    "title.settings.subtitle": "Fes que UNI·MATE sigui teu.",
    "title.plans.subtitle": "Free organitza. Pro ajuda. Ultra treballa amb tu.",
    "title.integrations.subtitle": "El món exterior, connectat al teu planificador.",
  },
  es: {
    // Navigation sections
    "nav.overview": "Resumen",
    "nav.academics": "Académico",
    "nav.productivity": "Productividad",
    "nav.community": "Comunidad",
    "nav.intelligence": "Inteligencia",
    "nav.account": "Cuenta",
    // Navigation items
    "nav.dashboard": "Panel",
    "nav.courses": "Cursos",
    "nav.schedule": "Horario",
    "nav.timeline": "Línea temporal",
    "timeline.title": "Línea temporal académica",
    "timeline.subtitle": "Cada semana del semestre, construida a partir del horario que realmente registraste.",
    "timeline.errorTitle": "Línea temporal no disponible",
    "timeline.errorDesc": "No pudimos cargar el horario de tu semestre en este momento.",
    "timeline.emptyTitle": "Aún no hay nada planificado",
    "timeline.emptyDesc": "Registra clases, seminarios y exámenes para que las semanas tengan clases reales.",
    "timeline.thisWeek": "Esta semana",
    "timeline.quiet": "Nada planificado para esta semana.",
    "timeline.now": "Hoy",
    "nav.tasks": "Tareas",
    "nav.exams": "Exámenes",
    "nav.grades": "Calificaciones",
    "nav.notes": "Notas",
    "nav.stickies": "Muro de notas",
    "nav.resources": "Recursos",
    "nav.focus": "Enfoque",
    "nav.goals": "Objetivos",
    "nav.habits": "Hábitos",
    "nav.topics": "Temas",
    "nav.workload": "Carga",
    "nav.insights": "Perspectivas",
    "nav.ai": "Asistente IA",
    "nav.flashcards": "Flashcards",
    "nav.studyPlan": "Planificador",
    "nav.analytics": "Analíticas",
    "nav.profile": "Perfil",
    "nav.settings": "Configuración",
    "nav.plans": "Planes",
    "nav.integrations": "Integraciones",
    "nav.home": "Inicio",
    // AppShell HUD / chrome
    "shell.sysOnline": "Sys · en línea",
    "shell.search": "Buscar o saltar a…",
    "shell.quickAdd": "Agregar rápido",
    "shell.menu": "Menú",
    "shell.logout": "Cerrar sesión",
    "shell.student": "Estudiante",
    // Notifications center
    "notify.title": "Notificaciones",
    "notify.markAll": "Marcar todo como leído",
    "notify.empty": "Estás al día",
    "notify.emptySub": "Aquí aparecen los avisos reales de clases, plazos y progreso.",
    "notify.group.academic": "Académico",
    "notify.group.milestone": "Hitos",
    "notify.group.community": "Comunidad",
    // Desk mode
    "desk.tidy": "Escritorio limpio",
    "desk.chaos": "Modo caos",
    // Tasks page
    "tasks.clutter": "Desorden actual",
    "tasks.open": "abiertas",
    "tasks.overdue": "vencidas",
    "tasks.panicToggle": "Pánico / Triaje",
    "tasks.panicOn": "Modo pánico activo",
    "tasks.panicMode": "Modo pánico / triaje",
    "tasks.next48h": "en las próximas 48h",
    "tasks.views.today": "hoy",
    "tasks.views.upcoming": "próximas",
    "tasks.views.overdue": "vencidas",
    "tasks.views.all": "todas",
    "tasks.views.completed": "completadas",
    // Section titles
    "title.dashboard": "Panel",
    "title.courses": "Cursos",
    "title.schedule": "Horario",
    "title.tasks": "Tareas",
    "title.exams": "Exámenes",
    "title.focus": "Enfoque",
    "title.grades": "Calificaciones",
    "title.notes": "Notas",
    "title.stickies": "Muro de notas",
    "title.resources": "Recursos",
    "title.topics": "Temas",
    "title.goals": "Objetivos",
    "title.habits": "Hábitos",
    "title.workload": "Carga",
    "title.insights": "Perspectivas",
    "title.community": "Comunidad",
    "title.ai": "Asistente IA",
    "title.flashcards": "Flashcards y cuestionarios",
    "title.studyPlan": "Planificador de estudio",
    "title.analytics": "Analítica avanzada",
    "title.profile": "Perfil",
    "title.settings": "Configuración",
    "title.plans": "Planes",
    "title.integrations": "Integraciones",
    // Section subtitles
    "title.courses.subtitle": "Todo lo que estás estudiando este semestre.",
    "title.schedule.subtitle": "Tu tiempo, de tres formas.",
    "title.tasks.subtitle": "Todo lo que necesita tu atención.",
    "title.tasks.subtitle.empty": "Tu primera tarea debería ser sencilla.",
    "title.exams.subtitle": "Cuentas atrás y preparación, todo en un solo lugar.",
    "title.focus.subtitle": "Trabajo profundo, cronometrado y registrado en tus cursos.",
    "title.grades.subtitle": "Evaluaciones ponderadas y medias — todo calculado por ti.",
    "title.notes.subtitle": "Un lugar de primera para todo lo que escribes.",
    "title.stickies.subtitle": "Pensamientos a medias bienvenidos — pégalos aquí antes de que escapen.",
    "title.resources.subtitle": "Tus materiales de estudio, enlazados a cursos y notas.",
    "title.topics.subtitle": "Domina los conceptos clave de tus cursos, tema a tema.",
    "title.goals.subtitle": "Define objetivos y mira cómo se llena tu progreso.",
    "title.habits.subtitle": "La constancia suma. Síguela sin ruido.",
    "title.workload.subtitle": "Cuánto trabajo te espera realmente esta semana.",
    "title.insights.subtitle": "Observaciones honestas de tus datos reales — sin métricas inventadas.",
    "title.community.subtitle": "Preguntas, consejos y victorias de todos en UNI·MATE.",
    "title.ai.subtitle": "Tu copiloto académico — basado en tus datos reales de UNI·MATE.",
    "title.studyPlan.subtitle": "Un plan de preparación día a día a partir de tu dominio real de la materia.",
    "title.analytics.subtitle": "Números a largo plazo sobre los hábitos que mueven tus notas.",
    "title.flashcards.subtitle": "Repetición espaciada para los conceptos que de verdad necesitas retener.",
    "title.profile.subtitle": "Tu identidad académica y preferencias.",
    "title.settings.subtitle": "Haz que UNI·MATE sea tuyo.",
    "title.plans.subtitle": "Free organiza. Pro ayuda. Ultra trabaja contigo.",
    "title.integrations.subtitle": "El mundo exterior, conectado a tu planificador.",
  },
};

const isValid = (c) => LANGUAGES.some((l) => l.code === c);

// Module-level cache so getLang() mirrors document state across effect runs.
let current = null;

const readStored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

function detectLang() {
  const stored = typeof window !== "undefined" ? readStored() : null;
  if (stored && isValid(stored)) return stored;
  const nav = typeof navigator !== "undefined" ? (navigator.language || "").slice(0, 2).toLowerCase() : null;
  if (nav && isValid(nav)) return nav;
  return "en";
}

export const getLang = () => {
  if (current && isValid(current)) return current;
  current = detectLang();
  return current;
};

export const setLang = (code) => {
  if (!isValid(code)) return;
  current = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // storage unavailable — language still applies for this session
  }
  if (typeof document !== "undefined") document.documentElement.lang = code;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: code }));
};

export const useI18n = () => {
  const [lang, setLangState] = useState(getLang);

  useEffect(() => {
    if (typeof document !== "undefined" && isValid(document.documentElement.lang)) {
      document.documentElement.lang = lang;
    }
    const onLang = () => setLangState(getLang());
    window.addEventListener(EVENT, onLang);
    return () => window.removeEventListener(EVENT, onLang);
  }, [lang]);

  const t = (key) => {
    const table = DICT[lang];
    if (table && table[key] !== undefined) return table[key];
    const fallback = DICT.en;
    return (fallback[key] !== undefined ? fallback[key] : key);
  };

  return { lang, setLang, t, LANGUAGES };
};