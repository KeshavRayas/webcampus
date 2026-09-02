import { CourseService } from "@webcampus/api/src/services/department/course.service";
import { Course } from "@webcampus/db";
import {
  CreateCourseDTO,
  UpdateCourseDTO,
} from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";

export class AdminCourseService {
  static create(data: CreateCourseDTO) {
    return CourseService.create(data);
  }

  static update(
    data: UpdateCourseDTO,
    adminContext?: {
      isAdmin: boolean;
      adminUserId: string;
      clientVersion?: number;
      reason?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ) {
    return CourseService.update(data, undefined, adminContext);
  }

  static delete(id: string) {
    return CourseService.delete(id);
  }

  // Updated to accept optional department filters as passed by the controller
  static getById(id: string, departmentId?: string, departmentName?: string) {
    return CourseService.getById(id, {
      departmentId,
      departmentName,
      adminView: true,
    });
  }

  static getByDepartment(
    departmentId?: string,
    departmentName?: string,
    semesterId?: string,
    cycle?: string
  ): Promise<
    BaseResponse<
      Array<
        Course & {
          departmentId: string;
          departmentName: string;
          isFullyMapped: boolean;
          isPartiallyMapped: boolean;
          isUnmapped: boolean;
        }
      >
    >
  > {
    // CourseService.getByBranch expects (semesterId, departmentId, departmentName, cycle)
    return CourseService.getByBranch(
      semesterId as string,
      departmentId,
      departmentName,
      cycle,
      { adminView: true }
    ) as unknown as Promise<
      BaseResponse<
        Array<
          Course & {
            departmentId: string;
            departmentName: string;
            isFullyMapped: boolean;
            isPartiallyMapped: boolean;
            isUnmapped: boolean;
          }
        >
      >
    >;
  }

  static getCoordinators(courseId: string) {
    return CourseService.getCoordinators(courseId, undefined, true);
  }

  static updateCoordinators(
    courseId: string,
    facultyIds: string[],
    adminContext?: {
      isAdmin: boolean;
      adminUserId: string;
      clientVersion?: number;
      reason?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ) {
    return CourseService.updateCoordinators(
      courseId,
      facultyIds,
      undefined,
      adminContext
    );
  }

  static getMappedFacultyForCourse(courseId: string) {
    return CourseService.getMappedFacultyForCourse(courseId);
  }

  static listApprovedSupplementaryCandidates(params: {
    departmentId: string;
    parity?: "odd" | "even";
    programType?: "UG" | "PG";
  }) {
    return CourseService.listApprovedSupplementaryCandidates(params);
  }
}
