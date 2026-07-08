let _seq = 0;

export type MakeSectionInput = {
  departmentId: string;
  semesterId: string;
  name?: string;
  cycle?: "PHYSICS" | "CHEMISTRY" | "NONE";
};

export function makeSection(
  overrides: {
    departmentId: string;
    semesterId: string;
  } & Partial<MakeSectionInput>
) {
  _seq++;
  const letter = String.fromCharCode(64 + _seq);
  return {
    name: overrides.name ?? `Section ${letter}`,
    departmentId: overrides.departmentId,
    semesterId: overrides.semesterId,
    cycle: overrides.cycle ?? "NONE",
  };
}

export type MakeBatchInput = {
  sectionId: string;
  name?: string;
};

export function makeBatch(
  overrides: { sectionId: string } & Partial<MakeBatchInput>
) {
  _seq++;
  return {
    sectionId: overrides.sectionId,
    name: overrides.name ?? `Batch ${String.fromCharCode(64 + _seq)}`,
  };
}
