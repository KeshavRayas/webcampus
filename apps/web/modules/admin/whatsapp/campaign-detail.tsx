"use client";

import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { CATEGORY_LABELS, RECIPIENT_LABELS } from "./template-form";
import type { ReceiptStatus } from "./types";
import { useCampaignDetail } from "./use-campaigns";

const statusBadge: Record<ReceiptStatus, string> = {
  SUCCESS:
    "bg-emerald-500 text-white dark:bg-emerald-500/20 dark:text-emerald-400",
  FAILURE: "bg-red-500 text-white dark:bg-red-500/20 dark:text-red-400",
  SKIPPED: "bg-amber-500 text-white dark:bg-amber-500/20 dark:text-amber-400",
};

const PAGE_SIZE = 25;

export const CampaignDetail = ({
  id,
  open,
  onOpenChange,
}: {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ReceiptStatus | "ALL">("ALL");

  const { data, isLoading } = useCampaignDetail(
    id,
    page,
    PAGE_SIZE,
    status === "ALL" ? undefined : status
  );

  const campaign = data?.campaign;
  const receipts = data?.receipts ?? [];
  const pagination = data?.pagination;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Campaign Report</DialogTitle>
          <DialogDescription>
            {campaign ? (
              <>
                {CATEGORY_LABELS[campaign.category]} &middot; scope:{" "}
                {campaign.scope} &middot; {campaign.createdAt}
              </>
            ) : (
              "Campaign details"
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
            <Loader2 className="size-4 animate-spin" /> Loading...
          </div>
        ) : campaign ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">Total</p>
                <p className="text-lg font-semibold">
                  {campaign.totalReceivers}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-500/30 p-3">
                <p className="text-muted-foreground text-xs">Success</p>
                <p className="text-lg font-semibold text-emerald-500">
                  {campaign.successCount}
                </p>
              </div>
              <div className="rounded-lg border border-red-500/30 p-3">
                <p className="text-muted-foreground text-xs">Failed</p>
                <p className="text-lg font-semibold text-red-500">
                  {campaign.failureCount}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">Skipped</p>
                <p className="text-lg font-semibold">{campaign.skippedCount}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">CIE</p>
                <p className="text-lg font-semibold">
                  {campaign.cieNumber ? `CIE ${campaign.cieNumber}` : "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                Templates: {campaign.studentTemplate?.name ?? "—"}
                {campaign.parentTemplate
                  ? ` + ${campaign.parentTemplate.name}`
                  : ""}
              </p>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value as ReceiptStatus | "ALL");
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="SUCCESS">Success</SelectItem>
                  <SelectItem value="FAILURE">Failed</SelectItem>
                  <SelectItem value="SKIPPED">Skipped</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Body Variables</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((receipt) => (
                    <TableRow key={receipt.id}>
                      <TableCell className="font-mono text-xs">
                        {receipt.studentId.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        {RECIPIENT_LABELS[receipt.recipientType]}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {receipt.to}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-48 truncate text-xs">
                        {Array.isArray(receipt.bodyvar)
                          ? receipt.bodyvar.join(" | ")
                          : JSON.stringify(receipt.bodyvar)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusBadge[receipt.status]}
                        >
                          {receipt.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-40 truncate text-xs">
                        {receipt.errorMessage ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {receipts.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-muted-foreground py-8 text-center text-sm"
                      >
                        No receipts for this filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} (
                  {pagination.total} receipts)
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!pagination.hasPreviousPage}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="mr-1 size-4" /> Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!pagination.hasNextPage}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next <ChevronRight className="ml-1 size-4" />
                  </Button>
                </div>
              </div>
            )}

            {campaign.providerResponse != null && (
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium">
                  Provider Response
                </p>
                <pre className="bg-muted max-h-40 overflow-auto rounded-lg border p-3 text-xs">
                  {JSON.stringify(campaign.providerResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Campaign not found.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
