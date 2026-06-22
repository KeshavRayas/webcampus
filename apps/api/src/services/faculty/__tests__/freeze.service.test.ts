/* eslint-disable @typescript-eslint/no-explicit-any */

/// <reference types="bun" />

import { describe, expect, it } from "bun:test";
import {
  assertCanManageFreezeWindow,
  assertCanMutateAttendance,
  canRoleManageFreezeWindow,
  canRoleMutateAttendance,
  resolveFreezeState,
} from "../freeze.service";

describe("resolveFreezeState", () => {
  it("returns OPEN for null freeze", () => {
    const result = resolveFreezeState(null);
    expect(result.displayState).toBe("OPEN");
    expect(result.lockedBy).toBeNull();
  });

  it("returns FROZEN_BY_FACULTY when facultyFrozen", () => {
    const result = resolveFreezeState({
      facultyFrozen: true,
      hodFrozen: false,
      adminFrozen: false,
      facultyFrozenAt: new Date("2024-01-01"),
      hodFrozenAt: null,
      adminFrozenAt: null,
    } as any);
    expect(result.displayState).toBe("FROZEN_BY_FACULTY");
    expect(result.lockedBy).toBe("FACULTY");
  });

  it("returns FROZEN_BY_HOD when hodFrozen", () => {
    const result = resolveFreezeState({
      facultyFrozen: true,
      hodFrozen: true,
      adminFrozen: false,
      facultyFrozenAt: new Date("2024-01-01"),
      hodFrozenAt: new Date("2024-02-01"),
      adminFrozenAt: null,
    } as any);
    expect(result.displayState).toBe("FROZEN_BY_HOD");
    expect(result.lockedBy).toBe("HOD");
  });

  it("returns LOCKED_BY_ADMIN when adminFrozen", () => {
    const result = resolveFreezeState({
      facultyFrozen: true,
      hodFrozen: true,
      adminFrozen: true,
      facultyFrozenAt: new Date("2024-01-01"),
      hodFrozenAt: new Date("2024-02-01"),
      adminFrozenAt: new Date("2024-03-01"),
    } as any);
    expect(result.displayState).toBe("LOCKED_BY_ADMIN");
    expect(result.lockedBy).toBe("ADMIN");
  });
});

describe("canRoleMutateAttendance", () => {
  const open = resolveFreezeState(null);
  const facultyLock = resolveFreezeState({
    facultyFrozen: true,
    hodFrozen: false,
    adminFrozen: false,
  } as any);
  const hodLock = resolveFreezeState({
    facultyFrozen: false,
    hodFrozen: true,
    adminFrozen: false,
  } as any);
  const adminLock = resolveFreezeState({
    facultyFrozen: false,
    hodFrozen: false,
    adminFrozen: true,
  } as any);

  it("faculty can mutate only when OPEN", () => {
    expect(canRoleMutateAttendance("faculty", open)).toBe(true);
    expect(canRoleMutateAttendance("faculty", facultyLock)).toBe(false);
    expect(canRoleMutateAttendance("faculty", hodLock)).toBe(false);
    expect(canRoleMutateAttendance("faculty", adminLock)).toBe(false);
  });

  it("HOD is blocked only by adminFrozen", () => {
    expect(canRoleMutateAttendance("department", open)).toBe(true);
    expect(canRoleMutateAttendance("department", hodLock)).toBe(true);
    expect(canRoleMutateAttendance("department", adminLock)).toBe(false);
  });

  it("admin can never mutate attendance", () => {
    expect(canRoleMutateAttendance("admin", open)).toBe(false);
    expect(canRoleMutateAttendance("admin", adminLock)).toBe(false);
  });
});

describe("canRoleManageFreezeWindow", () => {
  const open = resolveFreezeState(null);
  const facultyLock = resolveFreezeState({
    facultyFrozen: true,
    hodFrozen: false,
    adminFrozen: false,
  } as any);
  const hodLock = resolveFreezeState({
    facultyFrozen: false,
    hodFrozen: true,
    adminFrozen: false,
  } as any);
  const adminLock = resolveFreezeState({
    facultyFrozen: false,
    hodFrozen: false,
    adminFrozen: true,
  } as any);

  it("faculty can freeze only when OPEN", () => {
    expect(canRoleManageFreezeWindow("faculty", open, "freeze")).toBe(true);
    expect(canRoleManageFreezeWindow("faculty", facultyLock, "freeze")).toBe(
      false
    );
    expect(canRoleManageFreezeWindow("faculty", hodLock, "freeze")).toBe(false);
  });

  it("faculty can never unfreeze", () => {
    expect(canRoleManageFreezeWindow("faculty", open, "unfreeze")).toBe(false);
    expect(canRoleManageFreezeWindow("faculty", facultyLock, "unfreeze")).toBe(
      false
    );
  });

  it("HOD can freeze even when already hodFrozen", () => {
    expect(canRoleManageFreezeWindow("department", hodLock, "freeze")).toBe(
      true
    );
  });

  it("HOD unfreeze only when hodFrozen", () => {
    expect(canRoleManageFreezeWindow("department", open, "unfreeze")).toBe(
      false
    );
    expect(canRoleManageFreezeWindow("department", hodLock, "unfreeze")).toBe(
      true
    );
  });

  it("HOD can unfreeze when facultyFrozen", () => {
    expect(
      canRoleManageFreezeWindow("department", facultyLock, "unfreeze")
    ).toBe(true);
  });

  it("admin always freeze and unfreeze", () => {
    expect(canRoleManageFreezeWindow("admin", open, "freeze")).toBe(true);
    expect(canRoleManageFreezeWindow("admin", adminLock, "freeze")).toBe(true);
    expect(canRoleManageFreezeWindow("admin", adminLock, "unfreeze")).toBe(
      true
    );
  });
});

describe("assertCanMutateAttendance", () => {
  const adminLock = resolveFreezeState({
    facultyFrozen: false,
    hodFrozen: false,
    adminFrozen: true,
  } as any);
  const hodLock = resolveFreezeState({
    facultyFrozen: false,
    hodFrozen: true,
    adminFrozen: false,
  } as any);
  const facultyLock = resolveFreezeState({
    facultyFrozen: true,
    hodFrozen: false,
    adminFrozen: false,
  } as any);

  it("blocks admin mutations", () => {
    expect(() => assertCanMutateAttendance("admin", adminLock)).toThrow(
      "Forbidden: admin cannot mutate attendance"
    );
  });

  it("blocks faculty with precedence-aware messages", () => {
    expect(() => assertCanMutateAttendance("faculty", adminLock)).toThrow(
      "Forbidden: locked by admin"
    );
    expect(() => assertCanMutateAttendance("faculty", hodLock)).toThrow(
      "Forbidden: frozen by HOD"
    );
    expect(() => assertCanMutateAttendance("faculty", facultyLock)).toThrow(
      "Forbidden: frozen by faculty"
    );
  });
});

describe("assertCanManageFreezeWindow", () => {
  const adminLock = resolveFreezeState({
    facultyFrozen: false,
    hodFrozen: false,
    adminFrozen: true,
  } as any);
  const hodLock = resolveFreezeState({
    facultyFrozen: false,
    hodFrozen: true,
    adminFrozen: false,
  } as any);

  it("blocks faculty unfreeze with explicit message", () => {
    expect(() =>
      assertCanManageFreezeWindow("faculty", hodLock, "unfreeze")
    ).toThrow("Forbidden: faculty cannot unfreeze attendance");
  });

  it("blocks HOD unfreeze when admin locked", () => {
    expect(() =>
      assertCanManageFreezeWindow("department", adminLock, "unfreeze")
    ).toThrow("Forbidden: locked by admin");
  });
});
