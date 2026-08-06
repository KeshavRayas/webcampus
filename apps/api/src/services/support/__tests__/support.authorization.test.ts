/// <reference types="bun" />

import { describe, expect, it } from "bun:test";
import {
  assertCanReadTicket,
  assertCanReplyToTicket,
  assertValidStatusTransition,
} from "../support.authorization";

describe("support ticket authorization", () => {
  it("allows admins to read every ticket", () => {
    expect(() =>
      assertCanReadTicket("owner", "admin-user", "admin")
    ).not.toThrow();
  });

  it("allows creators to read their own ticket", () => {
    expect(() =>
      assertCanReadTicket("user-1", "user-1", "student")
    ).not.toThrow();
  });

  it("blocks non-owners from reading a ticket", () => {
    expect(() => assertCanReadTicket("owner", "other-user", "faculty")).toThrow(
      "You are not allowed to access this ticket"
    );
  });
});

describe("support ticket replies", () => {
  it("allows the creator to reply only while in progress", () => {
    expect(() =>
      assertCanReplyToTicket({
        ticketCreatorId: "user-1",
        userId: "user-1",
        role: "student",
        status: "IN_PROGRESS",
      })
    ).not.toThrow();

    expect(() =>
      assertCanReplyToTicket({
        ticketCreatorId: "user-1",
        userId: "user-1",
        role: "student",
        status: "OPEN",
      })
    ).toThrow("Users can reply only while the ticket is in progress");
  });

  it("blocks a non-owner even when the ticket is in progress", () => {
    expect(() =>
      assertCanReplyToTicket({
        ticketCreatorId: "user-1",
        userId: "user-2",
        role: "faculty",
        status: "IN_PROGRESS",
      })
    ).toThrow("You are not allowed to reply to this ticket");
  });

  it("allows admins to reply to open and in-progress tickets", () => {
    for (const status of ["OPEN", "IN_PROGRESS"] as const) {
      expect(() =>
        assertCanReplyToTicket({
          ticketCreatorId: "user-1",
          userId: "admin-1",
          role: "admin",
          status,
        })
      ).not.toThrow();
    }
  });

  it("blocks admins from replying to resolved or closed tickets", () => {
    for (const status of ["RESOLVED", "CLOSED"] as const) {
      expect(() =>
        assertCanReplyToTicket({
          ticketCreatorId: "user-1",
          userId: "admin-1",
          role: "admin",
          status,
        })
      ).toThrow("Admins cannot reply to a resolved or closed ticket");
    }
  });
});

describe("support ticket status transitions", () => {
  it("allows only forward transitions", () => {
    expect(() =>
      assertValidStatusTransition("OPEN", "IN_PROGRESS")
    ).not.toThrow();
    expect(() =>
      assertValidStatusTransition("IN_PROGRESS", "RESOLVED")
    ).not.toThrow();
    expect(() =>
      assertValidStatusTransition("RESOLVED", "CLOSED")
    ).not.toThrow();
  });

  it("blocks reopening, skipping states, and no-op transitions", () => {
    for (const [current, next] of [
      ["OPEN", "RESOLVED"],
      ["IN_PROGRESS", "OPEN"],
      ["RESOLVED", "OPEN"],
      ["CLOSED", "OPEN"],
      ["CLOSED", "CLOSED"],
    ] as const) {
      expect(() => assertValidStatusTransition(current, next)).toThrow(
        `Invalid status transition from ${current} to ${next}`
      );
    }
  });
});
