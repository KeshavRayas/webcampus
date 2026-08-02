export const roles = [
  "student",
  "faculty",
  "coordinator",
  "hod",
  "coe",
  "finance",
  "department",
  "admission_admin",
  "admin",
  "applicant",
] as const;

/** Type representing all allowed user roles in the system. */
export type Role = (typeof roles)[number];
