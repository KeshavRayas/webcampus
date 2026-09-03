import { isBatchManagedCourse } from "@webcampus/api/src/services/shared/course-kind";
import {
  isPeFull,
  peCourseCapacity,
  seatsLeft,
} from "@webcampus/api/src/services/shared/pe-capacity.service";
import {
  registrationStrategies,
  strategyFor,
  StudentRegistrationContext,
} from "@webcampus/api/src/services/student/registration-strategies";
import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import {
  AvailableCurriculumType,
  RegistrationCourseType,
  RegistrationDashboardType,
  SubmitCourseRegistrationResponseType,
  SubmitCourseRegistrationType,
} from "@webcampus/schemas/student";
import { BaseResponse } from "@webcampus/types/api";

const FIRST_YEAR_UG_SEMESTERS = new Set([1, 2]);

type StudentContext = {
  id: string;
  departmentId: string;
  departmentName: string;
  semesterId: string;
  academicTermId: string;
  currentSemester: number;
  programType: "UG" | "PG";
  studentSections: { section: { cycle: "PHYSICS" | "CHEMISTRY" | "NONE" } }[];
};

export class CourseRegistration {
  private static async getStudentContextByUserId(
    userId: string
  ): Promise<StudentContext> {
    const student = await db.student.findUnique({
      where: { userId },
      select: {
        id: true,
        departmentId: true,
        departmentName: true,
        semesterId: true,
        academicTermId: true,
        currentSemester: true,
        programType: true,
        studentSections: {
          select: {
            section: {
              select: {
                cycle: true,
              },
            },
          },
        },
      },
    });

    if (!student) {
      throw new Error("Student profile not found");
    }

    if (
      !student.semesterId ||
      !student.academicTermId ||
      !student.programType
    ) {
      throw new Error("Student academic context is incomplete");
    }

    return {
      id: student.id,
      departmentId: student.departmentId,
      departmentName: student.departmentName,
      semesterId: student.semesterId,
      academicTermId: student.academicTermId,
      currentSemester: student.currentSemester,
      programType: student.programType,
      studentSections: student.studentSections,
    };
  }

  private static getTermLabel(type: "even" | "odd", year: string): string {
    return `${type.charAt(0).toUpperCase() + type.slice(1)} ${year}`;
  }

  private static getSemesterLabel(
    programType: "UG" | "PG",
    semesterNumber: number
  ): string {
    return `${programType} Semester ${semesterNumber}`;
  }

  private static async resolveWindowScope(student: StudentContext): Promise<{
    departmentId: string | null;
    cycle: "PHYSICS" | "CHEMISTRY" | null;
  }> {
    const isFirstYearUg =
      student.programType === "UG" &&
      FIRST_YEAR_UG_SEMESTERS.has(student.currentSemester);

    if (isFirstYearUg) {
      const cycle = student.studentSections
        .map((item) => item.section.cycle)
        .find((value) => value === "PHYSICS" || value === "CHEMISTRY");

      if (!cycle) {
        throw new Error(
          "Unable to resolve student cycle for registration window"
        );
      }

      return {
        departmentId: null,
        cycle,
      };
    }

    return {
      departmentId: student.departmentId,
      cycle: null,
    };
  }

  private static async getRegistrationWindowState(
    student: StudentContext
  ): Promise<boolean> {
    const scope = await this.resolveWindowScope(student);

    const scopedWindow = await db.registrationWindow.findFirst({
      where: {
        academicTermId: student.academicTermId,
        semesterId: student.semesterId,
        departmentId: scope.departmentId,
        cycle: scope.cycle,
      },
      select: { isOpen: true },
    });

    if (scopedWindow) {
      return scopedWindow.isOpen;
    }

    const genericWindow = await db.registrationWindow.findFirst({
      where: {
        academicTermId: student.academicTermId,
        semesterId: student.semesterId,
        departmentId: null,
        cycle: null,
      },
      select: { isOpen: true },
    });

    return Boolean(genericWindow?.isOpen);
  }

  private static async getApprovedInstanceCourses(
    student: StudentContext
  ): Promise<RegistrationCourseType[]> {
    const scope = await this.resolveWindowScope(student);

    const courses = await db.course.findMany({
      where: {
        semesterId: student.semesterId,
        approvalStatus: "APPROVED",
        // A department-scoped student may register for courses owned by their own
        // department (PC/PE) AND Open Electives owned by ANY department (visibility
        // is governed by the OE eligibility contract, applied in JS after fetch).
        ...(scope.departmentId
          ? {
              OR: [{ departmentId: scope.departmentId }, { courseType: "OE" }],
            }
          : {}),
        ...(scope.cycle ? { cycle: scope.cycle } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        courseType: true,
        lectureCredits: true,
        tutorialCredits: true,
        practicalCredits: true,
        skillCredits: true,
        totalCredits: true,
        numberOfBatches: true,
        studentsPerBatch: true,
        departmentName: true,
        openElectiveEligibility: true,
        openElectiveDepartments: {
          select: { department: { select: { id: true, name: true } } },
        },
        electiveBatches: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            facultyAssignment: {
              select: {
                faculty: {
                  select: { shortName: true, user: { select: { name: true } } },
                },
              },
            },
            _count: { select: { studentAssignments: true } },
          },
        },
        _count: {
          select: { registrations: true },
        },
      },
      orderBy: { code: "asc" },
    });

    const visibleCourses = courses.filter(
      (course) =>
        strategyFor(course.courseType).visibleCourses(
          [course],
          student.departmentId,
          student.departmentName
        ).length === 1
    );

    return visibleCourses.map((course) => {
      const base = {
        id: course.id,
        code: course.code,
        name: course.name,
        courseType: course.courseType,
        ltp: `${course.lectureCredits}-${course.tutorialCredits}-${course.practicalCredits}-${course.skillCredits}`,
        totalCredits: course.totalCredits,
      };
      if (course.courseType === "PE") {
        const capacity = peCourseCapacity(
          course.numberOfBatches,
          course.studentsPerBatch
        );
        const registeredCount = course._count.registrations;
        return {
          ...base,
          capacity,
          registeredCount,
          seatsLeft: seatsLeft(capacity, registeredCount),
          isFull: isPeFull(capacity, registeredCount),
        };
      }
      if (course.courseType === "OE") {
        const perBatch = course.studentsPerBatch ?? 0;
        return {
          ...base,
          batches: course.electiveBatches.map((batch) => {
            const registeredCount = batch._count.studentAssignments;
            const capacity = perBatch;
            return {
              batchId: batch.id,
              name: batch.name,
              facultyName:
                batch.facultyAssignment?.faculty.user?.name ??
                batch.facultyAssignment?.faculty.shortName ??
                null,
              capacity,
              registeredCount,
              seatsLeft: Math.max(0, capacity - registeredCount),
              isFull: registeredCount >= capacity,
            };
          }),
        };
      }
      return base;
    });
  }

  static async getRegistrationDashboard(
    userId: string
  ): Promise<BaseResponse<RegistrationDashboardType>> {
    try {
      const student = await this.getStudentContextByUserId(userId);
      const [currentSemester, currentTerm, isWindowOpen, registrations] =
        await Promise.all([
          db.semester.findUnique({
            where: { id: student.semesterId },
            select: { semesterNumber: true, programType: true },
          }),
          db.academicTerm.findUnique({
            where: { id: student.academicTermId },
            select: { type: true, year: true },
          }),
          this.getRegistrationWindowState(student),
          db.courseRegistration.findMany({
            where: { studentId: student.id },
            include: {
              semester: {
                select: {
                  semesterNumber: true,
                  programType: true,
                },
              },
              academicTerm: {
                select: {
                  type: true,
                  year: true,
                },
              },
            },
            orderBy: { registrationDate: "desc" },
          }),
        ]);

      if (!currentSemester || !currentTerm) {
        throw new Error("Current semester context not found");
      }

      const groupedHistory = new Map<
        string,
        {
          semesterId: string;
          academicTermId: string;
          semesterLabel: string;
          academicTermLabel: string;
          courseCount: number;
          registrationDate: string;
        }
      >();

      for (const registration of registrations) {
        const groupKey = `${registration.academicTermId}_${registration.semesterId}`;
        if (!groupedHistory.has(groupKey)) {
          groupedHistory.set(groupKey, {
            semesterId: registration.semesterId,
            academicTermId: registration.academicTermId,
            semesterLabel: this.getSemesterLabel(
              registration.semester.programType,
              registration.semester.semesterNumber
            ),
            academicTermLabel: this.getTermLabel(
              registration.academicTerm.type,
              registration.academicTerm.year
            ),
            courseCount: 0,
            registrationDate: registration.registrationDate.toISOString(),
          });
        }

        const group = groupedHistory.get(groupKey);
        if (group) {
          group.courseCount += 1;
        }
      }

      const hasRegistered = registrations.some(
        (registration) =>
          registration.semesterId === student.semesterId &&
          registration.academicTermId === student.academicTermId
      );

      return {
        status: "success",
        message: "Registration dashboard fetched successfully",
        data: {
          current: {
            semesterId: student.semesterId,
            academicTermId: student.academicTermId,
            semesterLabel: this.getSemesterLabel(
              currentSemester.programType,
              currentSemester.semesterNumber
            ),
            academicTermLabel: this.getTermLabel(
              currentTerm.type,
              currentTerm.year
            ),
            isWindowOpen,
            hasRegistered,
          },
          history: Array.from(groupedHistory.values()),
        },
      };
    } catch (error) {
      logger.error("Error fetching registration dashboard:", { error });
      throw error;
    }
  }

  static async getAvailableCurriculum(
    userId: string
  ): Promise<BaseResponse<AvailableCurriculumType>> {
    try {
      const student = await this.getStudentContextByUserId(userId);
      const courses = await this.getApprovedInstanceCourses(student);

      const coreCourses = courses.filter(
        (course) => course.courseType !== "PE" && course.courseType !== "OE"
      );
      const professionalElectives = courses.filter(
        (course) => course.courseType === "PE"
      );
      const openElectives = courses.filter(
        (course) => course.courseType === "OE"
      );

      return {
        status: "success",
        message: "Available curriculum fetched successfully",
        data: {
          coreCourses,
          professionalElectives,
          openElectives,
        },
      };
    } catch (error) {
      logger.error("Error fetching available curriculum:", { error });
      throw error;
    }
  }

  static async submitRegistration(
    userId: string,
    request: SubmitCourseRegistrationType
  ): Promise<BaseResponse<SubmitCourseRegistrationResponseType>> {
    try {
      const student = await this.getStudentContextByUserId(userId);

      const [isWindowOpen, existingCount, availableCourses] = await Promise.all(
        [
          this.getRegistrationWindowState(student),
          db.courseRegistration.count({
            where: {
              studentId: student.id,
              semesterId: student.semesterId,
              academicTermId: student.academicTermId,
            },
          }),
          this.getApprovedInstanceCourses(student),
        ]
      );

      if (!isWindowOpen) {
        throw new Error("Course registration window is closed");
      }

      if (existingCount > 0) {
        throw new Error(
          "You have already completed registration for this semester"
        );
      }

      const uniqueCourseIds = Array.from(new Set(request.courseIds));
      const availableById = new Map(
        availableCourses.map((course) => [course.id, course])
      );

      for (const courseId of uniqueCourseIds) {
        if (!availableById.has(courseId)) {
          throw new Error(
            "Selected courses do not belong to your approved curriculum"
          );
        }
      }

      for (const strategy of registrationStrategies) {
        strategy.validateSelection(availableCourses, uniqueCourseIds, request);
      }

      const registrationContext: StudentRegistrationContext = {
        studentId: student.id,
        departmentId: student.departmentId,
        departmentName: student.departmentName,
        semesterId: student.semesterId,
        academicTermId: student.academicTermId,
      };

      await db.$transaction(async (tx) => {
        for (const strategy of registrationStrategies) {
          const strategyCourseIds = uniqueCourseIds.filter((courseId) =>
            strategy.matches(availableById.get(courseId)?.courseType)
          );
          if (strategyCourseIds.length === 0) continue;
          await strategy.registerInTx(
            registrationContext,
            tx,
            strategyCourseIds.map((courseId) => availableById.get(courseId)!),
            request
          );
        }

        await tx.courseRegistration.createMany({
          data: uniqueCourseIds.map((courseId) => ({
            studentId: student.id,
            courseId,
            semesterId: student.semesterId,
            academicTermId: student.academicTermId,
          })),
        });

        // A new batch-managed (PE/OE) registrant is unassigned until mapping is
        // saved, which flips elective-mapping completeness. Bump
        // electiveMappingVersion so mapping clients holding a stale version
        // notice the change.
        for (const courseId of uniqueCourseIds) {
          const course = availableById.get(courseId);
          if (!course || !isBatchManagedCourse(course.courseType)) continue;
          await tx.course.update({
            where: { id: courseId },
            data: { electiveMappingVersion: { increment: 1 } },
          });
        }
      });

      return {
        status: "success",
        message: "Course registration submitted successfully",
        data: { count: uniqueCourseIds.length },
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error(
          "You have already completed registration for this semester"
        );
      }
      logger.error("Error submitting course registration:", { error });
      throw error;
    }
  }

  static async getEnrolledCourses(
    userId: string,
    filterSemesterId?: string
  ): Promise<
    BaseResponse<{
      semesters: {
        semesterId: string;
        academicTermId: string;
        semesterLabel: string;
        academicTermLabel: string;
        courses: {
          id: string;
          code: string;
          name: string;
          courseType: string;
          ltp: string;
          totalCredits: number;
        }[];
        totalCredits: number;
      }[];
    }>
  > {
    try {
      const student = await this.getStudentContextByUserId(userId);

      const registrations = await db.courseRegistration.findMany({
        where: {
          studentId: student.id,
          ...(filterSemesterId ? { semesterId: filterSemesterId } : {}),
        },
        select: {
          semesterId: true,
          academicTermId: true,
          course: {
            select: {
              id: true,
              code: true,
              name: true,
              courseType: true,
              lectureCredits: true,
              tutorialCredits: true,
              practicalCredits: true,
              skillCredits: true,
              totalCredits: true,
            },
          },
          semester: {
            select: {
              semesterNumber: true,
              programType: true,
            },
          },
          academicTerm: {
            select: {
              type: true,
              year: true,
            },
          },
        },
        orderBy: [
          { academicTerm: { year: "desc" } },
          { semester: { semesterNumber: "desc" } },
          { course: { code: "asc" } },
        ],
      });

      const groupMap = new Map<
        string,
        {
          semesterId: string;
          academicTermId: string;
          semesterLabel: string;
          academicTermLabel: string;
          courses: {
            id: string;
            code: string;
            name: string;
            courseType: string;
            ltp: string;
            totalCredits: number;
          }[];
          totalCredits: number;
        }
      >();

      for (const reg of registrations) {
        const groupKey = `${reg.academicTermId}_${reg.semesterId}`;

        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            semesterId: reg.semesterId,
            academicTermId: reg.academicTermId,
            semesterLabel: this.getSemesterLabel(
              reg.semester.programType,
              reg.semester.semesterNumber
            ),
            academicTermLabel: this.getTermLabel(
              reg.academicTerm.type,
              reg.academicTerm.year
            ),
            courses: [],
            totalCredits: 0,
          });
        }

        const group = groupMap.get(groupKey)!;
        const courseItem = {
          id: reg.course.id,
          code: reg.course.code,
          name: reg.course.name,
          courseType: reg.course.courseType,
          ltp: `${reg.course.lectureCredits}-${reg.course.tutorialCredits}-${reg.course.practicalCredits}-${reg.course.skillCredits}`,
          totalCredits: reg.course.totalCredits,
        };

        group.courses.push(courseItem);
        group.totalCredits += reg.course.totalCredits;
      }

      return {
        status: "success",
        message: "Enrolled courses fetched successfully",
        data: {
          semesters: Array.from(groupMap.values()),
        },
      };
    } catch (error) {
      logger.error("Error fetching enrolled courses:", { error });
      throw error;
    }
  }
}
