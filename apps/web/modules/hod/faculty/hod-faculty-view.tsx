"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import {
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import { Page, PageContent, PageHeader } from "@webcampus/ui/components/page";
import axios from "axios";
import { Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type HodFacultyItem = {
  id: string;
  name: string;
  employeeId: string;
  officialEmail: string;
  designation: string;
};

type FacultyFilters = {
  search: string;
};

const EMPTY_FILTERS: FacultyFilters = { search: "" };

const FACULTY_FILTER_FIELDS: FilterFieldConfig<FacultyFilters>[] = [
  {
    key: "search",
    label: "Search",
    type: "text",
    placeholder: "Name, Employee ID, Email or Designation",
    className: "md:col-span-3",
  },
];

export const HodFacultyView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const [draftFilters, setDraftFilters] =
    useState<FacultyFilters>(EMPTY_FILTERS);
  const [appliedSearch, setAppliedSearch] = useState("");

  const { data: response, isLoading } = useQuery({
    queryKey: ["hod-faculty-list", appliedSearch],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<HodFacultyItem[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/hod/faculty`,
        {
          params: appliedSearch ? { search: appliedSearch } : undefined,
          withCredentials: true,
        }
      );
      return res.data;
    },
  });

  const facultyData =
    response?.status === "success" ? (response.data as HodFacultyItem[]) : [];

  const columns = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "employeeId",
      header: "Employee ID",
    },
    {
      accessorKey: "officialEmail",
      header: "Official Email",
    },
    {
      accessorKey: "designation",
      header: "Designation",
    },
    {
      id: "actions",
      cell: ({ row }: { row: { original: { id: string } } }) => {
        const facultyId = row.original.id;
        return (
          <Link href={`/hod/faculty/${facultyId}`}>
            <Button variant="ghost" size="sm">
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </Button>
          </Link>
        );
      },
    },
  ];

  return (
    <Page>
      <PageHeader title="Department Faculty">
        <p className="text-muted-foreground text-sm">
          View and manage faculty members in your department.
        </p>
      </PageHeader>
      <PageContent>
        <div className="space-y-4">
          <FilterPanel>
            <FilterBuilder<FacultyFilters>
              fields={FACULTY_FILTER_FIELDS}
              draftFilters={draftFilters}
              onDraftChange={(key, value) => {
                setDraftFilters((prev) => ({ ...prev, [key]: value }));

                if (key === "search") {
                  setAppliedSearch(value);
                }
              }}
            />
            <FilterActions
              onApply={() => {
                setAppliedSearch(draftFilters.search);
              }}
              onReset={() => {
                setDraftFilters(EMPTY_FILTERS);
                setAppliedSearch("");
              }}
              applyLabel="Search"
              resetLabel="Reset"
            />
          </FilterPanel>
          {isLoading ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center p-8">
              <Loader2 className="mb-2 h-8 w-8 animate-spin" />
              <p>Loading faculty list...</p>
            </div>
          ) : (
            <DataTable columns={columns} data={facultyData} />
          )}
        </div>
      </PageContent>
    </Page>
  );
};
