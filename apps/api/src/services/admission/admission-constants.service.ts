import { db } from "@webcampus/db";
import { AdmissionReferenceListsSchema } from "@webcampus/schemas/admission";
import {
  admissionModes,
  categoriesAllotted,
  categoriesClaimed,
  quotas,
} from "@webcampus/schemas/constants";
import {
  AdmissionConstantRecordDTO,
  AdmissionConstantsOptionsDTO,
  AdmissionReferenceCreatePayloadDTO,
  AdmissionReferenceListsPayloadDTO,
} from "@webcampus/types/api";

function orderByReference<T extends string>(
  values: T[],
  reference: readonly T[] | null | undefined
): T[] {
  if (!reference || reference.length === 0) return values;
  const indexOf = new Map<string, number>(
    reference.map((value, index) => [value, index])
  );

  return [...values].sort((a, b) => {
    const indexA = indexOf.get(a);
    const indexB = indexOf.get(b);
    if (indexA === undefined && indexB === undefined) {
      return a.localeCompare(b);
    }
    if (indexA === undefined) return 1;
    if (indexB === undefined) return -1;
    return indexA - indexB;
  });
}

export class AdmissionConstantsService {
  static async getOptions(): Promise<AdmissionConstantsOptionsDTO> {
    const rows = await db.admissionConstants.findMany({
      orderBy: [{ modeOfAdmission: "asc" }],
    });

    const distinctModes = Array.from(
      new Set(rows.map((row) => row.modeOfAdmission))
    );
    const categoriesClaimedMap: Record<string, string[]> = {};
    const categoriesAllottedMap: Record<string, string[]> = {};
    const quotasMap: Record<string, string[]> = {};

    for (const row of rows) {
      const mode = row.modeOfAdmission;
      const claimedOptions =
        categoriesClaimedMap[mode] ?? (categoriesClaimedMap[mode] = []);
      const allottedOptions =
        categoriesAllottedMap[mode] ?? (categoriesAllottedMap[mode] = []);
      const modeQuotas = quotasMap[mode] ?? (quotasMap[mode] = []);

      if (!claimedOptions.includes(row.categoryClaimed)) {
        claimedOptions.push(row.categoryClaimed);
      }
      if (!allottedOptions.includes(row.categoryAllotted)) {
        allottedOptions.push(row.categoryAllotted);
      }
      if (row.quota && !modeQuotas.includes(row.quota)) {
        modeQuotas.push(row.quota);
      }
    }

    for (const mode of distinctModes) {
      categoriesClaimedMap[mode] = orderByReference(
        categoriesClaimedMap[mode] ?? [],
        categoriesClaimed[mode as (typeof admissionModes)[number]]
      );
      categoriesAllottedMap[mode] = orderByReference(
        categoriesAllottedMap[mode] ?? [],
        categoriesAllotted[mode as (typeof admissionModes)[number]]
      );
      quotasMap[mode] = orderByReference(
        quotasMap[mode] ?? [],
        quotas[mode as (typeof admissionModes)[number]]
      );
    }

    return {
      modes: orderByReference(distinctModes, admissionModes),
      categoriesClaimed: categoriesClaimedMap,
      categoriesAllotted: categoriesAllottedMap,
      quotas: quotasMap,
    };
  }

  static async getAll(): Promise<AdmissionConstantRecordDTO[]> {
    const rows = await db.admissionConstants.findMany({
      orderBy: [
        { modeOfAdmission: "asc" },
        { quota: "asc" },
        { categoryClaimed: "asc" },
      ],
    });

    return rows.map((row) => ({
      id: row.id,
      modeOfAdmission: row.modeOfAdmission,
      quota: row.quota,
      categoryClaimed: row.categoryClaimed,
      categoryAllotted: row.categoryAllotted,
    }));
  }

  private static buildRowsForMode(
    mode: string,
    lists: AdmissionReferenceListsPayloadDTO
  ): {
    modeOfAdmission: string;
    quota: string;
    categoryClaimed: string;
    categoryAllotted: string;
  }[] {
    const { quotas, categoriesClaimed, categoriesAllotted } = lists;
    const uniqueQuotas = Array.from(new Set(quotas));
    const uniqueClaimed = Array.from(new Set(categoriesClaimed));
    const uniqueAllotted = Array.from(new Set(categoriesAllotted));
    const defaultAllotted = uniqueAllotted[0] ?? "GM";
    const rows: {
      modeOfAdmission: string;
      quota: string;
      categoryClaimed: string;
      categoryAllotted: string;
    }[] = [];

    for (const quota of uniqueQuotas) {
      for (const category of uniqueClaimed) {
        rows.push({
          modeOfAdmission: mode,
          quota,
          categoryClaimed: category,
          categoryAllotted: uniqueAllotted.includes(category)
            ? category
            : defaultAllotted,
        });
      }
    }

    return rows;
  }

  static async createMode(
    payload: AdmissionReferenceCreatePayloadDTO
  ): Promise<void> {
    const { modeOfAdmission, ...lists } = payload;

    const existing = await db.admissionConstants.findFirst({
      where: { modeOfAdmission },
      select: { id: true },
    });
    if (existing) {
      throw new Error(`Admission mode "${modeOfAdmission}" already exists`);
    }

    const rows = AdmissionConstantsService.buildRowsForMode(
      modeOfAdmission,
      lists
    );

    await db.$transaction([
      db.admissionConstants.deleteMany({ where: { modeOfAdmission } }),
      db.admissionConstants.createMany({ data: rows }),
    ]);
  }

  static async updateMode(
    mode: string,
    lists: AdmissionReferenceListsPayloadDTO
  ): Promise<void> {
    AdmissionReferenceListsSchema.parse(lists);

    const existing = await db.admissionConstants.findFirst({
      where: { modeOfAdmission: mode },
      select: { id: true },
    });
    if (!existing) {
      throw new Error(`Admission mode "${mode}" does not exist`);
    }

    const rows = AdmissionConstantsService.buildRowsForMode(mode, lists);

    await db.$transaction([
      db.admissionConstants.deleteMany({ where: { modeOfAdmission: mode } }),
      db.admissionConstants.createMany({ data: rows }),
    ]);
  }

  static async deleteMode(mode: string): Promise<void> {
    await db.admissionConstants.deleteMany({
      where: { modeOfAdmission: mode },
    });
  }
}
