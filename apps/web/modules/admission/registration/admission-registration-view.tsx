"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { DataTable } from "@webcampus/ui/components/data-table";
import { Input } from "@webcampus/ui/components/input";
import { Skeleton } from "@webcampus/ui/components/skeleton";
import axios from "axios";
import React, { useState } from "react";
import {
  AdmissionRecord,
  admissionRegistrationColumns,
} from "./admission-registration-columns";

export function AdmissionRegistrationView() {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const [filter, setFilter] = useState("");

  const response = useQuery({
    queryKey: ["admissions"],
    queryFn: async () => {
      return await axios.get<AdmissionRecord[]>(
        `${NEXT_PUBLIC_API_BASE_URL}/admission`
      );
    },
    select: (data) => data.data,
  });

  if (response.isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!response.data) {
    return <div>No admissions found</div>;
  }

  const filtered = filter
    ? response.data.filter((a) =>
        a.name.toLowerCase().includes(filter.toLowerCase())
      )
    : response.data;

  return (
    <div className="space-y-4">
      <Input
        placeholder="Filter by name..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
      />
      <DataTable columns={admissionRegistrationColumns} data={filtered} />
    </div>
  );
}
