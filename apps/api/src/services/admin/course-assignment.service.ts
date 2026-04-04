import { CourseAssignmentService } from "@webcampus/api/src/services/department/course-assignment.service";
import { UpsertCourseMappingType } from "@webcampus/schemas/department";

type AdminContext = {
  departmentName: string;
};

export class AdminCourseAssignmentService {
  static getMappingStatus(
    semesterId: string,
    departmentName: string,
    academicYear: string,
    cycle?: string
  ) {
    return CourseAssignmentService.getMappingStatus(
      semesterId,
      departmentName,
      academicYear,
      cycle
    );
  }

  static getMappingByCourse(
    courseId: string,
    semesterId: string,
    academicYear: string
  ) {
    return CourseAssignmentService.getMappingByCourse(
      courseId,
      semesterId,
      academicYear
    );
  }

  static upsertMapping(
    data: UpsertCourseMappingType,
    requestingUserId: string,
    context: AdminContext
  ) {
    return CourseAssignmentService.upsertMapping(data, requestingUserId, {
      departmentName: context.departmentName,
      requesterRole: "admin",
    });
  }

  static getFacultyForMapping(requestingUserId: string, context: AdminContext) {
    return CourseAssignmentService.getFacultyForMapping(requestingUserId, {
      departmentName: context.departmentName,
      requesterRole: "admin",
    });
  }

  static getSectionsForMapping(
    semesterId: string,
    requestingUserId: string,
    context: AdminContext,
    cycle?: string
  ) {
    return CourseAssignmentService.getSectionsForMapping(
      semesterId,
      requestingUserId,
      cycle,
      {
        departmentName: context.departmentName,
        requesterRole: "admin",
      }
    );
  }

  static deleteMappings(
    courseId: string,
    semesterId: string,
    academicYear: string
  ) {
    return CourseAssignmentService.deleteMappings(
      courseId,
      semesterId,
      academicYear
    );
  }
}
