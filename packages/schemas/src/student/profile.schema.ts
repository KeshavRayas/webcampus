import { AdmissionStatusSchema } from "../admission/admission.schema";
import { z } from "zod";

export const StudentGenderEnum = z.enum(["Male", "Female", "Other"]);

export const StudentBloodGroupEnum = z.enum([
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
]);

const optionalText = z.string().trim().max(500).optional().nullable();
const optionalEmail = z.string().email().optional().nullable();
const optionalPhone = z.string().trim().max(30).optional().nullable();
const optionalDate = z.coerce.date().optional().nullable();

export const UpdateStudentProfileSchema = z.object({
  // User level
  fullName: z.string().trim().min(1).max(150).optional(),

  // Personal details
  dob: optionalDate,
  gender: StudentGenderEnum.optional().nullable(),
  bloodGroup: StudentBloodGroupEnum.optional().nullable(),
  category: optionalText,
  aidedStatus: z.enum(["AIDED", "UNAIDED"]).optional().nullable(),
  personalEmail: optionalEmail,
  alternatePhone: optionalPhone,
  aadhaarNumber: z
    .string()
    .trim()
    .regex(/^\d{12}$/, "Aadhaar number must be exactly 12 digits")
    .optional()
    .nullable(),
  admissionQuota: optionalText,
  nationality: z.string().trim().max(120).optional().nullable(),
  passportNumber: z.string().trim().max(40).optional().nullable(),
  visaValidityDetails: z.string().trim().max(300).optional().nullable(),

  // Address details
  permanentAddress: z.string().trim().max(500).optional().nullable(),
  presentAddress: z.string().trim().max(500).optional().nullable(),
  sameAsPermanentAddress: z.boolean().optional(),

  // Family details
  fatherName: z.string().trim().max(150).optional().nullable(),
  fatherOccupation: z.string().trim().max(150).optional().nullable(),
  fatherQualification: z.string().trim().max(150).optional().nullable(),
  fatherMobile: optionalPhone,
  fatherEmail: optionalEmail,
  motherName: z.string().trim().max(150).optional().nullable(),
  motherOccupation: z.string().trim().max(150).optional().nullable(),
  motherQualification: z.string().trim().max(150).optional().nullable(),
  motherMobile: optionalPhone,
  motherEmail: optionalEmail,

  // Education details
  class10School: z.string().trim().max(200).optional().nullable(),
  class10Board: z.string().trim().max(150).optional().nullable(),
  class10Percentage: z.coerce.number().min(0).max(100).optional().nullable(),
  class10Year: z.string().trim().max(12).optional().nullable(),
  class12Institute: z.string().trim().max(200).optional().nullable(),
  class12Board: z.string().trim().max(150).optional().nullable(),
  class12Percentage: z.coerce.number().min(0).max(100).optional().nullable(),
  class12Year: z.string().trim().max(12).optional().nullable(),
  entranceExamDetails: z.string().trim().max(300).optional().nullable(),

  // Document URLs
  aadhaarCardUrl: z.string().trim().max(500).optional().nullable(),
  photoUrl: z.string().trim().max(500).optional().nullable(),
  marksCardsUrl: z.string().trim().max(500).optional().nullable(),
  otherDocumentsUrl: z.string().trim().max(500).optional().nullable(),
});

export const StudentProfileRequestApprovalSchema = z.object({});

export const StudentProfileStatusEnum = AdmissionStatusSchema;

export type UpdateStudentProfileType = z.infer<typeof UpdateStudentProfileSchema>;
