import { CourseAssignmentService } from "@webcampus/api/src/services/department/course-assignment.service";
import { UpsertCourseMappingType } from "@webcampus/schemas/department";

type AdminContext = {
  departmentId?: string;
  departmentName?: string;
  adminUserId?: string;
  clientVersion?: number;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
};

export class AdminCourseAssignmentService {
  static getMappingStatus(
    semesterId: string,
    academicYear: string,
    requestingUserId: string,
    context: AdminContext,
    cycle?: string
  ) {
    return CourseAssignmentService.getMappingStatus(
      semesterId,
      academicYear,
      requestingUserId,
      cycle,
      {
        departmentId: context.departmentId,
        departmentName: context.departmentName,
        requesterRole: "admin",
      }
    );
  }

  static getMappingByCourse(
    courseId: string,
    semesterId: string,
    academicYear: string,
    requestingUserId: string,
    context: AdminContext
  ) {
    return CourseAssignmentService.getMappingByCourse(
      courseId,
      semesterId,
      academicYear,
      requestingUserId,
      {
        departmentId: context.departmentId,
        departmentName: context.departmentName,
        requesterRole: "admin",
      }
    );
  }

  static upsertMapping(
    data: UpsertCourseMappingType,
    requestingUserId: string,
    context: AdminContext
  ) {
    return CourseAssignmentService.upsertMapping(data, requestingUserId, {
      departmentId: context.departmentId,
      departmentName: context.departmentName,
      requesterRole: "admin",
      adminUserId: context.adminUserId || requestingUserId,
      clientVersion: context.clientVersion,
      reason: context.reason,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  static getFacultyForMapping(
    requestingUserId: string,
    context: AdminContext,
    scope?: string
  ) {
    return CourseAssignmentService.getFacultyForMapping(
      requestingUserId,
      {
        departmentId: context.departmentId,
        departmentName: context.departmentName,
        requesterRole: "admin",
      },
      scope
    );
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
        departmentId: context.departmentId,
        departmentName: context.departmentName,
        requesterRole: "admin",
      }
    );
  }

  static deleteMappings(
    courseId: string,
    semesterId: string,
    academicYear: string,
    requestingUserId: string,
    context: AdminContext
  ) {
    return CourseAssignmentService.deleteMappings(
      courseId,
      semesterId,
      academicYear,
      requestingUserId,
      {
        departmentId: context.departmentId,
        departmentName: context.departmentName,
        requesterRole: "admin",
        adminUserId: context.adminUserId || requestingUserId,
        clientVersion: context.clientVersion,
        reason: context.reason,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      }
    );
  }

  static generateMappingTemplate(
    courseId: string,
    semesterId: string,
    academicYear: string,
    requestingUserId: string,
    context: AdminContext
  ) {
    return CourseAssignmentService.generateMappingTemplate(
      courseId,
      semesterId,
      academicYear,
      requestingUserId,
      {
        departmentId: context.departmentId,
        departmentName: context.departmentName,
        requesterRole: "admin",
      }
    );
  }

  static parseMappingUpload(
    fileBuffer: Buffer,
    requestingUserId: string,
    context: AdminContext
  ) {
    return CourseAssignmentService.parseMappingUpload(
      fileBuffer,
      requestingUserId,
      {
        departmentId: context.departmentId,
        departmentName: context.departmentName,
        requesterRole: "admin",
      }
    );
  }
}
