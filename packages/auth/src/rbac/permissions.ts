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
  accounts: ["read", "update"],
  trust: ["read", "update"],
  support: ["create", "read", "reply", "updateStatus"],
  feedback: ["create", "read", "manage", "export"],
} as const;

export const ac = createAccessControl(statement);

export const roles = {
  admin: ac.newRole({
    ...adminAc.statements,
    courses: ["create", "read", "update", "delete"],
    courseAssignment: ["create", "read"],
    courseCoordinator: ["create", "read", "update"],
    courseApprovalOverride: ["read", "update"],
    section: ["read"],
    semester: ["create", "read", "delete", "update"],
    department: ["create", "read", "update", "delete"],
    sectionAssignment: ["create", "read", "update", "delete"],
    faculty: ["create", "read", "update", "delete"],
    admission: ["create", "read", "update", "delete", "port"],
    student: ["read", "delete"],
    registrationWindow: ["create", "read", "update"],
    freeze: ["read", "lock"],
    support: ["create", "read", "reply", "updateStatus"],
    feedback: ["read", "manage", "export"],
  }),
  applicant: ac.newRole({
    admission: ["read", "update"],
    department: ["read"],
    support: ["create", "read", "reply"],
    feedback: ["create", "read"],
  }),
  student: ac.newRole({
    user: [],
    support: ["create", "read", "reply"],
    feedback: ["create", "read"],
  }),
  faculty: ac.newRole({
    user: [],
    attendance: ["create"],
    freeze: ["read", "lock"],
    semester: ["read"],
    support: ["create", "read", "reply"],
    feedback: ["read"],
  }),
  coordinator: ac.newRole({
    attendance: ["create"],
    support: ["create", "read", "reply"],
    feedback: ["read", "export"],
  }),
  hod: ac.newRole({
    ...adminAc.statements,
    semester: ["read"],
    courseAssignment: ["create"],
    freeze: ["read", "lock"],
    support: ["create", "read", "reply"],
    feedback: ["read"],
  }),
  coe: ac.newRole({
    freeze: ["read", "lock"],
    attendance: ["read"],
    marks: ["read"],
    support: ["create", "read", "reply"],
    feedback: ["read", "export"],
  }),
  accounts: ac.newRole({
    accounts: ["read", "update"],
    trust: ["read", "update"],
    support: ["create", "read", "reply"],
    feedback: ["read"],
  }),
  trust: ac.newRole({
    accounts: ["read", "update"],
    trust: ["read", "update"],
    support: ["create", "read", "reply"],
    feedback: ["read"],
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
    feedback: ["read"],
  }),
  admission: ac.newRole({
    semester: ["read"],
    admission: ["create", "read", "delete", "update", "port"],
    user: ["set-role"],
    department: ["read"],
    support: ["create", "read", "reply"],
  }),
  "admission-instructor": ac.newRole({
    semester: ["read"],
    admission: ["create", "read"],
    user: ["set-role"],
    department: ["read"],
  }),
} satisfies Record<Role, unknown>;

export type Permissions = {
  [K in keyof typeof statement]: (typeof statement)[K][number][];
};
