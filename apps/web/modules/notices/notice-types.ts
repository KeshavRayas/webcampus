export type Notice = {
  id: string;
  title: string;
  content: string;
  audience: "STUDENTS" | "FACULTY" | "BOTH";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
};
export type NoticeInput = {
  title: string;
  content: string;
  audience: Notice["audience"];
  priority: Notice["priority"];
  status?: "DRAFT" | "PUBLISHED";
  expiresAt?: string | null;
};
