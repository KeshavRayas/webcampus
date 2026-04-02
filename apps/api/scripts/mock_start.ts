import "dotenv/config";
import { AdminAdmissionUserService } from "@webcampus/api/src/services/admin/admission-user.service";
import { AdminFacultyService } from "@webcampus/api/src/services/admin/faculty.service";
import { SemesterService } from "@webcampus/api/src/services/admin/semester.service";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
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
  departmentCode: string;
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
    name: "Civil Engineering",
    code: "CE",
    abbreviation: "CE",
    type: "DEGREE_GRANTING",
    user: {
      name: "Civil Engineering Department",
      username: "dept.ce",
      email: "dept.ce@webcampus.com",
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
  {
    name: "Electrical and Electronics Engineering",
    code: "EE",
    abbreviation: "EE",
    type: "DEGREE_GRANTING",
    user: {
      name: "Electrical and Electronics Engineering Department",
      username: "dept.ee",
      email: "dept.ee@webcampus.com",
    },
  },
  {
    name: "Electronics and Communication Engineering",
    code: "EC",
    abbreviation: "EC",
    type: "DEGREE_GRANTING",
    user: {
      name: "Electronics and Communication Engineering Department",
      username: "dept.ec",
      email: "dept.ec@webcampus.com",
    },
  },
  {
    name: "Industrial Engineering and Management",
    code: "IM",
    abbreviation: "IM",
    type: "DEGREE_GRANTING",
    user: {
      name: "Industrial Engineering and Management Department",
      username: "dept.im",
      email: "dept.im@webcampus.com",
    },
  },
  {
    name: "Electronics and Telecommunication Engineering",
    code: "ET",
    abbreviation: "ET",
    type: "DEGREE_GRANTING",
    user: {
      name: "Electronics and Telecommunication Engineering Department",
      username: "dept.et",
      email: "dept.et@webcampus.com",
    },
  },
  {
    name: "Information Science and Engineering",
    code: "IS",
    abbreviation: "IS",
    type: "DEGREE_GRANTING",
    user: {
      name: "Information Science and Engineering Department",
      username: "dept.is",
      email: "dept.is@webcampus.com",
    },
  },
  {
    name: "Electronics and Instrumentation Engineering",
    code: "EI",
    abbreviation: "EI",
    type: "DEGREE_GRANTING",
    user: {
      name: "Electronics and Instrumentation Engineering Department",
      username: "dept.ei",
      email: "dept.ei@webcampus.com",
    },
  },
  {
    name: "Medical Electronics Engineering",
    code: "MD",
    abbreviation: "MD",
    type: "DEGREE_GRANTING",
    user: {
      name: "Medical Electronics Engineering Department",
      username: "dept.md",
      email: "dept.md@webcampus.com",
    },
  },
  {
    name: "Chemical Engineering",
    code: "CH",
    abbreviation: "CH",
    type: "DEGREE_GRANTING",
    user: {
      name: "Chemical Engineering Department",
      username: "dept.ch",
      email: "dept.ch@webcampus.com",
    },
  },
  {
    name: "Bio-Technology",
    code: "BT",
    abbreviation: "BT",
    type: "DEGREE_GRANTING",
    user: {
      name: "Bio-Technology Department",
      username: "dept.bt",
      email: "dept.bt@webcampus.com",
    },
  },
  {
    name: "Computer Applications (MCA)",
    code: "CA",
    abbreviation: "CA",
    type: "DEGREE_GRANTING",
    user: {
      name: "Computer Applications (MCA) Department",
      username: "dept.ca",
      email: "dept.ca@webcampus.com",
    },
  },
  {
    name: "Management Studies and Research Centre",
    code: "MS",
    abbreviation: "MS",
    type: "DEGREE_GRANTING",
    user: {
      name: "Management Studies and Research Centre Department",
      username: "dept.ms",
      email: "dept.ms@webcampus.com",
    },
  },
  {
    name: "Mathematics Department",
    code: "MA",
    abbreviation: "MA",
    type: "DEGREE_GRANTING",
    user: {
      name: "Mathematics Department",
      username: "dept.ma",
      email: "dept.ma@webcampus.com",
    },
  },
  {
    name: "Physics Department",
    code: "PH",
    abbreviation: "PH",
    type: "DEGREE_GRANTING",
    user: {
      name: "Physics Department",
      username: "dept.ph",
      email: "dept.ph@webcampus.com",
    },
  },
  {
    name: "Chemistry Department",
    code: "CY",
    abbreviation: "CY",
    type: "DEGREE_GRANTING",
    user: {
      name: "Chemistry Department",
      username: "dept.cy",
      email: "dept.cy@webcampus.com",
    },
  },
  {
    name: "Aerospace Engineering",
    code: "AE",
    abbreviation: "AE",
    type: "DEGREE_GRANTING",
    user: {
      name: "Aerospace Engineering Department",
      username: "dept.ae",
      email: "dept.ae@webcampus.com",
    },
  },
  {
    name: "Machine Learning (AI and ML)",
    code: "ML",
    abbreviation: "ML",
    type: "DEGREE_GRANTING",
    user: {
      name: "Machine Learning (AI and ML) Department",
      username: "dept.ml",
      email: "dept.ml@webcampus.com",
    },
  },
  {
    name: "Computer Science and Engineering (DS)",
    code: "CD",
    abbreviation: "CD",
    type: "DEGREE_GRANTING",
    user: {
      name: "Computer Science and Engineering (DS) Department",
      username: "dept.cd",
      email: "dept.cd@webcampus.com",
    },
  },
  {
    name: "Computer Science and Engineering (IoT and CS)",
    code: "CI",
    abbreviation: "CI",
    type: "DEGREE_GRANTING",
    user: {
      name: "Computer Science and Engineering (IoT and CS) Department",
      username: "dept.ci",
      email: "dept.ci@webcampus.com",
    },
  },
  {
    name: "Artificial Intelligence and Data Science",
    code: "AD",
    abbreviation: "AD",
    type: "DEGREE_GRANTING",
    user: {
      name: "Artificial Intelligence and Data Science Department",
      username: "dept.ad",
      email: "dept.ad@webcampus.com",
    },
  },
  {
    name: "Computer Science and Business Systems",
    code: "CB",
    abbreviation: "CB",
    type: "DEGREE_GRANTING",
    user: {
      name: "Computer Science and Business Systems Department",
      username: "dept.cb",
      email: "dept.cb@webcampus.com",
    },
  },
];

const FACULTY: FacultySeed[] = [
  {
    name: "FY Faculty",
    username: "faculty.fy",
    email: "faculty.fy@webcampus.com",
    employeeId: "FY001",
    departmentCode: "FY",
  },
  {
    name: "CE Faculty",
    username: "faculty.ce",
    email: "faculty.ce@webcampus.com",
    employeeId: "CE001",
    departmentCode: "CE",
  },
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
  {
    name: "EE Faculty",
    username: "faculty.ee",
    email: "faculty.ee@webcampus.com",
    employeeId: "EE001",
    departmentCode: "EE",
  },
  {
    name: "EC Faculty",
    username: "faculty.ec",
    email: "faculty.ec@webcampus.com",
    employeeId: "EC001",
    departmentCode: "EC",
  },
  {
    name: "IM Faculty",
    username: "faculty.im",
    email: "faculty.im@webcampus.com",
    employeeId: "IM001",
    departmentCode: "IM",
  },
  {
    name: "ET Faculty",
    username: "faculty.et",
    email: "faculty.et@webcampus.com",
    employeeId: "ET001",
    departmentCode: "ET",
  },
  {
    name: "IS Faculty",
    username: "faculty.is",
    email: "faculty.is@webcampus.com",
    employeeId: "IS001",
    departmentCode: "IS",
  },
  {
    name: "EI Faculty",
    username: "faculty.ei",
    email: "faculty.ei@webcampus.com",
    employeeId: "EI001",
    departmentCode: "EI",
  },
  {
    name: "MD Faculty",
    username: "faculty.md",
    email: "faculty.md@webcampus.com",
    employeeId: "MD001",
    departmentCode: "MD",
  },
  {
    name: "CH Faculty",
    username: "faculty.ch",
    email: "faculty.ch@webcampus.com",
    employeeId: "CH001",
    departmentCode: "CH",
  },
  {
    name: "BT Faculty",
    username: "faculty.bt",
    email: "faculty.bt@webcampus.com",
    employeeId: "BT001",
    departmentCode: "BT",
  },
  {
    name: "CA Faculty",
    username: "faculty.ca",
    email: "faculty.ca@webcampus.com",
    employeeId: "CA001",
    departmentCode: "CA",
  },
  {
    name: "MS Faculty",
    username: "faculty.ms",
    email: "faculty.ms@webcampus.com",
    employeeId: "MS001",
    departmentCode: "MS",
  },
  {
    name: "MA Faculty",
    username: "faculty.ma",
    email: "faculty.ma@webcampus.com",
    employeeId: "MA001",
    departmentCode: "MA",
  },
  {
    name: "PH Faculty",
    username: "faculty.ph",
    email: "faculty.ph@webcampus.com",
    employeeId: "PH001",
    departmentCode: "PH",
  },
  {
    name: "CY Faculty",
    username: "faculty.cy",
    email: "faculty.cy@webcampus.com",
    employeeId: "CY001",
    departmentCode: "CY",
  },
  {
    name: "AE Faculty",
    username: "faculty.ae",
    email: "faculty.ae@webcampus.com",
    employeeId: "AE001",
    departmentCode: "AE",
  },
  {
    name: "ML Faculty",
    username: "faculty.ml",
    email: "faculty.ml@webcampus.com",
    employeeId: "ML001",
    departmentCode: "ML",
  },
  {
    name: "CD Faculty",
    username: "faculty.cd",
    email: "faculty.cd@webcampus.com",
    employeeId: "CD001",
    departmentCode: "CD",
  },
  {
    name: "CI Faculty",
    username: "faculty.ci",
    email: "faculty.ci@webcampus.com",
    employeeId: "CI001",
    departmentCode: "CI",
  },
  {
    name: "AD Faculty",
    username: "faculty.ad",
    email: "faculty.ad@webcampus.com",
    employeeId: "AD001",
    departmentCode: "AD",
  },
  {
    name: "CB Faculty",
    username: "faculty.cb",
    email: "faculty.cb@webcampus.com",
    employeeId: "CB001",
    departmentCode: "CB",
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
      throw new Error(
        created.message || `Failed to create user ${userData.email}`
      );
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
        logger.info(
          `Updated department ${department.name} (${department.code})`
        );
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

  public async seedFaculty(
    departmentIdByCode: Map<string, string>
  ): Promise<void> {
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
    logger.error(
      `Fatal error in mock_start script: ${(error as Error).message}`
    );
    process.exit(1);
  }
}

main();
