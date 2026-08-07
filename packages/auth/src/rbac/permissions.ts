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
  courseAssignment: ["create", "read"],
  section: ["create", "read", "delete"],
  freeze: ["read", "lock"],
  faculty: ["create", "read", "update", "delete"],
  admission: ["create", "read", "update", "delete", "port"],
  student: ["read", "delete"],
  courseCoordinator: ["create", "read", "update"],
  courseApprovalOverride: ["read", "update"],
  registrationWindow: ["create", "read", "update"],
  finance: ["read", "update"],
  support: ["create", "read", "reply", "updateStatus"],
} as const;

export const ac = createAccessControl(statement);

const adminStatements = {
  ...adminAc.statements,
  courses: ["create", "read", "update", "delete"] as const,
  courseAssignment: ["create", "read"] as const,
  courseCoordinator: ["create", "read", "update"] as const,
  courseApprovalOverride: ["read", "update"] as const,
  section: ["read"] as const,
  semester: ["create", "read", "delete", "update"] as const,
  department: ["create", "read", "update", "delete"] as const,
  sectionAssignment: ["create", "read", "update", "delete"] as const,
  faculty: ["create", "read", "update", "delete"] as const,
  admission: ["create", "read", "update", "delete", "port"] as const,
  student: ["read", "delete"] as const,
  registrationWindow: ["create", "read", "update"] as const,
  freeze: ["read", "lock"] as const,
  support: ["create", "read", "reply", "updateStatus"] as const,
} as const;

export const roles = {
  admin: ac.newRole(adminStatements),
  super_admin: ac.newRole(adminStatements),
  applicant: ac.newRole({
    admission: ["read", "update"],
    department: ["read"],
    support: ["create", "read", "reply"],
  }),
  student: ac.newRole({
    user: [],
    support: ["create", "read", "reply"],
  }),
  faculty: ac.newRole({
    attendance: ["create"],
    freeze: ["read", "lock"],
    semester: ["read"],
    support: ["create", "read", "reply"],
  }),
  coordinator: ac.newRole({
    attendance: ["create"],
    support: ["create", "read", "reply"],
  }),
  hod: ac.newRole({
    ...adminAc.statements,
    semester: ["read"],
    courseAssignment: ["create"],
    freeze: ["read", "lock"],
    support: ["create", "read", "reply"],
  }),
  coe: ac.newRole({
    freeze: ["read", "lock"],
    attendance: ["read"],
    marks: ["read"],
    support: ["create", "read", "reply"],
  }),
  finance: ac.newRole({
    finance: ["read", "update"],
    support: ["create", "read", "reply"],
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
    courseAssignment: ["create", "read"],
    courseCoordinator: ["create", "read", "update"],
    freeze: ["read", "lock"],
    support: ["create", "read", "reply"],
  }),
  admission: ac.newRole({
    semester: ["read"],
    admission: ["create", "read", "delete", "update", "port"],
    user: ["set-role"],
    department: ["read"],
    support: ["create", "read", "reply"],
  }),
} satisfies Record<Role, unknown>;

export type Permissions = {
  [K in keyof typeof statement]: (typeof statement)[K][number][];
};
