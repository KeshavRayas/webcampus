import { type Role } from "@webcampus/types/rbac";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

const statement = {
  ...defaultStatements,
  attendance: ["create", "read"],
  marks: ["read"],
  semester: ["create", "delete", "read", "update"],
  courses: ["create", "read", "update", "delete"],
  department: ["create", "read", "update", "delete"],
  hod: ["create", "read", "remove"],
  sectionAssignment: ["create", "read", "update", "delete"],
  courseAssignment: ["create"],
  section: ["create", "read", "delete"],
  freeze: ["read", "lock"],
  faculty: ["create", "read", "update", "delete"],
  admission: ["create", "read", "update", "delete", "port"],
  student: ["read", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const roles = {
  admin: ac.newRole({
    ...adminAc.statements,
    semester: ["create", "read", "delete", "update"],
    department: ["create", "read", "update", "delete"],
    sectionAssignment: ["create", "read", "update", "delete"],
    faculty: ["create", "read", "update", "delete"],
    admission: ["create", "read", "update", "delete", "port"],
    student: ["read", "delete"],
  }),
  applicant: ac.newRole({
    admission: ["read", "update"],
    department: ["read"],
  }),
  student: ac.newRole({
    user: [],
  }),
  faculty: ac.newRole({
    attendance: ["create"],
  }),
  coordinator: ac.newRole({
    attendance: ["create"],
  }),
  hod: ac.newRole({
    ...adminAc.statements,
    courseAssignment: ["create"],
  }),
  coe: ac.newRole({
    freeze: ["read", "lock"],
    attendance: ["read"],
    marks: ["read"],
  }),
  department: ac.newRole({
    ...adminAc.statements,
    courses: ["create", "read", "update", "delete"],
    hod: ["create", "read", "remove"],
    faculty: ["read"],
    student: ["read"],
    sectionAssignment: ["create", "read", "update", "delete"],
    section: ["create", "read", "delete"],
    semester: ["read"],
  }),
  admission_admin: ac.newRole({
    semester: ["read"],
    admission: ["create", "read", "delete"],
    user: ["set-role"],
    department: ["read"],
  }),
  admission_reviewer: ac.newRole({
    semester: ["read"],
    admission: ["read", "update", "port", "delete"],
    department: ["read"],
  }),
} satisfies Record<Role, unknown>;

export type Permissions = {
  [K in keyof typeof statement]: (typeof statement)[K][number][];
};
