import { logger } from "@webcampus/common/logger";
import { db, Prisma, Section } from "@webcampus/db";
import {
  CreateSectionType,
  GenerateSectionsDTO,
  SectionQueryType,
  SectionResponseType,
} from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";

export class SectionService {
  static async create(
    data: CreateSectionType
  ): Promise<BaseResponse<SectionResponseType>> {
    try {
      const section = await db.section.create({
        data,
      });

      const response: BaseResponse<SectionResponseType> = {
        status: "success",
        message: "Section created successfully",
        data: section,
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error("Section already exists");
        }
      }
      if (error instanceof Error) {
        throw error;
      }
      logger.error("Error creating section:", { error });
      throw new Error("Failed to create section");
    }
  }

  static async getAll(
    query: SectionQueryType
  ): Promise<BaseResponse<SectionResponseType[]>> {
    try {
      const sections = await db.section.findMany({
        where: {
          ...query,
        },
      });
      const response: BaseResponse<SectionResponseType[]> = {
        status: "success",
        message: "Sections retrieved successfully",
        data: sections,
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error("No sections found");
        }
      }
      if (error instanceof Error) {
        throw error;
      }
      logger.error("Error retrieving sections:", { error });
      throw new Error("Failed to retrieve sections");
    }
  }

  static async getById(id: string): Promise<BaseResponse<SectionResponseType>> {
    try {
      const section = await db.section.findUnique({
        where: { id },
        include: {
          department: true,
          courses: true,
          studentSections: true,
          batches: true,
        },
      });

      if (!section) {
        throw new Error("Section not found");
      }

      const response: BaseResponse<SectionResponseType> = {
        status: "success",
        message: "Section retrieved successfully",
        data: section,
      };
      logger.info(response);
      return response;
    } catch (error) {
      logger.error("Error retrieving section:", { error });
      throw new Error("Failed to retrieve section");
    }
  }

  static async delete(id: string): Promise<BaseResponse<void>> {
    try {
      await db.section.delete({
        where: { id },
      });
      const response: BaseResponse<void> = {
        status: "success",
        message: "Section deleted successfully",
        data: null,
      };
      logger.info(response);
      return response;
    } catch (error) {
      logger.error("Error deleting section:", { error });
      throw new Error("Failed to delete section");
    }
  }

  /**
   * Get the count of students not yet assigned to any section
   * for a given semester + department.
   */
  static async getUnassignedCount(
    semesterId: string,
    departmentName: string
  ): Promise<BaseResponse<{ count: number; semesterNumber: number }>> {
    try {
      const semester = await db.semester.findUnique({
        where: { id: semesterId },
      });
      if (!semester) throw new Error("Semester not found");

      // Find existing section IDs for this semester + department
      const existingSections = await db.section.findMany({
        where: { semesterId, departmentName },
        select: { id: true },
      });
      const existingSectionIds = existingSections.map((s) => s.id);

      // Count students in this department+semester that are NOT in any section
      const count = await db.student.count({
        where: {
          departmentName,
          currentSemester: semester.semesterNumber,
          ...(existingSectionIds.length > 0
            ? {
                studentSections: {
                  none: {
                    sectionId: { in: existingSectionIds },
                  },
                },
              }
            : {}),
        },
      });

      return {
        status: "success",
        message: "Unassigned student count fetched",
        data: { count, semesterNumber: semester.semesterNumber },
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      logger.error("Error fetching unassigned count:", { error });
      throw new Error("Failed to fetch unassigned student count");
    }
  }

  /**
   * Auto-generate sections and assign students using a transaction.
   */
  static async generateSections(
    data: GenerateSectionsDTO
  ): Promise<BaseResponse<Section[]>> {
    try {
      const { semesterId, departmentName, studentsPerSection, academicYear } =
        data;

      const semester = await db.semester.findUnique({
        where: { id: semesterId },
      });
      if (!semester) throw new Error("Semester not found");

      const semesterNumber = semester.semesterNumber;

      // Find existing section IDs for this semester + department
      const existingSections = await db.section.findMany({
        where: { semesterId, departmentName },
        select: { id: true },
      });
      const existingSectionIds = existingSections.map((s) => s.id);

      // Fetch unassigned students
      const unassignedStudents = await db.student.findMany({
        where: {
          departmentName,
          currentSemester: semesterNumber,
          ...(existingSectionIds.length > 0
            ? {
                studentSections: {
                  none: {
                    sectionId: { in: existingSectionIds },
                  },
                },
              }
            : {}),
        },
        orderBy: { usn: "asc" },
      });

      if (unassignedStudents.length === 0) {
        throw new Error(
          "No unassigned students found for this semester and department"
        );
      }

      // Chunk students
      const chunks: (typeof unassignedStudents)[] = [];
      for (let i = 0; i < unassignedStudents.length; i += studentsPerSection) {
        chunks.push(unassignedStudents.slice(i, i + studentsPerSection));
      }

      // Determine starting letter offset from existing sections
      const startIndex = existingSections.length;

      // Transaction: create sections + assign students
      const createdSections = await db.$transaction(async (tx) => {
        const sections: Section[] = [];

        for (let i = 0; i < chunks.length; i++) {
          const sectionName = `${semesterNumber}${String.fromCharCode(65 + startIndex + i)}`;

          const section = await tx.section.create({
            data: {
              name: sectionName,
              departmentName,
              semesterId,
            },
          });

          await tx.studentSection.createMany({
            data: chunks[i]!.map((student) => ({
              studentId: student.id,
              sectionId: section.id,
              semester: semesterNumber,
              academicYear,
            })),
          });

          sections.push(section);
        }

        return sections;
      });

      return {
        status: "success",
        message: `Generated ${createdSections.length} sections with ${unassignedStudents.length} students assigned`,
        data: createdSections,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error(
            "Section name conflict: some sections already exist for this semester"
          );
        }
      }
      if (error instanceof Error) throw error;
      logger.error("Error generating sections:", { error });
      throw new Error("Failed to generate sections");
    }
  }

  /**
   * Get sections with nested student data for display cards.
   */
  static async getSectionsWithStudents(
    semesterId: string,
    departmentName: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const sections = await db.section.findMany({
        where: { semesterId, departmentName },
        include: {
          studentSections: {
            include: {
              student: {
                include: {
                  user: {
                    select: {
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: { studentSections: true },
          },
        },
        orderBy: { name: "asc" },
      });

      return {
        status: "success",
        message: "Sections with students fetched successfully",
        data: sections,
      };
    } catch (error) {
      logger.error("Error fetching sections with students:", { error });
      throw new Error("Failed to fetch sections with students");
    }
  }

  /**
   * Get students not yet assigned to any section for a given semester + department.
   * Returns full student data with user info for UI display.
   */
  static async getUnassignedStudents(
    semesterId: string,
    departmentName: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const semester = await db.semester.findUnique({
        where: { id: semesterId },
      });
      if (!semester) throw new Error("Semester not found");

      const existingSections = await db.section.findMany({
        where: { semesterId, departmentName },
        select: { id: true },
      });
      const existingSectionIds = existingSections.map((s) => s.id);

      const students = await db.student.findMany({
        where: {
          departmentName,
          currentSemester: semester.semesterNumber,
          ...(existingSectionIds.length > 0
            ? {
                studentSections: {
                  none: {
                    sectionId: { in: existingSectionIds },
                  },
                },
              }
            : {}),
        },
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
        orderBy: { usn: "asc" },
      });

      return {
        status: "success",
        message: "Unassigned students fetched successfully",
        data: students,
      };
    } catch (error) {
      if (error instanceof Error) throw error;
      logger.error("Error fetching unassigned students:", { error });
      throw new Error("Failed to fetch unassigned students");
    }
  }

  /**
   * Assign specific students to a section by creating StudentSection records.
   */
  static async assignStudentsToSection(
    sectionId: string,
    studentIds: string[],
    academicYear: string
  ): Promise<BaseResponse<{ count: number }>> {
    try {
      const section = await db.section.findUnique({
        where: { id: sectionId },
        include: { semester: true },
      });
      if (!section) throw new Error("Section not found");

      const result = await db.studentSection.createMany({
        data: studentIds.map((studentId) => ({
          studentId,
          sectionId,
          semester: section.semester.semesterNumber,
          academicYear,
        })),
        skipDuplicates: true,
      });

      return {
        status: "success",
        message: `${result.count} student(s) assigned to section ${section.name}`,
        data: { count: result.count },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error("Some students are already assigned to this section");
        }
      }
      if (error instanceof Error) throw error;
      logger.error("Error assigning students to section:", { error });
      throw new Error("Failed to assign students to section");
    }
  }
}
