import "dotenv/config";
import { AdminFacultyService } from "@webcampus/api/src/services/admin/faculty.service";
import { SemesterService } from "@webcampus/api/src/services/admin/semester.service";
import { UserService } from "@webcampus/api/src/services/admin/user.service";
import { auth } from "@webcampus/auth";
import { backendEnv } from "@webcampus/common/env";
import { logger } from "@webcampus/common/logger";
import { redis } from "@webcampus/common/redis";
import { db } from "@webcampus/db";

const DEFAULT_PASSWORD = "password";

const DEPARTMENTS = [
  {
    name: "Firstyear",
    code: "FY",
    abbreviation: "FIRSTYEAR",
    type: "BASIC_SCIENCES" as const,
  },
  {
    name: "Computer Science and Engineering",
    code: "CS",
    abbreviation: "CSE",
    type: "DEGREE_GRANTING" as const,
  },
];

const FACULTY = [
  {
    name: "FY Faculty",
    username: "faculty.fy",
    email: "faculty.fy@webcampus.com",
    employeeId: "FY001",
    departmentCode: "FY",
  },
  {
    name: "CS Faculty",
    username: "faculty.cs",
    email: "faculty.cs@webcampus.com",
    employeeId: "CS001",
    departmentCode: "CS",
  },
];

const STUDENTS = [
  { usn: "TBM26CS0001", email: "cassandra.cs26@bmsce.ac.in", section: "PA" },
  { usn: "TBM26CS0002", email: "jayson.cs26@bmsce.ac.in", section: "PA" },
  { usn: "TBM26CS0003", email: "jed.cs26@bmsce.ac.in", section: "PA" },
  { usn: "TBM26CS0004", email: "kristina.cs26@bmsce.ac.in", section: "PB" },
  { usn: "TBM26CS0005", email: "marques.cs26@bmsce.ac.in", section: "PB" },
  { usn: "TBM26CS0006", email: "roxane.cs26@bmsce.ac.in", section: "PB" },
];

class PeTestSeed {
  private adminToken: string | null = null;
  private adminUserId: string | null = null;

  private getHeaders() {
    if (!this.adminToken) {
      throw new Error("Admin token missing. Call signIn first.");
    }
    return { Authorization: `Bearer ${this.adminToken}` };
  }

  async signIn(): Promise<void> {
    const { ADMIN_USER_EMAIL, ADMIN_USER_PASSWORD } = backendEnv();
    const response = await auth.api.signInEmail({
      body: { email: ADMIN_USER_EMAIL, password: ADMIN_USER_PASSWORD },
    });
    if (!response.token || !response.user?.id) {
      throw new Error("Admin sign-in failed: token/user missing.");
    }
    this.adminToken = response.token;
    this.adminUserId = response.user.id;
    logger.info(`Admin sign-in successful: ${response.user.email}`);
  }

  private async ensureUser(userData: {
    email: string;
    username: string;
    password: string;
    name: string;
    role: string;
  }) {
    const normalizedUsername = userData.username.toLowerCase();
    const existing = await db.user.findFirst({
      where: {
        OR: [{ email: userData.email }, { username: normalizedUsername }],
      },
      select: { id: true },
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
        },
      });
      return { id: existing.id, created: false };
    }
    const userService = new UserService({
      request: { ...userData, username: normalizedUsername },
      headers: this.getHeaders(),
    });
    const created = await userService.create();
    if (created.status === "error" || !created.data?.id) {
      throw new Error(
        created.message || `Failed to create user ${userData.email}`
      );
    }
    return { id: created.data.id, created: true };
  }

  async seedDepartments(): Promise<Map<string, string>> {
    const departmentIdByCode = new Map<string, string>();
    for (const department of DEPARTMENTS) {
      const departmentUser = await this.ensureUser({
        name: department.name,
        email: `dept.${department.code.toLowerCase()}@webcampus.com`,
        username: `dept.${department.code.toLowerCase()}`,
        password: DEFAULT_PASSWORD,
        role: "department",
      });
      const existing = await db.department.findUnique({
        where: { code: department.code },
        select: { id: true, code: true },
      });
      if (existing) {
        const updated = await db.department.update({
          where: { id: existing.id },
          data: {
            userId: departmentUser.id,
            name: department.name,
            code: department.code,
            abbreviation: department.abbreviation,
            type: department.type,
          },
        });
        departmentIdByCode.set(updated.code, updated.id);
        continue;
      }
      const created = await db.department.create({
        data: {
          userId: departmentUser.id,
          name: department.name,
          code: department.code,
          abbreviation: department.abbreviation,
          type: department.type,
        },
      });
      departmentIdByCode.set(created.code, created.id);
    }
    return departmentIdByCode;
  }

  async seedAcademicTermAndSemesters(): Promise<{
    termId: string;
    semesterId: string;
  }> {
    if (!this.adminUserId) {
      throw new Error("Admin user id missing. Call signIn first.");
    }
    let term = await db.academicTerm.findFirst({
      where: { type: "odd", year: "2026" },
    });
    if (!term) {
      term = await db.academicTerm.create({
        data: { type: "odd", year: "2026", isCurrent: true },
      });
    }
    await SemesterService.bulkUpsertSemesters(term.id, [
      {
        academicTermId: term.id,
        programType: "UG",
        semesterNumber: 1,
        termType: "odd",
        startDate: new Date("2026-03-29T18:30:00.000Z"),
        endDate: new Date("2026-04-29T18:30:00.000Z"),
        userId: this.adminUserId,
      },
    ]);
    const semester = await db.semester.findFirst({
      where: { academicTermId: term.id, programType: "UG", semesterNumber: 1 },
      select: { id: true },
    });
    if (!semester) {
      throw new Error("UG sem-1 not found after upsert.");
    }
    return { termId: term.id, semesterId: semester.id };
  }

  async seedFaculty(departmentIdByCode: Map<string, string>): Promise<void> {
    for (const faculty of FACULTY) {
      const departmentId = departmentIdByCode.get(faculty.departmentCode);
      if (!departmentId) {
        throw new Error(`Department id missing for ${faculty.departmentCode}`);
      }
      const facultyUser = await this.ensureUser({
        name: faculty.name,
        email: faculty.email,
        username: faculty.username,
        password: DEFAULT_PASSWORD,
        role: "faculty",
      });
      const existing = await db.faculty.findFirst({
        where: {
          OR: [{ employeeId: faculty.employeeId }, { userId: facultyUser.id }],
        },
        select: { id: true },
      });
      const shortName = AdminFacultyService.generateShortName(faculty.name);
      if (existing) {
        await db.faculty.update({
          where: { id: existing.id },
          data: {
            userId: facultyUser.id,
            departmentId,
            shortName,
            designation: "ASSISTANT_PROFESSOR",
            employeeId: faculty.employeeId,
            staffType: "REGULAR",
          },
        });
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
        },
      });
    }
  }

  async seedSectionsAndStudents(semesterId: string): Promise<void> {
    const csDept = await db.department.findUnique({
      where: { code: "CS" },
      select: { id: true },
    });
    if (!csDept) {
      throw new Error("CS department not found.");
    }
    const sections: Record<string, string> = {};
    for (const name of ["PA", "PB"]) {
      const existing = await db.section.findFirst({
        where: { name, semesterId },
      });
      if (existing) {
        sections[name] = existing.id;
        continue;
      }
      const created = await db.section.create({
        data: {
          name,
          departmentName: "Computer Science and Engineering",
          departmentId: csDept.id,
          semesterId,
          cycle: "NONE",
        },
      });
      sections[name] = created.id;
    }

    for (const student of STUDENTS) {
      const user = await this.ensureUser({
        name: student.usn,
        email: student.email,
        username: student.usn.toLowerCase(),
        password: DEFAULT_PASSWORD,
        role: "student",
      });
      const existingStudent = await db.student.findUnique({
        where: { usn: student.usn },
        select: { id: true },
      });
      let studentId: string;
      if (existingStudent) {
        await db.student.update({
          where: { id: existingStudent.id },
          data: { userId: user.id },
        });
        studentId = existingStudent.id;
      } else {
        const createdStudent = await db.student.create({
          data: {
            userId: user.id,
            usn: student.usn,
            departmentName: "Computer Science and Engineering",
            currentSemester: 1,
            academicYear: "2026",
            academicTermId: (await db.academicTerm.findFirst({
              where: { type: "odd", year: "2026" },
              select: { id: true },
            }))!.id,
            academicTermType: "odd",
            academicTermYear: "2026",
            programType: "UG",
            semesterId,
            semesterNumber: 1,
          },
        });
        studentId = createdStudent.id;
      }
      const existingSectionLink = await db.studentSection.findFirst({
        where: { studentId, semester: 1, academicYear: "2026" },
      });
      if (!existingSectionLink) {
        await db.studentSection.create({
          data: {
            studentId,
            sectionId: sections[student.section]!,
            semester: 1,
            academicYear: "2026",
          },
        });
      }
    }
  }

  async run(): Promise<void> {
    await this.signIn();
    const departmentIdByCode = await this.seedDepartments();
    const { semesterId } = await this.seedAcademicTermAndSemesters();
    await this.seedFaculty(departmentIdByCode);
    await this.seedSectionsAndStudents(semesterId);
    logger.info("pe-test-seed completed successfully.");
  }
}

async function main() {
  const seed = new PeTestSeed();
  try {
    await seed.run();
  } catch (error) {
    logger.error("pe-test-seed failed", { error });
    process.exitCode = 1;
  } finally {
    await Promise.allSettled([redis.quit(), db.$disconnect()]);
  }
}

void main();
