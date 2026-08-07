import { describe, expect, test } from "bun:test";
import {
  AdmissionWizardSchema,
  ChangeAdmissionModeSchema,
  SubmitApplicationSchema,
} from "./admission.schema";

describe("admission schemas", () => {
  test("allows non-KCET admission mode changes without a quota", () => {
    const result = ChangeAdmissionModeSchema.safeParse({
      modeOfAdmission: "COMED-K",
      categoryClaimed: "GM",
      categoryAllotted: "GM",
      quota: undefined,
      entranceExamRank: 12,
      originalAdmissionOrderNumber: "123",
      originalAdmissionOrderDate: "2024-01-02",
    });

    expect(result.success).toBe(true);
  });

  test("preserves education country fields on submit", () => {
    const result = SubmitApplicationSchema.safeParse({
      applicationId: "APP-001",
      firstName: "Asha",
      lastName: "Rao",
      modeOfAdmission: "KCET",
      semesterId: "11111111-1111-4111-8111-111111111111",
      departmentId: "22222222-2222-4222-8222-222222222222",
      categoryClaimed: "GM",
      categoryAllotted: "GM",
      quota: "CET-AIDED",
      schoolCountry: "IN",
      instituteCountry: "IN",
      diplomaCountry: "US",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schoolCountry).toBe("IN");
      expect(result.data.instituteCountry).toBe("IN");
      expect(result.data.diplomaCountry).toBe("US");
    }
  });

  test("validates the structured admission wizard payload", () => {
    const result = AdmissionWizardSchema.safeParse({
      application: {
        status: "DRAFT",
        quota: "MERIT",
        branchCode: "CSE",
        academicYear: "2026-27",
      },
      personalDetails: {
        fullName: "Anish Kumar",
        dob: "2005-01-15",
        gender: "Male",
        bloodGroup: "O+",
        aadharNumber: "123456789012",
        religion: "Hindu",
        caste: "General",
        motherTongue: "Kannada",
        claimedCategory: "GM",
        allottedCategory: "GM",
      },
      parentDetails: {
        fatherName: "Ramesh Kumar",
        fatherOccupation: "Engineer",
        fatherPhone: "9999999999",
        fatherEmail: "father@example.com",
        motherName: "Suma Kumar",
        motherOccupation: "Teacher",
        motherPhone: "8888888888",
        annualIncome: 1200000,
      },
      addressDetails: {
        permanentAddress: "1 Main Road",
        permanentCity: "Bengaluru",
        permanentState: "Karnataka",
        permanentPincode: "560001",
        communicationAddress: "1 Main Road",
        communicationCity: "Bengaluru",
        communicationState: "Karnataka",
        communicationPincode: "560001",
        isSameAddress: true,
      },
      entranceDetails: {
        entranceType: "KCET",
        rollNumber: "KCET123456",
        rank: 1234,
        allotmentNumber: "A001",
        admissionDate: "2026-08-01",
      },
      academicDetails: {
        tenthBoard: "KSEEB",
        tenthRegistrationNumber: "10REG123",
        tenthMaxMarks: 500,
        tenthObtainedMarks: 450,
        twelfthBoard: "PUC",
        twelfthRegistrationNumber: "12REG123",
        twelfthMaxMarks: 500,
        twelfthObtainedMarks: 470,
        physicsMarks: 90,
        chemistryMarks: 88,
        mathematicsMarks: 95,
        pcmPercentage: 91.0,
      },
      feeDetails: {
        tuitionFee: 100000,
        otherFee: 5000,
        totalAmount: 105000,
        receiptNumber: "RCPT001",
        paymentDate: "2026-08-01",
        paymentMode: "ONLINE",
        transactionRef: "TXN123",
        bankName: "State Bank of India",
      },
      uploadedDocuments: [
        {
          documentType: "AADHAAR",
          fileName: "aadhar.pdf",
          fileUrl: "https://example.com/aadhar.pdf",
        },
      ],
      declaration: {
        agreedToTerms: true,
        applicantSignature: "Anish Kumar",
        guardianSignature: "Ramesh Kumar",
      },
    });

    expect(result.success).toBe(true);
  });
});
