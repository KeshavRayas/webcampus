/// <reference types="bun" />

import { describe, expect, it } from "bun:test";
import {
  CreateSupportMessageSchema,
  CreateSupportTicketSchema,
  UpdateSupportTicketStatusSchema,
} from "../support.schema";

describe("CreateSupportTicketSchema", () => {
  it("accepts a valid ticket and defaults priority", () => {
    const result = CreateSupportTicketSchema.parse({
      category: "TECHNICAL",
      subject: "Unable to open attendance page",
      body: "The attendance page shows an error after signing in.",
    });

    expect(result.priority).toBe("MEDIUM");
  });

  it("rejects unsupported categories and short descriptions", () => {
    expect(() =>
      CreateSupportTicketSchema.parse({
        category: "UNKNOWN",
        subject: "Issue",
        body: "Short",
      })
    ).toThrow();
  });

  it("rejects subjects longer than 200 characters", () => {
    expect(() =>
      CreateSupportTicketSchema.parse({
        category: "OTHER",
        subject: "x".repeat(201),
        body: "This is a sufficiently detailed support description.",
      })
    ).toThrow();
  });
});

describe("support message and status schemas", () => {
  it("requires a non-empty message body", () => {
    expect(() => CreateSupportMessageSchema.parse({ body: "" })).toThrow();
    expect(() =>
      CreateSupportMessageSchema.parse({ body: "Reply" })
    ).not.toThrow();
  });

  it("accepts only supported statuses", () => {
    expect(
      UpdateSupportTicketStatusSchema.parse({ status: "RESOLVED" }).status
    ).toBe("RESOLVED");
    expect(() =>
      UpdateSupportTicketStatusSchema.parse({ status: "REOPENED" })
    ).toThrow();
  });
});
