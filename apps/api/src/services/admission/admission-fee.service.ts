import { db } from "@webcampus/db";
import { BaseResponse } from "@webcampus/types/api";

export class AdmissionFeeService {
  static async getFeeStructure(input: {
    departmentId: string;
    modeOfAdmission: string;
    categoryAllotted?: string;
    quota?: string;
  }): Promise<BaseResponse<unknown>> {
    const fee = await db.feeStructure.findFirst({
      where: {
        departmentId: input.departmentId,
        modeOfAdmission: input.modeOfAdmission,
        ...(input.categoryAllotted
          ? { categoryAllotted: input.categoryAllotted }
          : {}),
        ...(input.quota ? { quota: input.quota } : {}),
      },
      select: { feeAmount: true },
      orderBy: { updatedAt: "desc" },
    });

    return {
      status: "success",
      message: "Fee structure fetched successfully",
      data: { feeAmount: fee?.feeAmount ?? 0 },
    };
  }
}
