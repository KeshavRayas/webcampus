import { z } from "zod";

export const registrationCourseBatchSchema = z.object({
  batchId: z.uuid("Invalid batch ID"),
  name: z.string(),
  facultyName: z.string().nullable(),
  capacity: z.number().int().nonnegative(),
  registeredCount: z.number().int().nonnegative(),
  seatsLeft: z.number().int().nonnegative(),
  isFull: z.boolean(),
});

export const registrationCourseSchema = z.object({
  id: z.uuid("Invalid course ID"),
  code: z.string(),
  name: z.string(),
  courseType: z.enum(["PC", "PE", "OE", "NCMC"]),
  ltp: z.string(),
  totalCredits: z.number().int().nonnegative(),
  capacity: z.number().int().nonnegative().optional(),
  registeredCount: z.number().int().nonnegative().optional(),
  seatsLeft: z.number().int().nonnegative().optional(),
  isFull: z.boolean().optional(),
  batches: z.array(registrationCourseBatchSchema).optional(),
});

export const submitCourseRegistrationSchema = z.object({
  courseIds: z.array(z.uuid("Invalid course ID")).min(1, "Select courses"),
  oeBatchIds: z
    .record(z.uuid("Invalid course ID"), z.uuid("Invalid batch ID"))
    .optional(),
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
export type RegistrationCourseBatchType = z.infer<
  typeof registrationCourseBatchSchema
>;
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
