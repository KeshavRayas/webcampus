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
    return CourseService.update(data, adminContext);
  }

  static delete(id: string) {
    return CourseService.delete(id);
  }

  // Updated to accept optional department filters as passed by the controller
  static getById(id: string, _departmentId?: string, _departmentName?: string) {
    return CourseService.getById(id);
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
      cycle
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
    return CourseService.getCoordinators(courseId);
  }

  static updateCoordinators(
    courseId: string,
    facultyIds: string[],
    _adminContext?: {
      isAdmin: boolean;
      adminUserId: string;
      clientVersion?: number;
      reason?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ) {
    return CourseService.updateCoordinators(courseId, facultyIds);
  }

  static getMappedFacultyForCourse(courseId: string) {
    return CourseService.getMappedFacultyForCourse(courseId);
  }
}