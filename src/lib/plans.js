// Plan model — the three tiers UNI·MATE actually has.
//
// Directive §35 fixes the names, the count and the meanings: FREE organises,
// PRO understands, ULTIMATE connects. It also requires every tier to carry
// real limits rather than a feature list that reads well and constrains
// nothing, so limits are data here and the UI renders what this module
// reports.
//
// There is no billing in this build and no plan is purchasable, so every
// workspace resolves to FREE. Nothing in the app is gated behind a plan it
// cannot yet grant: `entitlementFor` returns the FREE limits for everyone,
// and the limit values are chosen so FREE is the complete product §35 says it
// must be — a student who never pays still has the whole academic OS. The
// limits exist to be *reported* and to be ready when PRO/ULTIMATE ship.

export const PLAN_IDS = ["free", "pro", "ultimate"];

export const PLANS = {
  free: {
    id: "free",
    name: "FREE",
    purpose: "ORGANIZE",
    tagline: "The complete academic OS.",
    summary: "Everything you need to run a semester. Not a trial.",
    limits: {
      // Local-first (§36) means there is no sync quota to meter: the workspace
      // is the device. These bound the *product*, not the student's data.
      courses: Infinity,
      aiMessagesPerDay: 20,
      studyPlanHorizonDays: 7,
      gradeSimulations: Infinity,
      cloudSync: false,
      community: true,
      aiSyllabusParsing: false,
      predictiveWorkload: false,
    },
  },
  pro: {
    id: "pro",
    name: "PRO",
    purpose: "UNDERSTAND",
    tagline: "UNI·MATE gets intelligent.",
    summary: "Everything in Free, plus the analysis that tells you what it means.",
    limits: {
      courses: Infinity,
      aiMessagesPerDay: 500,
      studyPlanHorizonDays: 30,
      gradeSimulations: Infinity,
      cloudSync: false,
      community: true,
      aiSyllabusParsing: true,
      predictiveWorkload: true,
    },
  },
  ultimate: {
    id: "ultimate",
    name: "ULTIMATE",
    purpose: "CONNECT",
    tagline: "Your whole academic world, connected.",
    summary: "Everything in Pro, plus sync, collaboration and campus integrations.",
    limits: {
      courses: Infinity,
      aiMessagesPerDay: Infinity,
      studyPlanHorizonDays: 90,
      gradeSimulations: Infinity,
      cloudSync: true,
      community: true,
      aiSyllabusParsing: true,
      predictiveWorkload: true,
    },
  },
};

// Feature copy per tier, kept beside the limits so the two cannot drift. The
// capabilities named here are the ones the directive assigns to each tier.
export const PLAN_FEATURES = {
  free: [
    "Dashboard, Courses, Schedule, Tasks",
    "Exams, Grades and ECTS averages",
    "Notes, Resources and Sticky Wall",
    "Focus, Goals, Habits and Attendance",
    "Workload and Insights",
    "AI assistant with your real context",
    "Community and study groups",
  ],
  pro: [
    "Everything in Free",
    "AI parsing of syllabus documents and photos",
    "Advanced grade simulation",
    "Predictive workload and heatmaps",
    "Smart study planning",
    "AI study assistance",
  ],
  ultimate: [
    "Everything in Pro",
    "Cloud sync across devices",
    "Shared course repositories",
    "Study-group collaboration",
    "University and campus integrations",
    "Advanced personalisation",
  ],
};

// What a gated capability is called in the UI, so a locked affordance can say
// which tier unlocks it instead of just refusing.
export const CAPABILITY_PLANS = {
  aiSyllabusParsing: "pro",
  predictiveWorkload: "pro",
  cloudSync: "ultimate",
};

export const isPlanId = (id) => PLAN_IDS.includes(id);

export const planById = (id) => PLANS[id] || null;

/**
 * The active entitlement for a workspace. Always FREE today: no billing
 * exists, so nothing may claim otherwise. A stored plan is accepted so the
 * wiring is ready for real accounts, but anything other than FREE is refused —
 * a client-side value must not be able to grant itself a paid tier.
 */
export const entitlementFor = (storedPlanId) => {
  const requested = planById(storedPlanId);
  return requested && requested.id === "free" ? requested : PLANS.free;
};

/** Plan that would unlock a capability, or null if FREE already has it. */
export const planForCapability = (capability) => {
  const id = CAPABILITY_PLANS[capability];
  return id ? PLANS[id] : null;
};

/** Whether the given entitlement includes a capability. */
export const hasCapability = (entitlement, capability) => {
  const plan = planById(entitlement?.id) || PLANS.free;
  return Boolean(plan.limits[capability]);
};

export const remainingAiMessages = (entitlement, usedToday) => {
  const cap = (planById(entitlement?.id) || PLANS.free).limits.aiMessagesPerDay;
  if (cap === Infinity) return Infinity;
  const used = Number.isFinite(usedToday) && usedToday > 0 ? Math.floor(usedToday) : 0;
  return Math.max(0, cap - used);
};
