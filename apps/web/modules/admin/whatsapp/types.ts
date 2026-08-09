import type { BaseResponse } from "@webcampus/types/api";

export type MessageCategory =
  | "CIE"
  | "BALANCE_FEE"
  | "ANNUAL_FEE"
  | "PARENT_TEACHER_MEETING";

export type MessageRecipientType = "STUDENT" | "PARENT";
export type MessageScope = "STUDENT" | "PARENT" | "BOTH";
export type MessageFieldSource =
  | "STUDENT_NAME"
  | "USN"
  | "DEPARTMENT"
  | "SECTION"
  | "SEMESTER"
  | "ACADEMIC_YEAR"
  | "SUBJECT_CODE"
  | "SUBJECT_NAME"
  | "CIE_MARKS"
  | "CIE_MAX"
  | "FEE_DEMAND"
  | "AMOUNT_PAID"
  | "BALANCE"
  | "FEE_AMOUNT"
  | "DEADLINE"
  | "PTM_DATE"
  | "PTM_TIME"
  | "PTM_VENUE";

export type TemplateVariable = {
  id: string;
  position: number;
  label: string;
  fieldSource: MessageFieldSource;
};

export type MessageTemplate = {
  id: string;
  name: string;
  category: MessageCategory;
  recipientType: MessageRecipientType;
  externalTemplateId: string;
  messageBody: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  variables: TemplateVariable[];
};

export type TemplateVariableInput = {
  position: number;
  label: string;
  fieldSource: MessageFieldSource;
};

export type TemplateFormValues = {
  name: string;
  category: MessageCategory;
  recipientType: MessageRecipientType;
  externalTemplateId: string;
  messageBody: string;
  isActive: boolean;
  variables: TemplateVariableInput[];
};

export type FieldSourceOption = {
  value: MessageFieldSource;
  label: string;
};

export type CourseOption = {
  id: string;
  code: string;
  name: string;
};

export type PreviewRecipient = {
  studentId: string;
  usn: string;
  studentName: string;
  departmentName: string;
  sectionName: string;
  courseId?: string;
  courseCode?: string;
  courseName?: string;
  recipientType: MessageRecipientType;
  to: string;
  templateId: string;
  templateName: string;
  templateMessageBody: string;
  bodyvar: string[];
  messageText: string;
};

export type PreviewResult = {
  category: MessageCategory;
  scope: MessageScope;
  studentTemplate: {
    id: string;
    name: string;
    category: MessageCategory;
    recipientType: MessageRecipientType;
  } | null;
  parentTemplate: {
    id: string;
    name: string;
    category: MessageCategory;
    recipientType: MessageRecipientType;
  } | null;
  recipients: PreviewRecipient[];
  totalCount: number;
  skippedCount: number;
};

export type SendConfig = {
  academicTermId?: string;
  departmentId?: string;
  semesterId?: string;
  sectionIds?: string[];
  scope: MessageScope;
  studentTemplateId?: string;
  parentTemplateId?: string;
  cieNumber?: number;
  subjectIds?: string[];
  studentIds?: string[];
  adHocData?: {
    deadline?: string;
    ptmDate?: string;
    ptmTime?: string;
    ptmVenu?: string;
  };
};

export type SendResult = {
  campaignId: string;
  total: number;
  success: number;
  failure: number;
  skipped: number;
};

export type Campaign = {
  id: string;
  channel: "WHATSAPP";
  category: MessageCategory;
  scope: MessageScope;
  cieNumber: number | null;
  filterSnapshot: Record<string, unknown>;
  adHocData: Record<string, string> | null;
  studentTemplateId: string | null;
  parentTemplateId: string | null;
  sentById: string;
  totalReceivers: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  providerResponse: unknown;
  createdAt: string;
  studentTemplate: { name: string } | null;
  parentTemplate: { name: string } | null;
};

export type ReceiptStatus = "SUCCESS" | "FAILURE" | "SKIPPED";

export type Receipt = {
  id: string;
  campaignId: string;
  studentId: string;
  courseId: string | null;
  recipientType: MessageRecipientType;
  to: string;
  templateId: string | null;
  bodyvar: string[];
  status: ReceiptStatus;
  errorMessage: string | null;
  createdAt: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type ApiEnvelope<T> = BaseResponse<T>;
