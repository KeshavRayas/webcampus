import { z } from "zod";

export const DesignationEnum = z.enum([
  "ASSOCIATE_PROFESSOR",
  "ASSISTANT_PROFESSOR",
  "PROFESSOR",
  "VISITING_PROFESSOR",
]);

export const StaffTypeEnum = z.enum(["TEMPORARY", "REGULAR", "POP", "ADJUNCT"]);
export const FacultyGenderEnum = z.enum(["MALE", "FEMALE", "OTHER"]);
export const MaritalStatusEnum = z.enum([
  "SINGLE",
  "MARRIED",
  "DIVORCED",
  "WIDOWED",
  "OTHER",
]);
export const QualificationProgramTypeEnum = z.enum(["FULL_TIME", "PART_TIME"]);
export const PublicationCategoryEnum = z.enum([
  "JOURNAL",
  "CONFERENCE",
  "BOOK_CHAPTER_OR_BOOK",
  "CASE_STUDY",
  "PATENT",
]);

const requiredDateString = z.coerce.date();
const optionalDateString = z.coerce.date().optional().nullable();

export const FacultyAddressSchema = z.object({
  presentAddressLine: z.string().trim().max(500).optional().nullable(),
  presentCity: z.string().trim().max(120).optional().nullable(),
  presentState: z.string().trim().max(120).optional().nullable(),
  presentPincode: z.string().trim().max(20).optional().nullable(),
  permanentAddressLine: z.string().trim().max(500).optional().nullable(),
  permanentCity: z.string().trim().max(120).optional().nullable(),
  permanentState: z.string().trim().max(120).optional().nullable(),
  permanentPincode: z.string().trim().max(20).optional().nullable(),
  sameAsPresentAddress: z.boolean().optional(),
});

export const FacultyEditableProfileSchema = z.object({
  qualification: z.string().trim().max(150).optional().nullable(),
  gender: FacultyGenderEnum.optional().nullable(),
  bloodGroup: z.string().trim().max(20).optional().nullable(),
  maritalStatus: MaritalStatusEnum.optional().nullable(),
  aboutYourself: z.string().trim().max(3000).optional().nullable(),
  researchInterests: z.string().trim().max(3000).optional().nullable(),
  otherInformation: z.string().trim().max(3000).optional().nullable(),
  researchArea: z.string().trim().max(300).optional().nullable(),
  nationality: z.string().trim().max(120).optional().nullable(),
  phoneNumber: z.string().trim().max(30).optional().nullable(),
  personalEmail: z.string().email().optional().nullable(),
  contactInformation: z.string().trim().max(300).optional().nullable(),
  mobileNumber: z.string().trim().max(30).optional().nullable(),
  alternateContactNumber: z.string().trim().max(30).optional().nullable(),
  officeRoom: z.string().trim().max(120).optional().nullable(),
});

export const FacultyAdminOnlySchema = z.object({
  employeeId: z.string().trim().min(1, "Employee ID is required"),
  staffType: StaffTypeEnum,
  dob: requiredDateString,
  dateOfJoining: requiredDateString,
  departmentId: z.string().uuid("Invalid department ID"),
  designation: DesignationEnum,
});

export const BaseFacultySchema = z
  .object({
    userId: z.string().uuid("Invalid user ID"),
    shortName: z.string().trim().min(1, "Short name is required"),
  })
  .extend(FacultyAdminOnlySchema.shape)
  .extend(FacultyEditableProfileSchema.shape)
  .extend(FacultyAddressSchema.shape);

export const CreateFacultySchema = FacultyAdminOnlySchema;

export const UpdateFacultySchema = BaseFacultySchema.partial().extend({
  username: z.string().trim().min(1, "Username is required").optional(),
  displayUsername: z
    .string()
    .trim()
    .min(1, "Display username is required")
    .optional(),
});

export const UpdateFacultyProfileSchema = FacultyEditableProfileSchema.extend(
  FacultyAddressSchema.shape
)
  .extend({
    // Admin-only fields are accepted only for admin endpoints.
    staffType: StaffTypeEnum.optional().nullable(),
    dob: optionalDateString,
  })
  .partial();

export const FacultyQualificationSchema = z.object({
  id: z.string().uuid().optional(),
  program: z.string().trim().min(1, "Program is required"),
  degree: z.string().trim().min(1, "Degree is required"),
  specialization: z.string().trim().min(1, "Specialization is required"),
  institution: z.string().trim().min(1, "Institution is required"),
  programType: QualificationProgramTypeEnum,
  yearPassed: z.coerce
    .number()
    .int("Year passed must be an integer")
    .min(1900)
    .max(2200),
});

export const CreateFacultyQualificationSchema = FacultyQualificationSchema.omit({
  id: true,
});

export const UpdateFacultyQualificationSchema = FacultyQualificationSchema.partial();

export const FacultyPublicationSchema = z.object({
  id: z.string().uuid().optional(),
  category: PublicationCategoryEnum,
  publishedDate: requiredDateString,
  authors: z.string().trim().min(1, "Authors are required"),
  publicationDetails: z
    .string()
    .trim()
    .min(1, "Publication details are required"),
  weblink: z.string().url().optional().nullable(),
});

export const CreateFacultyPublicationSchema = FacultyPublicationSchema.omit({
  id: true,
});

export const UpdateFacultyPublicationSchema = FacultyPublicationSchema.partial();

export const FacultyExperienceSchema = z.object({
  id: z.string().uuid().optional(),
  designation: z.string().trim().min(1, "Designation is required"),
  institutionName: z.string().trim().min(1, "Institution is required"),
  startDate: requiredDateString,
  endDate: optionalDateString,
});

export const CreateFacultyExperienceSchema = FacultyExperienceSchema.omit({
  id: true,
});

export const UpdateFacultyExperienceSchema = FacultyExperienceSchema.partial();

export const FacultyResponseSchema = BaseFacultySchema.extend({
  id: z.string().uuid("Invalid faculty ID"),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type BaseFacultyType = z.infer<typeof BaseFacultySchema>;
export type CreateFacultyType = z.infer<typeof CreateFacultySchema>;
export type UpdateFacultyType = z.infer<typeof UpdateFacultySchema>;
export type UpdateFacultyProfileType = z.infer<typeof UpdateFacultyProfileSchema>;
export type FacultyQualificationType = z.infer<typeof FacultyQualificationSchema>;
export type CreateFacultyQualificationType = z.infer<
  typeof CreateFacultyQualificationSchema
>;
export type UpdateFacultyQualificationType = z.infer<
  typeof UpdateFacultyQualificationSchema
>;
export type FacultyPublicationType = z.infer<typeof FacultyPublicationSchema>;
export type CreateFacultyPublicationType = z.infer<
  typeof CreateFacultyPublicationSchema
>;
export type UpdateFacultyPublicationType = z.infer<
  typeof UpdateFacultyPublicationSchema
>;
export type FacultyExperienceType = z.infer<typeof FacultyExperienceSchema>;
export type CreateFacultyExperienceType = z.infer<
  typeof CreateFacultyExperienceSchema
>;
export type UpdateFacultyExperienceType = z.infer<
  typeof UpdateFacultyExperienceSchema
>;
export type FacultyResponseType = z.infer<typeof FacultyResponseSchema>;
