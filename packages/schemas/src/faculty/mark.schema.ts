import { z } from "zod";

export const EligibilityStatus = z.enum(["ELIGIBLE", "NOT_ELIGIBLE"]);

export const BaseMarkSchema = z.object({
  studentId: z.string("Invalid student ID"),
  courseId: z.string("Invalid course ID"),
  cie1: z.number().nullable(),
  cie2: z.number().nullable(),
  cie3: z.number().nullable(),
  aat1: z.number().nullable(),
  aat2: z.number().nullable(),
  lab1: z.number().nullable(),
  lab2: z.number().nullable(),
  labTotal: z.number().nullable(),
  cieTotal: z.number().nullable(),
  status: EligibilityStatus,
});

export const MarkResponseSchema = BaseMarkSchema.extend({
  id: z.string("Invalid mark ID"),
});

export const CreateMarkSchema = BaseMarkSchema;

export const UpdateMarkSchema = BaseMarkSchema.partial();

export type BaseMarkType = z.infer<typeof BaseMarkSchema>;
export type CreateMarkType = z.infer<typeof CreateMarkSchema>;
export type UpdateMarkType = z.infer<typeof UpdateMarkSchema>;
export type MarkResponseType = z.infer<typeof MarkResponseSchema>;

// Assessment Marks Entry Schemas
export const StudentQuestionMarkSchema = z.object({
  studentId: z.string().uuid("Invalid student ID"),
  questionId: z.string().uuid("Invalid question ID"),
  marksObtained: z.number().min(0, "Marks cannot be negative"),
});

export const StudentAssessmentStatusSchema = z.enum([
  "PRESENT",
  "ABSENT",
  "MP",
]);

export const StudentAssessmentTotalSchema = z.object({
  studentId: z.string().uuid("Invalid student ID"),
  totalMarks: z.number().min(0, "Total marks cannot be negative"),
  status: StudentAssessmentStatusSchema,
});

export const SaveAssessmentMarksSchema = z.object({
  assessmentId: z.string().uuid("Invalid assessment ID"),
  courseId: z.string().uuid("Invalid course ID"),
  marks: z.array(StudentQuestionMarkSchema).optional(),
  studentTotals: z
    .array(StudentAssessmentTotalSchema)
    .min(1, "At least one student total is required"),
});

export const StudentAssessmentDetailSchema = z.object({
  studentId: z.string().uuid("Invalid student ID"),
  usn: z.string(),
  name: z.string(),
  totalMarks: z.number().min(0),
  status: z.string(),
  questionMarks: z.record(z.string(), z.number()).optional(),
});

export const AssessmentWithStudentsSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  totalMarks: z.number(),
  courseId: z.string().uuid(),
  courseName: z.string(),
  courseCode: z.string(),
  questions: z.array(
    z.object({
      id: z.string().uuid(),
      part: z.string(),
      qNumber: z.string(),
      marks: z.number(),
      orGroupId: z.string().optional().nullable(),
    })
  ),
  students: z.array(StudentAssessmentDetailSchema),
});

export type StudentQuestionMarkType = z.infer<typeof StudentQuestionMarkSchema>;
export type SaveAssessmentMarksType = z.infer<typeof SaveAssessmentMarksSchema>;
export type StudentAssessmentDetailType = z.infer<
  typeof StudentAssessmentDetailSchema
>;
export type AssessmentWithStudentsType = z.infer<
  typeof AssessmentWithStudentsSchema
>;
export type StudentAssessmentStatusType = z.infer<
  typeof StudentAssessmentStatusSchema
>;
export type StudentAssessmentTotalType = z.infer<
  typeof StudentAssessmentTotalSchema
>;

export interface MarksReportAssessmentScore {
  assessmentId: string;
  assessmentTitle: string;
  totalMarks: number | null;
  maxMarks: number;
}

export interface MarksReportStudent {
  usn: string;
  name: string;
  assessments: MarksReportAssessmentScore[];
  cieTotal: number | null;
  status: string;
}

export interface MarksReportDTO {
  course: {
    id: string;
    code: string;
    name: string;
    cieMinMarks: number;
    cieEligibilityPercent: number;
  };
  assessments: Array<{
    id: string;
    title: string;
    totalMarks: number;
  }>;
  semester: {
    id: string;
    semesterNumber: number;
    academicTerm: {
      id: string;
      type: string;
      year: string;
    };
  };
  students: MarksReportStudent[];
}

export interface MarksReportFilterOptionsDTO {
  courses: Array<{
    id: string;
    code: string;
    name: string;
    sectionId: string;
    sectionName: string;
    semesterId: string;
  }>;
}
