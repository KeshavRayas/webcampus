"use client";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@webcampus/ui/components/button";
import { Input } from "@webcampus/ui/components/input";
import { LifeBuoy, Paperclip, Send, Ticket, X } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";

type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type TicketCategory =
  | "ACADEMICS"
  | "ATTENDANCE"
  | "MARKS"
  | "ADMISSIONS"
  | "FINANCE"
  | "TECHNICAL"
  | "OTHER";

type Attachment = {
  id: string;
  fileName: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
};

type Message = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; role?: string | null };
  attachments: Attachment[];
};

type SupportTicket = {
  id: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string; email: string };
  messages: Message[];
};

type ApiResponse<T> = { data: T; message: string };

const categories: { value: TicketCategory; label: string }[] = [
  { value: "ACADEMICS", label: "Academics" },
  { value: "ATTENDANCE", label: "Attendance" },
  { value: "MARKS", label: "Marks" },
  { value: "ADMISSIONS", label: "Admissions" },
  { value: "FINANCE", label: "Finance" },
  { value: "TECHNICAL", label: "Technical" },
  { value: "OTHER", label: "Other" },
];

const statusLabels: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const priorityLabels: Record<TicketPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

const statusStyles: Record<TicketStatus, string> = {
  OPEN: "bg-sky-100 text-sky-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-slate-100 text-slate-600",
};

const priorityStyles: Record<TicketPriority, string> = {
  LOW: "text-slate-500",
  MEDIUM: "text-sky-600",
  HIGH: "text-orange-600",
  URGENT: "text-red-600",
};

async function getTickets() {
  const response =
    await apiClient.get<ApiResponse<SupportTicket[]>>("/support/tickets");
  return response.data.data;
}

async function getTicket(ticketId: string) {
  const response = await apiClient.get<ApiResponse<SupportTicket>>(
    `/support/tickets/${ticketId}`
  );
  return response.data.data;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  if (!attachments.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <button
          key={attachment.id}
          type="button"
          onClick={async () => {
            try {
              const response = await apiClient.get<
                ApiResponse<{ url: string }>
              >(`/support/attachments/${attachment.id}/download`);
              window.open(
                response.data.data.url,
                "_blank",
                "noopener,noreferrer"
              );
            } catch (error) {
              toast.error(
                getApiErrorMessage(error, "Unable to download attachment")
              );
            }
          }}
          className="bg-background/70 flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
        >
          <Paperclip className="size-3.5" />
          <span className="max-w-48 truncate">{attachment.fileName}</span>
          <span className="text-muted-foreground">
            ({Math.ceil(attachment.fileSize / 1024)} KB)
          </span>
        </button>
      ))}
    </div>
  );
}

function FilePicker({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 text-sm font-medium">
        <Paperclip className="size-4" />
        <span>Attach files</span>
        <input
          type="file"
          multiple
          className="sr-only"
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []);
            onChange([...files, ...selected].slice(0, 5));
            event.target.value = "";
          }}
        />
      </label>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <button
              key={`${file.name}-${index}`}
              type="button"
              onClick={() =>
                onChange(files.filter((_, fileIndex) => fileIndex !== index))
              }
              className="bg-muted flex max-w-full items-center gap-1 rounded-full px-3 py-1 text-xs"
            >
              <span className="max-w-48 truncate">{file.name}</span>
              <X className="size-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateTicketForm({
  onCreated,
}: {
  onCreated: (ticket: SupportTicket) => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<TicketCategory>("TECHNICAL");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [files, setFiles] = useState<File[]>([]);

  const mutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("subject", subject);
      formData.append("body", body);
      formData.append("category", category);
      formData.append("priority", priority);
      files.forEach((file) => formData.append("attachments", file));
      const response = await apiClient.post<ApiResponse<SupportTicket>>(
        "/support/tickets",
        formData
      );
      return response.data.data;
    },
    onSuccess: (ticket) => {
      toast.success(`Ticket ${ticket.ticketNumber} created`);
      setSubject("");
      setBody("");
      setFiles([]);
      onCreated(ticket);
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Unable to create ticket")),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="ticket-subject" className="text-sm font-medium">
            Subject
          </label>
          <Input
            id="ticket-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Briefly describe the issue"
            required
            minLength={3}
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="ticket-category" className="text-sm font-medium">
            Category
          </label>
          <select
            id="ticket-category"
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as TicketCategory)
            }
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
          >
            {categories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="ticket-priority" className="text-sm font-medium">
            Priority
          </label>
          <select
            id="ticket-priority"
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as TicketPriority)
            }
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
          >
            {(Object.keys(priorityLabels) as TicketPriority[]).map((item) => (
              <option key={item} value={item}>
                {priorityLabels[item]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="ticket-description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="ticket-description"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Include the details needed to resolve your issue"
          rows={7}
          required
          minLength={10}
          maxLength={10000}
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-20 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1"
        />
      </div>
      <FilePicker files={files} onChange={setFiles} />
      <Button
        type="submit"
        disabled={mutation.isPending}
        className="w-full sm:w-auto"
      >
        <Ticket className="mr-2 size-4" />
        {mutation.isPending ? "Creating..." : "Create ticket"}
      </Button>
    </form>
  );
}

function TicketConversation({
  ticket,
  isAdmin,
  onChanged,
}: {
  ticket: SupportTicket;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const replyMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("body", body);
      files.forEach((file) => formData.append("attachments", file));
      const response = await apiClient.post<ApiResponse<SupportTicket>>(
        `/support/tickets/${ticket.id}/messages`,
        formData
      );
      return response.data.data;
    },
    onSuccess: () => {
      setBody("");
      setFiles([]);
      queryClient.invalidateQueries({
        queryKey: ["support-ticket", ticket.id],
      });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast.success("Reply sent");
      onChanged();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Unable to send reply")),
  });

  const statusMutation = useMutation({
    mutationFn: async (status: TicketStatus) => {
      const response = await apiClient.patch<ApiResponse<SupportTicket>>(
        `/support/tickets/${ticket.id}/status`,
        { status }
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["support-ticket", ticket.id],
      });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast.success("Ticket status updated");
      onChanged();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Unable to update status")),
  });

  const canReply =
    ticket.status === "IN_PROGRESS" || (isAdmin && ticket.status === "OPEN");

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">
              {ticket.ticketNumber}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[ticket.status]}`}
            >
              {statusLabels[ticket.status]}
            </span>
            <span
              className={`text-xs font-semibold ${priorityStyles[ticket.priority]}`}
            >
              {priorityLabels[ticket.priority]} priority
            </span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight">
            {ticket.subject}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {isAdmin && ticket.createdBy
              ? `Created by ${ticket.createdBy.name} · `
              : ""}
            {formatDate(ticket.createdAt)}
          </p>
        </div>
        {isAdmin && (
          <select
            value={ticket.status}
            onChange={(event) =>
              statusMutation.mutate(event.target.value as TicketStatus)
            }
            disabled={statusMutation.isPending}
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
          >
            {(Object.keys(statusLabels) as TicketStatus[]).map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-4">
        {ticket.messages.map((message) => {
          const fromAdmin = message.author.role === "admin";
          return (
            <div
              key={message.id}
              className={`flex ${fromAdmin ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-3xl rounded-2xl border px-4 py-3 ${fromAdmin ? "bg-muted/60" : "bg-primary text-primary-foreground"}`}
              >
                <div className="mb-2 flex items-center justify-between gap-6 text-xs opacity-75">
                  <span className="font-semibold">
                    {fromAdmin ? "Support admin" : message.author.name}
                  </span>
                  <span>{formatDate(message.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6">
                  {message.body}
                </p>
                <AttachmentList attachments={message.attachments} />
              </div>
            </div>
          );
        })}
      </div>

      {canReply ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            replyMutation.mutate();
          }}
          className="space-y-3 border-t pt-5"
        >
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={
              isAdmin
                ? "Write a response to the user"
                : "Reply to the support admin"
            }
            rows={5}
            required
            minLength={1}
            maxLength={10000}
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-20 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <FilePicker files={files} onChange={setFiles} />
            <Button type="submit" disabled={replyMutation.isPending}>
              <Send className="mr-2 size-4" />
              {replyMutation.isPending ? "Sending..." : "Send reply"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="bg-muted/30 text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          {ticket.status === "OPEN"
            ? "An admin will review this ticket and move it to in progress when a conversation is needed."
            : "This ticket is no longer accepting replies. Create a new ticket for another issue."}
        </div>
      )}
    </div>
  );
}

export function SupportView() {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === "admin";
  const queryClient = useQueryClient();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const ticketsQuery = useQuery({
    queryKey: ["support-tickets"],
    queryFn: getTickets,
    enabled: !!session?.user.id,
  });
  const selectedTicketQuery = useQuery({
    queryKey: ["support-ticket", selectedTicketId],
    queryFn: () => getTicket(selectedTicketId as string),
    enabled: !!selectedTicketId,
  });
  const selectedTicket = selectedTicketQuery.data;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-8">
      <div className="bg-card relative overflow-hidden rounded-2xl border p-6 shadow-sm sm:p-8">
        <div className="absolute -right-12 -top-16 size-56 rounded-full bg-sky-100/70 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-primary mb-3 flex items-center gap-2">
              <LifeBuoy className="size-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">
                Raise an issue
              </span>
            </div>
            <h1 className="text-foreground text-3xl font-semibold tracking-tight">
              Need help with something?
            </h1>
            <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-6">
              Raise an issue and follow the conversation with the support admin
              from one place.
            </p>
          </div>
          <Button
            onClick={() => {
              setShowCreate(true);
              setSelectedTicketId(null);
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Ticket className="mr-2 size-4" />
            Raise an issue
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.6fr)]">
        <section className="bg-card rounded-xl border shadow-sm">
          <div className="flex items-center justify-between border-b p-4">
            <div>
              <h2 className="font-semibold">
                {isAdmin ? "All tickets" : "Your tickets"}
              </h2>
              <p className="text-muted-foreground text-xs">
                {ticketsQuery.data?.length ?? 0} total
              </p>
            </div>
            <button
              type="button"
              onClick={() => ticketsQuery.refetch()}
              className="text-primary text-xs font-medium"
            >
              Refresh
            </button>
          </div>
          <div className="max-h-[650px] overflow-y-auto">
            {ticketsQuery.isLoading ? (
              <p className="text-muted-foreground p-6 text-sm">
                Loading tickets...
              </p>
            ) : ticketsQuery.isError ? (
              <p className="text-destructive p-6 text-sm">
                Unable to load tickets.
              </p>
            ) : ticketsQuery.data?.length ? (
              ticketsQuery.data.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => {
                    setSelectedTicketId(ticket.id);
                    setShowCreate(false);
                  }}
                  className={`hover:bg-muted/50 w-full border-b p-4 text-left transition ${selectedTicketId === ticket.id ? "bg-muted" : ""}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold">
                      {ticket.ticketNumber}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusStyles[ticket.status]}`}
                    >
                      {statusLabels[ticket.status]}
                    </span>
                  </div>
                  <p className="truncate text-sm font-medium">
                    {ticket.subject}
                  </p>
                  <p className="text-muted-foreground mt-1 truncate text-xs">
                    {ticket.messages[0]?.body ?? "No messages"}
                  </p>
                  <p className="text-muted-foreground mt-2 text-[11px]">
                    Updated {formatDate(ticket.updatedAt)}
                  </p>
                </button>
              ))
            ) : (
              <div className="p-8 text-center">
                <Ticket className="text-muted-foreground/50 mx-auto mb-3 size-8" />
                <p className="text-sm font-medium">No tickets yet</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Create a ticket when you need help.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="bg-card min-h-[500px] rounded-xl border p-5 shadow-sm sm:p-7">
          {showCreate ? (
            <div>
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Create a new ticket</h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Include enough detail for the admin to investigate the
                    issue.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-2"
                >
                  <X className="size-4" />
                </button>
              </div>
              <CreateTicketForm
                onCreated={(ticket) => {
                  queryClient.invalidateQueries({
                    queryKey: ["support-tickets"],
                  });
                  setShowCreate(false);
                  setSelectedTicketId(ticket.id);
                }}
              />
            </div>
          ) : selectedTicketQuery.isLoading ? (
            <p className="text-muted-foreground py-20 text-center text-sm">
              Loading conversation...
            </p>
          ) : selectedTicketQuery.isError ? (
            <p className="text-destructive py-20 text-center text-sm">
              Unable to load this ticket.
            </p>
          ) : selectedTicket ? (
            <TicketConversation
              ticket={selectedTicket}
              isAdmin={!!isAdmin}
              onChanged={() => selectedTicketQuery.refetch()}
            />
          ) : (
            <div className="flex min-h-[450px] flex-col items-center justify-center text-center">
              <div className="mb-4 rounded-full bg-sky-100 p-4 text-sky-600">
                <LifeBuoy className="size-8" />
              </div>
              <h2 className="text-xl font-semibold">Select a ticket</h2>
              <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-6">
                Choose a ticket from the list to view its conversation, or
                create a new one.
              </p>
              <Button
                onClick={() => setShowCreate(true)}
                variant="outline"
                className="mt-5"
              >
                <Ticket className="mr-2 size-4" />
                Create ticket
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
