import { DepartmentContextResolver } from "@webcampus/api/src/services/shared/department-context-resolver.service";
import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import {
  CreateSectionType,
  SectionResponseType,
} from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";
import { ProjectMappingService } from "../department/project-mapping.service";

/**
 * Admin-scoped section service — explicit departmentId per request, no
 * session-derived department context. Mirrors the AdminCourseService →
 * CourseService delegation pattern (course.service.ts:33-79) but for sections.
 * Auth is role-level (admin router), data scope is request-level.
 */
export class AdminSectionService {
  static async create(
    data: CreateSectionType & {
      departmentId: string;
      departmentName?: string;
      supplementaryOfferingId?: string;
      registrationType?: "SUPPLEMENTARY" | "REGULAR";
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    adminUserId?: string
  ): Promise<BaseResponse<SectionResponseType>> {
    try {
      const resolvedDepartment = await DepartmentContextResolver.resolve({
        source: "admin.section.create",
        departmentId: data.departmentId,
        departmentName: data.departmentName,
      });

      const semester = await db.semester.findUnique({
        where: { id: data.semesterId },
        select: {
          academicTermId: true,
          academicTerm: { select: { type: true } },
        },
      });
      const isSupplementaryTerm =
        semester?.academicTerm.type === "supplementary";

      const section = await db.$transaction(async (tx) => {
        const created = await tx.section.create({
          data: {
            ...data,
            departmentId: resolvedDepartment.departmentId,
            departmentName: resolvedDepartment.departmentName,
            // Preserve explicit registrationType/supplementaryOfferingId if provided, else infer from term
            ...(!data.registrationType && isSupplementaryTerm
              ? { registrationType: "SUPPLEMENTARY" as const }
              : {}),
          },
        });
        await ProjectMappingService.reconcileProjectGroupsForScope({
          tx,
          departmentId: resolvedDepartment.departmentId,
          semesterId: data.semesterId,
        });
        return created;
      });

      const response: BaseResponse<SectionResponseType> = {
        status: "success",
        message: "Section created successfully",
        data: section,
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error("Section already exists");
      }
      if (error instanceof Error) throw error;
      logger.error("Error creating admin section:", { error });
      throw new Error("Failed to create section");
    }
  }

  static async getAll(
    query: { semesterId?: string; cycle?: string; name?: string },
    departmentId: string
  ): Promise<BaseResponse<SectionResponseType[]>> {
    const resolvedDepartment = await DepartmentContextResolver.resolve({
      source: "admin.section.getAll",
      departmentId,
    });

    const whereClause: Prisma.SectionWhereInput = {
      ...(query.semesterId ? { semesterId: query.semesterId } : {}),
      ...(query.cycle
        ? { cycle: query.cycle as import("@webcampus/db").Cycle }
        : {}),
      ...(query.name ? { name: query.name } : {}),
      department: { is: { id: resolvedDepartment.departmentId } },
    };

    const sections = await db.section.findMany({ where: whereClause });
    return {
      status: "success",
      message: "Sections retrieved successfully",
      data: sections,
    };
  }

  static async deleteSection(
    id: string,
    departmentId: string
  ): Promise<BaseResponse<null>> {
    const resolvedDepartment = await DepartmentContextResolver.resolve({
      source: "admin.section.delete",
      departmentId,
    });

    const existing = await db.section.findFirst({
      where: {
        id,
        department: { is: { id: resolvedDepartment.departmentId } },
      },
      include: {
        _count: {
          select: { studentSections: true, courses: true, ClassSession: true },
        },
      },
    });

    if (!existing) throw new Error("Section not found");
    if (existing._count.courses > 0)
      throw new Error(
        "Cannot delete section: Courses are mapped to this section."
      );
    if (existing._count.ClassSession > 0)
      throw new Error(
        "Cannot delete section: Class sessions have been recorded for this section."
      );

    const reconcileScope = {
      departmentId: resolvedDepartment.departmentId,
      semesterId: existing.semesterId,
    };

    await db.$transaction(async (tx) => {
      await tx.studentSection.deleteMany({ where: { sectionId: id } });
      await tx.batch.deleteMany({ where: { sectionId: id } });
      await tx.section.delete({ where: { id } });
      await ProjectMappingService.reconcileProjectGroupsForScope({
        tx,
        ...reconcileScope,
      });
    });

    return {
      status: "success",
      message: "Section deleted successfully",
      data: null,
    };
  }
}
