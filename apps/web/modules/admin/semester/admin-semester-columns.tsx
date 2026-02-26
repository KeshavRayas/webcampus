"use client";

import { ColumnDef } from "@tanstack/react-table";
import { SemesterResponseType } from "@webcampus/schemas/admin";
import dayjs from "dayjs";
import { AdminSemesterActions } from "./admin-semester-actions";

export const AdminSemesterColumns: ColumnDef<SemesterResponseType>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    id: "name",
    header: "Name",
    cell: ({ row }) => {
      return (
        <div>
          {row.original.type.toUpperCase()} {row.original.year}
        </div>
      );
    },
  },
  {
    accessorKey: "endDate",
    header: "End Date",
    cell: ({ row }) => {
      return <div>{dayjs(row.original.endDate).format("DD/MM/YYYY")}</div>;
    },
  },
  {
    accessorKey: "type",
    header: "Type",
  },
  {
    accessorKey: "startDate",
    header: "Start Date",
    cell: ({ row }) => {
      return <div>{dayjs(row.original.startDate).format("DD/MM/YYYY")}</div>;
    },
  },
  {
    accessorKey: "year",
    header: "Year",
  },
  {
    accessorKey: "isCurrent",
    header: "Is Current",
    cell: ({ row }) => {
      return <div>{row.original.isCurrent ? "Yes" : "No"}</div>;
    },
  },
  {
    accessorKey: "userId",
    header: "User ID",
    cell: ({ row }) => {
      return <div>{row.original.userId}</div>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <AdminSemesterActions semester={row.original} />,
  },
];
