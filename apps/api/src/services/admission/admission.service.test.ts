/// <reference types="bun" />

import { beforeEach, describe, expect, it, mock } from "bun:test";

type TransactionUser = {
  id: string;
  email: string;
};

const mockState = {
  semester: {
    id: "semester-1",
    programType: "UG",
    academicTerm: { id: "term-1", type: "odd", year: "2022" },
    semesterNumber: 5,
  },
  admissions: [
    {
      id: "admission-1",
      applicationId: "APP001",
      departmentId: "dept-1",
      tempUsn: "TBM22CS001",
      studentId: null,
      firstName: "Keshav",
      middleName: null,
      lastName: "G",
      primaryEmail: "admission@example.com",
      photo: null,
    },
  ],
  applicantUsers: [
    {
      id: "user-1",
      username: "app001",
      email: "app001@applicant.local",
    },
  ],
  existingStudentUsers: [] as TransactionUser[],
  studentRecord: null as null | { id: string; usn: string },
  createdStudentId: "student-1",
  userUpdates: [] as Array<{ where: { id: string }; data: Record<string, unknown> }>,
  studentCreates: [] as Array<{ data: Record<string, unknown> }>,
  studentUpdates: [] as Array<{ where: { id: string }; data: Record<string, unknown> }>,
};

const txMock = {
  department: {
    findUnique: async () => ({ name: "Computer Science", code: "CS" }),
  },
  user: {
    findMany: async () => mockState.existingStudentUsers,
    findFirst: async () => null,
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      mockState.userUpdates.push(args);
      return { id: args.where.id };
    },
  },
  student: {
    findFirst: async () => mockState.studentRecord,
    create: async (args: { data: Record<string, unknown> }) => {
      mockState.studentCreates.push(args);
      return { id: mockState.createdStudentId };
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      mockState.studentUpdates.push(args);
      return { id: args.where.id };
    },
  },
  admission: {
    update: async () => ({ id: "admission-1" }),
  },
};

const dbMock = {
  semester: {
    findUnique: async () => mockState.semester,
  },
  admission: {
    count: async () => 0,
    findMany: async () => mockState.admissions,
    update: async () => ({ id: "admission-1" }),
  },
  user: {
    findMany: async () => mockState.applicantUsers,
    findFirst: async () => null,
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      mockState.userUpdates.push(args);
      return { id: args.where.id };
    },
  },
  student: {
    findFirst: async () => mockState.studentRecord,
    create: async (args: { data: Record<string, unknown> }) => {
      mockState.studentCreates.push(args);
      return { id: mockState.createdStudentId };
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      mockState.studentUpdates.push(args);
      return { id: args.where.id };
    },
  },
  department: {
    findUnique: async () => ({ name: "Computer Science", code: "CS" }),
  },
  $transaction: async (callback: (tx: typeof txMock) => Promise<unknown>) => {
    return callback(txMock);
  },
};

mock.module("@webcampus/db", () => ({
  db: dbMock,
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code = "";
    },
  },
}));

mock.module("@webcampus/common/logger", () => ({
  logger: {
    error: () => {},
    info: () => {},
  },
}));

mock.module("@webcampus/api/src/services/admin/user.service", () => ({
  UserService: class {
    constructor() {}
    async create() {
      return {
        status: "success",
        message: "created",
        data: { id: "user-1" },
      };
    }
  },
}));

describe("AdmissionService.portStudents", () => {
  beforeEach(() => {
    mockState.studentRecord = null;
    mockState.existingStudentUsers = [];
    mockState.userUpdates.length = 0;
    mockState.studentCreates.length = 0;
    mockState.studentUpdates.length = 0;
  });

  it("writes the generated student email when creating a student record", async () => {
    const { AdmissionService } = await import("./admission.service");

    const response = await AdmissionService.portStudents(
      { semesterId: "semester-1" },
      {}
    );

    expect(response.status).toBe("success");
    expect(mockState.studentCreates).toHaveLength(1);
    expect(mockState.userUpdates).toHaveLength(1);
    expect(mockState.userUpdates[0]?.data).toMatchObject({
      email: "keshav.cs22@bmsce.ac.in",
      username: "TBM22CS001",
    });
  });

  it("writes the generated student email when updating an existing student record", async () => {
    const { AdmissionService } = await import("./admission.service");

    mockState.studentRecord = { id: "student-1", usn: "1BM22CS001" };

    const response = await AdmissionService.portStudents(
      { semesterId: "semester-1" },
      {}
    );

    expect(response.status).toBe("success");
    expect(mockState.studentUpdates).toHaveLength(1);
    expect(mockState.userUpdates).toHaveLength(1);
    expect(mockState.userUpdates[0]?.data).toMatchObject({
      email: "keshav.cs22@bmsce.ac.in",
      username: "1BM22CS001",
    });
  });
});
