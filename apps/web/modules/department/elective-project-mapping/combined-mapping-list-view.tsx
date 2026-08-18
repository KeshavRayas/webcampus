"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { frontendEnv } from "@webcampus/common/env";
import type { BaseResponse } from "@webcampus/types/api";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import axios from "axios";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

export type PeListItem = {
  courseId: string;
  code: string;
  name: string;
  courseType: "PE";
  registeredCount: number;
  capacity: number;
  seatsLeft: number;
  facultyMappingComplete: boolean;
  electiveMappingComplete: boolean;
};

export type ProjectListItem = {
  id: string;
  code: string;
  name: string;
  courseType: "PW";
  projectGroupingScope: "WITHIN_SECTION" | "DEPARTMENT_WIDE";
  numberOfGroups: number;
  studentsPerGroup: number;
  registeredCount: number;
  electiveAssignedCount: number;
  facultyMappedCount: number;
  facultyMappingComplete: boolean;
  electiveMappingComplete: boolean;
};

export type CombinedMappingRow = PeListItem | ProjectListItem;

type CombinedMappingListViewProps = {
  basePath: "/department" | "/admin";
  departmentId?: string;
  semesterId: string;
};

const scopeLabel = (scope: ProjectListItem["projectGroupingScope"]) =>
  scope === "DEPARTMENT_WIDE" ? "Dept-wide" : "Within Section";

const getCombinedMappingColumns = (
  basePath: "/department" | "/admin",
  departmentId?: string
): ColumnDef<CombinedMappingRow>[] => {
  const openHref = (row: CombinedMappingRow) => {
    const courseId = row.courseType === "PE" ? row.courseId : row.id;
    const route =
      row.courseType === "PE" ? "elective-mapping" : "project-mapping";
    return departmentId
      ? `${basePath}/${route}/${courseId}?departmentId=${departmentId}`
      : `${basePath}/${route}/${courseId}`;
  };

  return [
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => <div className="font-medium">{row.original.code}</div>,
    },
    { accessorKey: "name", header: "Name" },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => (
        <Badge
          variant={row.original.courseType === "PE" ? "secondary" : "default"}
        >
          {row.original.courseType}
        </Badge>
      ),
    },
    {
      id: "scope",
      header: "Scope",
      cell: ({ row }) =>
        row.original.courseType === "PW"
          ? scopeLabel(row.original.projectGroupingScope)
          : "—",
    },
    {
      id: "groups",
      header: "Groups / Capacity",
      cell: ({ row }) =>
        row.original.courseType === "PW"
          ? row.original.numberOfGroups
          : row.original.capacity,
    },
    {
      id: "registered",
      header: "Registered",
      cell: ({ row }) =>
        row.original.courseType === "PE" ? (
          <div>
            {row.original.registeredCount}
            <span className="text-muted-foreground ml-2 text-xs">
              ({row.original.seatsLeft} left)
            </span>
          </div>
        ) : (
          row.original.registeredCount
        ),
    },
    {
      id: "studentMapping",
      header: "Student Mapping",
      cell: ({ row }) => {
        const item = row.original;
        if (item.courseType === "PW") {
          const pct =
            item.registeredCount > 0
              ? Math.round(
                  (item.electiveAssignedCount / item.registeredCount) * 100
                )
              : null;
          return (
            <div>
              <Badge
                variant={item.electiveMappingComplete ? "default" : "outline"}
              >
                {item.electiveMappingComplete ? "Complete" : "Incomplete"}
              </Badge>
              {pct !== null && (
                <span className="text-muted-foreground ml-2 text-xs">
                  {pct}%
                </span>
              )}
            </div>
          );
        }
        return (
          <Badge variant={item.electiveMappingComplete ? "default" : "outline"}>
            {item.electiveMappingComplete ? "Complete" : "Incomplete"}
          </Badge>
        );
      },
    },
    {
      id: "facultyMapping",
      header: "Faculty Mapping",
      cell: ({ row }) => {
        const item = row.original;
        if (item.courseType === "PW") {
          return (
            <Badge
              variant={item.facultyMappingComplete ? "default" : "outline"}
            >
              {item.facultyMappedCount} / {item.numberOfGroups}
            </Badge>
          );
        }
        return (
          <Badge variant={item.facultyMappingComplete ? "default" : "outline"}>
            {item.facultyMappingComplete ? "Complete" : "Incomplete"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="text-right">
          <Button asChild size="sm" variant="outline">
            <Link href={openHref(row.original)}>Open</Link>
          </Button>
        </div>
      ),
    },
  ];
};

export function CombinedMappingListView({
  basePath,
  departmentId,
  semesterId,
}: CombinedMappingListViewProps) {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const enabled =
    Boolean(semesterId) &&
    (basePath === "/department" || Boolean(departmentId));

  const peQuery = useQuery({
    queryKey: ["elective-mapping-list", basePath, semesterId, departmentId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<PeListItem[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}${basePath}/elective-mapping`,
        { params: { semesterId, departmentId }, withCredentials: true }
      );
      return res.data.status === "success" ? (res.data.data ?? []) : [];
    },
    enabled,
  });

  const pwQuery = useQuery({
    queryKey: ["project-mapping-list", basePath, semesterId, departmentId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<ProjectListItem[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}${basePath}/project-mapping`,
        { params: { semesterId, departmentId }, withCredentials: true }
      );
      return res.data.status === "success" ? (res.data.data ?? []) : [];
    },
    enabled,
  });

  const isLoading = peQuery.isLoading || pwQuery.isLoading;
  const isError = peQuery.isError || pwQuery.isError;

  const rows = useMemo<CombinedMappingRow[]>(
    () =>
      [...(peQuery.data ?? []), ...(pwQuery.data ?? [])].sort((a, b) =>
        a.code.localeCompare(b.code)
      ),
    [peQuery.data, pwQuery.data]
  );

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Elective / Project Mapping</h2>
        <p className="text-muted-foreground text-sm">
          Assign registered PE and Project / Mini-Project students after
          registration. Initial group-to-faculty mapping is done in Course
          Mapping.
        </p>
      </header>

      {isLoading ? (
        <div className="text-muted-foreground flex items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin" />
        </div>
      ) : isError ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          Failed to load mapping courses.
        </div>
      ) : rows.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          No PE or Project / Mini-Project courses found for this semester.
        </div>
      ) : (
        <DataTable
          columns={getCombinedMappingColumns(basePath, departmentId)}
          data={rows}
        />
      )}
    </section>
  );
}
