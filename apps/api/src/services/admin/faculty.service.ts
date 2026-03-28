import { IncomingHttpHeaders } from "http";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
import { auth, fromNodeHeaders } from "@webcampus/auth";
import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import { CreateUserType } from "@webcampus/schemas/admin";
import { CreateFacultyType, UpdateFacultyType } from "@webcampus/schemas/faculty";
import { BaseResponse } from "@webcampus/types/api";

export class AdminFacultyService {
  // Utility function to generate "BF" from "Bruno Fernandes"
  static generateShortName(name: string): string {
    return name
      .split(" ")
      .filter((word) => word.length > 0)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .substring(0, 3); // Max 3 characters just in case of very long names
  }

  static async create(
    request: CreateFacultyType &
      CreateUserType & {
        headers: IncomingHttpHeaders;
        imageFile: Express.Multer.File;
      }
  ): Promise<BaseResponse<unknown>> {
    let createdAuthUserId: string | null = null;
    let uploadedImageUrl: string | null = null;

    try {
      // 1. Create the global auth user
      const userService = new UserService({
        request: {
          email: request.email,
          password: request.password,
          name: request.name,
          username: request.username,
          role: "faculty", // Force the role
        },
        headers: request.headers,
      });

      const authUser = await userService.create();

      if (authUser.status === "error" || !authUser.data?.id) {
        throw new Error(authUser.message || "Failed to create auth user");
      }

      createdAuthUserId = authUser.data.id;

      const { generateFileName, uploadToS3 } = await import(
        "@webcampus/api/src/utils/s3"
      );
      const imageFileName = generateFileName(
        request.imageFile.originalname,
        "faculty_image_"
      );
      const uploadResult = await uploadToS3(
        request.imageFile.buffer,
        imageFileName,
        request.imageFile.mimetype
      );

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error("Failed to upload faculty image");
      }

      uploadedImageUrl = uploadResult.url;

      await db.user.update({
        where: { id: createdAuthUserId },
        data: {
          image: uploadedImageUrl,
        },
      });

      // 2. Generate the Short Name automatically
      const shortName = this.generateShortName(request.name);

      // 3. Create the Faculty record linked to the Department
      const faculty = await db.faculty.create({
        data: {
          userId: createdAuthUserId,
          departmentId: request.departmentId,
          designation: request.designation,
          shortName: shortName,
          employeeId: request.employeeId,
          staffType: request.staffType,
          dob: request.dob,
          dateOfJoining: request.dateOfJoining,
        },
        include: {
          user: true,
        },
      });

      const response: BaseResponse<unknown> = {
        status: "success",
        message: "Faculty created successfully",
        data: faculty,
      };
      logger.info(response);
      return response;
    } catch (error) {
      if (uploadedImageUrl) {
        try {
          const { deleteFromS3 } = await import("@webcampus/api/src/utils/s3");
          await deleteFromS3(uploadedImageUrl);
        } catch (cleanupError) {
          logger.warn("Failed to clean up uploaded faculty image after create failure", {
            uploadedImageUrl,
            cleanupError,
          });
        }
      }

      if (createdAuthUserId) {
        try {
          await auth.api.removeUser({
            headers: fromNodeHeaders(request.headers),
            body: {
              userId: createdAuthUserId,
            },
          });
        } catch (cleanupError) {
          logger.warn("Failed to clean up auth user after faculty create failure", {
            createdAuthUserId,
            cleanupError,
          });
        }
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error("Faculty already exists");
      }
      logger.error("Failed to create faculty", error);
      throw new Error("Failed to create faculty");
    }
  }

  static async getAll(
    departmentId?: string
  ): Promise<BaseResponse<unknown>> {
    try {
      await UserService.backfillMissingProfileFields();

      const faculties = await db.faculty.findMany({
        where: departmentId ? { departmentId } : undefined,
        include: {
          user: {
            select: {
              name: true,
              email: true,
              username: true,
              displayUsername: true,
            },
          },
          department: {
            select: {
              name: true,
            },
          },
          hod: true,
        },
      });

      return {
        status: "success",
        message: "Faculty fetched successfully",
        data: faculties,
      };
    } catch (error) {
      logger.error("Failed to fetch faculty", error);
      throw error;
    }
  }

  static async getByDepartmentId(
    departmentId: string
  ): Promise<BaseResponse<unknown>> {
    return AdminFacultyService.getAll(departmentId);
  }

  static async update(
    id: string,
    data: UpdateFacultyType,
    imageFile?: Express.Multer.File
  ): Promise<BaseResponse<unknown>> {
    try {
      const existingFaculty = await db.faculty.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              image: true,
            },
          },
        },
      });

      if (!existingFaculty) {
        throw new Error("Faculty not found");
      }

      if (imageFile) {
        const { deleteFromS3, generateFileName, uploadToS3 } = await import(
          "@webcampus/api/src/utils/s3"
        );
        const nextImageFileName = generateFileName(
          imageFile.originalname,
          "faculty_image_"
        );
        const uploadResult = await uploadToS3(
          imageFile.buffer,
          nextImageFileName,
          imageFile.mimetype
        );

        if (!uploadResult.success || !uploadResult.url) {
          throw new Error("Failed to upload faculty image");
        }

        if (existingFaculty.user.image) {
          await deleteFromS3(existingFaculty.user.image);
        }

        await db.user.update({
          where: { id: existingFaculty.user.id },
          data: {
            image: uploadResult.url,
          },
        });
      }

      const nextUserData: { username?: string; displayUsername?: string } = {};
      if (data.username !== undefined) {
        nextUserData.username = data.username;
      }
      if (data.displayUsername !== undefined) {
        nextUserData.displayUsername = data.displayUsername;
      }

      if (Object.keys(nextUserData).length > 0) {
        await db.user.update({
          where: { id: existingFaculty.user.id },
          data: nextUserData,
        });
      }

      const facultyData = { ...data } as Record<string, unknown>;
      delete facultyData.username;
      delete facultyData.displayUsername;

      const faculty = await db.faculty.update({
        where: { id },
        data: facultyData,
      });
      return { status: "success", message: "Faculty updated", data: faculty };
    } catch (error) {
      logger.error("Failed to update faculty", error);
      throw new Error("Failed to update faculty");
    }
  }

  static async delete(id: string): Promise<BaseResponse<unknown>> {
    try {
      // 1. Fetch the faculty record to check for HOD linkage and get userId
      const faculty = await db.faculty.findUnique({
        where: { id },
        include: { hod: true },
      });

      if (!faculty) {
        throw new Error("Faculty member not found");
      }

      // 2. Safety Check: Prevent deletion if they are an active HOD
      if (faculty.hod) {
        throw new Error(
          "Cannot delete a faculty member who is currently assigned as an HOD. Please re-assign the HOD role to another faculty member first."
        );
      }

      // 3. Transactional Deletion of Faculty and Base User
      await db.$transaction([
        db.faculty.delete({ where: { id } }),
        db.user.delete({ where: { id: faculty.userId } }),
      ]);

      return {
        status: "success",
        message: "Faculty deleted successfully",
        data: null,
      };
    } catch (error) {
      logger.error("Failed to delete faculty", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to delete faculty"
      );
    }
  }

  static async createHodAccount(
    facultyId: string,
    departmentId: string,
    request: CreateUserType & { headers: IncomingHttpHeaders }
  ): Promise<BaseResponse<unknown>> {
    try {
      // 1. Resolve department to get code
      const dept = await db.department.findUnique({
        where: { id: departmentId },
      });
      if (!dept) throw new Error("Department not found");

      // 2. Auto-Generate the HOD username securely
      const generatedUsername = `hod_${dept.code.toLowerCase()}_${request.name.replace(/\s+/g, "").toLowerCase()}`;

      // 3. Create the HOD user
      const userService = new UserService({
        request: {
          email: request.email,
          password: request.password,
          name: request.name,
          username: generatedUsername,
          role: "hod",
        },
        headers: request.headers,
      });
      const authUser = await userService.create();
      if (authUser.status === "error" || !authUser.data?.id) {
        throw new Error(authUser.message || "Failed to create HOD user");
      }

      // 4. Create the HOD record linked to the faculty
      const hod = await db.hod.create({
        data: {
          userId: authUser.data.id,
          departmentName: dept.name,
          facultyId: facultyId,
        },
      });
      return {
        status: "success",
        message: "HOD role created and assigned",
        data: hod,
      };
    } catch (error) {
      logger.error("Failed to create HOD role", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to create HOD role"
      );
    }
  }

  static async reassignHodAccount(
    hodId: string,
    newFacultyId: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const hod = await db.hod.update({
        where: { id: hodId },
        data: { facultyId: newFacultyId },
      });
      return {
        status: "success",
        message: "HOD role reassigned successfully",
        data: hod,
      };
    } catch (error) {
      logger.error("Failed to reassign HOD role", error);
      throw new Error("Failed to reassign HOD role");
    }
  }
}
