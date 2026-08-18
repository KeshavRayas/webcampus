import { PeCapacityService } from "./pe-capacity.service";

export interface DistributionGroup {
  id: string;
  sortOrder: number;
  hasFaculty: boolean;
}

export interface DistributionFaculty {
  id: string;
  name: string;
}

export interface BalancedFacultyProposalOptions {
  preserveExisting?: boolean;
}

export interface FacultyProposal {
  groupId: string;
  facultyId: string;
}

export const computeBalancedFacultyProposal = (
  groups: DistributionGroup[],
  faculty: DistributionFaculty[],
  options: BalancedFacultyProposalOptions = {}
): FacultyProposal[] => {
  const { preserveExisting = true } = options;

  if (faculty.length === 0) {
    throw new Error("No faculty available to propose for project groups");
  }

  const sortedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);
  const targets = preserveExisting
    ? sortedGroups.filter((group) => !group.hasFaculty)
    : sortedGroups;

  const result: FacultyProposal[] = [];
  if (targets.length === 0) {
    return result;
  }

  if (faculty.length >= targets.length) {
    targets.forEach((group, index) => {
      const fac = faculty[index];
      if (fac) {
        result.push({ groupId: group.id, facultyId: fac.id });
      }
    });
    return result;
  }

  const facultyCount = faculty.length;
  const base = Math.floor(targets.length / facultyCount);
  const remainder = targets.length % facultyCount;

  let groupIndex = 0;
  for (let i = 0; i < facultyCount && groupIndex < targets.length; i++) {
    let load = base + (i < remainder ? 1 : 0);
    while (load > 0 && groupIndex < targets.length) {
      const group = targets[groupIndex];
      const fac = faculty[i];
      if (group && fac) {
        result.push({ groupId: group.id, facultyId: fac.id });
      }
      groupIndex++;
      load--;
    }
  }

  return result;
};

export const assertFacultyReassignmentAllowed = async (
  courseId: string
): Promise<void> => {
  const hasData =
    await PeCapacityService.hasAttendanceOrMarksForCourse(courseId);
  if (hasData) {
    throw new Error(
      "Faculty assignments cannot be modified after attendance or marks have been recorded for this course"
    );
  }
};
