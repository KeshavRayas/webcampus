"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@webcampus/ui/components/badge";
import { AdminFacultyActions } from "./admin-faculty-actions";

export type AdminFacultyResponse = {
  id: string;
  userId: string;
  departmentId: string;
  shortName: string;
  designation: string;
  user: {
    name: string;
    email: string;
    username?: string | null;
    displayUsername?: string | null;
  };
  hod?: { id: string } | null;
};

export const AdminFacultyColumns: ColumnDef<AdminFacultyResponse>[] = [
  {
    accessorKey: "user.name",
    header: "Name",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        {row.original.user?.name}
        {row.original.hod && (
          <Badge variant="secondary" className="h-5 py-0 text-xs">
            HOD
          </Badge>
        )}
      </div>
    ),
  },
  {
    accessorKey: "user.email",
    header: "Email",
    cell: ({ row }) => <div>{row.original.user?.email}</div>,
  },
  {
    accessorKey: "user.username",
    header: "Username",
    cell: ({ row }) => <div>{row.original.user?.username || "-"}</div>,
  },
  {
    accessorKey: "user.displayUsername",
    header: "Display Username",
    cell: ({ row }) => <div>{row.original.user?.displayUsername || "-"}</div>,
  },
  {
    accessorKey: "shortName",
    header: "Short Name",
  },
  {
    accessorKey: "designation",
    header: "Designation",
    cell: ({ row }) => {
      const formatted = row.original.designation
        .split("_")
        .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
        .join(" ");
      return <div>{formatted}</div>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <AdminFacultyActions faculty={row.original} />,
  },
];
