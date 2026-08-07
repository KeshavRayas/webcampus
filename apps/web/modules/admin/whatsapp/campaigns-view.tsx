"use client";

import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { Card, CardContent } from "@webcampus/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { ChevronLeft, ChevronRight, Eye, Loader2 } from "lucide-react";
import { useState } from "react";
import { CampaignDetail } from "./campaign-detail";
import { CATEGORY_LABELS } from "./template-form";
import { useCampaigns } from "./use-campaigns";

const PAGE_SIZE = 10;

const categoryBadge: Record<string, string> = {
  CIE: "bg-blue-500 text-white dark:bg-blue-500/20 dark:text-blue-400",
  BALANCE_FEE:
    "bg-amber-500 text-white dark:bg-amber-500/20 dark:text-amber-400",
  ANNUAL_FEE:
    "bg-orange-500 text-white dark:bg-orange-500/20 dark:text-orange-400",
  PARENT_TEACHER_MEETING:
    "bg-purple-500 text-white dark:bg-purple-500/20 dark:text-purple-400",
};

export const CampaignsView = () => {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data, isLoading } = useCampaigns(page, PAGE_SIZE);

  const campaigns = data?.items ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Send Reports</h2>
        <p className="text-muted-foreground text-sm">
          View past WhatsApp campaigns and their per-recipient delivery status.
        </p>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 rounded-lg border p-12 text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading campaigns...
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            No campaigns yet.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Student Template</TableHead>
                <TableHead>Parent Template</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>OK</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Skipped</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(campaign.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={categoryBadge[campaign.category]}
                    >
                      {CATEGORY_LABELS[campaign.category]}
                    </Badge>
                  </TableCell>
                  <TableCell>{campaign.scope}</TableCell>
                  <TableCell className="max-w-40 truncate text-xs">
                    {campaign.studentTemplate?.name ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-40 truncate text-xs">
                    {campaign.parentTemplate?.name ?? "—"}
                  </TableCell>
                  <TableCell>{campaign.totalReceivers}</TableCell>
                  <TableCell className="text-emerald-500">
                    {campaign.successCount}
                  </TableCell>
                  <TableCell className="text-red-500">
                    {campaign.failureCount}
                  </TableCell>
                  <TableCell className="text-amber-500">
                    {campaign.skippedCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="View report"
                      onClick={() => {
                        setSelectedId(campaign.id);
                        setDetailOpen(true);
                      }}
                    >
                      <Eye className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} (
            {pagination.total} campaigns)
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

      <CampaignDetail
        id={selectedId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
};
