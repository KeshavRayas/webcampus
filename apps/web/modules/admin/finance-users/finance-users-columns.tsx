import { ColumnDef } from "@tanstack/react-table";
import { FinanceActions } from "./finance-actions";
import { FinanceUser } from "./finance-types";

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
