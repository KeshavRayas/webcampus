import { db } from "@webcampus/db";
import type {
  DepartmentRequestContext,
  RequestContext,
} from "@webcampus/types/request-context";
import type { Request } from "express";

export const getRequestContext = (req: Request): RequestContext => {
  if (!req.requestContext?.userId || !req.requestContext.role) {
    throw new Error("Unauthorized");
  }

  return req.requestContext;
};

export const getDepartmentRequestContext = async (
  req: Request
): Promise<DepartmentRequestContext> => {
  const requestContext = getRequestContext(req);

  if (requestContext.departmentId && requestContext.role === "department") {
    return requestContext as DepartmentRequestContext;
  }

  if (requestContext.role !== "department") {
    throw new Error("Forbidden");
  }

  const primaryMembership = await db.departmentUser.findFirst({
    where: {
      userId: requestContext.userId,
      isPrimary: true,
    },
    select: {
      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const fallbackMembership = primaryMembership
    ? null
    : await db.departmentUser.findFirst({
        where: {
          userId: requestContext.userId,
        },
        select: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

  const legacyDepartment =
    primaryMembership || fallbackMembership
      ? null
      : await db.department.findFirst({
          where: { userId: requestContext.userId },
          select: { id: true, name: true },
        });

  const department =
    primaryMembership?.department ??
    fallbackMembership?.department ??
    legacyDepartment;

  if (!department) {
    throw new Error("Department not found");
  }

  const departmentRequestContext: DepartmentRequestContext = {
    userId: requestContext.userId,
    role: "department",
    departmentId: department.id,
    // Keep name as a compatibility snapshot only.
    departmentName: department.name,
  };

  req.requestContext = departmentRequestContext;

  return departmentRequestContext;
};