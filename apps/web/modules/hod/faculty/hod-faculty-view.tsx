"use client";

import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import { Input } from "@webcampus/ui/components/input";
import { Page, PageContent, PageHeader } from "@webcampus/ui/components/page";
import axios from "axios";
import { Eye, Loader2, Search } from "lucide-react";
import Link from "next/link";
import React, { useMemo, useState } from "react";

type HodFacultyItem = {
  id: string;
  name: string;
  employeeId: string;
  officialEmail: string;
  designation: string;
};

export const HodFacultyView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: response, isLoading } = useQuery({
    queryKey: ["hod-faculty-list"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<HodFacultyItem[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/hod/faculty`,
        { withCredentials: true }
      );
      return res.data;
    },
  });

  const facultyData =
    response?.status === "success" ? (response.data as HodFacultyItem[]) : [];

  const filteredData = useMemo(() => {
    return facultyData.filter((f) => {
      const term = searchTerm.toLowerCase();
      return (
        f.name.toLowerCase().includes(term) ||
        (f.employeeId || "").toLowerCase().includes(term) ||
        f.officialEmail.toLowerCase().includes(term) ||
        f.designation.toLowerCase().includes(term)
      );
    });
  }, [facultyData, searchTerm]);

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
          <div className="flex items-center space-x-2">
            <div className="relative max-w-sm flex-1">
              <Search className="text-muted-foreground absolute left-2 top-2.5 h-4 w-4" />
              <Input
                placeholder="Search faculty..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          {isLoading ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center p-8">
              <Loader2 className="mb-2 h-8 w-8 animate-spin" />
              <p>Loading faculty list...</p>
            </div>
          ) : (
            <DataTable columns={columns} data={filteredData} />
          )}
        </div>
      </PageContent>
    </Page>
  );
};
