import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import {
  CreateSectionAssignmentType,
  SectionAssignmentResponseType,
  UpdateSectionAssignmentType,
} from "@webcampus/schemas/department";
import { BaseResponse } from "@webcampus/types/api";
import { ProjectMappingService } from "./project-mapping.service";

export class SectionAssignment {
  static async validateSameDepartment(studentId: string, sectionId: string) {
    const student = await db.student.findUnique({
      where: { id: studentId },
      select: {
        department: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!student) throw new Error("Student not found");

    const section = await db.section.findUnique({
      where: { id: sectionId },
      select: {
        department: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!section) throw new Error("Section not found");

    if (student.department.id !== section.department.id) {
      throw new Error(
        "Student and Section do not belong to the same department"
      );
    }
  }

  static async create(
    data: CreateSectionAssignmentType
  ): Promise<BaseResponse<SectionAssignmentResponseType>> {
    try {
      await SectionAssignment.validateSameDepartment(
        data.studentId,
        data.sectionId
      );
      const assignment = await db.$transaction(async (tx) => {
        const created = await tx.studentSection.create({
          data,
        });
        const section = await tx.section.findUnique({
          where: { id: data.sectionId },
          select: { departmentId: true, semesterId: true },
        });
        if (section) {
          await ProjectMappingService.reconcileProjectGroupsForScope({
            tx,
            departmentId: section.departmentId,
            semesterId: section.semesterId,
          });
        }
        return created;
      });

      const response: BaseResponse<SectionAssignmentResponseType> = {
        status: "success",
        message: "Section assignment created successfully",
        data: assignment,
      };
      logger.info(response);
      return response;
    } catch (error) {
      logger.error("Error creating section assignment:", { error });
      throw error;
    }
  }

  static async getAll(): Promise<
    BaseResponse<SectionAssignmentResponseType[]>
  > {
    try {
      const assignments = await db.studentSection.findMany();

      const response: BaseResponse<SectionAssignmentResponseType[]> = {
        status: "success",
        message: "Section assignments retrieved successfully",
        data: assignments,
      };
      logger.info(response);
      return response;
    } catch (error) {
      logger.error("Error retrieving section assignments:", { error });
      throw new Error("Failed to retrieve section assignments");
    }
  }

  static async getById(
    id: string
  ): Promise<BaseResponse<SectionAssignmentResponseType>> {
    try {
      const assignment = await db.studentSection.findUnique({
        where: { id },
      });

      if (!assignment) {
        throw new Error("Section assignment not found");
      }

      const response: BaseResponse<SectionAssignmentResponseType> = {
        status: "success",
        message: "Section assignment retrieved successfully",
        data: assignment,
      };
      logger.info(response);
      return response;
    } catch (error) {
      logger.error("Error retrieving section assignment:", { error });
      throw new Error("Failed to retrieve section assignment");
    }
  }

  static async getBySectionId(
    sectionId: string
  ): Promise<BaseResponse<SectionAssignmentResponseType[]>> {
    try {
      const assignments = await db.studentSection.findMany({
        where: { sectionId },
      });

      const response: BaseResponse<SectionAssignmentResponseType[]> = {
        status: "success",
        message: "Section assignments for section retrieved successfully",
        data: assignments,
      };
      logger.info(response);
      return response;
    } catch (error) {
      logger.error("Error retrieving assignments by section:", { error });
      throw new Error("Failed to retrieve assignments by section");
    }
  }

  static async update(
    id: string,
    data: UpdateSectionAssignmentType
  ): Promise<BaseResponse<SectionAssignmentResponseType>> {
    try {
      const existing = await db.studentSection.findUnique({ where: { id } });
      if (!existing) throw new Error("Section assignment not found");
      if (data.sectionId) {
        await this.validateSameDepartment(existing.studentId, data.sectionId);
      }

      const updated = await db.$transaction(async (tx) => {
        const result = await tx.studentSection.update({
          where: { id },
          data,
        });
        const scopes = new Map<
          string,
          { departmentId: string; semesterId: string }
        >();
        const sectionIds = [
          existing.sectionId,
          data.sectionId ?? existing.sectionId,
        ];
        for (const sectionId of sectionIds) {
          const section = await tx.section.findUnique({
            where: { id: sectionId },
            select: { departmentId: true, semesterId: true },
          });
          if (section) {
            scopes.set(`${section.departmentId}:${section.semesterId}`, {
              departmentId: section.departmentId,
              semesterId: section.semesterId,
            });
          }
        }
        const orderedScopes = Array.from(scopes.values()).sort(
          (a, b) =>
            a.departmentId.localeCompare(b.departmentId) ||
            a.semesterId.localeCompare(b.semesterId)
        );
        for (const scope of orderedScopes) {
          await ProjectMappingService.reconcileProjectGroupsForScope({
            tx,
            departmentId: scope.departmentId,
            semesterId: scope.semesterId,
          });
        }
        return result;
      });

      const response: BaseResponse<SectionAssignmentResponseType> = {
        status: "success",
        message: "Section assignment updated successfully",
        data: updated,
      };
      logger.info(response);
      return response;
    } catch (error) {
      logger.error("Error updating section assignment:", { error });
      throw error;
    }
  }

  static async delete(id: string): Promise<BaseResponse<void>> {
    try {
      const existing = await db.studentSection.findUnique({ where: { id } });
      if (!existing) throw new Error("Section assignment not found");
      await db.$transaction(async (tx) => {
        await tx.studentSection.delete({ where: { id } });
        const section = await tx.section.findUnique({
          where: { id: existing.sectionId },
          select: { departmentId: true, semesterId: true },
        });
        if (section) {
          await ProjectMappingService.reconcileProjectGroupsForScope({
            tx,
            departmentId: section.departmentId,
            semesterId: section.semesterId,
          });
        }
      });
      const response: BaseResponse<void> = {
        status: "success",
        message: "Section assignment deleted successfully",
        data: null,
      };
      logger.info(response);
      return response;
    } catch (error) {
      logger.error("Error deleting section assignment:", { error });
      throw new Error("Failed to delete section assignment");
    }
  }
}
