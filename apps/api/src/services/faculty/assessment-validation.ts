import type { AssessmentComponentType } from "@webcampus/db";
import type { CreateAssessmentType } from "@webcampus/schemas/faculty";
import { DuplicateComponentSequenceError } from "../shared/assessment-aggregation.errors";
import {
  validateCourseTemplateLayout,
  type TemplateAggregationSource,
} from "../shared/assessment-aggregation.mapper";

type CourseAssessmentRules = {
  id: string;
  theoryMaxExams: number;
  labMaxMarks: number;
  aatMaxMarks: number;
};

export function validateAssessmentComponentFields(
  data: Pick<CreateAssessmentType, "componentType" | "sequence">,
  course: CourseAssessmentRules
): void {
  if (data.componentType === "THEORY") {
    if (data.sequence > course.theoryMaxExams) {
      throw new Error(
        `Theory sequence ${data.sequence} exceeds configured theoryMaxExams (${course.theoryMaxExams})`
      );
    }
    if (course.theoryMaxExams === 0) {
      throw new Error("This course has no configured theory exams");
    }
  }

  if (data.componentType === "LAB" && course.labMaxMarks === 0) {
    throw new Error("This course has no configured lab assessment");
  }

  if (data.componentType === "AAT" && course.aatMaxMarks === 0) {
    throw new Error("This course has no configured AAT assessment");
  }
}

export function assertTemplateLayoutForCreate(
  course: CourseAssessmentRules,
  existingTemplates: TemplateAggregationSource[],
  data: Pick<CreateAssessmentType, "componentType" | "sequence" | "totalMarks">,
  updatingTemplateId?: string
): void {
  const proposed: TemplateAggregationSource = {
    id: updatingTemplateId ?? `pending-${data.componentType}-${data.sequence}`,
    componentType: data.componentType as AssessmentComponentType,
    sequence: data.sequence,
    totalMarks: data.totalMarks,
  };

  const merged = [
    ...existingTemplates.filter(
      (template) => template.id !== updatingTemplateId
    ),
    proposed,
  ];

  validateCourseTemplateLayout(course, merged);
}

export function assertNoDuplicateComponentSlot(
  courseId: string,
  componentType: AssessmentComponentType,
  sequence: number,
  existingTemplateId: string | undefined,
  conflictingTemplateId: string | undefined
): void {
  if (!conflictingTemplateId || conflictingTemplateId === existingTemplateId) {
    return;
  }

  throw new DuplicateComponentSequenceError(
    courseId,
    componentType,
    sequence,
    [conflictingTemplateId, existingTemplateId ?? "new"].filter(Boolean)
  );
}

export function assertSingletonComponentAvailable(
  courseId: string,
  componentType: "LAB" | "AAT",
  existingTemplateId: string | undefined,
  otherTemplateId: string | undefined
): void {
  if (!otherTemplateId || otherTemplateId === existingTemplateId) {
    return;
  }

  throw new DuplicateComponentSequenceError(
    courseId,
    componentType,
    1,
    [otherTemplateId, existingTemplateId ?? "new"].filter(Boolean)
  );
}
