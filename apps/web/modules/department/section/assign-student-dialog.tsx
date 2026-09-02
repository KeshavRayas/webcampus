"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { AxiosError } from "axios";
import { UserPlus } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";

interface AssignableStudent {
  id: string;
  usn: string;
  user: { name: string; email: string };
  department: { id: string; name: string };
  currentSection: { id: string; name: string } | null;
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
  academicYear,
}: AssignStudentDialogProps) => {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
    }
  }, [open]);

  const { data: studentList = [], isLoading } = useQuery({
    queryKey: ["unassigned-students", sectionId, semesterId, academicYear],
    queryFn: async () => {
      const res = await apiClient.get(
        `/department/section/unassigned-students`,
        {
          params: { semesterId, academicYear },
        }
      );
      // Extract the 'students' array from the response object
      return res.data.data.students;
    },
    enabled: open && !!semesterId && !!academicYear, // Ensure dialog is open and params exist
  });

  const isInThisSection = (student: AssignableStudent) =>
    student.currentSection?.id === sectionId;

  const toggleStudent = (student: AssignableStudent) => {
    if (isInThisSection(student)) {
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(student.id)) {
        next.delete(student.id);
      } else {
        next.add(student.id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (!studentList) return;
    const selectable = studentList.filter(
      (s: AssignableStudent) => !isInThisSection(s)
    );
    if (selectedIds.size === selectable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectable.map((s: AssignableStudent) => s.id)));
    }
  };

  const assignMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        sectionId,
        studentIds: Array.from(selectedIds),
        academicYear,
      };
      return apiClient.post(`/department/section/assign-students`, payload);
    },
    onSuccess: () => {
      toast.success(`Assigned ${selectedIds.size} student(s) successfully`);
      queryClient.invalidateQueries({ queryKey: ["sections-with-students"] });
      queryClient.invalidateQueries({ queryKey: ["unassigned-students"] });
      // <-- NEW: Reload global counts after assigning
      queryClient.invalidateQueries({ queryKey: ["unassigned-counts"] });
      setSelectedIds(new Set());
      onOpenChange(false);
    },
    onError: (error) => {
      const message =
        error instanceof AxiosError
          ? error.response?.data?.message
          : "Failed to assign students";
      toast.error(message || "Failed to assign students");
    },
  });

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
            Loading students...
          </p>
        )}

        {!isLoading && studentList.length === 0 && (
          <div className="text-muted-foreground py-8 text-center">
            <p className="text-sm">
              No students found for this department and semester.
            </p>
          </div>
        )}

        {!isLoading && studentList.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                {selectedIds.size} of{" "}
                {
                  studentList.filter(
                    (s: AssignableStudent) => !isInThisSection(s)
                  ).length
                }{" "}
                selected
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleAll}
              >
                {selectedIds.size ===
                studentList.filter(
                  (s: AssignableStudent) => !isInThisSection(s)
                ).length
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
                    <TableHead className="text-xs">Department</TableHead>
                    <TableHead className="text-xs">Current Section</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentList.map((student: AssignableStudent) => {
                    const inThisSection = isInThisSection(student);
                    return (
                      <TableRow
                        key={student.id}
                        className={
                          inThisSection ? "opacity-60" : "cursor-pointer"
                        }
                        onClick={() => toggleStudent(student)}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(student.id)}
                            disabled={inThisSection}
                            onCheckedChange={() => toggleStudent(student)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {student.usn}
                        </TableCell>
                        <TableCell className="text-xs">
                          {student.user.name}
                        </TableCell>
                        <TableCell className="text-xs">
                          {student.department.name}
                        </TableCell>
                        <TableCell className="text-xs">
                          {inThisSection ? (
                            <span className="text-muted-foreground">
                              In this section
                            </span>
                          ) : student.currentSection ? (
                            `Section ${student.currentSection.name}`
                          ) : (
                            <span className="text-muted-foreground">
                              Unassigned
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
