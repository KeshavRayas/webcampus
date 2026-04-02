"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { frontendEnv } from "@webcampus/common/env";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@webcampus/ui/components/alert-dialog";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import axios, { AxiosError } from "axios";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import { CoeForm } from "./coe-form";

interface CoeUser {
  id: string;
  name: string;
  username: string;
  email: string;
}

export const CoeView = () => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: coes, isLoading } = useQuery<CoeUser[]>({
    queryKey: ["admin-coes"],
    queryFn: async () => {
      const res = await axios.get(`${NEXT_PUBLIC_API_BASE_URL}/admin/coe`, {
        withCredentials: true,
      });
      return res.data.data;
    },
  });

  const handleDelete = async (id: string) => {
    try {
      const res = await axios.delete(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/coe/${id}`,
        {
          withCredentials: true,
        }
      );

      if (res.data.status === "success") {
        toast.success("COE user deleted successfully");
        queryClient.invalidateQueries({ queryKey: ["admin-coes"] });
      }
    } catch (error) {
      const message =
        error instanceof AxiosError
          ? error.response?.data?.message
          : "Failed to delete COE user";
      toast.error(message || "Failed to delete COE user");
    } finally {
      setDeletingId(null);
    }
  };

  const columns: ColumnDef<CoeUser>[] = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "username",
      header: "Username",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const id = row.original.id;
        return (
          <AlertDialog
            open={deletingId === id}
            onOpenChange={(o) => !o && setDeletingId(null)}
          >
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setDeletingId(id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete COE User</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this COE user? This action
                  cannot be undone and will permanently remove their access.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleDelete(id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Controller of Examinations (COE)
          </h2>
          <p className="text-muted-foreground text-sm">
            Manage COE user accounts and their system access.
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
