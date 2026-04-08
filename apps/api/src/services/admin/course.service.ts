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

  static update(data: UpdateCourseDTO) {
    return CourseService.update(data);
  }

  static delete(id: string) {
    return CourseService.delete(id);
  }

  static getById(id: string) {
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
    return CourseService.getByBranch(
      departmentId,
      departmentName,
      semesterId,
      cycle
    );
  }
}
