import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Request, Response } from "express";

type SentResponse = {
  statusCode: number;
  message: string;
};

const sentResponses: SentResponse[] = [];

mock.module("@webcampus/backend-utils/errors", () => ({
  ERRORS: { INTERNAL_SERVER_ERROR: "Internal server error" },
}));

mock.module("@webcampus/backend-utils/helpers", () => ({
  sendResponse: (opts: {
    res: Response;
    status: string;
    statusCode: number;
    message: string;
  }) => {
    sentResponses.push({
      statusCode: opts.statusCode,
      message: opts.message,
    });
  },
}));

mock.module("@webcampus/common/logger", () => ({
  logger: { error: () => undefined },
}));

const makeError = (message: string): Error => {
  const err = new Error(message);
  return err;
};

const toggleError = mock<(message: string) => Error>(makeError);

mock.module(
  "@webcampus/api/src/services/admin/registration-window.service",
  () => ({
    RegistrationWindowService: {
      toggleWindow: async () => {
        throw toggleError("");
      },
    },
  })
);

const { RegistrationWindowController } = await import(
  "../registration-window.controller"
);

const makeReq = (): Request =>
  ({
    params: { id: "window-1" },
    body: { isOpen: true },
  }) as unknown as Request;

const makeRes = (): Response => ({}) as unknown as Response;

describe("RegistrationWindowController", () => {
  beforeEach(() => {
    sentResponses.length = 0;
    toggleError.mockImplementation(makeError);
  });

  test("reopen-block error maps to 409", async () => {
    toggleError.mockImplementation(() =>
      makeError(
        "Cannot reopen registration: attendance or marks have started for PE courses in this scope"
      )
    );
    await RegistrationWindowController.toggleWindow(makeReq(), makeRes());
    expect(sentResponses).toHaveLength(1);
    expect(sentResponses[0]?.statusCode).toBe(409);
    expect(sentResponses[0]?.message).toContain("Cannot reopen registration");
  });

  test("window-not-found error still maps to 404", async () => {
    toggleError.mockImplementation(() =>
      makeError("Registration window not found")
    );
    await RegistrationWindowController.toggleWindow(makeReq(), makeRes());
    expect(sentResponses[0]?.statusCode).toBe(404);
  });

  test("validation error still maps to 400", async () => {
    toggleError.mockImplementation(() =>
      makeError("Select either department or cycle")
    );
    await RegistrationWindowController.toggleWindow(makeReq(), makeRes());
    expect(sentResponses[0]?.statusCode).toBe(400);
  });

  test("unknown error still maps to 500", async () => {
    toggleError.mockImplementation(() => makeError("Something unexpected"));
    await RegistrationWindowController.toggleWindow(makeReq(), makeRes());
    expect(sentResponses[0]?.statusCode).toBe(500);
  });
});
