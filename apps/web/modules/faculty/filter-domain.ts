export type FilterDomain = "section" | "batch" | "group" | null;

export const DOMAIN_LABELS: Record<Exclude<FilterDomain, null>, string> = {
  section: "Section",
  batch: "Batch",
  group: "Group",
};

export const DOMAIN_ALL_LABELS: Record<Exclude<FilterDomain, null>, string> = {
  section: "All sections",
  batch: "All batches",
  group: "All groups",
};

export const isBatchManagedCourseType = (
  courseType: string | null | undefined
): boolean => courseType === "PE" || courseType === "OE" || courseType === "PW";

export const deriveCourseFilterDomain = (
  courseType: string | null | undefined
): FilterDomain => {
  if (courseType === "PC" || courseType === "NCMC") {
    return "section";
  }
  if (courseType === "PE" || courseType === "OE") {
    return "batch";
  }
  if (courseType === "PW") {
    return "group";
  }
  return null;
};

export interface DomainSourceAssignment {
  course: {
    id: string;
    semester: { id: string; academicTerm: { id: string } };
  };
  section: { id: string; name: string } | null;
  electiveBatchId: string | null;
  electiveBatchName: string | null;
}

export interface DomainScope {
  termId: string;
  semesterId: string;
  courseId: string;
}

export type DomainKind = "section" | "batch" | "group";

export interface DomainOption {
  value: string;
  label: string;
}

/**
 * Builds domain filter options that belong ONLY to the selected course.
 *
 * Invariant: after a course is selected, every returned option must belong to
 * that exact course. Assignments that do not match the scope (term, semester,
 * and especially course) never contribute options. Deduplication is keyed by
 * the underlying record id, never by option label/name.
 *
 * Section options use Section.id; batch and group options use ElectiveBatch.id
 * (PE/OE label as Batch, PW as Group at the UI layer — the id namespace is the
 * same ElectiveBatch for all three).
 */
export const buildDomainOptions = (
  assignments: DomainSourceAssignment[],
  scope: DomainScope,
  kind: DomainKind
): DomainOption[] => {
  const options = new Map<string, string>();
  for (const assignment of assignments) {
    if (assignment.course.id !== scope.courseId) continue;
    if (
      scope.termId &&
      assignment.course.semester.academicTerm.id !== scope.termId
    ) {
      continue;
    }
    if (
      scope.semesterId &&
      assignment.course.semester.id !== scope.semesterId
    ) {
      continue;
    }
    if (kind === "section") {
      if (assignment.section) {
        options.set(assignment.section.id, assignment.section.name);
      }
    } else if (assignment.electiveBatchId) {
      options.set(
        assignment.electiveBatchId,
        assignment.electiveBatchName ?? "Batch"
      );
    }
  }
  return Array.from(options.entries()).map(([value, label]) => ({
    value,
    label,
  }));
};
