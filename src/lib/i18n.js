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
    "nav.tasks": "Tasks",
    "nav.exams": "Exams",
    "nav.grades": "Grades",
    "nav.notes": "Notes",
    "nav.stickies": "Sticky Wall",
    "nav.resources": "Resources",
    "nav.focus": "Focus",
    "nav.goals": "Goals",
    "nav.habits": "Habits",
    "nav.notifications": "Attention",
    "nav.workload": "Workload",
    "nav.insights": "Insights",
    "nav.ai": "AI Assistant",
    "nav.profile": "Profile",
    "nav.settings": "Settings",
    "nav.plans": "Plans",
    "nav.home": "Home",
    // AppShell HUD / chrome
    "shell.sysOnline": "Sys · online",
    "shell.search": "Search or jump to…",
    "shell.quickAdd": "Quick Add",
    "shell.menu": "Menu",
    "shell.logout": "Log out",
    "shell.student": "Student",
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
    "tasks.views.archived": "archived",
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
    "title.goals": "Goals",
    "title.habits": "Habits",
    "title.workload": "Workload",
    "title.insights": "Insights",
    "title.community": "Community",
    "title.ai": "AI Assistant",
    "title.profile": "Profile",
    "title.settings": "Settings",
    "title.plans": "Plans",
    "title.notifications": "Attention",
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
    "title.goals.subtitle": "Set targets and watch your progress fill in.",
    "title.habits.subtitle": "Consistency compounds. Track it without the noise.",
    "title.workload.subtitle": "How much work is really ahead of you this week.",
    "title.insights.subtitle": "Honest observations from your real data — no fabricated metrics.",
    "title.community.subtitle": "Questions, tips and wins from everyone on UNI·MATE.",
    "title.ai.subtitle": "Your academic copilot — grounded in your real UNI·MATE data.",
    "title.profile.subtitle": "Your academic identity and preferences.",
    "title.settings.subtitle": "Make UNI·MATE yours.",
    "title.plans.subtitle": "Free organizes. Pro helps. Ultra works with you.",
    "title.notifications.subtitle": "What actually needs you, derived from your own data.",
    // Empty states
    "empty.notifications.title": "Nothing needs you right now",
    "empty.notifications.description": "Deadlines, exams, schedule clashes and academic risk show up here as soon as there is something real to act on.",
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
    "nav.tasks": "Tasques",
    "nav.exams": "Exàmens",
    "nav.grades": "Qualificacions",
    "nav.notes": "Notes",
    "nav.stickies": "Mur adhesiu",
    "nav.resources": "Recursos",
    "nav.focus": "Focus",
    "nav.goals": "Objectius",
    "nav.habits": "Hàbits",
    "nav.notifications": "Atenció",
    "nav.workload": "Càrrega",
    "nav.insights": "Perspectives",
    "nav.ai": "Assistent IA",
    "nav.profile": "Perfil",
    "nav.settings": "Configuració",
    "nav.plans": "Plans",
    "nav.home": "Inici",
    // AppShell HUD / chrome
    "shell.sysOnline": "Sys · en línia",
    "shell.search": "Cerca o salta a…",
    "shell.quickAdd": "Afegir ràpid",
    "shell.menu": "Menú",
    "shell.logout": "Tanca sessió",
    "shell.student": "Estudiant",
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
    "tasks.views.archived": "arxivades",
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
    "title.goals": "Objectius",
    "title.habits": "Hàbits",
    "title.workload": "Càrrega",
    "title.insights": "Perspectives",
    "title.community": "Comunitat",
    "title.ai": "Assistent IA",
    "title.profile": "Perfil",
    "title.settings": "Configuració",
    "title.plans": "Plans",
    "title.notifications": "Atenció",
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
    "title.goals.subtitle": "Defineix objectius i mira com s'omple el teu progrés.",
    "title.habits.subtitle": "La constància suma. Segueix-la sense soroll.",
    "title.workload.subtitle": "Quanta feina tens realment aquesta setmana.",
    "title.insights.subtitle": "Observacions honestes de les teves dades reals — sense mètriques inventades.",
    "title.community.subtitle": "Preguntes, consells i victòries de tothom a UNI·MATE.",
    "title.ai.subtitle": "El teu copilot acadèmic — basat en les teves dades reals d'UNI·MATE.",
    "title.profile.subtitle": "La teva identitat acadèmica i preferències.",
    "title.settings.subtitle": "Fes que UNI·MATE sigui teu.",
    "title.plans.subtitle": "Free organitza. Pro ajuda. Ultra treballa amb tu.",
    "title.notifications.subtitle": "El que realment et reclama, derivat de les teves pròpies dades.",
    // Empty states
    "empty.notifications.title": "Ara mateix res no et reclama",
    "empty.notifications.description": "Els lliuraments, exàmens, xocs d'horari i risc acadèmic apareixen aquí tan bon punt hi ha alguna cosa real per fer.",
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
    "nav.tasks": "Tareas",
    "nav.exams": "Exámenes",
    "nav.grades": "Calificaciones",
    "nav.notes": "Notas",
    "nav.stickies": "Muro de notas",
    "nav.resources": "Recursos",
    "nav.focus": "Enfoque",
    "nav.goals": "Objetivos",
    "nav.habits": "Hábitos",
    "nav.notifications": "Atención",
    "nav.workload": "Carga",
    "nav.insights": "Perspectivas",
    "nav.ai": "Asistente IA",
    "nav.profile": "Perfil",
    "nav.settings": "Configuración",
    "nav.plans": "Planes",
    "nav.home": "Inicio",
    // AppShell HUD / chrome
    "shell.sysOnline": "Sys · en línea",
    "shell.search": "Buscar o saltar a…",
    "shell.quickAdd": "Agregar rápido",
    "shell.menu": "Menú",
    "shell.logout": "Cerrar sesión",
    "shell.student": "Estudiante",
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
    "tasks.views.archived": "archivadas",
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
    "title.goals": "Objetivos",
    "title.habits": "Hábitos",
    "title.workload": "Carga",
    "title.insights": "Perspectivas",
    "title.community": "Comunidad",
    "title.ai": "Asistente IA",
    "title.profile": "Perfil",
    "title.settings": "Configuración",
    "title.plans": "Planes",
    "title.notifications": "Atención",
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
    "title.goals.subtitle": "Define objetivos y mira cómo se llena tu progreso.",
    "title.habits.subtitle": "La constancia suma. Síguela sin ruido.",
    "title.workload.subtitle": "Cuánto trabajo te espera realmente esta semana.",
    "title.insights.subtitle": "Observaciones honestas de tus datos reales — sin métricas inventadas.",
    "title.community.subtitle": "Preguntas, consejos y victorias de todos en UNI·MATE.",
    "title.ai.subtitle": "Tu copiloto académico — basado en tus datos reales de UNI·MATE.",
    "title.profile.subtitle": "Tu identidad académica y preferencias.",
    "title.settings.subtitle": "Haz que UNI·MATE sea tuyo.",
    "title.plans.subtitle": "Free organiza. Pro ayuda. Ultra trabaja contigo.",
    "title.notifications.subtitle": "Lo que de verdad te reclama, derivado de tus propios datos.",
    // Empty states
    "empty.notifications.title": "Ahora mismo nada te reclama",
    "empty.notifications.description": "Los entregables, exámenes, choques de horario y riesgo académico aparecen aquí en cuanto hay algo real que hacer.",
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