"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { SuccessResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import { Page, PageContent, PageHeader } from "@webcampus/ui/components/page";
import { Skeleton } from "@webcampus/ui/components/skeleton";
import axios from "axios";
import { Plus } from "lucide-react";
import React, { useState } from "react";
import { adminProgrammeOutcomeColumns } from "./admin-programme-outcomes-columns";
import { ProgrammeOutcomeDialog } from "./programme-outcome-dialog";
import { ProgrammeOutcomeTableItem } from "./types";

export const AdminProgrammeOutcomesView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const response = useQuery({
    queryKey: ["programme-outcomes"],
    queryFn: async () => {
      return await axios.get<SuccessResponse<ProgrammeOutcomeTableItem[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/programme-outcomes`,
        {
          withCredentials: true,
        }
      );
    },
  });

  if (response.isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const outcomes = response.data?.data?.data ?? [];

  return (
    <Page>
      <PageHeader title="Programme Outcomes">
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Outcome
        </Button>
      </PageHeader>
      <PageContent>
        <DataTable columns={adminProgrammeOutcomeColumns} data={outcomes} />
      </PageContent>
      <ProgrammeOutcomeDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </Page>
  );
};
