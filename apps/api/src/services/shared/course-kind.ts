/**
 * Shared concept: "batch-managed course" — a course whose students are
 * organized into elective-style batches (ElectiveBatch) rather than sections.
 *
 * Today this is PE, OE and PW. Any new elective type can be added here
 * instead of sprinkling `if (courseType === "PE" || courseType === "OE")`
 * throughout the codebase.
 */
export const isBatchManagedCourse = (
  courseType: string | null | undefined
): boolean => {
  return courseType === "PE" || courseType === "OE" || courseType === "PW";
};

/**
 * True for Project / Mini-Project (PW) courses. PW shares the batch-managed
 * storage (ElectiveBatch family) but differs from PE/OE in its mode
 * (FINAL_SUMMARY, not NON_INTEGRATED) and its group lifecycle
 * (student-created-style groups are configured by the department admin and
 * never renamed/renumbered).
 */
export const isProjectCourse = (
  courseType: string | null | undefined
): boolean => {
  return courseType === "PW";
};
