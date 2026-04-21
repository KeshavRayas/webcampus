import type { Role } from "./rbac";

export type RequestContext = {
  userId: string;
  role: Role;
  departmentId?: string;
  // Snapshot-only field retained for migration and display compatibility.
  departmentName?: string;
};

export type DepartmentRequestContext = RequestContext & {
  role: "department";
  departmentId: string;
  departmentName?: string;
};

declare module "express-serve-static-core" {
  interface Request {
    requestContext?: RequestContext;
  }
}

export {};
