"use client";

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import type { BaseResponse } from "@webcampus/types/api";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import { Loader2 } from "lucide-react";
import Link from "next/link";

export type ProjectListItem = {
  id: string;
  code: string;
  name: string;
  projectGroupingScope: "WITHIN_SECTION" | "DEPARTMENT_WIDE";
  numberOfGroups: number;
  studentsPerGroup: number;
  registeredCount: number;
  facultyMappedCount: number;
  facultyMappingComplete: boolean;
  electiveMappingComplete: boolean;
  electiveMappingVersion: number;
};

const getProjectMappingColumns = (
  basePath: "/department" | "/admin",
  departmentId?: string
): ColumnDef<ProjectListItem>[] => [
  {
    accessorKey: "code",
    header: "Code",
    cell: ({ row }) => <span className="font-medium">{row.original.code}</span>,
  },
  { accessorKey: "name", header: "Name" },
  {
    accessorKey: "numberOfGroups",
    header: "Groups",
  },
  {
    accessorKey: "studentsPerGroup",
    header: "Students / Group",
  },
  {
    accessorKey: "registeredCount",
    header: "Registered",
  },
  {
    accessorKey: "facultyMappedCount",
    header: "Faculty Mapping",
    cell: ({ row }) => {
      const item = row.original;
      return (
        <Badge variant={item.facultyMappingComplete ? "default" : "outline"}>
          {item.facultyMappedCount} / {item.numberOfGroups}
        </Badge>
      );
    },
  },
  {
    accessorKey: "electiveMappingComplete",
    header: "Groups",
    cell: ({ row }) => {
      const item = row.original;
      return (
        <Badge variant={item.electiveMappingComplete ? "default" : "outline"}>
          {item.electiveMappingComplete ? "Complete" : "Incomplete"}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    header: "Action",
    cell: ({ row }) => (
      <Button asChild size="sm" variant="outline">
        <Link
          href={
            departmentId
              ? `${basePath}/project-mapping/${row.original.id}?departmentId=${departmentId}`
              : `${basePath}/project-mapping/${row.original.id}`
          }
        >
          Open
        </Link>
      </Button>
    ),
  },
];

export function ProjectMappingListView({
  basePath,
  departmentId,
  semesterId,
}: {
  basePath: "/department" | "/admin";
  departmentId?: string;
  semesterId: string;
}) {
  const apiBase = `${basePath}/project-mapping`;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["project-mapping-list", basePath, semesterId, departmentId],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<ProjectListItem[]>>(
        apiBase,
        {
          params: { semesterId, departmentId },
        }
      );
      return res.data.status === "success" ? (res.data.data ?? []) : [];
    },
    enabled:
      Boolean(semesterId) &&
      (basePath === "/department" || Boolean(departmentId)),
  });

  const rows = data ?? [];

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Project / Mini-Project</h2>
        <p className="text-muted-foreground text-sm">
          Configure and map project groups to faculty.
        </p>
      </header>

      {isLoading ? (
        <Loader2 className="text-muted-foreground m-12 size-6 animate-spin" />
      ) : isError ? (
        <p className="text-muted-foreground text-sm">
          Failed to load project courses.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No Project / Mini-Project courses found for this semester.
        </p>
      ) : (
        <DataTable
          columns={getProjectMappingColumns(basePath, departmentId)}
          data={rows}
        />
      )}
    </section>
  );
}
