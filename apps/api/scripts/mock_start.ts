import "dotenv/config";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
import { AdminAdmissionUserService } from "@webcampus/api/src/services/admin/admission-user.service";
import { AdminFacultyService } from "@webcampus/api/src/services/admin/faculty.service";
import { SemesterService } from "@webcampus/api/src/services/admin/semester.service";
import { auth } from "@webcampus/auth";
import { backendEnv } from "@webcampus/common/env";
import { logger } from "@webcampus/common/logger";
import { db } from "@webcampus/db";
import { CreateUserType } from "@webcampus/schemas/admin";

type DepartmentSeed = {
  name: string;
  code: string;
  abbreviation: string;
  type: "BASIC_SCIENCES" | "DEGREE_GRANTING";
  user: {
    name: string;
    username: string;
    email: string;
  };
};

type FacultySeed = {
  name: string;
  username: string;
  email: string;
  employeeId: string;
  departmentCode: "CS" | "ME";
};

const DEFAULT_PASSWORD = "password";
const IMAGE_URL =
  "https://adminportal-fileupload.s3.ap-southeast-2.amazonaws.com/department_logo_39bc77d3-dc17-4679-952e-2bab6d716229.jpg";

const DEPARTMENTS: DepartmentSeed[] = [
  {
    name: "Firstyear",
    code: "FY",
    abbreviation: "FIRSTYEAR",
    type: "BASIC_SCIENCES",
    user: {
      name: "Firstyear Department",
      username: "dept.fy",
      email: "dept.fy@webcampus.com",
    },
  },
  {
    name: "Computer Science and Engineering",
    code: "CS",
    abbreviation: "CSE",
    type: "DEGREE_GRANTING",
    user: {
      name: "Computer Science and Engineering Department",
      username: "dept.cs",
      email: "dept.cs@webcampus.com",
    },
  },
  {
    name: "Mechanical Engineering",
    code: "ME",
    abbreviation: "MECH",
    type: "DEGREE_GRANTING",
    user: {
      name: "Mechanical Engineering Department",
      username: "dept.me",
      email: "dept.me@webcampus.com",
    },
  },
];

const FACULTY: FacultySeed[] = [
  {
    name: "CS Faculty",
    username: "faculty.cs",
    email: "faculty.cs@webcampus.com",
    employeeId: "CS001",
    departmentCode: "CS",
  },
  {
    name: "ME Faculty",
    username: "faculty.me",
    email: "faculty.me@webcampus.com",
    employeeId: "ME001",
    departmentCode: "ME",
  },
];

const ADMISSION_USERS = [
  {
    name: "Admission Admin",
    username: "admission.admin",
    email: "admission.admin@webcampus.com",
    role: "admission_admin" as const,
  },
  {
    name: "Admission Reviewer",
    username: "admission.reviewer",
    email: "admission.reviewer@webcampus.com",
    role: "admission_reviewer" as const,
  },
];

const ODD_2026_SEMESTERS = [
  {
    programType: "UG" as const,
    semesterNumber: 1,
    startDate: new Date("2026-03-29T18:30:00.000Z"),
    endDate: new Date("2026-04-29T18:30:00.000Z"),
  },
  {
    programType: "UG" as const,
    semesterNumber: 3,
    startDate: new Date("2026-04-30T18:30:00.000Z"),
    endDate: new Date("2026-05-30T18:30:00.000Z"),
  },
  {
    programType: "UG" as const,
    semesterNumber: 5,
    startDate: new Date("2026-05-31T18:30:00.000Z"),
    endDate: new Date("2026-06-29T18:30:00.000Z"),
  },
  {
    programType: "UG" as const,
    semesterNumber: 7,
    startDate: new Date("2026-06-30T18:30:00.000Z"),
    endDate: new Date("2026-07-30T18:30:00.000Z"),
  },
  {
    programType: "PG" as const,
    semesterNumber: 1,
    startDate: new Date("2026-03-29T18:30:00.000Z"),
    endDate: new Date("2026-04-29T18:30:00.000Z"),
  },
  {
    programType: "PG" as const,
    semesterNumber: 3,
    startDate: new Date("2026-04-30T18:30:00.000Z"),
    endDate: new Date("2026-05-30T18:30:00.000Z"),
  },
];

class MockStarter {
  private adminAuthToken: string | null = null;
  private adminUserId: string | null = null;

  private getHeaders() {
    if (!this.adminAuthToken) {
      throw new Error("Admin token missing. Call signIn first.");
    }

    return {
      Authorization: `Bearer ${this.adminAuthToken}`,
    };
  }

  public async signIn(): Promise<void> {
    const { ADMIN_USER_EMAIL, ADMIN_USER_PASSWORD } = backendEnv();

    const response = await auth.api.signInEmail({
      body: {
        email: ADMIN_USER_EMAIL,
        password: ADMIN_USER_PASSWORD,
      },
    });

    if (!response.token || !response.user?.id) {
      throw new Error("Admin sign-in succeeded but token/user is missing.");
    }

    this.adminAuthToken = response.token;
    this.adminUserId = response.user.id;

    logger.info(
      `Admin sign-in successful: ${response.user.name} (${response.user.email})`
    );
  }

  private async ensureUser(userData: CreateUserType & { image?: string }) {
    const normalizedUsername = userData.username.toLowerCase();

    const existing = await db.user.findFirst({
      where: {
        OR: [{ email: userData.email }, { username: normalizedUsername }],
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      await db.user.update({
        where: { id: existing.id },
        data: {
          name: userData.name,
          email: userData.email,
          role: userData.role,
          username: normalizedUsername,
          displayUsername: userData.name,
          ...(userData.image ? { image: userData.image } : {}),
        },
      });

      return { id: existing.id, created: false };
    }

    const userService = new UserService({
      request: {
        ...userData,
        username: normalizedUsername,
      },
      headers: this.getHeaders(),
    });

    const created = await userService.create();

    if (created.status === "error" || !created.data?.id) {
      throw new Error(created.message || `Failed to create user ${userData.email}`);
    }

    if (userData.image) {
      await db.user.update({
        where: { id: created.data.id },
        data: { image: userData.image },
      });
    }

    return { id: created.data.id, created: true };
  }

  public async seedDepartments(): Promise<Map<string, string>> {
    const departmentIdByCode = new Map<string, string>();

    for (const department of DEPARTMENTS) {
      const departmentUser = await this.ensureUser({
        name: department.user.name,
        email: department.user.email,
        username: department.user.username,
        password: DEFAULT_PASSWORD,
        role: "department",
        image: IMAGE_URL,
      });

      const existingDepartment = await db.department.findFirst({
        where: {
          OR: [{ code: department.code }, { name: department.name }],
        },
        select: {
          id: true,
        },
      });

      if (existingDepartment) {
        const updatedDepartment = await db.department.update({
          where: { id: existingDepartment.id },
          data: {
            userId: departmentUser.id,
            name: department.name,
            code: department.code,
            abbreviation: department.abbreviation,
            type: department.type,
          },
        });

        departmentIdByCode.set(updatedDepartment.code, updatedDepartment.id);
        logger.info(`Updated department ${department.name} (${department.code})`);
        continue;
      }

      const createdDepartment = await db.department.create({
        data: {
          userId: departmentUser.id,
          name: department.name,
          code: department.code,
          abbreviation: department.abbreviation,
          type: department.type,
        },
      });

      departmentIdByCode.set(createdDepartment.code, createdDepartment.id);
      logger.info(`Created department ${department.name} (${department.code})`);
    }

    return departmentIdByCode;
  }

  public async seedAcademicTermAndSemesters(): Promise<void> {
    if (!this.adminUserId) {
      throw new Error("Admin user id missing. Call signIn first.");
    }

    const latestOddTerm = await db.academicTerm.findFirst({
      where: { type: "odd" },
      orderBy: [{ year: "desc" }],
      select: {
        isCurrent: true,
      },
    });

    const termIsCurrent = latestOddTerm?.isCurrent ?? true;

    let term = await db.academicTerm.findFirst({
      where: {
        type: "odd",
        year: "2026",
      },
    });

    if (term) {
      term = await db.academicTerm.update({
        where: { id: term.id },
        data: {
          isCurrent: termIsCurrent,
        },
      });
      logger.info("Updated academic term ODD 2026");
    } else {
      term = await db.academicTerm.create({
        data: {
          type: "odd",
          year: "2026",
          isCurrent: termIsCurrent,
        },
      });
      logger.info("Created academic term ODD 2026");
    }

    await SemesterService.bulkUpsertSemesters(
      term.id,
      ODD_2026_SEMESTERS.map((semester) => ({
        academicTermId: term.id,
        programType: semester.programType,
        semesterNumber: semester.semesterNumber,
        termType: "odd",
        startDate: semester.startDate,
        endDate: semester.endDate,
        userId: this.adminUserId as string,
      }))
    );

    logger.info("Upserted ODD 2026 semester configurations");
  }

  public async seedFaculty(departmentIdByCode: Map<string, string>): Promise<void> {
    for (const faculty of FACULTY) {
      const departmentId = departmentIdByCode.get(faculty.departmentCode);

      if (!departmentId) {
        throw new Error(
          `Department id missing for code ${faculty.departmentCode}. Seed departments first.`
        );
      }

      const facultyUser = await this.ensureUser({
        name: faculty.name,
        email: faculty.email,
        username: faculty.username,
        password: DEFAULT_PASSWORD,
        role: "faculty",
        image: IMAGE_URL,
      });

      const existingFaculty = await db.faculty.findFirst({
        where: {
          OR: [{ employeeId: faculty.employeeId }, { userId: facultyUser.id }],
        },
        select: {
          id: true,
        },
      });

      const shortName = AdminFacultyService.generateShortName(faculty.name);

      if (existingFaculty) {
        await db.faculty.update({
          where: { id: existingFaculty.id },
          data: {
            userId: facultyUser.id,
            departmentId,
            shortName,
            designation: "ASSISTANT_PROFESSOR",
            employeeId: faculty.employeeId,
            staffType: "REGULAR",
            dob: new Date("1990-01-01T00:00:00.000Z"),
            dateOfJoining: new Date("2020-01-01T00:00:00.000Z"),
          },
        });

        logger.info(`Updated faculty ${faculty.name} (${faculty.employeeId})`);
        continue;
      }

      await db.faculty.create({
        data: {
          userId: facultyUser.id,
          departmentId,
          shortName,
          designation: "ASSISTANT_PROFESSOR",
          employeeId: faculty.employeeId,
          staffType: "REGULAR",
          dob: new Date("1990-01-01T00:00:00.000Z"),
          dateOfJoining: new Date("2020-01-01T00:00:00.000Z"),
        },
      });

      logger.info(`Created faculty ${faculty.name} (${faculty.employeeId})`);
    }
  }

  public async seedAdmissionUsers(): Promise<void> {
    for (const admissionUser of ADMISSION_USERS) {
      const existing = await db.user.findFirst({
        where: {
          OR: [
            { email: admissionUser.email },
            { username: admissionUser.username },
          ],
        },
        select: {
          id: true,
        },
      });

      if (existing) {
        await db.user.update({
          where: { id: existing.id },
          data: {
            name: admissionUser.name,
            email: admissionUser.email,
            username: admissionUser.username,
            displayUsername: admissionUser.name,
            role: admissionUser.role,
          },
        });

        logger.info(`Updated admission user ${admissionUser.email}`);
        continue;
      }

      await AdminAdmissionUserService.create(
        {
          ...admissionUser,
          password: DEFAULT_PASSWORD,
        },
        this.getHeaders()
      );

      logger.info(`Created admission user ${admissionUser.email}`);
    }
  }

  public async run(): Promise<void> {
    await this.signIn();
    const departmentIdByCode = await this.seedDepartments();
    await this.seedAcademicTermAndSemesters();
    await this.seedFaculty(departmentIdByCode);
    await this.seedAdmissionUsers();
    logger.info("mock_start script completed successfully.");
  }
}

async function main() {
  const starter = new MockStarter();

  try {
    await starter.run();
  } catch (error) {
    logger.error(`Fatal error in mock_start script: ${(error as Error).message}`);
    process.exit(1);
  }
}

main();
