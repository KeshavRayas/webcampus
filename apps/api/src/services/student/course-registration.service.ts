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

    const department = await db.department.findUnique({
      where: { name: student.departmentName },
      select: { id: true },
    });

    if (!department) {
      throw new Error("Student department not found");
    }

    return {
      departmentId: department.id,
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
        ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
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
      },
      orderBy: { code: "asc" },
    });

    return courses.map((course) => ({
      id: course.id,
      code: course.code,
      name: course.name,
      courseType: course.courseType,
      ltp: `${course.lectureCredits}-${course.tutorialCredits}-${course.practicalCredits}-${course.skillCredits}`,
      totalCredits: course.totalCredits,
    }));
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
        (course) => course.courseType === "PC" || course.courseType === "NCMC"
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

      const requiredCoreIds = availableCourses
        .filter(
          (course) => course.courseType === "PC" || course.courseType === "NCMC"
        )
        .map((course) => course.id);
      const selectedPeCount = uniqueCourseIds.filter(
        (courseId) => availableById.get(courseId)?.courseType === "PE"
      ).length;
      const selectedOeCount = uniqueCourseIds.filter(
        (courseId) => availableById.get(courseId)?.courseType === "OE"
      ).length;

      if (
        requiredCoreIds.some((courseId) => !uniqueCourseIds.includes(courseId))
      ) {
        throw new Error("All mandatory core courses must be included");
      }

      if (
        availableCourses.some((course) => course.courseType === "PE") &&
        selectedPeCount !== 1
      ) {
        throw new Error("Please select exactly one Professional Elective (PE)");
      }

      if (
        availableCourses.some((course) => course.courseType === "OE") &&
        selectedOeCount !== 1
      ) {
        throw new Error("Please select exactly one Open Elective (OE)");
      }

      await db.$transaction(async (tx) => {
        await tx.courseRegistration.createMany({
          data: uniqueCourseIds.map((courseId) => ({
            studentId: student.id,
            courseId,
            semesterId: student.semesterId,
            academicTermId: student.academicTermId,
          })),
        });
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
