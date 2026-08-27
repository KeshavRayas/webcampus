"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { SuccessResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import { Page, PageContent, PageHeader } from "@webcampus/ui/components/page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
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

  const [programType, setProgramType] = useState<"UG" | "PG">("UG");
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [outcomeType, setOutcomeType] = useState<"PO" | "PEO" | "PSO">("PO");

  const departmentsQuery = useQuery({
    queryKey: ["department"],
    queryFn: async () => {
      return await axios.get<SuccessResponse<{ id: string; name: string }[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/department`,
        { withCredentials: true }
      );
    },
  });

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

  if (response.isLoading || departmentsQuery.isLoading) {
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

  const allOutcomes = response.data?.data?.data ?? [];
  const departments = departmentsQuery.data?.data?.data ?? [];

  const filteredOutcomes = allOutcomes.filter((outcome) => {
    if (outcome.programType !== programType) return false;
    if (outcome.type !== outcomeType) return false;
    if (departmentId === "all") {
      return outcome.departmentId === null;
    }
    return outcome.departmentId === departmentId;
  });

  return (
    <Page>
      <PageHeader title="PO/PEO/PSO Configuration">
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Outcome
        </Button>
      </PageHeader>
      <PageContent>
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="text-muted-foreground mb-1 block text-sm font-medium">
              Program Type
            </label>
            <Select
              value={programType}
              onValueChange={(val: "UG" | "PG") => setProgramType(val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Program Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UG">UG (e.g. B.E)</SelectItem>
                <SelectItem value="PG">PG (e.g. M.Tech)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-sm font-medium">
              Department
            </label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Common (All Departments)</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-sm font-medium">
              Outcome Type
            </label>
            <Select
              value={outcomeType}
              onValueChange={(val: "PO" | "PEO" | "PSO") => setOutcomeType(val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Outcome Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PO">PO</SelectItem>
                <SelectItem value="PEO">PEO</SelectItem>
                <SelectItem value="PSO">PSO</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DataTable
          columns={adminProgrammeOutcomeColumns}
          data={filteredOutcomes}
        />
      </PageContent>
      <ProgrammeOutcomeDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        defaultProgramType={programType}
        defaultDepartmentId={departmentId === "all" ? "" : departmentId}
        defaultType={outcomeType}
      />
    </Page>
  );
};
