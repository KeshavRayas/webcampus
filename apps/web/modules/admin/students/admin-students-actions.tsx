"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { AdminStudentResponseType } from "@webcampus/schemas/admin";
import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@webcampus/ui/components/dropdown-menu";
import axios, { AxiosError } from "axios";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";

export const AdminStudentActions = ({
  student,
}: {
  student: AdminStudentResponseType;
}) => {
  const queryClient = useQueryClient();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await axios.delete(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/student/${student.id}`,
        { withCredentials: true }
      );
    },
    onSuccess: () => {
      toast.success(`Student ${student.usn} deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      setIsDeleteOpen(false);
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      toast.error(error.response?.data?.error || "Failed to delete student");
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
          <DropdownMenuItem
            onClick={() => setIsDeleteOpen(true)}
            className="text-red-600 focus:text-red-600"
          >
            Delete Student
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Student</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <strong>{student.usn}</strong> ({student.name ?? "Unnamed"})? This
              will remove the student profile, their user account, all section
              assignments, course registrations, and marks. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
