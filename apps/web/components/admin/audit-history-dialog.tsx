"use client";

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@webcampus/ui/components/dialog";
import { format } from "date-fns";
import { ArrowRight, History, Loader2 } from "lucide-react";
import { useState } from "react";

interface AuditLogEntry {
  id: string;
  changeGroupId: string;
  entityType: string;
  entityId: string;
  courseId: string | null;
  fieldName: string | null;
  oldValue: unknown;
  newValue: unknown;
  action: string;
  reason: string | null;
  editedAt: string;
  adminUserId: string;
  adminUser: {
    name: string | null;
    username: string | null;
  };
}

interface PaginatedAuditResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface AuditHistoryDialogProps {
  courseId: string;
}

export const AuditHistoryDialog = ({ courseId }: AuditHistoryDialogProps) => {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit-history", courseId, page],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<PaginatedAuditResponse>>(
        `/admin/audit/course/${courseId}`,
        { params: { page, pageSize } }
      );
      if (res.data.status === "success") return res.data.data;
      return null;
    },
    enabled: !!courseId,
  });

  const entries = data?.data ?? [];
  const totalPages = data?.totalPages ?? 0;

  // Group by changeGroupId
  const groupedChanges = entries.reduce(
    (acc, entry) => {
      const group = acc.get(entry.changeGroupId);
      if (group) {
        group.entries.push(entry);
      } else {
        acc.set(entry.changeGroupId, {
          entries: [entry],
          editedAt: entry.editedAt,
          adminName:
            entry.adminUser?.name ||
            entry.adminUser?.username ||
            "Unknown Admin",
          reason: entry.reason,
          action: entry.action,
        });
      }
      return acc;
    },
    new Map<
      string,
      {
        entries: AuditLogEntry[];
        editedAt: string;
        adminName: string;
        reason: string | null;
        action: string;
      }
    >()
  );

  const renderValue = (value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const formatFieldName = (name: string): string => {
    return name
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="mr-2 size-4" />
          View History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-5" />
            Override History
          </DialogTitle>
          <DialogDescription>
            All administrator modifications to this course.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="text-muted-foreground size-8 animate-spin" />
            </div>
          )}

          {isError && !isLoading && (
            <div className="text-muted-foreground py-8 text-center text-sm">
              Failed to load audit history.
            </div>
          )}

          {!isLoading && groupedChanges.size === 0 && (
            <div className="text-muted-foreground py-8 text-center text-sm">
              No override history for this course.
            </div>
          )}

          {Array.from(groupedChanges.entries()).map(
            ([changeGroupId, group]) => (
              <div
                key={changeGroupId}
                className="border-muted rounded-lg border p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{group.adminName}</p>
                    <p className="text-muted-foreground text-xs">
                      {format(new Date(group.editedAt), "dd MMM yyyy, hh:mm a")}
                    </p>
                  </div>
                  <span className="bg-muted rounded-md px-2 py-0.5 text-xs font-medium">
                    {group.action.replace(/_/g, " ")}
                  </span>
                </div>

                {group.reason && (
                  <div className="border-muted mb-3 rounded-md border bg-amber-50 p-2 dark:bg-amber-950">
                    <p className="text-xs font-medium">Reason</p>
                    <p className="text-xs">{group.reason}</p>
                  </div>
                )}

                <div className="space-y-2">
                  {group.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="text-muted-foreground min-w-[120px] text-xs">
                        {entry.fieldName
                          ? formatFieldName(entry.fieldName)
                          : entry.action}
                      </span>
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800 dark:bg-red-900 dark:text-red-200">
                        {renderValue(entry.oldValue)}
                      </span>
                      <ArrowRight className="text-muted-foreground size-3" />
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800 dark:bg-green-900 dark:text-green-200">
                        {renderValue(entry.newValue)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="text-muted-foreground text-xs">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
