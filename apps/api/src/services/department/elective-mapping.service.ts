import {
  checkAndIncrementElectiveMappingVersion,
  logChanges,
} from "@webcampus/api/src/services/shared/audit.service";
import { DepartmentContextResolver } from "@webcampus/api/src/services/shared/department-context-resolver.service";
import {
  PeCapacityService,
  peCourseCapacity,
  seatsLeft,
} from "@webcampus/api/src/services/shared/pe-capacity.service";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import type {
  OverridePeCourseType,
  SaveElectiveMappingType,
  ValidateElectiveMappingCsvType,
} from "@webcampus/schemas/department";
import type { BaseResponse } from "@webcampus/types/api";

type MappingContext = {
  departmentId?: string;
  departmentName?: string;
  requesterRole?: "admin" | "department";
  adminUserId?: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
};

export class ElectiveMappingService {
  private static async resolveDepartment(
    requestingUserId: string,
    context?: MappingContext
  ) {
    if (context?.requesterRole === "admin") {
      if (!context.departmentId && !context.departmentName) {
        throw new Error("departmentId is required");
      }
      const resolved = await DepartmentContextResolver.resolve({
        source: "elective-mapping",
        departmentId: context.departmentId,
        departmentName: context.departmentName,
      });
      const department = await db.department.findUnique({
        where: { id: resolved.departmentId },
        select: { id: true, name: true },
      });
      if (!department) throw new Error("Department not found");
      return department;
    }

    const department = await db.department.findFirst({
      where: { userId: requestingUserId },
      select: { id: true, name: true },
    });
    if (!department) throw new Error("Requesting department not found");
    return department;
  }

  static async listPeCourses(
    semesterId: string,
    requestingUserId: string,
    cycle: string | undefined,
    context?: MappingContext
  ): Promise<BaseResponse<unknown>> {
    try {
      const department = await this.resolveDepartment(
        requestingUserId,
        context
      );

      const courses = await db.course.findMany({
        where: {
          semesterId,
          departmentId: department.id,
          courseType: "PE",
          ...(cycle ? { cycle: cycle as "PHYSICS" | "CHEMISTRY" } : {}),
        },
        select: {
          id: true,
          code: true,
          name: true,
          numberOfBatches: true,
          studentsPerBatch: true,
          electiveMappingVersion: true,
          electiveBatches: {
            select: {
              id: true,
              facultyAssignment: { select: { id: true } },
            },
          },
          _count: {
            select: {
              registrations: true,
              electiveStudentAssignments: true,
            },
          },
        },
        orderBy: { code: "asc" },
      });

      const data = await Promise.all(
        courses.map(async (course) => {
          const capacity = peCourseCapacity(
            course.numberOfBatches,
            course.studentsPerBatch
          );
          const registeredCount = course._count.registrations;
          const facultyMappingComplete =
            course.electiveBatches.length > 0 &&
            course.electiveBatches.every((b) => Boolean(b.facultyAssignment));
          const electiveMappingComplete =
            registeredCount === 0 ||
            course._count.electiveStudentAssignments >= registeredCount;

          return {
            courseId: course.id,
            code: course.code,
            name: course.name,
            registeredCount,
            capacity,
            seatsLeft: seatsLeft(capacity, registeredCount),
            facultyMappingComplete,
            electiveMappingComplete,
            electiveMappingVersion: course.electiveMappingVersion,
          };
        })
      );

      return {
        status: "success",
        message: "PE elective mapping list fetched",
        data,
      };
    } catch (error) {
      logger.error("Error listing PE courses for elective mapping", { error });
      throw error instanceof Error
        ? error
        : new Error("Failed to list PE courses");
    }
  }

  static async getCourseDetail(
    courseId: string,
    requestingUserId: string,
    context?: MappingContext
  ): Promise<BaseResponse<unknown>> {
    try {
      const department = await this.resolveDepartment(
        requestingUserId,
        context
      );

      const course = await db.course.findFirst({
        where: {
          id: courseId,
          departmentId: department.id,
          courseType: "PE",
        },
        select: {
          id: true,
          code: true,
          name: true,
          numberOfBatches: true,
          studentsPerBatch: true,
          electiveMappingVersion: true,
          semesterId: true,
          cycle: true,
          electiveBatches: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              name: true,
              sortOrder: true,
              facultyAssignment: {
                select: {
                  facultyId: true,
                  faculty: {
                    select: {
                      shortName: true,
                      user: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!course) throw new Error("PE course not found");

      const registrations = await db.courseRegistration.findMany({
        where: { courseId },
        select: {
          studentId: true,
          student: {
            select: {
              id: true,
              usn: true,
              user: { select: { name: true } },
              studentSections: {
                select: {
                  section: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      });

      const assignments = await db.electiveStudentAssignment.findMany({
        where: { courseId },
        select: {
          studentId: true,
          electiveBatchId: true,
        },
      });
      const assignmentByStudent = new Map(
        assignments.map((a) => [a.studentId, a.electiveBatchId])
      );

      const hasAttendanceOrMarks =
        await PeCapacityService.hasAttendanceOrMarksForCourse(courseId);

      const students = registrations.map((reg) => {
        const section = reg.student.studentSections[0]?.section ?? null;
        return {
          studentId: reg.student.id,
          usn: reg.student.usn,
          name: reg.student.user?.name ?? "",
          sectionId: section?.id ?? null,
          sectionName: section?.name ?? null,
          electiveBatchId: assignmentByStudent.get(reg.student.id) ?? null,
          locked:
            hasAttendanceOrMarks && assignmentByStudent.has(reg.student.id),
        };
      });

      return {
        status: "success",
        message: "Elective mapping detail fetched",
        data: {
          courseId: course.id,
          code: course.code,
          name: course.name,
          studentsPerBatch: course.studentsPerBatch,
          numberOfBatches: course.numberOfBatches,
          electiveMappingVersion: course.electiveMappingVersion,
          semesterId: course.semesterId,
          cycle: course.cycle ?? null,
          hasAttendanceOrMarks,
          batches: course.electiveBatches.map((b) => ({
            id: b.id,
            name: b.name,
            sortOrder: b.sortOrder,
            facultyId: b.facultyAssignment?.facultyId ?? null,
            facultyName:
              b.facultyAssignment?.faculty.user?.name ??
              b.facultyAssignment?.faculty.shortName ??
              null,
          })),
          students,
        },
      };
    } catch (error) {
      logger.error("Error fetching elective mapping detail", { error });
      throw error instanceof Error
        ? error
        : new Error("Failed to fetch elective mapping detail");
    }
  }

  static async saveMapping(
    payload: SaveElectiveMappingType,
    requestingUserId: string,
    context?: MappingContext
  ): Promise<BaseResponse<{ electiveMappingVersion: number }>> {
    try {
      const department = await this.resolveDepartment(
        requestingUserId,
        context
      );

      const course = await db.course.findFirst({
        where: {
          id: payload.courseId,
          departmentId: department.id,
          courseType: "PE",
        },
      });
      if (!course) throw new Error("PE course not found");

      const registrations = await db.courseRegistration.findMany({
        where: { courseId: course.id },
        select: { studentId: true },
      });
      const registeredIds = new Set(registrations.map((r) => r.studentId));

      if (payload.assignments.length !== registeredIds.size) {
        throw new Error(
          "Every registered student must be assigned to a batch before saving"
        );
      }

      const assignedStudents = new Set<string>();
      const batchIds = new Set(
        (
          await db.electiveBatch.findMany({
            where: { courseId: course.id },
            select: { id: true },
          })
        ).map((b) => b.id)
      );

      for (const row of payload.assignments) {
        if (!registeredIds.has(row.studentId)) {
          throw new Error(
            "Assignment includes a student not registered for this PE"
          );
        }
        if (!batchIds.has(row.electiveBatchId)) {
          throw new Error("Assignment includes an invalid elective batch");
        }
        if (assignedStudents.has(row.studentId)) {
          throw new Error("Duplicate student in elective mapping payload");
        }
        assignedStudents.add(row.studentId);
      }

      const hasAttendanceOrMarks =
        await PeCapacityService.hasAttendanceOrMarksForCourse(course.id);

      if (hasAttendanceOrMarks) {
        const existing = await db.electiveStudentAssignment.findMany({
          where: { courseId: course.id },
          select: { studentId: true, electiveBatchId: true },
        });
        const existingMap = new Map(
          existing.map((e) => [e.studentId, e.electiveBatchId])
        );
        for (const row of payload.assignments) {
          const prev = existingMap.get(row.studentId);
          if (prev && prev !== row.electiveBatchId) {
            throw new Error(
              "Cannot move already-mapped students after attendance or marks exist"
            );
          }
        }
      }

      const newVersion = await db.$transaction(async (tx) => {
        await tx.electiveStudentAssignment.deleteMany({
          where: { courseId: course.id },
        });
        await tx.electiveStudentAssignment.createMany({
          data: payload.assignments.map((a) => ({
            courseId: course.id,
            studentId: a.studentId,
            electiveBatchId: a.electiveBatchId,
          })),
        });
        return checkAndIncrementElectiveMappingVersion(
          course.id,
          payload.electiveMappingVersion,
          tx
        );
      });

      await logChanges({
        entityType: "COURSE",
        entityId: course.id,
        courseId: course.id,
        action: "SUPER_EDIT",
        changes: [
          {
            fieldName: "electiveStudentAssignments",
            oldValue: null,
            newValue: `${payload.assignments.length} students`,
          },
        ],
        adminUserId: context?.adminUserId ?? requestingUserId,
        reason: context?.reason,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });

      return {
        status: "success",
        message: "Elective mapping saved",
        data: { electiveMappingVersion: newVersion },
      };
    } catch (error) {
      logger.error("Error saving elective mapping", { error });
      throw error instanceof Error
        ? error
        : new Error("Failed to save elective mapping");
    }
  }

  static async validateCsv(
    payload: ValidateElectiveMappingCsvType,
    requestingUserId: string,
    context?: MappingContext
  ): Promise<
    BaseResponse<{
      assignments: { studentId: string; electiveBatchId: string }[];
    }>
  > {
    try {
      const detail = await this.getCourseDetail(
        payload.courseId,
        requestingUserId,
        context
      );
      if (detail.status !== "success" || !detail.data) {
        throw new Error("Failed to load course for CSV validation");
      }

      const courseData = detail.data as {
        students: {
          studentId: string;
          usn: string;
          electiveBatchId: string | null;
          locked: boolean;
        }[];
        batches: { id: string; name: string }[];
      };

      const byUsn = new Map(
        courseData.students.map((s) => [s.usn.toUpperCase(), s])
      );
      const byBatchId = new Map(courseData.batches.map((b) => [b.id, b]));
      const byBatchName = new Map(
        courseData.batches.map((b) => [b.name.toLowerCase(), b])
      );

      const assignments: { studentId: string; electiveBatchId: string }[] = [];
      const errors: string[] = [];

      for (let i = 0; i < payload.rows.length; i++) {
        const row = payload.rows[i]!;
        const student = byUsn.get(row.usn.toUpperCase());
        if (!student) {
          errors.push(`Row ${i + 1}: unknown or unregistered USN ${row.usn}`);
          continue;
        }
        const batch =
          (row.batchId ? byBatchId.get(row.batchId) : undefined) ??
          (row.batchName
            ? byBatchName.get(row.batchName.toLowerCase())
            : undefined);
        if (!batch) {
          errors.push(`Row ${i + 1}: invalid batch for USN ${row.usn}`);
          continue;
        }
        if (student.locked && student.electiveBatchId !== batch.id) {
          errors.push(
            `Row ${i + 1}: student ${row.usn} is locked and cannot change batch`
          );
          continue;
        }
        assignments.push({
          studentId: student.studentId,
          electiveBatchId: batch.id,
        });
      }

      if (errors.length > 0) {
        throw new Error(`CSV validation failed:\n${errors.join("\n")}`);
      }

      return {
        status: "success",
        message: "CSV validated",
        data: { assignments },
      };
    } catch (error) {
      logger.error("Error validating elective mapping CSV", { error });
      throw error instanceof Error ? error : new Error("CSV validation failed");
    }
  }

  static async overridePeCourse(
    payload: OverridePeCourseType,
    requestingUserId: string,
    context?: MappingContext
  ): Promise<BaseResponse<{ ok: true }>> {
    try {
      const department = await this.resolveDepartment(
        requestingUserId,
        context
      );

      const [fromCourse, toCourse] = await Promise.all([
        db.course.findFirst({
          where: {
            id: payload.fromCourseId,
            departmentId: department.id,
            courseType: "PE",
          },
        }),
        db.course.findFirst({
          where: {
            id: payload.toCourseId,
            departmentId: department.id,
            courseType: "PE",
          },
        }),
      ]);

      if (!fromCourse || !toCourse) {
        throw new Error("Source or target PE course not found");
      }
      if (fromCourse.semesterId !== toCourse.semesterId) {
        throw new Error("PE override must stay within the same semester");
      }

      const [fromLocked, toLocked] = await Promise.all([
        PeCapacityService.hasAttendanceOrMarksForCourse(fromCourse.id),
        PeCapacityService.hasAttendanceOrMarksForCourse(toCourse.id),
      ]);
      if (fromLocked || toLocked) {
        throw new Error(
          "PE override is forbidden once attendance or marks exist on either course"
        );
      }

      const existing = await db.courseRegistration.findUnique({
        where: {
          studentId_courseId: {
            studentId: payload.studentId,
            courseId: fromCourse.id,
          },
        },
      });
      if (!existing) {
        throw new Error("Student is not registered for the source PE course");
      }

      await db.$transaction(async (tx) => {
        await tx.electiveStudentAssignment.deleteMany({
          where: {
            studentId: payload.studentId,
            courseId: fromCourse.id,
          },
        });
        await tx.courseRegistration.delete({
          where: { id: existing.id },
        });
        await tx.courseRegistration.create({
          data: {
            studentId: payload.studentId,
            courseId: toCourse.id,
            semesterId: toCourse.semesterId,
            academicTermId: existing.academicTermId,
          },
        });
        if (payload.fromCourseVersion !== undefined) {
          await checkAndIncrementElectiveMappingVersion(
            fromCourse.id,
            payload.fromCourseVersion,
            tx
          );
        } else {
          await tx.course.update({
            where: { id: fromCourse.id },
            data: { electiveMappingVersion: { increment: 1 } },
          });
        }
        if (payload.toCourseVersion !== undefined) {
          await checkAndIncrementElectiveMappingVersion(
            toCourse.id,
            payload.toCourseVersion,
            tx
          );
        } else {
          await tx.course.update({
            where: { id: toCourse.id },
            data: { electiveMappingVersion: { increment: 1 } },
          });
        }
      });

      await logChanges({
        entityType: "COURSE",
        entityId: toCourse.id,
        courseId: toCourse.id,
        action: "SUPER_EDIT",
        changes: [
          {
            fieldName: "peOverride",
            oldValue: fromCourse.code,
            newValue: toCourse.code,
          },
        ],
        adminUserId: context?.adminUserId ?? requestingUserId,
        reason: payload.reason ?? context?.reason,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });

      return {
        status: "success",
        message:
          "Student moved to target PE course (unassigned until remapped)",
        data: { ok: true },
      };
    } catch (error) {
      logger.error("Error overriding PE course", { error });
      throw error instanceof Error ? error : new Error("PE override failed");
    }
  }

  static async renameBatch(
    electiveBatchId: string,
    name: string,
    requestingUserId: string,
    context?: MappingContext
  ): Promise<BaseResponse<{ id: string; name: string }>> {
    const department = await this.resolveDepartment(requestingUserId, context);
    const batch = await db.electiveBatch.findFirst({
      where: { id: electiveBatchId, course: { departmentId: department.id } },
    });
    if (!batch) throw new Error("Elective batch not found");

    const updated = await db.electiveBatch.update({
      where: { id: electiveBatchId },
      data: { name },
      select: { id: true, name: true },
    });

    return {
      status: "success",
      message: "Elective batch renamed",
      data: updated,
    };
  }

  static async deleteBatch(
    electiveBatchId: string,
    requestingUserId: string,
    context?: MappingContext
  ): Promise<BaseResponse<{ numberOfBatches: number }>> {
    const department = await this.resolveDepartment(requestingUserId, context);
    const batch = await db.electiveBatch.findFirst({
      where: { id: electiveBatchId, course: { departmentId: department.id } },
      include: { course: true },
    });
    if (!batch) throw new Error("Elective batch not found");

    if (await PeCapacityService.hasAttendanceOrMarksForCourse(batch.courseId)) {
      throw new Error(
        "Cannot delete elective batches after attendance or marks exist"
      );
    }

    const registered = await PeCapacityService.countRegisteredForCourse(
      batch.courseId
    );
    const remainingCapacity = peCourseCapacity(
      (batch.course.numberOfBatches ?? 1) - 1,
      batch.course.studentsPerBatch
    );
    if (remainingCapacity < registered) {
      throw new Error(
        `Cannot delete elective batch: remaining capacity ${remainingCapacity} is below registered students ${registered}.`
      );
    }

    const remaining = await db.$transaction(async (tx) => {
      await tx.electiveBatchFaculty.deleteMany({
        where: { electiveBatchId },
      });
      await tx.electiveStudentAssignment.deleteMany({
        where: { electiveBatchId },
      });
      await tx.electiveBatch.delete({ where: { id: electiveBatchId } });
      const count = await tx.electiveBatch.count({
        where: { courseId: batch.courseId },
      });
      if (count < 1) {
        throw new Error("A PE course must keep at least one elective batch");
      }
      // Renumber the surviving batches back to a contiguous 1..N sequence and
      // realign auto-generated names ({code} 1..N) so a later increase can't
      // collide with @@unique([courseId, sortOrder]) / @@unique([courseId, name]).
      const survivors = await tx.electiveBatch.findMany({
        where: { courseId: batch.courseId },
        orderBy: { sortOrder: "asc" },
      });
      const codePrefix = `${batch.course.code} `;
      for (let i = 0; i < survivors.length; i++) {
        const survivor = survivors[i];
        if (!survivor) continue;
        const expectedName = `${batch.course.code} ${i + 1}`;
        if (survivor.sortOrder !== i + 1 || survivor.name !== expectedName) {
          await tx.electiveBatch.update({
            where: { id: survivor.id },
            data: {
              sortOrder: i + 1,
              ...(survivor.name.startsWith(codePrefix)
                ? { name: expectedName }
                : {}),
            },
          });
        }
      }
      await tx.course.update({
        where: { id: batch.courseId },
        data: {
          numberOfBatches: count,
          electiveMappingVersion: { increment: 1 },
        },
      });
      return count;
    });

    return {
      status: "success",
      message: "Elective batch deleted",
      data: { numberOfBatches: remaining },
    };
  }
}
