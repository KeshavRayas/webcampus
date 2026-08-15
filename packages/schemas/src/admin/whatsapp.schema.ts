import { z } from "zod";

export const MESSAGE_CHANNELS = ["WHATSAPP", "SMS"] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export const MESSAGE_CATEGORIES = [
  "CIE",
  "BALANCE_FEE",
  "ANNUAL_FEE",
  "PARENT_TEACHER_MEETING",
] as const;
export type MessageCategory = (typeof MESSAGE_CATEGORIES)[number];

export const MESSAGE_RECIPIENT_TYPES = ["STUDENT", "PARENT"] as const;
export type MessageRecipientType = (typeof MESSAGE_RECIPIENT_TYPES)[number];

export const MESSAGE_SCOPES = ["STUDENT", "PARENT", "BOTH"] as const;
export type MessageScope = (typeof MESSAGE_SCOPES)[number];

export const MAX_MARKS_SOURCES = [
  "ASSESSMENT",
  "THEORY",
  "LAB",
  "AAT",
  "CIE",
] as const;
export type MaxMarksSource = (typeof MAX_MARKS_SOURCES)[number];

export const MESSAGE_FIELD_SOURCES = [
  "STUDENT_NAME",
  "USN",
  "DEPARTMENT",
  "SECTION",
  "SEMESTER",
  "ACADEMIC_YEAR",
  "SUBJECT_CODE",
  "SUBJECT_NAME",
  "CIE_MARKS",
  "CIE_MAX",
  "CIE_NUMBER",
  "CIE_MARKS_DETAILS",
  "FEE_DEMAND",
  "AMOUNT_PAID",
  "BALANCE",
  "FEE_AMOUNT",
  "DEADLINE",
  "PTM_DATE",
  "PTM_TIME",
  "PTM_VENUE",
] as const;
export type MessageFieldSource = (typeof MESSAGE_FIELD_SOURCES)[number];

export const RECEIPT_STATUSES = ["SUCCESS", "FAILURE", "SKIPPED"] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

export const MessageCategorySchema = z.enum(MESSAGE_CATEGORIES);
export const MessageChannelSchema = z.enum(MESSAGE_CHANNELS);
export const MessageRecipientTypeSchema = z.enum(MESSAGE_RECIPIENT_TYPES);
export const MessageScopeSchema = z.enum(MESSAGE_SCOPES);
export const MessageFieldSourceSchema = z.enum(MESSAGE_FIELD_SOURCES);
export const ReceiptStatusSchema = z.enum(RECEIPT_STATUSES);
export const MaxMarksSourceSchema = z.enum(MAX_MARKS_SOURCES);

export const MessageTemplateVariableSchema = z.object({
  position: z.number().int().min(1),
  label: z.string().trim().min(1).max(80),
  fieldSource: MessageFieldSourceSchema,
});
export type MessageTemplateVariableInput = z.infer<
  typeof MessageTemplateVariableSchema
>;

export const CreateMessageTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: MessageCategorySchema,
  recipientType: MessageRecipientTypeSchema,
  externalTemplateId: z.string().trim().min(1).max(160),
  smsTemplateId: z.string().trim().max(160).optional().default(""),
  messageBody: z.string().trim().min(1).max(4000),
  isActive: z.boolean().optional().default(true),
  variables: z
    .array(MessageTemplateVariableSchema)
    .min(1)
    .max(30)
    .refine(
      (vars) => new Set(vars.map((v) => v.position)).size === vars.length,
      { message: "Variable positions must be unique" }
    ),
});
export type CreateMessageTemplateType = z.infer<
  typeof CreateMessageTemplateSchema
>;

export const UpdateMessageTemplateSchema = CreateMessageTemplateSchema.partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateMessageTemplateType = z.infer<
  typeof UpdateMessageTemplateSchema
>;

export const MessageTemplateResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: MessageCategorySchema,
  recipientType: MessageRecipientTypeSchema,
  externalTemplateId: z.string(),
  smsTemplateId: z.string().nullable().optional(),
  messageBody: z.string(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  variables: z.array(
    z.object({
      id: z.string(),
      position: z.number(),
      label: z.string(),
      fieldSource: MessageFieldSourceSchema,
    })
  ),
});
export type MessageTemplateResponseType = z.infer<
  typeof MessageTemplateResponseSchema
>;

export const MessageTemplateQuerySchema = z.object({
  category: MessageCategorySchema.optional(),
  recipientType: MessageRecipientTypeSchema.optional(),
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

const optionalQueryString = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, schema.optional());

const optionalUuidList = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}, z.array(z.string().uuid()).optional());

export const SendConfigSchema = z.object({
  channel: MessageChannelSchema.optional().default("WHATSAPP"),
  academicTermId: optionalQueryString(z.string().uuid()),
  departmentId: optionalQueryString(z.string().uuid()),
  semesterId: optionalQueryString(z.string().uuid()),
  sectionIds: optionalUuidList,
  scope: MessageScopeSchema,
  studentTemplateId: optionalQueryString(z.string().uuid()),
  parentTemplateId: optionalQueryString(z.string().uuid()),
  cieNumber: z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === "")
        return undefined;
      return Number(value);
    },
    z.union([z.literal(1), z.literal(2), z.literal(3)]).optional()
  ),
  maxMarksSource: MaxMarksSourceSchema.optional().default("ASSESSMENT"),
  subjectIds: optionalUuidList,
  studentIds: optionalUuidList,
  adHocData: z
    .object({
      deadline: z.string().trim().max(120).optional(),
      ptmDate: z.string().trim().max(120).optional(),
      ptmTime: z.string().trim().max(120).optional(),
      ptmVenu: z.string().trim().max(120).optional(),
    })
    .optional(),
});
export type SendConfigType = z.infer<typeof SendConfigSchema>;

export const CampaignListQuerySchema = z.object({
  page: z.preprocess((v) => Number(v ?? 1), z.number().int().min(1).default(1)),
  limit: z.preprocess(
    (v) => Number(v ?? 10),
    z.number().int().min(1).max(100).default(10)
  ),
});

export const CampaignReceiptQuerySchema = z.object({
  page: z.preprocess((v) => Number(v ?? 1), z.number().int().min(1).default(1)),
  limit: z.preprocess(
    (v) => Number(v ?? 25),
    z.number().int().min(1).max(200).default(25)
  ),
  status: ReceiptStatusSchema.optional(),
});
