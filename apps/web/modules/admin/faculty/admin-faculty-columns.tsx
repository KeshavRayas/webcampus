"use client";

import { ColumnDef } from "@tanstack/react-table";

// Define a local type for the joined response from our new backend endpoint
export type AdminFacultyResponse = {
  id: string;
  userId: string;
  departmentId: string;
  shortName: string;
  designation: string;
  user: {
    name: string;
    email: string;
  };
};

export const AdminFacultyColumns: ColumnDef<AdminFacultyResponse>[] = [
  {
    accessorKey: "user.name",
    header: "Name",
    cell: ({ row }) => <div>{row.original.user?.name}</div>,
  },
  {
    accessorKey: "user.email",
    header: "Email",
    cell: ({ row }) => <div>{row.original.user?.email}</div>,
  },
  {
    accessorKey: "shortName",
    header: "Short Name",
  },
  {
    accessorKey: "designation",
    header: "Designation",
    cell: ({ row }) => {
      // Format "ASSISTANT_PROFESSOR" to "Assistant Professor"
      const formatted = row.original.designation
        .split("_")
        .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
        .join(" ");
      return <div>{formatted}</div>;
    },
  },
];
