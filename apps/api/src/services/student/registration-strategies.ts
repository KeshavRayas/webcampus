import {
  isPeFull,
  peCourseCapacity,
} from "@webcampus/api/src/services/shared/pe-capacity.service";
import { Prisma } from "@webcampus/db";
import {
  RegistrationCourseType,
  SubmitCourseRegistrationType,
} from "@webcampus/schemas/student";

export type StudentRegistrationContext = {
  studentId: string;
  departmentName: string;
  semesterId: string;
  academicTermId: string;
};

type VisibleCourse = {
  courseType: string;
  departmentName?: string | null;
  openElectiveEligibility?: string | null;
  openElectiveDepartments?: { department: { name: string } }[];
};

export interface RegistrationStrategy {
  readonly bucket: "CORE" | "PE" | "OE";
  readonly label: string;
  matches(courseType: string | undefined): boolean;
  /** Which of the given courses may this student see? (OE visibility only; others pass-through.) */
  visibleCourses<T extends VisibleCourse>(
    courses: T[],
    departmentName: string
  ): T[];
  /** Validate the submitted selection for this bucket; throws a friendly Error. */
  validateSelection(
    available: RegistrationCourseType[],
    selectedIds: string[],
    request: SubmitCourseRegistrationType
  ): void;
  /** In-transaction registration work: locks, capacity checks, extra writes. */
  registerInTx(
    ctx: StudentRegistrationContext,
    tx: Prisma.TransactionClient,
    courses: RegistrationCourseType[],
    request: SubmitCourseRegistrationType
  ): Promise<void>;
}

export const coreRegistrationStrategy: RegistrationStrategy = {
  bucket: "CORE",
  label: "Core",
  matches: (courseType) => courseType === "PC" || courseType === "NCMC",
  visibleCourses: (courses) => courses,
  validateSelection: (available, selectedIds) => {
    const requiredCoreIds = available
      .filter(
        (course) => course.courseType === "PC" || course.courseType === "NCMC"
      )
      .map((course) => course.id);
    if (requiredCoreIds.some((courseId) => !selectedIds.includes(courseId))) {
      throw new Error("All mandatory core courses must be included");
    }
  },
  registerInTx: async () => {},
};

export const peRegistrationStrategy: RegistrationStrategy = {
  bucket: "PE",
  label: "Professional Elective",
  matches: (courseType) => courseType === "PE",
  visibleCourses: (courses) => courses,
  validateSelection: (available, selectedIds) => {
    const selectedPeCount = selectedIds.filter(
      (courseId) =>
        available.find((course) => course.id === courseId)?.courseType === "PE"
    ).length;
    if (
      available.some((course) => course.courseType === "PE") &&
      selectedPeCount !== 1
    ) {
      throw new Error("Please select exactly one Professional Elective (PE)");
    }
  },
  registerInTx: async (ctx, tx, courses) => {
    const peCourseIds = courses.map((course) => course.id).sort();
    for (const courseId of peCourseIds) {
      await tx.$queryRaw`SELECT id FROM "Course" WHERE id = ${courseId} FOR UPDATE`;
    }

    for (const course of courses) {
      const peCourse = await tx.course.findUnique({
        where: { id: course.id },
        select: {
          numberOfBatches: true,
          studentsPerBatch: true,
          code: true,
        },
      });
      if (!peCourse) {
        throw new Error("Selected PE course not found");
      }
      const capacity = peCourseCapacity(
        peCourse.numberOfBatches,
        peCourse.studentsPerBatch
      );
      const registeredCount = await tx.courseRegistration.count({
        where: { courseId: course.id },
      });
      if (isPeFull(capacity, registeredCount)) {
        throw new Error(
          `Course ${peCourse.code} is full (${registeredCount}/${capacity}). Please select another Professional Elective.`
        );
      }
    }
  },
};

export const oeRegistrationStrategy: RegistrationStrategy = {
  bucket: "OE",
  label: "Open Elective",
  matches: (courseType) => courseType === "OE",
  visibleCourses: (courses, departmentName) =>
    courses.filter((course) => {
      const eligibility = course.openElectiveEligibility ?? "ALL";
      if (eligibility === "ALL") return true;
      if (eligibility === "ALL_EXCEPT_OWNER") {
        return course.departmentName !== departmentName;
      }
      if (eligibility === "CUSTOM") {
        return (
          course.openElectiveDepartments?.some(
            (entry) => entry.department.name === departmentName
          ) ?? false
        );
      }
      return true;
    }),
  validateSelection: (available, selectedIds, request) => {
    const selectedOeCourses = selectedIds
      .map((courseId) => available.find((course) => course.id === courseId))
      .filter(
        (course): course is RegistrationCourseType =>
          course?.courseType === "OE"
      );

    if (
      available.some((course) => course.courseType === "OE") &&
      selectedOeCourses.length !== 1
    ) {
      throw new Error("Please select exactly one Open Elective (OE)");
    }

    for (const course of selectedOeCourses) {
      const batchId = request.oeBatchIds?.[course.id];
      if (!batchId) {
        throw new Error(
          `Please select a batch for Open Elective ${course.code}`
        );
      }
      if (!course.batches?.some((batch) => batch.batchId === batchId)) {
        throw new Error(
          `Selected batch is not valid for Open Elective ${course.code}`
        );
      }
    }
  },
  registerInTx: async (ctx, tx, courses, request) => {
    for (const course of courses) {
      const batchId = request.oeBatchIds?.[course.id];
      const batch = batchId
        ? course.batches?.find((b) => b.batchId === batchId)
        : undefined;
      if (!batch || !batchId) {
        throw new Error(
          `Selected batch is not valid for Open Elective ${course.code}`
        );
      }

      await tx.$queryRaw`SELECT id FROM "ElectiveBatch" WHERE id = ${batchId} FOR UPDATE`;

      const occupied = await tx.electiveStudentAssignment.count({
        where: { electiveBatchId: batchId },
      });
      if (occupied >= batch.capacity) {
        throw new Error(`Batch ${batch.name} is full`);
      }

      await tx.electiveStudentAssignment.create({
        data: {
          courseId: course.id,
          studentId: ctx.studentId,
          electiveBatchId: batchId,
        },
      });
    }
  },
};

export const registrationStrategies: RegistrationStrategy[] = [
  coreRegistrationStrategy,
  peRegistrationStrategy,
  oeRegistrationStrategy,
];

export const strategyFor = (
  courseType: string | undefined
): RegistrationStrategy =>
  registrationStrategies.find((strategy) => strategy.matches(courseType)) ??
  coreRegistrationStrategy;
