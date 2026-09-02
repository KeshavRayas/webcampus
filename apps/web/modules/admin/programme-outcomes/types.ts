export type ProgrammeOutcomeTableItem = {
  id: string;
  programType: string;
  departmentId: string | null;
  department: {
    id: string;
    name: string;
    code: string;
  } | null;
  type: string;
  code: string;
  description: string;
  isActive: boolean;
};
