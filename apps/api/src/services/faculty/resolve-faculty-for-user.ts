import { db } from "@webcampus/db";

export async function resolveFacultyIdForUser(userId: string): Promise<string> {
  const ownFaculty = await db.faculty.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (ownFaculty) {
    return ownFaculty.id;
  }

  const hod = await db.hod.findUnique({
    where: { userId },
    select: { facultyId: true },
  });
  if (hod?.facultyId) {
    return hod.facultyId;
  }

  throw new Error("Faculty profile not found");
}
