import { CourseApprovalStatus } from "@webcampus/db";

export const ADMIN_VISIBLE_COURSE_STATUSES = [
  CourseApprovalStatus.PENDING,
  CourseApprovalStatus.APPROVED,
] as const;

export const FACULTY_COURSE_STATUS = CourseApprovalStatus.APPROVED;

export const COURSE_NOT_SUBMITTED_MESSAGE =
  "Course has not been submitted for approval.";
export const COURSE_NOT_APPROVED_MESSAGE =
  "Course must be approved before this operation can be performed.";

export class CourseApprovalError extends Error {
  readonly statusCode = 403;

  constructor(message: string) {
    super(message);
    this.name = "CourseApprovalError";
  }
}

export const isApprovedCourse = (approvalStatus: CourseApprovalStatus) =>
  approvalStatus === FACULTY_COURSE_STATUS;

export const assertFacultyCourseApproved = (
  approvalStatus: CourseApprovalStatus,
  isMutation = false
) => {
  if (!isApprovedCourse(approvalStatus)) {
    throw new CourseApprovalError(
      isMutation ? COURSE_NOT_APPROVED_MESSAGE : COURSE_NOT_SUBMITTED_MESSAGE
    );
  }
};
