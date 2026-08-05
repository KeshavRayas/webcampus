import { db } from "@webcampus/db";
import { resolveHODDepartment } from "../hod/resolve-hod-department";

export type FeedbackRole = "faculty" | "hod" | "department" | "coe" | "admin";

export type FeedbackScope = {
  role: FeedbackRole;
  facultyId?: string;
  departmentId?: string;
};

export async function resolveFeedbackScope(
  userId: string,
  role: FeedbackRole
): Promise<FeedbackScope> {
  if (role === "admin" || role === "coe") return { role };

  if (role === "faculty") {
    const faculty = await db.faculty.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!faculty) throw new Error("Faculty profile not found");
    return { role, facultyId: faculty.id };
  }

  if (role === "hod") {
    const department = await resolveHODDepartment(userId);
    if (!department) throw new Error("HOD department not found");
    return { role, departmentId: department.departmentId };
  }

  const membership = await db.departmentUser.findFirst({
    where: { userId, role: { in: ["ADMIN", "VIEWER"] } },
    select: { departmentId: true },
  });
  if (!membership) throw new Error("Department membership not found");
  return { role, departmentId: membership.departmentId };
}
