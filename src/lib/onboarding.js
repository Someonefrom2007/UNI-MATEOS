// Onboarding completion.
//
// Onboarding is never shown automatically — it is an opt-in route reached from
// the dashboard. The flag exists so the dashboard can stop inviting a student
// who has already been through it, rather than nagging them forever.

import { getLang } from "@/lib/i18n";

const KEY = "unimate-onboarding";

export const isOnboardingDone = () => {
  try {
    return localStorage.getItem(KEY) === "done";
  } catch {
    return false;
  }
};

export const markOnboardingDone = () => {
  try {
    localStorage.setItem(KEY, "done");
  } catch {
    // storage unavailable — the invitation simply stays visible
  }
};

// The student's answers, used for the signed-in account metadata.
export const onboardingProfile = (form) => ({
  university: form.university || "",
  degree: form.degree || "",
  year: form.year || "1",
  semester: form.semester || "1",
  academic_year: form.academic_year || "",
  interests: form.goals || [],
  language: getLang(),
});
