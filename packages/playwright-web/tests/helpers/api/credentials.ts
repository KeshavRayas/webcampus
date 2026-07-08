const DEFAULT_PASSWORD = "password";

export const CREDENTIALS = {
  admin: {
    email: process.env.ADMIN_USER_EMAIL || "dev@webcampus.com",
    password: process.env.ADMIN_USER_PASSWORD || DEFAULT_PASSWORD,
  },
  department: {
    email: "dept.cs@webcampus.com",
    password: DEFAULT_PASSWORD,
  },
  faculty: {
    email: "faculty.cs@webcampus.com",
    password: DEFAULT_PASSWORD,
  },
  student: {
    email: "student.cs@webcampus.com",
    password: DEFAULT_PASSWORD,
  },
} as const;

export type RoleName = keyof typeof CREDENTIALS;
