"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse, SuccessResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import { Checkbox } from "@webcampus/ui/components/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import axios, { AxiosError, AxiosResponse } from "axios";
import { UserPlus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-toastify";

interface UnassignedStudent {
  id: string;
  usn: string;
  user: {
    name: string;
    email: string;
  };
}

interface AssignStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: string;
  sectionName: string;
  semesterId: string;
  departmentName: string;
  academicYear: string;
}

export const AssignStudentDialog = ({
  open,
  onOpenChange,
  sectionId,
  sectionName,
  semesterId,
  departmentName,
  academicYear,
}: AssignStudentDialogProps) => {
  const queryClient = useQueryClient();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: students, isLoading } = useQuery({
    queryKey: ["unassigned-students", semesterId, departmentName],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<UnassignedStudent[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/section/unassigned-students`,
        {
          params: { semesterId, departmentName },
          withCredentials: true,
        }
      );
      if (res.data.status === "success") return res.data.data;
      return [] as UnassignedStudent[];
    },
    enabled: open && !!semesterId && !!departmentName,
  });

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (!students) return;
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s) => s.id)));
    }
  };

  const assignMutation = useMutation({
    mutationFn: async () => {
      return await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/department/section/assign-students`,
        {
          sectionId,
          studentIds: Array.from(selectedIds),
          academicYear,
        },
        { withCredentials: true }
      );
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<{ count: number }>>) => {
      toast.success(data.data.message);
      queryClient.invalidateQueries({ queryKey: ["sections-with-students"] });
      queryClient.invalidateQueries({ queryKey: ["unassigned-students"] });
      queryClient.invalidateQueries({ queryKey: ["unassigned-count"] });
      setSelectedIds(new Set());
      onOpenChange(false);
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      toast.error(error.response?.data?.error || "Failed to assign students");
    },
  });

  const studentList = Array.isArray(students) ? students : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Students to Section {sectionName}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <p className="text-muted-foreground py-4 text-center text-sm">
            Loading unassigned students...
          </p>
        )}

        {!isLoading && studentList.length === 0 && (
          <div className="text-muted-foreground py-8 text-center">
            <p className="text-sm">
              No unassigned students found for this semester.
            </p>
          </div>
        )}

        {!isLoading && studentList.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                {selectedIds.size} of {studentList.length} selected
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleAll}
              >
                {selectedIds.size === studentList.length
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead className="text-xs">USN</TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentList.map((student) => (
                    <TableRow
                      key={student.id}
                      className="cursor-pointer"
                      onClick={() => toggleStudent(student.id)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(student.id)}
                          onCheckedChange={() => toggleStudent(student.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {student.usn}
                      </TableCell>
                      <TableCell className="text-xs">
                        {student.user.name}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={() => assignMutation.mutate()}
            disabled={
              assignMutation.isPending ||
              selectedIds.size === 0 ||
              studentList.length === 0
            }
          >
            {assignMutation.isPending
              ? "Assigning..."
              : `Assign ${selectedIds.size} Student${selectedIds.size !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
