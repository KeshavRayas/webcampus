"use client";

import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { BaseResponse } from "@webcampus/types/api";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import { Loader2 } from "lucide-react";
import Link from "next/link";

type PeListItem = {
  courseId: string;
  code: string;
  name: string;
  registeredCount: number;
  capacity: number;
  seatsLeft: number;
  facultyMappingComplete: boolean;
  electiveMappingComplete: boolean;
};

type ElectiveMappingListViewProps = {
  basePath: "/department" | "/admin";
  departmentId?: string;
  semesterId: string;
};

const getElectiveMappingColumns = (
  basePath: "/department" | "/admin",
  departmentId?: string
): ColumnDef<PeListItem>[] => [
  {
    accessorKey: "code",
    header: "Code",
    cell: ({ row }) => <div className="font-medium">{row.original.code}</div>,
  },
  { accessorKey: "name", header: "Name" },
  {
    accessorKey: "registeredCount",
    header: "Registered / Capacity",
    cell: ({ row }) => (
      <div>
        {row.original.registeredCount} / {row.original.capacity}
        <span className="text-muted-foreground ml-2 text-xs">
          ({row.original.seatsLeft} left)
        </span>
      </div>
    ),
  },
  {
    id: "faculty",
    header: "Faculty",
    cell: ({ row }) => (
      <Badge
        variant={row.original.facultyMappingComplete ? "default" : "outline"}
      >
        {row.original.facultyMappingComplete ? "Complete" : "Incomplete"}
      </Badge>
    ),
  },
  {
    id: "elective",
    header: "Elective",
    cell: ({ row }) => (
      <Badge
        variant={row.original.electiveMappingComplete ? "default" : "outline"}
      >
        {row.original.electiveMappingComplete ? "Complete" : "Incomplete"}
      </Badge>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <div className="text-right">
        <Button asChild size="sm" variant="outline">
          <Link
            href={
              departmentId
                ? `${basePath}/elective-mapping/${row.original.courseId}?departmentId=${departmentId}`
                : `${basePath}/elective-mapping/${row.original.courseId}`
            }
          >
            Open
          </Link>
        </Button>
      </div>
    ),
  },
];

export const ElectiveMappingListView = ({
  basePath,
  departmentId,
  semesterId,
}: ElectiveMappingListViewProps) => {
  const apiBase = `${basePath}/elective-mapping`;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["elective-mapping-list", basePath, semesterId, departmentId],
    queryFn: async () => {
      const res = await apiClient.get<BaseResponse<PeListItem[]>>(apiBase, {
        params: { semesterId, departmentId },
      });
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
        <h2 className="text-xl font-semibold">Elective Mapping</h2>
        <p className="text-muted-foreground text-sm">
          Assign registered PE students into elective batches after
          registration.
        </p>
      </header>

      {isLoading ? (
        <div className="text-muted-foreground flex items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin" />
        </div>
      ) : isError ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          Failed to load PE courses.
        </div>
      ) : rows.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          No PE courses found for this semester.
        </div>
      ) : (
        <DataTable
          columns={getElectiveMappingColumns(basePath, departmentId)}
          data={rows}
        />
      )}
    </section>
  );
};
