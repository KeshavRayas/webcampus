import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";

type ResolveDepartmentContextInput = {
  source: string;
  departmentId?: string | null;
  departmentName?: string | null;
  strictDepartmentIdOnly?: boolean;
};

export type DepartmentContext = {
  departmentId: string;
  departmentName: string;
};

const normalizeDepartmentName = (value: string) =>
  value.trim().toUpperCase().replace(/\s+/g, "_");

const isDepartmentContextStrictModeEnabled = () =>
  process.env.DEPARTMENT_CONTEXT_STRICT_MODE !== "false";

export class DepartmentContextResolver {
  private static legacyNameOnlyUsageCount = 0;
  private static mismatchUsageCount = 0;
  private static missingMappingCount = 0;
  private static ambiguousNameMappingCount = 0;

  static isStrictModeEnabled(): boolean {
    return isDepartmentContextStrictModeEnabled();
  }

  static async resolve(
    input: ResolveDepartmentContextInput
  ): Promise<DepartmentContext> {
    const strictDepartmentIdOnly =
      input.strictDepartmentIdOnly ?? DepartmentContextResolver.isStrictModeEnabled();

    const departmentId = input.departmentId?.trim();
    const departmentName = input.departmentName?.trim();

    if (departmentId) {
      const department = await db.department.findUnique({
        where: { id: departmentId },
        select: { id: true, name: true },
      });

      if (!department) {
        DepartmentContextResolver.missingMappingCount += 1;
        logger.warn("Department mapping missing for departmentId", {
          source: input.source,
          metric: "department_context_missing_mapping_count",
          missingMappingCount: DepartmentContextResolver.missingMappingCount,
          providedDepartmentId: departmentId,
        });
        throw new Error("Department not found");
      }

      if (
        departmentName &&
        normalizeDepartmentName(department.name) !==
          normalizeDepartmentName(departmentName)
      ) {
        DepartmentContextResolver.mismatchUsageCount += 1;
        logger.warn("Department context mismatch", {
          source: input.source,
          metric: "department_context_id_name_mismatch_count",
          mismatchCount: DepartmentContextResolver.mismatchUsageCount,
          providedDepartmentId: departmentId,
          providedDepartmentName: departmentName,
          resolvedDepartmentName: department.name,
        });
        throw new Error("departmentId and departmentName do not match");
      }

      return {
        departmentId: department.id,
        departmentName: department.name,
      };
    }

    if (strictDepartmentIdOnly) {
      throw new Error("departmentId is required");
    }

    if (!departmentName) {
      throw new Error("departmentId is required");
    }

    const candidateDepartments = await db.department.findMany({
      where: {
        name: {
          equals: departmentName,
          mode: "insensitive",
        },
      },
      select: { id: true, name: true },
      take: 2,
    });

    if (candidateDepartments.length === 0) {
      DepartmentContextResolver.missingMappingCount += 1;
      logger.warn("Department mapping missing for departmentName", {
        source: input.source,
        metric: "department_context_missing_mapping_count",
        missingMappingCount: DepartmentContextResolver.missingMappingCount,
        providedDepartmentName: departmentName,
      });
      throw new Error("Department not found");
    }

    if (candidateDepartments.length > 1) {
      DepartmentContextResolver.ambiguousNameMappingCount += 1;
      logger.warn("Ambiguous departmentName mapping", {
        source: input.source,
        metric: "department_context_ambiguous_name_count",
        ambiguousNameMappingCount:
          DepartmentContextResolver.ambiguousNameMappingCount,
        providedDepartmentName: departmentName,
        candidateDepartmentIds: candidateDepartments.map((d) => d.id),
      });
      throw new Error("Ambiguous departmentName mapping");
    }

    const department = candidateDepartments[0]!;

    DepartmentContextResolver.legacyNameOnlyUsageCount += 1;
    logger.warn("Legacy departmentName-only payload resolved", {
      source: input.source,
      metric: "department_context_legacy_name_only_count",
      legacyNameOnlyUsageCount:
        DepartmentContextResolver.legacyNameOnlyUsageCount,
      providedDepartmentName: departmentName,
      resolvedDepartmentId: department.id,
    });

    return {
      departmentId: department.id,
      departmentName: department.name,
    };
  }
}
