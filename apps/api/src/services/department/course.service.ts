import {
  checkAndIncrementOptimisticVersion,
  diffFields,
  diffLists,
  logChanges,
} from "@webcampus/api/src/services/shared/audit.service";
import { CourseApprovalStatus, Cycle, PrismaClient } from "@webcampus/db";
import {
  CreateCourseDTO,
  UpdateCourseDTO,
} from "@webcampus/schemas/department";
import type { DepartmentRequestContext } from "@webcampus/types/request-context";
import {
  ADMIN_VISIBLE_COURSE_STATUSES,
  CourseApprovalError,
} from "../shared/course-approval";

interface AdminCourseEditContext {
  isAdmin?: boolean;
  adminUserId?: string;
  clientVersion?: number;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

const TRACKABLE_COURSE_FIELDS = [
  "code",
  "name",
  "courseMode",
  "courseType",
  "cycle",
  "semesterNumber",
  "lectureCredits",
  "tutorialCredits",
  "practicalCredits",
  "skillCredits",
  "totalCredits",
  "hasLaboratoryComponent",
  "seeMaxMarks",
  "seeEligibility",
  "cieMaxMarks",
  "cieEligibility",
  "theoryMaxExams",
  "theoryExamMaxMarks",
  "theoryMinExams",
  "theoryCieContribution",
  "theoryEligibility",
  "labMaxMarks",
  "labEligibility",
  "aatMaxMarks",
  "aatEligibility",
  "allowFeedback",
  "attendanceRequired",
] as const;

const prisma = new PrismaClient();

interface GroupShape {
  id: string;
  departmentId: string;
  departmentName: string;
  departmentCode?: string | null;
  semesterId: string;
  semester: unknown;
  cycle: string;
  approvalStatus: string;
  hasAdminApproved: boolean;
  hasCoeApproved: boolean;
  courseCount: number;
  courses: Array<Record<string, unknown>>;
  hasPostApprovalEdits: boolean;
  overrideCount: number;
  lastOverrideAt: string | null;
  lastOverrideById: string | null;
}

export class CourseService {
  // ────────────────────────────────────────────────────────────────────────
  // CORE BUSINESS LOGIC (Wrapped in standard API responses)
  // ────────────────────────────────────────────────────────────────────────

  static async createCourse(data: CreateCourseDTO, userId: string) {
    void userId;
    let targetDepartmentId = data.departmentId;

    if (!targetDepartmentId && data.departmentName) {
      const dept = await prisma.department.findFirst({
        where: { name: data.departmentName },
      });
      if (!dept) {
        throw new Error(`Department ${data.departmentName} not found`);
      }
      targetDepartmentId = dept.id;
    }

    if (!targetDepartmentId) {
      throw new Error("Valid Department ID or Name is required");
    }

    const semester = await prisma.semester.findUnique({
      where: { id: data.semesterId },
    });
    if (!semester) {
      throw new Error("Semester not found");
    }

    const totalCredits =
      (data.lectureCredits || 0) +
      (data.tutorialCredits || 0) +
      (data.practicalCredits || 0) +
      (data.skillCredits || 0);

    const hasLaboratoryComponent =
      (data.practicalCredits || 0) > 0 || (data.labMaxMarks || 0) > 0;

    const course = await prisma.course.create({
      data: {
        code: data.code,
        name: data.name,
        courseMode: data.courseMode,
        courseType: data.courseType,
        cycle: data.cycle,
        departmentId: targetDepartmentId,
        departmentName: data.departmentName,
        semesterId: data.semesterId,
        semesterNumber: data.semesterNumber,

        lectureCredits: data.lectureCredits,
        tutorialCredits: data.tutorialCredits,
        practicalCredits: data.practicalCredits,
        skillCredits: data.skillCredits,
        totalCredits,
        hasLaboratoryComponent,

        seeMaxMarks: data.seeMaxMarks,
        seeEligibility: data.seeEligibility,

        cieMaxMarks: data.cieMaxMarks,
        cieEligibility: data.cieEligibility,

        theoryMaxExams: data.theoryMaxExams,
        theoryExamMaxMarks: data.theoryExamMaxMarks,
        theoryMinExams: data.theoryMinExams,
        theoryCieContribution: data.theoryCieContribution,
        theoryEligibility: data.theoryEligibility,

        labMaxMarks: data.labMaxMarks,
        labEligibility: data.labEligibility,

        aatMaxMarks: data.aatMaxMarks,
        aatEligibility: data.aatEligibility,

        allowFeedback: data.allowFeedback,
        attendanceRequired: data.attendanceRequired,

        approvalStatus: CourseApprovalStatus.DRAFT,
        version: 1,
      },
      include: {
        department: true,
        semester: {
          include: {
            academicTerm: true,
          },
        },
      },
    });

    return {
      status: "success",
      message: "Course created successfully",
      data: course,
    };
  }

  static async updateCourse(
    id: string,
    data: UpdateCourseDTO,
    requestContext?: DepartmentRequestContext,
    adminContext?: AdminCourseEditContext
  ) {
    const isAdmin = adminContext?.isAdmin === true;

    const existingCourse = isAdmin
      ? await prisma.course.findUnique({ where: { id } })
      : await prisma.course.findFirst({
          where: { id, departmentId: requestContext?.departmentId },
        });

    if (!existingCourse) {
      throw new Error("Course not found");
    }

    CourseService._ensureCourseIsEditable(
      existingCourse.approvalStatus,
      isAdmin
    );

    let targetDepartmentId = data.departmentId ?? existingCourse.departmentId;
    if (data.departmentName && !data.departmentId) {
      const dept = await prisma.department.findFirst({
        where: { name: data.departmentName },
      });
      if (!dept) {
        throw new Error(`Department ${data.departmentName} not found`);
      }
      targetDepartmentId = dept.id;
    }

    const lectureCredits = data.lectureCredits ?? existingCourse.lectureCredits;
    const tutorialCredits =
      data.tutorialCredits ?? existingCourse.tutorialCredits;
    const practicalCredits =
      data.practicalCredits ?? existingCourse.practicalCredits;
    const skillCredits = data.skillCredits ?? existingCourse.skillCredits;
    const totalCredits =
      lectureCredits + tutorialCredits + practicalCredits + skillCredits;

    const labMaxMarks = data.labMaxMarks ?? existingCourse.labMaxMarks;
    const hasLaboratoryComponent = practicalCredits > 0 || labMaxMarks > 0;

    const course = await prisma.course.update({
      where: { id },
      data: {
        code: data.code,
        name: data.name,
        courseMode: data.courseMode,
        courseType: data.courseType,
        cycle: data.cycle,
        departmentId: targetDepartmentId,
        departmentName: data.departmentName ?? existingCourse.departmentName,
        semesterId: data.semesterId,
        semesterNumber: data.semesterNumber,

        lectureCredits,
        tutorialCredits,
        practicalCredits,
        skillCredits,
        totalCredits,
        hasLaboratoryComponent,

        seeMaxMarks: data.seeMaxMarks,
        seeEligibility: data.seeEligibility,

        cieMaxMarks: data.cieMaxMarks,
        cieEligibility: data.cieEligibility,

        theoryMaxExams: data.theoryMaxExams,
        theoryExamMaxMarks: data.theoryExamMaxMarks,
        theoryMinExams: data.theoryMinExams,
        theoryCieContribution: data.theoryCieContribution,
        theoryEligibility: data.theoryEligibility,

        labMaxMarks,
        labEligibility: data.labEligibility,

        aatMaxMarks: data.aatMaxMarks,
        aatEligibility: data.aatEligibility,

        allowFeedback: data.allowFeedback,
        attendanceRequired: data.attendanceRequired,

        ...(isAdmin
          ? {}
          : {
              approvalStatus: CourseApprovalStatus.DRAFT,
              version: { increment: 1 },
            }),
      },
      include: {
        department: true,
        semester: {
          include: {
            academicTerm: true,
          },
        },
      },
    });

    const isLocked =
      existingCourse.approvalStatus === CourseApprovalStatus.PENDING ||
      existingCourse.approvalStatus === CourseApprovalStatus.APPROVED;

    if (isAdmin && isLocked) {
      const changes = diffFields(
        existingCourse as unknown as Record<string, unknown>,
        course as unknown as Record<string, unknown>,
        TRACKABLE_COURSE_FIELDS
      );
      if (changes.length > 0) {
        await logChanges({
          entityType: "COURSE",
          entityId: course.id,
          courseId: course.id,
          action: "SUPER_EDIT",
          changes,
          adminUserId: adminContext?.adminUserId ?? "system",
          reason: adminContext?.reason,
          ipAddress: adminContext?.ipAddress,
          userAgent: adminContext?.userAgent,
        });
      }
      if (adminContext?.clientVersion != null) {
        await checkAndIncrementOptimisticVersion(
          course.id,
          adminContext.clientVersion,
          adminContext.adminUserId ?? null
        );
      }
      const latest = await prisma.course.findUnique({
        where: { id: course.id },
        select: { version: true },
      });
      if (latest) {
        course.version = latest.version;
      }
    }

    return {
      status: "success",
      message: "Course updated successfully",
      data: course,
    };
  }

  static async getSectionCounts(
    semesterId: string,
    departmentId: string,
    cycle?: string
  ): Promise<Record<string, { sections: number; batches: number }>> {
    const sections = await prisma.section.findMany({
      where: {
        semesterId,
        departmentId,
        ...(cycle && cycle !== "NONE" ? { cycle: cycle as Cycle } : {}),
      },
      include: {
        _count: { select: { batches: true } },
      },
    });

    const counts: Record<string, { sections: number; batches: number }> = {};
    for (const sec of sections) {
      const key = `${sec.semesterId}_${sec.cycle}`;
      if (!counts[key]) counts[key] = { sections: 0, batches: 0 };
      counts[key].sections += 1;
      counts[key].batches += sec._count.batches;
    }
    return counts;
  }

  static computeMappingStatus(
    courseMode: string,
    counts: { sections: number; batches: number },
    assignmentCount: number
  ): {
    expectedAssignments: number;
    isFullyMapped: boolean;
    isPartiallyMapped: boolean;
    isUnmapped: boolean;
  } {
    let expectedAssignments = 0;
    if (courseMode === "NON_INTEGRATED" || courseMode === "NCMC") {
      expectedAssignments = counts.sections;
    } else if (courseMode === "FINAL_SUMMARY") {
      expectedAssignments = counts.batches;
    } else if (courseMode === "INTEGRATED") {
      expectedAssignments = counts.sections + counts.batches;
    }

    return {
      expectedAssignments,
      isFullyMapped:
        expectedAssignments > 0 ? assignmentCount >= expectedAssignments : true,
      isPartiallyMapped:
        assignmentCount > 0 && assignmentCount < expectedAssignments,
      isUnmapped: assignmentCount === 0 || expectedAssignments === 0,
    };
  }

  static async resolveDepartmentId(
    departmentId?: string,
    departmentName?: string
  ): Promise<string> {
    if (departmentId) return departmentId;
    if (departmentName) {
      const dept = await prisma.department.findFirst({
        where: { name: departmentName },
      });
      if (dept) return dept.id;
    }
    throw new Error("Department scope is required");
  }

  private static _ensureCourseIsEditable(
    status?: string | null,
    isAdmin?: boolean
  ) {
    if (
      (status === CourseApprovalStatus.PENDING ||
        status === CourseApprovalStatus.APPROVED) &&
      !isAdmin
    ) {
      throw new Error(
        "403 Forbidden: Course is locked for review/approval and cannot be modified"
      );
    }
  }

  static async getCourse(
    id: string,
    departmentContext?: {
      departmentId?: string;
      departmentName?: string;
      adminView?: boolean;
    }
  ) {
    const where: Record<string, unknown> = { id };
    if (departmentContext) {
      const departmentId = await CourseService.resolveDepartmentId(
        departmentContext.departmentId,
        departmentContext.departmentName
      );
      where.departmentId = departmentId;
    }

    const course = await prisma.course.findFirst({
      where: where as never,
      include: {
        department: true,
        semester: {
          include: {
            academicTerm: true,
          },
        },
        mappingAuditLogs: true,
        coordinators: true,
        _count: {
          select: { assignments: true, coordinators: true },
        },
      },
    });

    if (!course) {
      throw new Error("Course not found");
    }

    if (
      departmentContext?.adminView &&
      !ADMIN_VISIBLE_COURSE_STATUSES.some(
        (status) => status === course.approvalStatus
      )
    ) {
      throw new CourseApprovalError(
        "Course has not been submitted for approval."
      );
    }

    const sectionCounts = await CourseService.getSectionCounts(
      course.semesterId,
      course.departmentId,
      course.cycle ?? undefined
    );
    const key = `${course.semesterId}_${course.cycle}`;
    const status = CourseService.computeMappingStatus(
      course.courseMode,
      sectionCounts[key] || { sections: 0, batches: 0 },
      course._count.assignments
    );

    return {
      status: "success",
      message: "Course fetched successfully",
      data: {
        ...course,
        isFullyMapped: status.isFullyMapped,
        isPartiallyMapped: status.isPartiallyMapped,
        isUnmapped: status.isUnmapped,
        coordinatorCount: course._count.coordinators,
      },
    };
  }

  static async getCoursesBySemester(
    semesterId: string,
    departmentId?: string,
    departmentName?: string,
    cycle?: string,
    options?: { adminView?: boolean }
  ) {
    const resolvedDepartmentId = await CourseService.resolveDepartmentId(
      departmentId,
      departmentName
    );

    const whereClause: Record<string, unknown> = {
      semesterId,
      departmentId: resolvedDepartmentId,
    };

    if (cycle && cycle !== "NONE") {
      whereClause.cycle = cycle;
    }

    if (options?.adminView) {
      whereClause.approvalStatus = { in: ADMIN_VISIBLE_COURSE_STATUSES };
    }

    const sectionCounts = await CourseService.getSectionCounts(
      semesterId,
      resolvedDepartmentId,
      cycle
    );

    const courses = await prisma.course.findMany({
      where: whereClause,
      include: {
        department: true,
        semester: {
          include: {
            academicTerm: true,
          },
        },
        mappingAuditLogs: true,
        coordinators: true,
        _count: {
          select: { assignments: true, coordinators: true },
        },
      },
      orderBy: {
        code: "asc",
      },
    });

    return {
      status: "success" as const,
      message: "Courses fetched successfully",
      data: courses.map((course) => {
        const key = `${course.semesterId}_${course.cycle}`;
        const status = CourseService.computeMappingStatus(
          course.courseMode,
          sectionCounts[key] || { sections: 0, batches: 0 },
          course._count.assignments
        );
        return {
          ...course,
          isFullyMapped: status.isFullyMapped,
          isPartiallyMapped: status.isPartiallyMapped,
          isUnmapped: status.isUnmapped,
          coordinatorCount: course._count.coordinators,
        };
      }),
    };
  }

  static async deleteCourse(id: string) {
    const existingCourse = await prisma.course.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            coordinators: true,
            mappingAuditLogs: true,
          },
        },
      },
    });

    if (!existingCourse) {
      throw new Error("Course not found");
    }

    if (existingCourse.approvalStatus === CourseApprovalStatus.APPROVED) {
      throw new Error("Cannot delete an approved course");
    }

    if (
      existingCourse._count.coordinators > 0 ||
      existingCourse._count.mappingAuditLogs > 0
    ) {
      throw new Error(
        "Cannot delete course with assigned coordinators or mappings"
      );
    }

    await prisma.course.delete({
      where: { id },
    });

    return {
      status: "success" as const,
      message: "Course deleted successfully",
      data: null,
    };
  }

  static async approveSemesterCourses(
    semesterId: string,
    departmentId?: string,
    departmentName?: string,
    cycle?: string,
    role: "admin" | "coe" = "admin",
    approverUsername?: string | null,
    approverDisplayUsername?: string | null
  ) {
    const resolvedDepartmentId = await CourseService.resolveDepartmentId(
      departmentId,
      departmentName
    );

    const resolvedCoeUsername =
      approverDisplayUsername?.trim() || approverUsername?.trim() || "COE";
    const approvedByDisplay = role === "admin" ? "Admin" : resolvedCoeUsername;

    const whereClause: Record<string, unknown> = {
      semesterId,
      departmentId: resolvedDepartmentId,
      approvalStatus: CourseApprovalStatus.PENDING,
    };

    if (cycle && cycle !== "NONE") {
      whereClause.cycle = cycle;
    }

    const updateResult = await prisma.$transaction((tx) =>
      tx.course.updateMany({
        where: whereClause,
        data: {
          approvalStatus: CourseApprovalStatus.APPROVED,
          approvedByRole: role,
          approvedByUsername:
            role === "coe" ? resolvedCoeUsername : (approverUsername ?? null),
          approvedByDisplay,
          approvedAt: new Date(),
        },
      })
    );

    return {
      status: "success" as const,
      message: `Successfully approved ${updateResult.count} courses`,
      data: { count: updateResult.count },
    };
  }

  static async requestRevisionForSemester(
    semesterId: string,
    departmentId?: string,
    departmentName?: string,
    reviewerNotes?: string,
    cycle?: string,
    role: "admin" | "coe" = "admin"
  ) {
    const resolvedDepartmentId = await CourseService.resolveDepartmentId(
      departmentId,
      departmentName
    );

    const whereClause: Record<string, unknown> = {
      semesterId,
      departmentId: resolvedDepartmentId,
      approvalStatus: CourseApprovalStatus.PENDING,
    };

    if (cycle && cycle !== "NONE") {
      whereClause.cycle = cycle;
    }

    const updateResult = await prisma.$transaction((tx) =>
      tx.course.updateMany({
        where: whereClause,
        data: {
          approvalStatus: CourseApprovalStatus.NEEDS_REVISION,
          revisionRequestedByRole: role,
          revisionNotes: reviewerNotes ?? null,
          revisionRequestedAt: new Date(),
        },
      })
    );

    return {
      status: "success" as const,
      message: `Successfully requested revision for ${updateResult.count} courses`,
      data: { count: updateResult.count },
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // STATIC ALIASES & CONTROLLER/ADMIN BRIDGE METHODS
  // ────────────────────────────────────────────────────────────────────────

  static async create(data: CreateCourseDTO, departmentContext?: unknown) {
    const ctx = departmentContext as { userId?: string } | undefined;
    return this.createCourse(data, ctx?.userId || "system");
  }

  static async update(
    arg1: unknown,
    arg2?: unknown,
    arg3?: unknown,
    arg4?: unknown
  ) {
    let id: string;
    let data: UpdateCourseDTO;
    let requestContext: DepartmentRequestContext | undefined;
    let adminContext: AdminCourseEditContext | undefined;

    if (typeof arg1 === "object" && arg1 !== null) {
      const obj = arg1 as UpdateCourseDTO & { id: string };
      id = obj.id;
      data = obj;
      requestContext = arg2 as DepartmentRequestContext | undefined;
      adminContext = (arg3 ?? arg4) as AdminCourseEditContext | undefined;
    } else {
      id = arg1 as string;
      data = arg2 as UpdateCourseDTO;
      requestContext = arg3 as DepartmentRequestContext | undefined;
      adminContext = arg4 as AdminCourseEditContext | undefined;
    }
    return this.updateCourse(id, data, requestContext, adminContext);
  }

  static async delete(id: string, ...args: unknown[]) {
    void args;
    return this.deleteCourse(id);
  }

  static async getById(id: string, ...args: unknown[]) {
    const [a, b] = args;
    let ctx:
      | {
          departmentId?: string;
          departmentName?: string;
          adminView?: boolean;
        }
      | undefined;

    if (a && typeof a === "object") {
      const obj = a as {
        departmentId?: string;
        departmentName?: string;
        adminView?: boolean;
      };
      ctx = {
        departmentId: obj.departmentId,
        departmentName: obj.departmentName,
        adminView: obj.adminView,
      };
    } else if (typeof a === "string") {
      ctx = { departmentId: a, departmentName: (b as string) || undefined };
    } else {
      ctx = {};
    }

    return this.getCourse(id, ctx);
  }

  static async getByBranch(
    semesterId: string,
    departmentId?: string,
    departmentName?: string,
    cycle?: string,
    ...args: unknown[]
  ) {
    const options = args[0] as { adminView?: boolean } | undefined;
    return this.getCoursesBySemester(
      semesterId,
      departmentId,
      departmentName,
      cycle,
      options
    );
  }

  static async bulkSubmitForApproval(
    semesterId: string,
    departmentId?: string,
    departmentName?: string,
    cycle?: string
  ) {
    const resolvedDepartmentId = await CourseService.resolveDepartmentId(
      departmentId,
      departmentName
    );

    const whereClause: Record<string, unknown> = {
      semesterId,
      departmentId: resolvedDepartmentId,
      approvalStatus: {
        in: [CourseApprovalStatus.DRAFT, CourseApprovalStatus.NEEDS_REVISION],
      },
    };

    if (cycle && cycle !== "NONE") {
      whereClause.cycle = cycle;
    }

    const sectionCounts = await CourseService.getSectionCounts(
      semesterId,
      resolvedDepartmentId,
      cycle
    );

    const courses = await prisma.course.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { assignments: true, coordinators: true },
        },
      },
    });

    const errors: string[] = [];
    for (const course of courses) {
      const key = `${course.semesterId}_${course.cycle}`;
      const counts = sectionCounts[key] || { sections: 0, batches: 0 };
      const { expectedAssignments, isFullyMapped } =
        CourseService.computeMappingStatus(
          course.courseMode,
          counts,
          course._count.assignments
        );

      if (course._count.coordinators === 0) {
        errors.push(
          `${course.code} (${course.name}) — no coordinator appointed`
        );
      }
      if (!isFullyMapped) {
        errors.push(
          `${course.code} (${course.name}) — not fully mapped (${course._count.assignments}/${expectedAssignments} assignments)`
        );
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Cannot submit for approval. ${errors.length} course(s) have issues:\n${errors.join("\n")}`
      );
    }

    const updateResult = await prisma.$transaction((tx) =>
      tx.course.updateMany({
        where: whereClause,
        data: {
          approvalStatus: CourseApprovalStatus.PENDING,
          approvedByRole: null,
          approvedByUsername: null,
          approvedByDisplay: null,
          approvedAt: null,
          revisionRequestedByRole: null,
          revisionNotes: null,
          revisionRequestedAt: null,
        },
      })
    );

    return {
      status: "success" as const,
      message: `Successfully submitted ${updateResult.count} courses for approval`,
      data: { count: updateResult.count, ids: courses.map((c) => c.id) },
    };
  }

  static async getGroupedCourseSubmissions(role: "admin" | "coe") {
    const pendingCourses = await prisma.course.findMany({
      where: {
        approvalStatus: CourseApprovalStatus.PENDING,
      },
      include: {
        department: { select: { id: true, code: true, name: true } },
        semester: {
          include: { academicTerm: true },
        },
      },
      orderBy: { code: "asc" },
    });

    const groupedMap = new Map<string, GroupShape>();

    for (const course of pendingCourses) {
      const hasAdminApproved = course.approvedByRole === "admin";
      const hasCoeApproved = course.approvedByRole === "coe";
      const key = `${course.department.id}_${course.semesterId}_${course.cycle}`;

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          id: key,
          departmentId: course.department.id,
          departmentName: course.department.name,
          departmentCode: course.department.code ?? null,
          semesterId: course.semesterId,
          semester: course.semester,
          cycle: course.cycle,
          approvalStatus: course.approvalStatus,
          hasAdminApproved,
          hasCoeApproved,
          courseCount: 0,
          courses: [],
          hasPostApprovalEdits: course.hasPostApprovalEdits,
          overrideCount: course.overrideCount,
          lastOverrideAt: course.lastOverrideAt?.toISOString() ?? null,
          lastOverrideById: course.lastOverrideById ?? null,
        });
      }

      const group = groupedMap.get(key);
      if (!group) continue;

      const statusPriority: Record<string, number> = {
        DRAFT: 0,
        NEEDS_REVISION: 1,
        PENDING: 2,
        APPROVED: 3,
      };
      const currentPriority = statusPriority[group.approvalStatus] ?? 0;
      const coursePriority = statusPriority[course.approvalStatus] ?? 0;
      if (coursePriority < currentPriority) {
        group.approvalStatus = course.approvalStatus;
      }
      group.hasAdminApproved = group.hasAdminApproved || hasAdminApproved;
      group.hasCoeApproved = group.hasCoeApproved || hasCoeApproved;
      group.hasPostApprovalEdits =
        group.hasPostApprovalEdits || course.hasPostApprovalEdits;
      group.overrideCount = Math.max(group.overrideCount, course.overrideCount);
      if (
        course.lastOverrideAt &&
        (!group.lastOverrideAt ||
          course.lastOverrideAt.toISOString() > group.lastOverrideAt)
      ) {
        group.lastOverrideAt = course.lastOverrideAt.toISOString();
        group.lastOverrideById = course.lastOverrideById ?? null;
      }
      group.courseCount += 1;
      group.courses.push({
        ...course,
        hasAdminApproved,
        hasCoeApproved,
      });
    }

    return {
      status: "success" as const,
      message: `Fetched grouped course submissions for ${role}`,
      data: Array.from(groupedMap.values()),
    };
  }

  static async getCoordinators(
    courseId: string,
    requestContext?: DepartmentRequestContext,
    isAdmin?: boolean
  ) {
    if (!isAdmin) {
      const departmentId = requestContext?.departmentId;
      const course = await prisma.course.findFirst({
        where: { id: courseId, departmentId },
        select: { id: true },
      });
      if (!course) throw new Error("Course not found");
    }

    const coordinators = await prisma.courseCoordinator.findMany({
      where: { courseId },
      include: {
        faculty: {
          select: {
            id: true,
            shortName: true,
            departmentId: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    return {
      status: "success" as const,
      message: "Coordinators fetched successfully",
      data: coordinators,
    };
  }

  static async updateCoordinators(
    courseId: string,
    facultyIds: string[],
    requestContext?: DepartmentRequestContext,
    adminContext?: AdminCourseEditContext
  ) {
    const isAdmin = adminContext?.isAdmin === true;

    const course = await prisma.course.findFirst({
      where: isAdmin
        ? { id: courseId }
        : { id: courseId, departmentId: requestContext?.departmentId },
      select: { id: true, approvalStatus: true },
    });
    if (!course) throw new Error("Course not found");

    CourseService._ensureCourseIsEditable(course.approvalStatus, isAdmin);

    let oldCoordinators: Array<{ facultyId: string }> | null = null;
    if (isAdmin) {
      oldCoordinators = await prisma.courseCoordinator.findMany({
        where: { courseId },
        select: { facultyId: true },
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.courseCoordinator.deleteMany({ where: { courseId } });
      if (facultyIds.length > 0) {
        await tx.courseCoordinator.createMany({
          data: facultyIds.map((facultyId) => ({ courseId, facultyId })),
        });
      }
    });

    if (isAdmin && adminContext?.adminUserId) {
      const change = diffLists(
        oldCoordinators ?? [],
        facultyIds.map((facultyId) => ({ facultyId })),
        "coordinators",
        (c) => c.facultyId,
        (c) => c.facultyId
      );
      if (change) {
        await logChanges({
          entityType: "COORDINATOR",
          entityId: courseId,
          courseId,
          action: "UPDATE_COORDINATOR",
          changes: [change],
          adminUserId: adminContext.adminUserId,
          reason: adminContext.reason,
          ipAddress: adminContext.ipAddress,
          userAgent: adminContext.userAgent,
        });
      }
      if (adminContext.clientVersion != null) {
        await checkAndIncrementOptimisticVersion(
          courseId,
          adminContext.clientVersion,
          adminContext.adminUserId
        );
      }
    }

    return {
      status: "success" as const,
      message: `Successfully updated coordinators (${facultyIds.length} assigned)`,
      data: { count: facultyIds.length },
    };
  }

  static async getMappedFacultyForCourse(
    courseId: string,
    departmentContext?: { departmentId: string }
  ) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) throw new Error("Course not found");

    if (
      departmentContext &&
      departmentContext.departmentId !== course.departmentId
    ) {
      throw new Error("Course not found");
    }

    const assignments = await prisma.courseAssignment.findMany({
      where: { courseId },
      select: {
        facultyId: true,
        faculty: {
          select: {
            id: true,
            user: { select: { name: true } },
            department: { select: { abbreviation: true } },
          },
        },
      },
    });

    const seen = new Set<string>();
    const uniqueFaculty: {
      id: string;
      name: string;
      departmentAbbreviation: string;
    }[] = [];

    for (const assignment of assignments) {
      if (seen.has(assignment.facultyId)) continue;
      seen.add(assignment.facultyId);
      uniqueFaculty.push({
        id: assignment.faculty.id,
        name: assignment.faculty.user.name,
        departmentAbbreviation: assignment.faculty.department.abbreviation,
      });
    }

    uniqueFaculty.sort((a, b) => a.name.localeCompare(b.name));

    return {
      status: "success" as const,
      message: "Fetched mapped faculty",
      data: uniqueFaculty,
    };
  }
}
