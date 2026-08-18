/// <reference types="bun" />

import { beforeEach, describe, expect, it, mock } from "bun:test";

type UserRecord = {
  id: string;
  email: string;
  username: string | null;
};

let users: UserRecord[] = [];
let createdRequests: Record<string, unknown>[] = [];

const dbMock = {
  user: {
    findMany: async () => users,
    findFirst: async ({
      where,
    }: {
      where: {
        OR: Array<{
          username?: { equals: string; mode: "insensitive" };
          email?: { equals: string; mode: "insensitive" };
        }>;
      };
    }) => {
      return users.find((user) =>
        where.OR.some((condition) => {
          const value = condition.username?.equals ?? condition.email?.equals;
          return value
            ? user.username?.toLowerCase() === value.toLowerCase() ||
                user.email.toLowerCase() === value.toLowerCase()
            : false;
        })
      );
    },
  },
};

class MockUserService {
  private request: Record<string, unknown>;

  constructor({ request }: { request: Record<string, unknown> }) {
    this.request = request;
    createdRequests.push(request);
  }

  async create() {
    const user = {
      id: "created-user",
      email: this.request.email as string,
      username: this.request.username as string,
    };
    users.push(user);
    return { status: "success", data: user };
  }
}

mock.module("@webcampus/db", () => ({ db: dbMock, Prisma: {} }));
mock.module("@webcampus/api/src/services/admin/user.service", () => ({
  UserService: MockUserService,
}));
mock.module("@webcampus/auth", () => ({
  auth: { api: {} },
  fromNodeHeaders: () => ({}),
}));
mock.module("@webcampus/common/logger", () => ({
  logger: { error: () => {}, info: () => {}, warn: () => {} },
}));

describe("AdmissionService applicant port resolution", () => {
  beforeEach(() => {
    users = [];
    createdRequests = [];
  });

  it("resolves an existing applicant by email case-insensitively", async () => {
    users = [
      {
        id: "existing-user",
        email: "keshav@gmail.com",
        username: "keshav",
      },
    ];

    const { AdmissionService } = await import("./admission.service");
    const resolveApplicantUsers = (
      AdmissionService as unknown as {
        resolveApplicantUsersForPort: (
          primaryEmails: string[],
          headers: Record<string, string>
        ) => Promise<{
          userIdByPrimaryEmail: Map<string, string>;
          autoCreatedUsers: number;
        }>;
      }
    ).resolveApplicantUsersForPort;

    const result = await resolveApplicantUsers.call(
      AdmissionService,
      ["KESHAV@GMAIL.COM"],
      {}
    );

    expect(result.userIdByPrimaryEmail.get("keshav@gmail.com")).toBe(
      "existing-user"
    );
    expect(result.autoCreatedUsers).toBe(0);
    expect(createdRequests).toHaveLength(0);
  });

  it("creates a missing applicant with the real primary email", async () => {
    const { AdmissionService } = await import("./admission.service");
    const resolveApplicantUsers = (
      AdmissionService as unknown as {
        resolveApplicantUsersForPort: (
          primaryEmails: string[],
          headers: Record<string, string>
        ) => Promise<{
          userIdByPrimaryEmail: Map<string, string>;
          autoCreatedUsers: number;
        }>;
      }
    ).resolveApplicantUsersForPort;

    const result = await resolveApplicantUsers.call(
      AdmissionService,
      ["KESHAV@GMAIL.COM"],
      {}
    );

    expect(createdRequests[0]).toMatchObject({
      email: "keshav@gmail.com",
      username: "keshav",
      role: "applicant",
    });
    expect(result.userIdByPrimaryEmail.get("keshav@gmail.com")).toBe(
      "created-user"
    );
    expect(result.autoCreatedUsers).toBe(1);
  });
});
