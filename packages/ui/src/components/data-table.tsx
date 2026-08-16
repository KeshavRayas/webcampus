"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  PaginationState,
  Updater,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { Copy } from "./copy";
import { DataTablePagination } from "./data-table-pagination";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  manualPagination?: boolean;
  page?: number;
  pageSize?: number;
  totalRows?: number;
  onPaginationChange?: (page: number, pageSize: number) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  manualPagination = false,
  page = 0,
  pageSize = 10,
  totalRows = 0,
  onPaginationChange,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(manualPagination
      ? {
          manualPagination: true,
          rowCount: totalRows,
          pageCount: Math.max(Math.ceil(totalRows / pageSize), 1),
          state: {
            pagination: { pageIndex: page, pageSize },
          },
          onPaginationChange: (updater: Updater<PaginationState>) => {
            const next =
              typeof updater === "function"
                ? updater({ pageIndex: page, pageSize })
                : updater;
            onPaginationChange?.(next.pageIndex, next.pageSize);
          },
        }
      : {
          getPaginationRowModel: getPaginationRowModel(),
          initialState: {
            pagination: {
              pageSize: 10,
            },
          },
        }),
  });

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => {
                  const copyButton =
                    cell.column.columnDef.meta?.enableCopy === true;

                  return (
                    <TableCell
                      key={cell.id}
                      className={copyButton ? "group relative" : "relative"}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                      {copyButton && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-end pr-2 opacity-0 transition-all duration-200 ease-in-out group-hover:opacity-100">
                          <Copy text={String(cell.getValue())} />
                        </div>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <DataTablePagination table={table} />
    </div>
  );
}
