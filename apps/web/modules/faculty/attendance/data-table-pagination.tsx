import { useReactTable } from "@tanstack/react-table";
import { Button } from "@webcampus/ui/components/button";

type DataTablePaginationProps<TData> = {
  table: ReturnType<typeof useReactTable<TData>>;
  isLoading?: boolean;
};

export function DataTablePagination<TData>({
  table,
  isLoading,
}: DataTablePaginationProps<TData>) {
  return (
    <div className="flex items-center justify-between text-sm">
      <Button
        type="button"
        variant="outline"
        onClick={() => table.previousPage()}
        disabled={!table.getCanPreviousPage() || isLoading}
      >
        Previous
      </Button>
      <span className="text-muted-foreground">
        Page{" "}
        <strong>
          {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </strong>
      </span>
      <Button
        type="button"
        variant="outline"
        onClick={() => table.nextPage()}
        disabled={!table.getCanNextPage() || isLoading}
      >
        Next
      </Button>
    </div>
  );
}
