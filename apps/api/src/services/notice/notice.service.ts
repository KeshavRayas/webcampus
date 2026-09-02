import { db } from "@webcampus/db";

export type NoticeInput = {
  title: string;
  content: string;
  audience: "STUDENTS" | "FACULTY" | "BOTH";
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status?: "DRAFT" | "PUBLISHED";
  expiresAt?: string | null;
};

const activeWhere = (audience: "STUDENTS" | "FACULTY") => ({
  status: "PUBLISHED" as const,
  OR: [{ audience }, { audience: "BOTH" as const }],
  AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
});

export class NoticeService {
  static async listForStudent(userId: string) {
    const student = await db.student.findUnique({
      where: { userId },
      select: { id: true, departmentId: true, departmentName: true },
    });
    if (!student) return [];

    const latestSection = await db.studentSection.findFirst({
      where: { studentId: student.id },
      orderBy: { semester: "desc" },
      select: { section: { select: { departmentId: true } } },
    });
    if (latestSection?.section?.departmentId) {
      return this.listAudience(latestSection.section.departmentId, "STUDENTS");
    }

    return this.listAudience(student.departmentId, "STUDENTS");
  }

  static async listForFaculty(userId: string) {
    const faculty = await db.faculty.findUnique({
      where: { userId },
      select: { departmentId: true },
    });
    if (!faculty) return [];
    return this.listAudience(faculty.departmentId, "FACULTY");
  }

  static async listAudienceByDepartmentName(
    departmentName: string,
    audience: "STUDENTS" | "FACULTY"
  ) {
    const department = await db.department.findUnique({
      where: { name: departmentName },
      select: { id: true },
    });
    return department ? this.listAudience(department.id, audience) : [];
  }

  static listDepartment(
    departmentId: string,
    filters: { status?: string; audience?: string }
  ) {
    return db.notice.findMany({
      where: {
        departmentId,
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.audience ? { audience: filters.audience as never } : {}),
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });
  }

  static listAudience(departmentId: string, audience: "STUDENTS" | "FACULTY") {
    return db.notice.findMany({
      where: { departmentId, ...activeWhere(audience) },
      orderBy: [{ priority: "desc" }, { publishedAt: "desc" }],
    });
  }

  static async create(
    departmentId: string,
    createdById: string,
    input: NoticeInput
  ): Promise<unknown> {
    return db.notice.create({
      data: {
        ...input,
        departmentId,
        createdById,
        status: input.status ?? "DRAFT",
        priority: input.priority ?? "NORMAL",
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        publishedAt: input.status === "PUBLISHED" ? new Date() : null,
      },
    });
  }

  static async update(
    departmentId: string,
    id: string,
    input: Partial<NoticeInput>
  ) {
    const existing = await db.notice.findFirst({
      where: { id, departmentId },
    });
    if (!existing) throw new Error("Notice not found");
    return db.notice.update({
      where: { id },
      data: {
        ...input,
        ...(input.expiresAt !== undefined
          ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }
          : {}),
        ...(input.status
          ? {
              publishedAt:
                input.status === "PUBLISHED"
                  ? (existing.publishedAt ?? new Date())
                  : existing.publishedAt,
            }
          : {}),
      },
    });
  }

  static async remove(departmentId: string, id: string) {
    const existing = await db.notice.findFirst({
      where: { id, departmentId },
    });
    if (!existing) throw new Error("Notice not found");
    await db.notice.delete({ where: { id } });
  }

  static async setStatus(
    departmentId: string,
    id: string,
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
  ) {
    const existing = await db.notice.findFirst({
      where: { id, departmentId },
    });
    if (!existing) throw new Error("Notice not found");
    return db.notice.update({
      where: { id },
      data: {
        status,
        publishedAt:
          status === "PUBLISHED"
            ? (existing.publishedAt ?? new Date())
            : existing.publishedAt,
      },
    });
  }
}
