"use client";

import { authClient } from "@/lib/auth-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse, SuccessResponse } from "@webcampus/types/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@webcampus/ui/components/alert-dialog";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import axios, { AxiosError, AxiosResponse } from "axios";
import { Plus, Trash2, Users } from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { AssignStudentDialog } from "./assign-student-dialog";

type SectionCycle = "PHYSICS" | "CHEMISTRY";

interface StudentSection {
  id: string;
  student: {
    id: string;
    usn: string;
    user: {
      name: string;
      email: string;
    };
  };
}

interface SectionWithStudents {
  id: string;
  name: string;
  cycle: "PHYSICS" | "CHEMISTRY" | "NONE";
  semesterId: string;
  studentSections: StudentSection[];
  _count: {
    studentSections: number;
  };
}

interface SectionCardsViewProps {
  semesterId: string;
  academicYear: string;
  isUgFirstYearReadOnly: boolean;
  isBasicSciences: boolean;
  selectedCycle: SectionCycle;
}

export const SectionCardsView = ({
  semesterId,
  academicYear,
  isUgFirstYearReadOnly,
  isBasicSciences,
  selectedCycle,
}: SectionCardsViewProps) => {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const departmentName = session?.user?.name ?? "";

  // Assign dialog state
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<{
    sectionId: string;
    sectionName: string;
  }>({ sectionId: "", sectionName: "" });
  const [deleteTarget, setDeleteTarget] = useState<{
    sectionId: string;
    sectionName: string;
  } | null>(null);

  // Fetch sections with students
  const { data: sections, isLoading } = useQuery({
    queryKey: ["sections-with-students", semesterId, departmentName],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<SectionWithStudents[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/department/section/with-students`,
        {
          params: { semesterId, departmentName },
          withCredentials: true,
        }
      );
      if (res.data.status === "success") return res.data.data;
      return [] as SectionWithStudents[];
    },
    enabled: !!semesterId && !!departmentName,
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      return await axios.delete(
        `${NEXT_PUBLIC_API_BASE_URL}/department/section/${sectionId}`,
        { withCredentials: true }
      );
    },
    onSuccess: (data: AxiosResponse<SuccessResponse<null>>) => {
      toast.success(data.data.message);
      queryClient.invalidateQueries({ queryKey: ["sections-with-students"] });
      queryClient.invalidateQueries({ queryKey: ["unassigned-count"] });
      setDeleteTarget(null);
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      toast.error(error.response?.data?.error || "Failed to delete section");
    },
  });

  const visibleSections = useMemo(() => {
    if (!sections) {
      return [] as SectionWithStudents[];
    }

    if (!isBasicSciences) {
      return sections;
    }

    return sections.filter((section) => section.cycle === selectedCycle);
  }, [isBasicSciences, sections, selectedCycle]);

  return (
    <div className="space-y-4">
      {/* Section Cards Grid */}
      {isLoading && semesterId && (
        <p className="text-muted-foreground text-sm">Loading sections...</p>
      )}

      {visibleSections.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleSections.map((section) => (
            <Card key={section.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold">
                  Section {section.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Users className="h-3 w-3" />
                    {section._count.studentSections}
                  </Badge>
                  {!isUgFirstYearReadOnly && (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setAssignTarget({
                            sectionId: section.id,
                            sectionName: section.name,
                          });
                          setAssignOpen(true);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="sr-only">Add student</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          setDeleteTarget({
                            sectionId: section.id,
                            sectionName: section.name,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete section</span>
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">USN</TableHead>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {section.studentSections.map((ss) => (
                        <TableRow key={ss.id}>
                          <TableCell className="font-mono text-xs">
                            {ss.student.usn}
                          </TableCell>
                          <TableCell className="text-xs">
                            {ss.student.user.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {ss.student.user.email}
                          </TableCell>
                        </TableRow>
                      ))}
                      {section.studentSections.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="text-muted-foreground text-center text-xs"
                          >
                            No students assigned
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {sections && visibleSections.length === 0 && semesterId && (
        <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
          <Users className="mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">
            {isBasicSciences
              ? `No ${selectedCycle.toLowerCase()} cycle sections found for this semester.`
              : "No sections found for this semester. Use the Generate button to create sections."}
          </p>
        </div>
      )}

      {/* Assign Student Dialog */}
      <AssignStudentDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        sectionId={assignTarget.sectionId}
        sectionName={assignTarget.sectionName}
        semesterId={semesterId}
        departmentName={departmentName}
        academicYear={academicYear}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section</AlertDialogTitle>
            <AlertDialogDescription>
              {`Are you sure you want to delete Section ${deleteTarget?.sectionName ?? ""}? Deleting this section will unassign all students currently in it.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                if (!deleteTarget?.sectionId) {
                  return;
                }
                deleteSectionMutation.mutate(deleteTarget.sectionId);
              }}
              disabled={deleteSectionMutation.isPending}
            >
              {deleteSectionMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
