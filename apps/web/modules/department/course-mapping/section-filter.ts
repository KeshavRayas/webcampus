export const ALL_SECTIONS = "__all__";

export type SectionFilterMapping = {
  electiveBatchId: string;
  electiveBatchName: string;
  sectionName: string | null;
  facultyId: string | null;
  proposedFacultyId: string | null;
};

export function getSectionOptions(mappings: SectionFilterMapping[]): string[] {
  return Array.from(
    new Set(
      mappings.map((m) => m.sectionName).filter((s): s is string => s !== null)
    )
  ).sort();
}

export function filterMappingsBySection(
  mappings: SectionFilterMapping[],
  sectionFilter: string
): SectionFilterMapping[] {
  if (sectionFilter === ALL_SECTIONS) {
    return mappings;
  }
  return mappings.filter((m) => m.sectionName === sectionFilter);
}
