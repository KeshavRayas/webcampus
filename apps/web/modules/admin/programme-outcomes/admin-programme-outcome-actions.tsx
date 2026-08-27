"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { Button } from "@webcampus/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@webcampus/ui/components/dropdown-menu";
import axios, { AxiosError } from "axios";
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
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await axios.delete(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/programme-outcomes/${outcome.id}`,
        {
          withCredentials: true,
        }
      );
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
            onClick={() => {
              if (
                window.confirm("Are you sure you want to delete this outcome?")
              ) {
                deleteMutation.mutate();
              }
            }}
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
    </>
  );
};
