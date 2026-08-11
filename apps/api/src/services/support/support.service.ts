import { randomUUID } from "crypto";
import { db, Prisma } from "@webcampus/db";
import type {
  CreateSupportMessageInput,
  CreateSupportTicketInput,
  UpdateSupportTicketStatusInput,
} from "@webcampus/schemas/support";
import type { Role } from "@webcampus/types/rbac";
import {
  createSignedDownloadUrl,
  generateFileName,
  uploadBufferToS3,
} from "../../utils/s3";
import {
  assertCanReadTicket,
  assertCanReplyToTicket,
  assertValidStatusTransition,
  isSupportAdmin,
} from "./support.authorization";

const supportTicketInclude = {
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: {
      author: { select: { id: true, name: true, email: true, role: true } },
      attachments: true,
    },
  },
} satisfies Prisma.SupportTicketInclude;

async function nextTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SUP-${year}-`;
  const latest = await db.supportTicket.findFirst({
    where: { ticketNumber: { startsWith: prefix } },
    orderBy: { ticketNumber: "desc" },
    select: { ticketNumber: true },
  });
  const sequence = latest ? Number(latest.ticketNumber.slice(-6)) + 1 : 1;
  return `${prefix}${String(sequence).padStart(6, "0")}`;
}

export class SupportService {
  static async listTickets(userId: string, role: Role) {
    const tickets = await db.supportTicket.findMany({
      where: isSupportAdmin(role) ? undefined : { createdById: userId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, createdAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return {
      status: "success" as const,
      message: "Tickets fetched successfully",
      data: tickets,
    };
  }

  static async getTicket(ticketId: string, userId: string, role: Role) {
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
      include: supportTicketInclude,
    });
    if (!ticket) throw new Error("Support ticket not found");
    assertCanReadTicket(ticket.createdById, userId, role);
    return {
      status: "success" as const,
      message: "Ticket fetched successfully",
      data: ticket,
    };
  }

  static async getAttachmentDownloadUrl(
    attachmentId: string,
    userId: string,
    role: Role
  ) {
    const attachment = await db.supportTicketAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        fileName: true,
        storageKey: true,
        message: {
          select: {
            ticket: { select: { createdById: true } },
          },
        },
      },
    });
    if (!attachment) throw new Error("Support attachment not found");
    assertCanReadTicket(attachment.message.ticket.createdById, userId, role);

    return {
      status: "success" as const,
      message: "Attachment download URL created successfully",
      data: {
        fileName: attachment.fileName,
        url: await createSignedDownloadUrl(
          attachment.storageKey,
          attachment.fileName
        ),
        expiresIn: 300,
      },
    };
  }

  static async createTicket(
    userId: string,
    input: CreateSupportTicketInput,
    files: Express.Multer.File[]
  ) {
    const ticketNumber = await nextTicketNumber();
    const messageId = randomUUID();
    const ticket = await db.supportTicket.create({
      data: {
        ticketNumber,
        createdById: userId,
        category: input.category,
        priority: input.priority,
        subject: input.subject,
        messages: {
          create: { id: messageId, authorId: userId, body: input.body },
        },
      },
      include: supportTicketInclude,
    });

    if (files.length > 0) {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const fileName = generateFileName(
            file.originalname,
            `support/${ticketNumber}/${messageId}/`
          );
          const result = await uploadBufferToS3(
            file.buffer,
            fileName,
            file.mimetype
          );
          if (!result.success || !result.key) {
            throw new Error("Unable to upload support attachment");
          }
          return {
            fileName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            storageKey: result.key,
          };
        })
      );
      await db.supportTicketAttachment.createMany({
        data: uploaded.map((file) => ({ messageId, ...file })),
      });
    }

    return this.getTicket(ticket.id, userId, "student");
  }

  static async addMessage(
    ticketId: string,
    userId: string,
    role: Role,
    input: CreateSupportMessageInput,
    files: Express.Multer.File[]
  ) {
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, ticketNumber: true, createdById: true, status: true },
    });
    if (!ticket) throw new Error("Support ticket not found");

    assertCanReplyToTicket({
      ticketCreatorId: ticket.createdById,
      userId,
      role,
      status: ticket.status,
    });

    const messageId = randomUUID();
    await db.supportTicketMessage.create({
      data: { id: messageId, ticketId, authorId: userId, body: input.body },
    });

    if (files.length > 0) {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const fileName = generateFileName(
            file.originalname,
            `support/${ticket.ticketNumber}/${messageId}/`
          );
          const result = await uploadBufferToS3(
            file.buffer,
            fileName,
            file.mimetype
          );
          if (!result.success || !result.key) {
            throw new Error("Unable to upload support attachment");
          }
          return {
            fileName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            storageKey: result.key,
          };
        })
      );
      await db.supportTicketAttachment.createMany({
        data: uploaded.map((file) => ({ messageId, ...file })),
      });
    }

    return this.getTicket(ticketId, userId, role);
  }

  static async updateStatus(
    ticketId: string,
    input: UpdateSupportTicketStatusInput
  ) {
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true },
    });
    if (!ticket) throw new Error("Support ticket not found");

    assertValidStatusTransition(ticket.status, input.status);

    const now = new Date();
    const updated = await db.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: input.status,
        resolvedAt: input.status === "RESOLVED" ? now : undefined,
        closedAt: input.status === "CLOSED" ? now : undefined,
      },
      include: supportTicketInclude,
    });
    return {
      status: "success" as const,
      message: "Ticket status updated successfully",
      data: updated,
    };
  }
}
