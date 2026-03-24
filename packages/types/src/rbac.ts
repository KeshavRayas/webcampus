export const roles = [
  "student",
  "faculty",
  "coordinator",
  "hod",
  "coe",
  "department",
  "admission_admin",
  "admission_reviewer",
  "admin",
  "applicant",
] as const;

/** Type representing all allowed user roles in the system. */
export type Role = (typeof roles)[number];
