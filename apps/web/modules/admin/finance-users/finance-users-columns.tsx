import { ColumnDef } from "@tanstack/react-table";
import { FinanceUser } from "./finance-types";
import { FinanceActions } from "./finance-actions";

export const FinanceUserColumns: ColumnDef<FinanceUser>[] = [
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
    cell: ({ row }) => <FinanceActions user={row.original} />,
  },
];
