/// <reference types="bun" />

import { describe, expect, it, mock } from "bun:test";

type UserRecord = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  displayUsername: string | null;
  student?: {
    usn: string;
  } | null;
};

let users: UserRecord[] = [];

const dbMock = {
  user: {
    findMany: async () => users,
    update: async ({ where, data }: any) => {
      const target = users.find((user) => user.id === where.id);
      if (!target) {
        throw new Error(`User ${where.id as string} not found`);
      }

      target.username = data.username;
      target.displayUsername = data.displayUsername;
      return target;
    },
  },
};

mock.module("@webcampus/db", () => ({
  db: dbMock,
}));

mock.module("@webcampus/auth", () => ({
  auth: {
    api: {},
  },
  fromNodeHeaders: () => ({}),
}));

mock.module("@webcampus/common/logger", () => ({
  logger: {
    error: () => {},
    info: () => {},
  },
}));

describe("UserService.backfillMissingProfileFields", () => {
  it("keeps existing username even when student usn exists", async () => {
    users = [
      {
        id: "user-1",
        name: "Student One",
        email: "student.one@college.edu",
        username: "student.one",
        displayUsername: null,
        student: {
          usn: "1BM22CS001",
        },
      },
    ];

    const { UserService } = await import("./user.service");

    const updatedCount = await UserService.backfillMissingProfileFields();

    expect(updatedCount).toBe(1);
    expect(users[0]?.username).toBe("student.one");
    expect(users[0]?.displayUsername).toBe("Student One");
  });

  it("uses email-derived username when username is missing", async () => {
    users = [
      {
        id: "user-2",
        name: "No Username",
        email: "No.Username@college.edu",
        username: null,
        displayUsername: null,
        student: {
          usn: "1BM22CS002",
        },
      },
    ];

    const { UserService } = await import("./user.service");

    const updatedCount = await UserService.backfillMissingProfileFields();

    expect(updatedCount).toBe(1);
    expect(users[0]?.username).toBe("no.username");
    expect(users[0]?.displayUsername).toBe("No Username");
  });
});
