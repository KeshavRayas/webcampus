import "dotenv/config";
import { invalidatePrefix } from "@webcampus/common/cache";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import {
  admissionModes,
  categoriesAllotted,
  categoriesClaimed,
  quotas,
} from "@webcampus/schemas/constants";

type AdmissionConstantRow = {
  modeOfAdmission: string;
  quota: string;
  categoryClaimed: string;
  categoryAllotted: string;
};

function buildRows(): AdmissionConstantRow[] {
  const rows: AdmissionConstantRow[] = [];

  for (const mode of admissionModes) {
    const claimed = categoriesClaimed[mode] as readonly string[];
    if (!claimed?.length) {
      throw new Error(`No categoriesClaimed defined for mode ${mode}`);
    }
    const allotted = (categoriesAllotted[mode] ?? claimed) as readonly string[];
    if (!allotted.length) {
      throw new Error(`No categoriesAllotted defined for mode ${mode}`);
    }
    const modeQuotas = (quotas[mode] ?? []) as readonly string[];
    if (!modeQuotas.length) {
      throw new Error(
        `No quotas defined for mode ${mode} — add entry to packages/schemas/src/constants/admission-options.ts`
      );
    }
    const defaultAllotted = allotted[0] ?? "GM";

    for (const quota of modeQuotas) {
      for (const category of claimed) {
        rows.push({
          modeOfAdmission: mode,
          quota,
          categoryClaimed: category,
          categoryAllotted: allotted.includes(category)
            ? category
            : defaultAllotted,
        });
      }
    }
  }

  return rows;
}

async function seedAdmissionConstants(): Promise<void> {
  const rows = buildRows();
  logger.info(`Seeding ${rows.length} AdmissionConstants rows...`);

  let count = 0;

  for (const row of rows) {
    await db.admissionConstants.upsert({
      where: {
        modeOfAdmission_quota_categoryClaimed_categoryAllotted: {
          modeOfAdmission: row.modeOfAdmission,
          quota: row.quota,
          categoryClaimed: row.categoryClaimed,
          categoryAllotted: row.categoryAllotted,
        },
      },
      update: {},
      create: row,
    });

    count++;
  }

  logger.info(`Admission constants seeding complete: ${count} rows ensured.`);

  try {
    await invalidatePrefix("cache:admission-constants:");
    logger.info("Admission constants cache invalidated");
  } catch (error) {
    logger.warn(
      `Cache invalidation failed (non-fatal): ${(error as Error).message}`
    );
  }
}

seedAdmissionConstants()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error(
      `Failed to seed admission constants: ${(error as Error).message}`
    );
    process.exit(1);
  });
