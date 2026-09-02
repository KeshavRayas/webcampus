"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@webcampus/ui/components/button";
import { ConfirmDialog } from "@webcampus/ui/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@webcampus/ui/components/dropdown-menu";
import type { AxiosError } from "axios";
import { MoreHorizontal, Pencil, Trash } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-toastify";
import { ProgrammeOutcomeDialog } from "./programme-outcome-dialog";
import { ProgrammeOutcomeTableItem } from "./types";

export const AdminProgrammeOutcomeActions = ({
  outcome,
}: {
  outcome: ProgrammeOutcomeTableItem;
}) => {
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/admin/programme-outcomes/${outcome.id}`);
    },
    onSuccess: () => {
      toast.success("Outcome deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["programme-outcomes"] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosError<{ message?: string }>;
      toast.error(err.response?.data?.message || "Failed to delete outcome");
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProgrammeOutcomeDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        outcome={outcome}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete this outcome?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          deleteMutation.mutate();
        }}
      />
    </>
  );
};
