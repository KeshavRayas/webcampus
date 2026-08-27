import { IncomingHttpHeaders } from "http";
import { invalidateUserSessions } from "@webcampus/auth/redis";
import { logger } from "@webcampus/common/logger";
import { db, Prisma } from "@webcampus/db";
import {
  AdmissionActionParamType,
  ChangeAdmissionModeType,
  GetAdmissionsQueryType,
  PortStudentsType,
} from "@webcampus/schemas/admission";
import { BaseResponse } from "@webcampus/types/api";
import {
  buildAdmissionWhere,
  generateTempUsnWithClient,
  getSortableApplicantName,
  getStudentFullName,
  normalizeApplicationId,
  resolveApplicantUsersForPort,
  updateAdmissionStatus,
} from "./admission.shared";

export class AdmissionViewService {
  static async getAdmissions(
    filters: GetAdmissionsQueryType,
    filledById?: string
  ): Promise<BaseResponse<unknown>> {
    try {
      const admissions = await db.admission.findMany({
        where: buildAdmissionWhere(filters, filledById),
        orderBy: { createdAt: "desc" },
        include: {
          semester: {
            include: {
              academicTerm: {
                select: { type: true, year: true },
              },
            },
          },
          department: true,
          student: {
            select: {
              usn: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
          filledBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          cancellation: {
            select: {
              reason: true,
              cancelledAt: true,
            },
          },
        },
      });

      return {
        status: "success",
        message: "Admissions fetched successfully",
        data: admissions,
      };
    } catch (error) {
      logger.error("Failed to fetch admissions", error);
      throw error;
    }
  }

  static async getAdmissionsBySemester(
    semesterId: string,
    filledById?: string
  ): Promise<BaseResponse<unknown>> {
    return this.getAdmissions({ semester: semesterId }, filledById);
  }

  static async getByApplicationId(
    applicationId: string
  ): Promise<BaseResponse<unknown>> {
    const admission = await db.admission.findFirst({
      where: {
        applicationId: {
          equals: applicationId,
          mode: "insensitive",
        },
      },
      include: {
        semester: {
          include: {
            academicTerm: {
              select: { type: true, year: true },
            },
          },
        },
        department: true,
        student: {
          select: {
            usn: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
    return { status: "success", message: "Fetched", data: admission };
  }

  static async deleteAdmission(id: string): Promise<BaseResponse<unknown>> {
    try {
      const admission = await db.admission.findUnique({ where: { id } });
      if (!admission) throw new Error("Admission not found");

      const { deleteFromS3 } = await import("@webcampus/api/src/utils/s3");
      const fileUrls = [
        admission.photo,
        admission.class10thMarksPdf,
        admission.class12thMarksPdf,
        admission.diplomaMarksPdf,
        admission.casteCertificate,
        admission.disabilityCertificate,
        admission.economicallyBackwardCertificate,
        admission.aadharCard,
        admission.transferCertificate,
        admission.studyCertificate,
        admission.embassyPermissionLetter,
      ].filter(
        (url): url is string => typeof url === "string" && url.length > 0
      );

      await Promise.all(fileUrls.map((url) => deleteFromS3(url)));
      const applicantEmail = admission.primaryEmail?.trim().toLowerCase();

      const applicantUser = await db.user.findFirst({
        where: {
          OR: [{ email: applicantEmail, role: "applicant" }],
          role: "applicant",
        },
        select: { id: true },
      });

      await db.$transaction(async (tx) => {
        await tx.admission.delete({ where: { id } });

        if (applicantUser) {
          await tx.user.delete({ where: { id: applicantUser.id } });
        }
      });

      return {
        status: "success",
        message: "Admission deleted successfully",
        data: null,
      };
    } catch (error) {
      logger.error("Failed to delete admission", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to delete admission"
      );
    }
  }

  static async approveAdmission(
    params: AdmissionActionParamType,
    feeDetails?: { feePaid?: number; feeReceiptNumber?: string }
  ): Promise<BaseResponse<unknown>> {
    try {
      const feePaid = feeDetails?.feePaid;
      const feeReceiptNumber = feeDetails?.feeReceiptNumber?.trim();

      if (feeReceiptNumber && !feePaid) {
        throw new Error(
          "Fee Paid amount is required when a receipt is provided"
        );
      }

      await db.admission.update({
        where: { id: params.id },
        data: {
          status: "APPROVED",
          ...(feePaid !== undefined ? { feePaid } : {}),
          ...(feeReceiptNumber ? { feeReceiptNumber } : {}),
          feeStatus: feePaid !== undefined || Boolean(feeReceiptNumber),
        },
      });

      return {
        status: "success",
        message: "Admission approved successfully",
        data: { id: params.id, status: "APPROVED" },
      };
    } catch (error) {
      logger.error("Failed to approve admission", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to approve admission"
      );
    }
  }

  static async rejectAdmission(
    params: AdmissionActionParamType
  ): Promise<BaseResponse<unknown>> {
    try {
      return await updateAdmissionStatus(params.id, "REJECTED");
    } catch (error) {
      logger.error("Failed to reject admission", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to reject admission"
      );
    }
  }

  static async changeAdmissionMode(
    id: string,
    data: ChangeAdmissionModeType
  ): Promise<BaseResponse<unknown>> {
    try {
      const admission = await db.admission.findUnique({
        where: { id },
      });

      if (!admission) {
        throw new Error("Admission not found");
      }

      if (admission.status === "EXITED") {
        throw new Error(
          "Cannot change admission mode after the student has exited."
        );
      }

      const updatedAdmission = await db.admission.update({
        where: { id },
        data: {
          modeOfAdmission: data.modeOfAdmission,
          categoryClaimed: data.categoryClaimed,
          categoryAllotted: data.categoryAllotted,
          quota: data.modeOfAdmission === "KCET" ? (data.quota ?? null) : null,
          entranceExamRank:
            data.entranceExamRank != null
              ? String(data.entranceExamRank)
              : null,
          originalAdmissionOrderNumber: data.originalAdmissionOrderNumber,
          originalAdmissionOrderDate: data.originalAdmissionOrderDate
            ? new Date(data.originalAdmissionOrderDate)
            : null,
        },
        include: {
          semester: true,
          department: true,
        },
      });

      return {
        status: "success",
        message: "Admission mode updated successfully",
        data: updatedAdmission,
      };
    } catch (error) {
      logger.error("Failed to change admission mode", error);
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to change admission mode"
      );
    }
  }

  static async exitAdmission(id: string): Promise<BaseResponse<unknown>> {
    try {
      const admission = await db.admission.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          studentId: true,
          applicationId: true,
        },
      });

      if (!admission) {
        throw new Error("Admission not found");
      }

      if (admission.status === "EXITED") {
        throw new Error("Student has already exited the college");
      }

      if (!admission.studentId) {
        throw new Error("Only admitted students can be marked as exited");
      }

      const updatedAdmission = await db.admission.update({
        where: { id },
        data: {
          status: "EXITED",
        },
      });

      return {
        status: "success",
        message: "Student marked as exited successfully",
        data: updatedAdmission,
      };
    } catch (error) {
      logger.error("Failed to exit admission", error);

      throw new Error(
        error instanceof Error ? error.message : "Failed to exit admission"
      );
    }
  }

  static async portStudents(
    payload: PortStudentsType,
    headers: IncomingHttpHeaders
  ): Promise<BaseResponse<unknown>> {
    try {
      const portingSelected = Boolean(
        payload.admissionIds && payload.admissionIds.length > 0
      );

      const [semester, unresolvedCount, approvedAdmissions] = await Promise.all(
        [
          db.semester.findUnique({
            where: { id: payload.semesterId },
            select: {
              id: true,
              programType: true,
              academicTerm: { select: { id: true, type: true, year: true } },
              semesterNumber: true,
            },
          }),
          db.admission.count({
            where: {
              semesterId: payload.semesterId,
              status: {
                in: ["PENDING", "SUBMITTED"],
              },
            },
          }),
          db.admission.findMany({
            where: {
              semesterId: payload.semesterId,
              status: "APPROVED",
              ...(portingSelected ? { id: { in: payload.admissionIds } } : {}),
            },
            orderBy: [{ applicationId: "asc" }],
            select: {
              id: true,
              applicationId: true,
              departmentId: true,
              tempUsn: true,
              studentId: true,
              nameAsPer10th: true,
              primaryEmail: true,
              photo: true,
            },
          }),
        ]
      );

      if (!semester) {
        throw new Error("Semester not found");
      }

      if (!portingSelected && unresolvedCount > 0) {
        throw new Error(
          `Cannot port students. ${unresolvedCount} application(s) are still pending review.`
        );
      }

      const approvedUnportedAdmissions = approvedAdmissions.filter(
        (admission) => !admission.studentId
      );

      approvedUnportedAdmissions.sort((left, right) => {
        const leftName = getSortableApplicantName(left);
        const rightName = getSortableApplicantName(right);

        if (leftName !== rightName) {
          return leftName.localeCompare(rightName);
        }

        return left.primaryEmail.localeCompare(right.primaryEmail);
      });

      const unportedApplicationIds = approvedUnportedAdmissions.map(
        (admission) => admission.primaryEmail
      );

      let userIdByApplicationId = new Map<string, string>();
      let autoCreatedUsers = 0;

      if (unportedApplicationIds.length > 0) {
        const resolvedApplicantUsers = await resolveApplicantUsersForPort(
          unportedApplicationIds,
          headers
        );
        userIdByApplicationId = resolvedApplicantUsers.userIdByApplicationId;
        autoCreatedUsers = resolvedApplicantUsers.autoCreatedUsers;
      }

      let newlyPorted = 0;
      let alreadyPorted = 0;
      const failedPorts: { applicationId: string; reason: string }[] = [];
      const portedUserIds: string[] = [];

      for (const admission of approvedUnportedAdmissions) {
        try {
          const userId = userIdByApplicationId.get(
            normalizeApplicationId(admission.primaryEmail)
          );
          if (!userId) {
            throw new Error(
              `Applicant user not found for application ID ${admission.applicationId}`
            );
          }

          if (!admission.departmentId) {
            throw new Error(
              `Branch is missing for application ID ${admission.applicationId}`
            );
          }

          await db.$transaction(async (tx) => {
            const department = await tx.department.findUnique({
              where: { id: admission.departmentId },
              select: { id: true, name: true, code: true },
            });

            if (!department) {
              throw new Error(
                `Department not found for application ID ${admission.applicationId}`
              );
            }

            let finalUsn = admission.tempUsn?.trim();
            if (!finalUsn) {
              finalUsn = await generateTempUsnWithClient(
                tx,
                payload.semesterId,
                department.code
              );
            }

            const fullName = getStudentFullName(admission);

            if (!fullName) {
              throw new Error(
                `Cannot port ${admission.applicationId}: student full name is missing`
              );
            }

            const existingStudent = await tx.student.findFirst({
              where: {
                OR: [{ userId }, { usn: finalUsn }],
              },
              select: {
                id: true,
                usn: true,
              },
            });

            const finalStudentUsn = existingStudent?.usn ?? finalUsn;

            if (existingStudent) {
              const academicTermLabel = `${semester.academicTerm.type.toUpperCase()} ${semester.academicTerm.year}`;

              await tx.student.update({
                where: { id: existingStudent.id },
                data: {
                  departmentId: department.id,
                  departmentName: department.name,
                  currentSemester: semester.semesterNumber,
                  academicYear: semester.academicTerm.year,
                  semesterId: semester.id,
                  semesterNumber: semester.semesterNumber,
                  programType: semester.programType,
                  academicTermId: semester.academicTerm.id,
                  academicTermType: semester.academicTerm.type,
                  academicTermYear: semester.academicTerm.year,
                  academicTermLabel,
                },
              });

              await tx.admission.update({
                where: { id: admission.id },
                data: {
                  tempUsn: finalStudentUsn,
                  studentId: existingStudent.id,
                  status: "PORTED",
                },
              });

              await tx.user.update({
                where: { id: userId },
                data: {
                  role: "student",
                  name: fullName,
                  displayUsername: fullName,
                  username: finalStudentUsn,
                  email: admission.primaryEmail,
                  image: admission.photo ?? undefined,
                },
              });

              alreadyPorted += 1;
              return;
            }

            const createdStudent = await tx.student.create({
              data: {
                userId,
                usn: finalStudentUsn,
                departmentId: department.id,
                departmentName: department.name,
                currentSemester: semester.semesterNumber,
                academicYear: semester.academicTerm.year,
                semesterId: semester.id,
                semesterNumber: semester.semesterNumber,
                programType: semester.programType,
                academicTermId: semester.academicTerm.id,
                academicTermType: semester.academicTerm.type,
                academicTermYear: semester.academicTerm.year,
                academicTermLabel: `${semester.academicTerm.type.toUpperCase()} ${semester.academicTerm.year}`,
              },
              select: {
                id: true,
              },
            });

            await tx.admission.update({
              where: { id: admission.id },
              data: {
                tempUsn: finalStudentUsn,
                studentId: createdStudent.id,
                status: "PORTED",
              },
            });

            await tx.user.update({
              where: { id: userId },
              data: {
                role: "student",
                name: fullName,
                displayUsername: fullName,
                username: finalStudentUsn,
                email: admission.primaryEmail,
                image: admission.photo ?? undefined,
              },
            });

            newlyPorted += 1;
          });

          portedUserIds.push(userId);
        } catch (studentError) {
          const reason =
            studentError instanceof Error
              ? studentError.message
              : "Failed to port student";
          failedPorts.push({
            applicationId: admission.primaryEmail,
            reason,
          });
        }
      }

      if (portedUserIds.length > 0) {
        await Promise.all(portedUserIds.map(invalidateUserSessions));
      }

      return {
        status: "success",
        message:
          failedPorts.length > 0
            ? "Students ported with partial failures"
            : "Students ported successfully",
        data: {
          semesterId: payload.semesterId,
          semesterNumber: semester.semesterNumber,
          totalApproved: approvedAdmissions.length,
          newlyPorted,
          alreadyPorted,
          failedPorts,
          autoCreatedApplicants: autoCreatedUsers,
          rejectedCount: await db.admission.count({
            where: {
              semesterId: payload.semesterId,
              status: "REJECTED",
            },
          }),
        },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new Error("Port operation encountered duplicate student data");
        }

        if (error.code === "P2003") {
          throw new Error(
            "Port operation failed due to missing department mapping for one or more branches"
          );
        }
      }

      logger.error("Failed to port students", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to port students"
      );
    }
  }

  static async portAdmission(
    id: string,
    headers: IncomingHttpHeaders
  ): Promise<BaseResponse<unknown>> {
    try {
      const admission = await db.admission.findUnique({
        where: { id },
        select: {
          id: true,
          applicationId: true,
          departmentId: true,
          tempUsn: true,
          studentId: true,
          nameAsPer10th: true,
          primaryEmail: true,
          photo: true,
          semesterId: true,
          status: true,
        },
      });

      if (!admission) {
        throw new Error("Admission not found");
      }

      if (admission.status !== "APPROVED") {
        throw new Error("Only approved admissions can be ported");
      }

      if (admission.studentId) {
        throw new Error("Admission has already been ported");
      }

      const [semester, department] = await Promise.all([
        db.semester.findUnique({
          where: { id: admission.semesterId },
          select: {
            id: true,
            programType: true,
            semesterNumber: true,
            academicTerm: { select: { id: true, type: true, year: true } },
          },
        }),
        db.department.findUnique({
          where: { id: admission.departmentId },
          select: { id: true, name: true, code: true },
        }),
      ]);

      if (!semester) {
        throw new Error("Semester not found");
      }

      if (!department) {
        throw new Error("Department not found");
      }

      const resolved = await resolveApplicantUsersForPort(
        [admission.primaryEmail],
        headers
      );
      const userId = resolved.userIdByApplicationId.get(
        normalizeApplicationId(admission.primaryEmail)
      );

      if (!userId) {
        throw new Error(
          `Applicant user not found for application ID ${admission.applicationId}`
        );
      }

      const fullName = getStudentFullName(admission);

      if (!fullName) {
        throw new Error("Student full name is missing");
      }

      const result = await db.$transaction(async (tx) => {
        const existingStudent = await tx.student.findFirst({
          where: {
            OR: [{ userId }, { usn: admission.tempUsn || "NO_USN" }],
          },
          select: { id: true, usn: true },
        });

        if (existingStudent) {
          await tx.admission.update({
            where: { id: admission.id },
            data: {
              tempUsn: existingStudent.usn,
              studentId: existingStudent.id,
              status: "PORTED",
            },
          });

          await tx.user.update({
            where: { id: userId },
            data: {
              role: "student",
              name: fullName,
              displayUsername: fullName,
              username: existingStudent.usn,
              email: admission.primaryEmail,
              image: admission.photo ?? undefined,
            },
          });

          return { studentId: existingStudent.id, usn: existingStudent.usn };
        }

        const finalUsn =
          admission.tempUsn?.trim() ||
          (await generateTempUsnWithClient(
            tx,
            admission.semesterId,
            department.code
          ));

        const createdStudent = await tx.student.create({
          data: {
            userId,
            usn: finalUsn,
            departmentId: department.id,
            departmentName: department.name,
            currentSemester: semester.semesterNumber,
            academicYear: semester.academicTerm.year,
            semesterId: semester.id,
            semesterNumber: semester.semesterNumber,
            programType: semester.programType,
            academicTermId: semester.academicTerm.id,
            academicTermType: semester.academicTerm.type,
            academicTermYear: semester.academicTerm.year,
            academicTermLabel: `${semester.academicTerm.type.toUpperCase()} ${semester.academicTerm.year}`,
          },
          select: { id: true },
        });

        await tx.admission.update({
          where: { id: admission.id },
          data: {
            tempUsn: finalUsn,
            studentId: createdStudent.id,
            status: "PORTED",
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: {
            role: "student",
            name: fullName,
            displayUsername: fullName,
            username: finalUsn,
            email: admission.primaryEmail,
            image: admission.photo ?? undefined,
          },
        });

        return { studentId: createdStudent.id, usn: finalUsn };
      });

      await invalidateUserSessions(userId);

      return {
        status: "success",
        message: "Admission ported successfully",
        data: result,
      };
    } catch (error) {
      logger.error("Failed to port admission", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to port admission"
      );
    }
  }
}
