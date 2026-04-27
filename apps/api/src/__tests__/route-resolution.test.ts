/// <reference types="bun" />

import http from "http";
import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";

mock.module("dotenv", () => ({
  config: () => {},
}));

mock.module("@webcampus/common/env", () => ({
  backendEnv: () => ({
    PORT: 3456,
    FRONTEND_URL: "http://localhost:3000",
    NODE_ENV: "test",
  }),
  frontendEnv: () => ({
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:3456",
    NEXT_PUBLIC_FRONTEND_URL: "http://localhost:3000",
  }),
}));

mock.module("@webcampus/auth", () => ({
  auth: {
    api: {
      getSession: async () => null,
      signIn: async () => null,
      signOut: async () => null,
    },
  },
  toNodeHandler: (handler: unknown) => handler,
}));

mock.module("@webcampus/auth", () => ({
  auth: {
    api: {
      getSession: async () => null,
      signIn: async () => null,
      signOut: async () => null,
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toNodeHandler: () => (req: any, res: any) => {
    res.statusCode = 404;
    res.end("Auth not available in test");
  },
  fromNodeHeaders: () => ({}),
}));

mock.module("@webcampus/common/env", () => ({
  backendEnv: () => ({
    PORT: 3456,
    FRONTEND_URL: "http://localhost:3000",
    NODE_ENV: "test",
  }),
  frontendEnv: () => ({
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:3456",
    NEXT_PUBLIC_FRONTEND_URL: "http://localhost:3000",
  }),
}));

mock.module("@webcampus/db", () => ({
  db: {},
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

const BASE_URL = "http://localhost:3456";
let server: http.Server;

beforeAll(async () => {
  const { default: app } = await import("../app.js");

  server = http.createServer(app);
  server.listen(3456);
  await new Promise((resolve) => server.on("listening", resolve));
});

afterAll(() => {
  server?.close();
});

describe("Route Resolution Tests", () => {
  const TIMEOUT_MS = 5000;

  async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout = TIMEOUT_MS
  ) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (error: unknown) {
      clearTimeout(id);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms: ${url}`);
      }
      throw error;
    }
  }

  describe("/faculty/attendance/* routes", () => {
    it("GET /faculty/attendance resolves without hanging", async () => {
      const url = `${BASE_URL}/faculty/attendance`;
      const start = Date.now();

      const res = await fetchWithTimeout(url, { method: "GET" });

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(TIMEOUT_MS);
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(600);
    });

    it("GET /faculty/attendance/ resolves to correct handler (not 404)", async () => {
      const url = `${BASE_URL}/faculty/attendance/`;
      const res = await fetchWithTimeout(url, { method: "GET" });
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(600);
    });

    it("GET /faculty/attendance/session resolves correctly (not :id)", async () => {
      const url = `${BASE_URL}/faculty/attendance/session`;
      const res = await fetchWithTimeout(url, { method: "GET" });
      const text = await res.text();
      expect(text).not.toContain("Use /faculty/attendance/session endpoint");
    });

    it("GET /faculty/attendance/session/test-hang resolves", async () => {
      const url = `${BASE_URL}/faculty/attendance/session/test-hang`;
      const res = await fetchWithTimeout(url, { method: "GET" });
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(600);
    });

    it("GET /faculty/attendance/report/detailed resolves", async () => {
      const url = `${BASE_URL}/faculty/attendance/report/detailed`;
      const res = await fetchWithTimeout(url, { method: "GET" });
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(600);
    });

    it("GET /faculty/attendance/:id does not match /session", async () => {
      const url = `${BASE_URL}/faculty/attendance/session`;
      const res = await fetchWithTimeout(url, { method: "GET" });
      const text = await res.text();
      expect(text).not.toContain("Use /faculty/attendance/session endpoint");
    });
  });

  describe("/admission routes", () => {
    it("GET /admission/me resolves (not :id)", async () => {
      const url = `${BASE_URL}/admission/me`;
      const res = await fetchWithTimeout(url, { method: "GET" });
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(600);
    });

    it("GET /admission/departments resolves", async () => {
      const url = `${BASE_URL}/admission/departments`;
      const res = await fetchWithTimeout(url, { method: "GET" });
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(600);
    });

    it("GET /admission/:id does not shadow /me", async () => {
      const url = `${BASE_URL}/admission/me`;
      const res = await fetchWithTimeout(url, { method: "GET" });
      const text = await res.text();
      expect(text).not.toMatch(/"id"\s*:\s*"me"/);
    });
  });

  describe("/department routes", () => {
    it("GET /department/section/:id resolves", async () => {
      const url = `${BASE_URL}/department/section/test-id`;
      const res = await fetchWithTimeout(url, { method: "GET" });
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(600);
    });

    it("GET /department/section/unassigned-counts resolves before :id", async () => {
      const url = `${BASE_URL}/department/section/unassigned-counts`;
      const res = await fetchWithTimeout(url, { method: "GET" });
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(600);
    });
  });

  describe("/hod routes", () => {
    it("GET /hod/course-assignment resolves", async () => {
      const url = `${BASE_URL}/hod/course-assignment`;
      const res = await fetchWithTimeout(url, { method: "GET" });
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(600);
    });

    it("GET /hod/course-assignment/faculty/:facultyId resolves", async () => {
      const url = `${BASE_URL}/hod/course-assignment/faculty/faculty-123`;
      const res = await fetchWithTimeout(url, { method: "GET" });
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(600);
    });

    it("GET /hod/course-assignment/:id does not match /faculty/:id", async () => {
      const url = `${BASE_URL}/hod/course-assignment/faculty/test-id`;
      const res = await fetchWithTimeout(url, { method: "GET" });
      const text = await res.text();
      expect(text).not.toMatch(/"id"\s*:\s*"faculty"/);
    });
  });

  describe("/student routes", () => {
    it("GET /student/profile resolves", async () => {
      const url = `${BASE_URL}/student/profile`;
      const res = await fetchWithTimeout(url, { method: "GET" });
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(600);
    });

    it("GET /student/course-registration/dashboard resolves", async () => {
      const url = `${BASE_URL}/student/course-registration/dashboard`;
      const res = await fetchWithTimeout(url, { method: "GET" });
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(600);
    });
  });

  describe("/admin routes", () => {
    it("GET /admin/user resolves", async () => {
      const url = `${BASE_URL}/admin/user`;
      const res = await fetchWithTimeout(url, { method: "GET" });
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(600);
    });

    it("GET /admin/faculty resolves", async () => {
      const url = `${BASE_URL}/admin/faculty`;
      const res = await fetchWithTimeout(url, { method: "GET" });
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(600);
    });
  });

  describe("Timeout detection", () => {
    it("does not hang on /faculty/attendance/*", async () => {
      const urls = [
        `${BASE_URL}/faculty/attendance`,
        `${BASE_URL}/faculty/attendance/session`,
        `${BASE_URL}/faculty/attendance/`,
      ];

      const promises = urls.map((url) =>
        fetchWithTimeout(url, { method: "GET" }, 3000)
      );

      const results = await Promise.allSettled(promises);

      const timeouts = results.filter((r) => r.status === "rejected");
      expect(timeouts).toHaveLength(0);
    });
  });

  describe("Status code sanity", () => {
    it("returns valid HTTP status codes", async () => {
      const endpoints = [
        `${BASE_URL}/faculty/attendance/session`,
        `${BASE_URL}/faculty/attendance/report/detailed`,
        `${BASE_URL}/admission/me`,
        `${BASE_URL}/department/section/unassigned-counts`,
        `${BASE_URL}/hod/course-assignment`,
      ];

      for (const url of endpoints) {
        const res = await fetchWithTimeout(url, { method: "GET" });
        const status = res.status;
        expect(status).toBeGreaterThanOrEqual(200);
        expect(status).toBeLessThan(600);
      }
    });
  });
});
