import { db } from "@webcampus/db";

interface GenerateProctorGroupsParams {
  departmentId: string;
  semesterId: string;
  studentsPerGroup: number;
  action: "generate" | "regenerate";
}

export class ProctorService {
  static async generateProctorGroups(params: GenerateProctorGroupsParams) {
    const { departmentId, semesterId, studentsPerGroup, action } = params;

    return await db.$transaction(async (tx) => {
      // 1. Verify semester
      const semester = await tx.semester.findUnique({
        where: { id: semesterId },
      });
      if (!semester) {
        throw new Error("Semester not found");
      }

      // 2. Handle regenerate: clear existing assignments and delete groups
      if (action === "regenerate") {
        // Clear students' proctor groups in this semester
        await tx.student.updateMany({
          where: {
            departmentId,
            semesterId,
          },
          data: { proctorGroupId: null },
        });

        // Delete all proctor groups for this semester and department
        await tx.proctorGroup.deleteMany({
          where: {
            departmentId,
            semesterId,
          },
        });
      }

      // 3. Fetch unassigned students
      const unassignedStudents = await tx.student.findMany({
        where: {
          departmentId,
          semesterId,
          proctorGroupId: null,
        },
        select: { id: true, usn: true },
        orderBy: { usn: "asc" },
      });

      if (unassignedStudents.length === 0) {
        return {
          status: "success",
          message: "No unassigned students found.",
          data: { groupsCreated: 0, studentsAssigned: 0 },
        };
      }

      // 4. Determine how many groups we need
      const numGroups = Math.ceil(unassignedStudents.length / studentsPerGroup);

      // 5. Determine starting index for group numbers
      let existingCount = 0;
      if (action === "generate") {
        existingCount = await tx.proctorGroup.count({
          where: { departmentId, semesterId },
        });
      }

      // 6. Fetch active faculty (assume all are active if user status isn't available)
      const faculty = await tx.faculty.findMany({
        where: { departmentId },
        orderBy: { id: "asc" }, // Deterministic order
      });

      // 7. Create groups and assign students
      for (let i = 0; i < numGroups; i++) {
        const groupNumber = `PR-${existingCount + i + 1}`;
        const facultyItem =
          faculty.length > 0 ? faculty[i % faculty.length] : undefined;
        const facultyId = facultyItem ? facultyItem.id : null;

        const group = await tx.proctorGroup.create({
          data: {
            groupNumber,
            departmentId,
            semesterId,
            facultyId,
          },
        });

        const startIndex = i * studentsPerGroup;
        const groupStudents = unassignedStudents.slice(
          startIndex,
          startIndex + studentsPerGroup
        );

        if (groupStudents.length > 0) {
          await tx.student.updateMany({
            where: { id: { in: groupStudents.map((s) => s.id) } },
            data: { proctorGroupId: group.id },
          });
        }
      }

      return {
        status: "success",
        message: `Successfully generated ${numGroups} group(s) and assigned ${unassignedStudents.length} student(s).`,
        data: {
          groupsCreated: numGroups,
          studentsAssigned: unassignedStudents.length,
        },
      };
    });
  }
}
