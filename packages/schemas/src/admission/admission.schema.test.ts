import { describe, expect, test } from "bun:test";
import {
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
      nameAsPer10th: "Asha Rao",
      modeOfAdmission: "KCET",
      admissionType: "REGULAR",
      scholarship: "false",
      studiedKannadaIn10th: "false",
      admissionBasedOn: "CLASS_12_PUC",
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
});
