import type { Role } from "@webcampus/types/rbac";

export type SupportTicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

const allowedStatusTransitions: Record<
  SupportTicketStatus,
  SupportTicketStatus[]
> = {
  OPEN: ["IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

export function isSupportAdmin(role: Role): boolean {
  return role === "admin";
}

export function assertCanReadTicket(
  ticketCreatorId: string,
  userId: string,
  role: Role
): void {
  if (!isSupportAdmin(role) && ticketCreatorId !== userId) {
    throw new Error("You are not allowed to access this ticket");
  }
}

export function assertCanReplyToTicket(params: {
  ticketCreatorId: string;
  userId: string;
  role: Role;
  status: SupportTicketStatus;
}): void {
  if (isSupportAdmin(params.role)) {
    if (!["OPEN", "IN_PROGRESS"].includes(params.status)) {
      throw new Error("Admins cannot reply to a resolved or closed ticket");
    }
    return;
  }

  if (params.ticketCreatorId !== params.userId) {
    throw new Error("You are not allowed to reply to this ticket");
  }
  if (params.status !== "IN_PROGRESS") {
    throw new Error("Users can reply only while the ticket is in progress");
  }
}

export function assertValidStatusTransition(
  currentStatus: SupportTicketStatus,
  nextStatus: SupportTicketStatus
): void {
  if (!allowedStatusTransitions[currentStatus].includes(nextStatus)) {
    throw new Error(
      `Invalid status transition from ${currentStatus} to ${nextStatus}`
    );
  }
}
