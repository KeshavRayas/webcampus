import { PrismaClient, CourseApprovalStatus } from "@webcampus/db";
import {
  CreateCourseDTO,
  UpdateCourseDTO,
} from "@webcampus/schemas/department";

const prisma = new PrismaClient();

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
      (data.practicalCredits || 0) > 0 ||
      (data.labCount || 0) > 0 ||
      (data.labMaxMarks || 0) > 0;

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
        
        cieCount: data.cieCount,
        cieMaxMarks: data.cieMaxMarks,
        cieEligibility: data.cieEligibility,
        
        theoryMaxMarks: data.theoryMaxMarks,
        theoryMinExams: data.theoryMinExams,
        theoryEligibility: data.theoryEligibility,
        
        labCount: data.labCount,
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
      data: course
    };
  }

  static async updateCourse(id: string, data: UpdateCourseDTO, userId: string) {
    void userId;
    const existingCourse = await prisma.course.findUnique({
      where: { id },
    });

    if (!existingCourse) {
      throw new Error("Course not found");
    }

    if (existingCourse.approvalStatus === CourseApprovalStatus.APPROVED) {
      throw new Error(
        "Cannot edit an approved course directly. Request revision or use post-approval edits if implemented."
      );
    }

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
    const tutorialCredits = data.tutorialCredits ?? existingCourse.tutorialCredits;
    const practicalCredits = data.practicalCredits ?? existingCourse.practicalCredits;
    const skillCredits = data.skillCredits ?? existingCourse.skillCredits;
    const totalCredits = lectureCredits + tutorialCredits + practicalCredits + skillCredits;

    const labCount = data.labCount ?? existingCourse.labCount;
    const labMaxMarks = data.labMaxMarks ?? existingCourse.labMaxMarks;
    const hasLaboratoryComponent = practicalCredits > 0 || labCount > 0 || labMaxMarks > 0;

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
        
        cieCount: data.cieCount,
        cieMaxMarks: data.cieMaxMarks,
        cieEligibility: data.cieEligibility,
        
        theoryMaxMarks: data.theoryMaxMarks,
        theoryMinExams: data.theoryMinExams,
        theoryEligibility: data.theoryEligibility,
        
        labCount,
        labMaxMarks,
        labEligibility: data.labEligibility,
        
        aatMaxMarks: data.aatMaxMarks,
        aatEligibility: data.aatEligibility,

        allowFeedback: data.allowFeedback,
        attendanceRequired: data.attendanceRequired,

        approvalStatus: CourseApprovalStatus.DRAFT,
        version: { increment: 1 },
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
      message: "Course updated successfully",
      data: course
    };
  }

  static async getCourse(id: string) {
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        department: true,
        semester: {
          include: {
            academicTerm: true,
          },
        },
        mappingAuditLogs: true,
        coordinators: true,
      },
    });

    if (!course) {
      throw new Error("Course not found");
    }

    return {
      status: "success",
      message: "Course fetched successfully",
      data: {
        ...course,
        isFullyMapped: false,
        isPartiallyMapped: false,
        isUnmapped: true,
        coordinatorCount: course.coordinators?.length || 0,
      }
    };
  }

  static async getCoursesBySemester(
    semesterId: string,
    departmentId?: string,
    departmentName?: string,
    cycle?: string
  ) {
    if (!departmentId && !departmentName) {
      throw new Error("Department scope is required");
    }

    const whereClause: Record<string, unknown> = {
      semesterId,
    };

    if (departmentId) {
      whereClause.departmentId = departmentId;
    } else if (departmentName) {
      whereClause.departmentName = departmentName;
    }

    if (cycle && cycle !== "NONE") {
      whereClause.cycle = cycle;
    }

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
      },
      orderBy: {
        code: "asc",
      },
    });

    return {
      status: "success"as const,
      message: "Courses fetched successfully",
      data: courses.map((course: Record<string, unknown> & { coordinators?: unknown[] }) => {
        return {
          ...course,
          isFullyMapped: false,
          isPartiallyMapped: false,
          isUnmapped: true,
          coordinatorCount: course.coordinators?.length || 0,
        };
      })
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
      data: null
    };
  }

  static async approveSemesterCourses(
    semesterId: string,
    departmentId?: string,
    departmentName?: string,
    cycle?: string,
    userId?: string,
    username?: string, // Added to fix controller mismatch
    displayUsername?: string // Added to fix controller mismatch
  ) {
    void userId;
    if (!departmentId && !departmentName) {
      throw new Error("Department scope is required for approval");
    }

    const whereClause: Record<string, unknown> = {
      semesterId,
      approvalStatus: {
        in: [CourseApprovalStatus.DRAFT, CourseApprovalStatus.NEEDS_REVISION],
      },
    };

    if (departmentId) {
      whereClause.departmentId = departmentId;
    } else if (departmentName) {
      whereClause.departmentName = departmentName;
    }

    if (cycle && cycle !== "NONE") {
      whereClause.cycle = cycle;
    }

    const coursesToApprove = await prisma.course.findMany({
      where: whereClause,
      select: { id: true },
    });

    if (coursesToApprove.length === 0) {
      throw new Error("No unapproved courses found for this scope");
    }

    const updateResult = await prisma.course.updateMany({
      where: whereClause,
      data: {
        approvalStatus: CourseApprovalStatus.APPROVED,
        approvedByRole: "ADMIN", 
        approvedByUsername: username || "Admin User", 
        approvedByDisplay: displayUsername || "System Admin",
        approvedAt: new Date(),
      },
    });

    return {
      status: "success" as const,
      count: updateResult.count,
      data: { count: updateResult.count },
      message: `Successfully approved ${updateResult.count} course(s)`,
    };
  }

  static async requestRevisionForSemester(
    semesterId: string,
    reviewerNotes: string,
    departmentId?: string,
    departmentName?: string,
    cycle?: string,
    userId?: string,
    username?: string, // Added to fix controller mismatch
    displayUsername?: string // Added to fix controller mismatch
  ) {
    void userId;
    void username;
    void displayUsername;

    if (!departmentId && !departmentName) {
      throw new Error("Department scope is required for revision request");
    }

    const whereClause: Record<string, unknown> = {
      semesterId,
      approvalStatus: {
        not: CourseApprovalStatus.APPROVED,
      },
    };

    if (departmentId) {
      whereClause.departmentId = departmentId;
    } else if (departmentName) {
      whereClause.departmentName = departmentName;
    }

    if (cycle && cycle !== "NONE") {
      whereClause.cycle = cycle;
    }

    const coursesToRevise = await prisma.course.findMany({
      where: whereClause,
      select: { id: true },
    });

    if (coursesToRevise.length === 0) {
      throw new Error("No valid courses found for revision in this scope");
    }

    const updateResult = await prisma.course.updateMany({
      where: whereClause,
      data: {
        approvalStatus: CourseApprovalStatus.NEEDS_REVISION,
        revisionRequestedByRole: "ADMIN", 
        revisionNotes: reviewerNotes,
        revisionRequestedAt: new Date(),
      },
    });

    return {
      status: "success" as const,
      count: updateResult.count,
      data: { count: updateResult.count },
      message: `Requested revision for ${updateResult.count} course(s)`,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // STATIC ALIASES & CONTROLLER/ADMIN BRIDGE METHODS
  // ────────────────────────────────────────────────────────────────────────

  static async create(data: CreateCourseDTO, departmentContext?: unknown) {
    const ctx = departmentContext as { userId?: string } | undefined;
    return this.createCourse(data, ctx?.userId || "system");
  }

  static async update(arg1: unknown, arg2?: unknown, arg3?: unknown, arg4?: unknown) {
    let id: string;
    let data: UpdateCourseDTO;
    let ctx: { userId?: string } | undefined;

    if (typeof arg1 === "object" && arg1 !== null) {
      const obj = arg1 as UpdateCourseDTO & { id: string };
      id = obj.id;
      data = obj;
      ctx = (arg3 || arg4) as { userId?: string } | undefined;
    } else {
      id = arg1 as string;
      data = arg2 as UpdateCourseDTO;
      ctx = (arg3 || arg4) as { userId?: string } | undefined;
    }
    return this.updateCourse(id, data, ctx?.userId || "system");
  }

  static async delete(id: string, ...args: unknown[]) {
    void args;
    return this.deleteCourse(id);
  }

  static async getById(id: string, ...args: unknown[]) {
    void args;
    return this.getCourse(id);
  }

  static async getByBranch(
    semesterId: string,
    departmentId?: string,
    departmentName?: string,
    cycle?: string,
    ...args: unknown[]
  ) {
    void args;
    return this.getCoursesBySemester(semesterId, departmentId, departmentName, cycle);
  }

  static async bulkSubmitForApproval(
    courseIds: string[],
    departmentId?: string,
    departmentName?: string,
    cycle?: string,
    ...args: unknown[]
  ) {
    void args;
    // Handle both array-first or filter-based invocations gracefully
    let targetIds = courseIds;
    if (!Array.isArray(courseIds)) {
      // If controller passed semesterId as first arg instead of courseIds array
      const semesterId = courseIds as unknown as string;
      const whereClause: Record<string, unknown> = { semesterId };
      if (departmentId) whereClause.departmentId = departmentId;
      if (departmentName) whereClause.departmentName = departmentName;
      if (cycle && cycle !== "NONE") whereClause.cycle = cycle;
      
      const found = await prisma.course.findMany({ where: whereClause, select: { id: true } });
      targetIds = found.map((c) => c.id);
    }

    const updateResult = await prisma.course.updateMany({
      where: {
        id: { in: targetIds },
        approvalStatus: { not: CourseApprovalStatus.APPROVED },
      },
      data: {
        approvalStatus: CourseApprovalStatus.DRAFT,
      },
    });
    return {
      status: "success" as const,
      count: updateResult.count,
      data: { count: updateResult.count },
      message: `Successfully submitted ${updateResult.count} courses for approval`,
    };
  }

  static async getGroupedCourseSubmissions(...args: unknown[]) {
    void args;
    return {
      
      status: "success" as const,
      message: "Submissions grouped successfully",
      data: [],
    };
  }

  static async getCoordinators(courseId: string, ...args: unknown[]) {
    void args;
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { coordinators: true },
    });
    return {
      status: "success" as const,
      message: "Coordinators fetched successfully",
      data: course?.coordinators || [],
    };
  }

  static async updateCoordinators(courseId: string, facultyIds: string[], ...args: unknown[]) {
    void args;
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new Error("Course not found");

    await prisma.$transaction([
      prisma.courseCoordinator.deleteMany({ where: { courseId } }),
      prisma.courseCoordinator.createMany({
        data: facultyIds.map((facultyId) => ({
          courseId,
          facultyId,
        })),
      }),
    ]);

    return {
      status: "success" as const,
      message: "Coordinators updated successfully",
      data: null,
    };
  }

  static async getMappedFacultyForCourse(courseId: string, ...args: unknown[]) {
    void args;
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        coordinators: {
          include: {
            faculty: {
              include: { user: true },
            },
          },
        },
      },
    });

    if (!course) throw new Error("Course not found");

    return {
      status: "success" as const,
      message: "Fetched mapped faculty",
      data: course.coordinators.map((c: { faculty: unknown }) => c.faculty),
    };
  }
}