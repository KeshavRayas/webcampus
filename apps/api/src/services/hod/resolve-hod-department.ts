import { db } from "@webcampus/db";

export async function resolveHODDepartment(userId: string) {
  const hod = await db.hod.findUnique({
    where: { userId },
    select: {
      department: { select: { id: true, name: true, type: true } },
    },
  });

  if (!hod?.department) {
    return null;
  }

  return {
    departmentId: hod.department.id,
    departmentName: hod.department.name,
    departmentType: hod.department.type,
  };
}
