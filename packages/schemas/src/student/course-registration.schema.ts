import { z } from "zod";

export const registrationCourseSchema = z.object({
  id: z.uuid("Invalid course ID"),
  code: z.string(),
  name: z.string(),
  courseType: z.enum(["PC", "PE", "OE", "NCMC"]),
  ltp: z.string(),
  totalCredits: z.number().int().nonnegative(),
});

export const submitCourseRegistrationSchema = z.object({
  courseIds: z.array(z.uuid("Invalid course ID")).min(1, "Select courses"),
});

export const registrationHistoryItemSchema = z.object({
  semesterId: z.uuid("Invalid semester ID"),
  academicTermId: z.uuid("Invalid academic term ID"),
  semesterLabel: z.string(),
  academicTermLabel: z.string(),
  courseCount: z.number().int().nonnegative(),
  registrationDate: z.string(),
});

export const registrationDashboardSchema = z.object({
  current: z.object({
    semesterId: z.uuid("Invalid semester ID"),
    academicTermId: z.uuid("Invalid academic term ID"),
    semesterLabel: z.string(),
    academicTermLabel: z.string(),
    isWindowOpen: z.boolean(),
    hasRegistered: z.boolean(),
  }),
  history: z.array(registrationHistoryItemSchema),
});

export const availableCurriculumSchema = z.object({
  coreCourses: z.array(registrationCourseSchema),
  professionalElectives: z.array(registrationCourseSchema),
  openElectives: z.array(registrationCourseSchema),
});

export const submitCourseRegistrationResponseSchema = z.object({
  count: z.number().int().nonnegative(),
});

export type RegistrationCourseType = z.infer<typeof registrationCourseSchema>;
export type SubmitCourseRegistrationType = z.infer<
  typeof submitCourseRegistrationSchema
>;
export type RegistrationHistoryItemType = z.infer<
  typeof registrationHistoryItemSchema
>;
export type RegistrationDashboardType = z.infer<
  typeof registrationDashboardSchema
>;
export type AvailableCurriculumType = z.infer<typeof availableCurriculumSchema>;
export type SubmitCourseRegistrationResponseType = z.infer<
  typeof submitCourseRegistrationResponseSchema
>;
