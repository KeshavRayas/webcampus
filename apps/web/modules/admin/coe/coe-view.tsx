"use client";

import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { frontendEnv } from "@webcampus/common/env";
import { DataTable } from "@webcampus/ui/components/data-table";
import axios from "axios";
import { CoeActions } from "./coe-actions";
import { CoeForm } from "./coe-form";
import { CoeUser } from "./coe-types";

export const CoeView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const { data: coes, isLoading } = useQuery<CoeUser[]>({
    queryKey: ["admin-coes"],
    queryFn: async () => {
      const res = await axios.get(`${NEXT_PUBLIC_API_BASE_URL}/admin/coe`, {
        withCredentials: true,
      });
      return res.data.data;
    },
  });

  const columns: ColumnDef<CoeUser>[] = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "username",
      header: "Username",
      cell: ({ row }) => row.original.username || "-",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      id: "actions",
      cell: ({ row }) => <CoeActions user={row.original} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">COE Users</h2>
          <p className="text-muted-foreground text-sm">
            Manage COE users and their system access.
          </p>
        </div>
        <CoeForm />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground p-8 text-center text-sm">
          Loading COE users...
        </div>
      ) : coes && coes.length > 0 ? (
        <DataTable columns={columns} data={coes} />
      ) : (
        <div className="text-muted-foreground rounded-lg border p-12 text-center text-sm">
          No COE users found. Create one to get started.
        </div>
      )}
    </div>
  );
};
