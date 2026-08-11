/**
 * Shared concept: "batch-managed course" — a course whose students are
 * organized into elective-style batches (ElectiveBatch) rather than sections.
 *
 * Today this is PE and OE. Tomorrow any new elective type can be added here
 * instead of sprinkling `if (courseType === "PE" || courseType === "OE")`
 * throughout the codebase.
 */
export const isBatchManagedCourse = (
  courseType: string | null | undefined
): boolean => {
  return courseType === "PE" || courseType === "OE";
};
