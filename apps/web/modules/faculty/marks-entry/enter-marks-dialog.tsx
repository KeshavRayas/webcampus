"use client";

import { apiClient } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AssessmentWithStudentsType,
  SaveAssessmentMarksType,
  StudentAssessmentStatusType,
  StudentAssessmentTotalType,
} from "@webcampus/schemas/faculty";
import { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import { Input } from "@webcampus/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useOrMarkCalculator } from "./use-or-mark-calculator";

interface EnterMarksDialogProps {
  assessmentId: string;
  courseId: string;
  assessmentTitle: string;
  sectionId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface StudentMarksState {
  [studentId: string]: {
    [questionId: string]: number;
  };
}

interface StudentStatusState {
  [studentId: string]: StudentAssessmentStatusType;
}

interface StudentTotalState {
  [studentId: string]: number;
}

type StudentInfo = AssessmentWithStudentsType["students"][number];
type QuestionInfo = AssessmentWithStudentsType["questions"][number];

/** Statuses where all question inputs should be disabled and total forced to 0. */
const DISABLED_STATUSES: StudentAssessmentStatusType[] = ["ABSENT", "MP"];

const STATUS_OPTIONS: Array<{
  value: StudentAssessmentStatusType;
  label: string;
}> = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "MP", label: "MP" },
];

export function EnterMarksDialog({
  assessmentId,
  courseId,
  assessmentTitle,
  sectionId,
  onClose,
  onSuccess,
}: EnterMarksDialogProps) {
  const queryClient = useQueryClient();

  const [studentMarks, setStudentMarks] = useState<StudentMarksState>({});
  const [studentStatuses, setStudentStatuses] = useState<StudentStatusState>(
    {}
  );
  const [studentTotals, setStudentTotals] = useState<StudentTotalState>({});

  // Fetch assessment data with students — uses apiClient which has withCredentials
  const { data: assessmentData, isLoading } = useQuery({
    queryKey: ["assessmentWithMarks", assessmentId, sectionId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (sectionId) {
        params.sectionId = sectionId;
      }
      const response = await apiClient.get<
        BaseResponse<AssessmentWithStudentsType>
      >(`/faculty/marks/assessments/${assessmentId}/marks`, { params });
      if (response.data.status === "success") {
        return response.data.data;
      }
      throw new Error("Failed to fetch assessment data");
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Initialize marks from existing data (including previously saved per-question marks)
  useEffect(() => {
    if (assessmentData?.students) {
      const initialMarks: StudentMarksState = {};
      const initialStatuses: StudentStatusState = {};
      const initialTotals: StudentTotalState = {};

      assessmentData.students.forEach((student: StudentInfo) => {
        initialMarks[student.studentId] = {};
        initialStatuses[student.studentId] =
          (student.status as StudentAssessmentStatusType) ?? "PRESENT";
        initialTotals[student.studentId] = student.totalMarks ?? 0;
      });

      // Hydrate per-question marks from existing data
      assessmentData.questions.forEach((question: QuestionInfo) => {
        assessmentData.students.forEach((student: StudentInfo) => {
          const studentEntry = initialMarks[student.studentId] || {};
          // Use saved marks if they exist, otherwise default to 0
          const savedMark = student.questionMarks?.[question.id];
          studentEntry[question.id] = savedMark ?? 0;
          initialMarks[student.studentId] = studentEntry;
        });
      });

      setStudentMarks(initialMarks);
      setStudentStatuses(initialStatuses);
      setStudentTotals(initialTotals);
    }
  }, [assessmentData]);

  // Build a lookup of max marks per question for clamping
  const maxMarksByQuestion = useMemo(() => {
    const map = new Map<string, number>();
    assessmentData?.questions.forEach((q: QuestionInfo) => {
      map.set(q.id, q.marks);
    });
    return map;
  }, [assessmentData]);

  // Group questions by part and OR group
  const questionStructure = useMemo(() => {
    if (!assessmentData) return null;

    const parts = new Map<string, QuestionInfo[]>();
    assessmentData.questions.forEach((q: QuestionInfo) => {
      if (!parts.has(q.part)) {
        parts.set(q.part, []);
      }
      parts.get(q.part)!.push(q);
    });

    return parts;
  }, [assessmentData]);

  const computePartMaxMarks = useCallback((partQuestions: QuestionInfo[]) => {
    let standaloneSum = 0;
    const orGroupMaxes = new Map<string, number>();

    partQuestions.forEach((q) => {
      if (q.orGroupId) {
        const currentMax = orGroupMaxes.get(q.orGroupId) || 0;
        orGroupMaxes.set(q.orGroupId, Math.max(currentMax, q.marks));
      } else {
        standaloneSum += q.marks;
      }
    });

    const sumOfMaxes = Array.from(orGroupMaxes.values()).reduce(
      (sum, max) => sum + max,
      0
    );
    return standaloneSum + sumOfMaxes;
  }, []);

  // OR mark calculator hook
  const { calculateTotalMarks } = useOrMarkCalculator(
    assessmentData?.questions || []
  );

  // Calculate student totals
  const computedTotals = useMemo(() => {
    if (!assessmentData) return { totals: {}, multipleAttempts: {} };

    const totals: { [studentId: string]: number } = {};
    const multipleAttempts: { [studentId: string]: boolean } = {};

    assessmentData.students.forEach((student: StudentInfo) => {
      const status = studentStatuses[student.studentId];
      // Absent/MP students always get 0
      if (status && DISABLED_STATUSES.includes(status)) {
        totals[student.studentId] = 0;
        multipleAttempts[student.studentId] = false;
        return;
      }

      const marks = studentMarks[student.studentId] || {};
      const { totalMarks, hasMultipleOrAttempts } = calculateTotalMarks(marks);

      totals[student.studentId] = totalMarks;
      multipleAttempts[student.studentId] = hasMultipleOrAttempts;
    });

    return { totals, multipleAttempts };
  }, [assessmentData, studentStatuses, studentMarks, calculateTotalMarks]);

  // Save marks mutation — uses apiClient which has withCredentials
  const { mutate: saveMarks, isPending: isSaving } = useMutation({
    mutationFn: async (data: SaveAssessmentMarksType) => {
      const response = await apiClient.post(
        `/faculty/marks/assessments/save-marks`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success("Marks saved successfully");
      queryClient.invalidateQueries({
        queryKey: ["marks-dashboard-assignments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["assessmentWithMarks", assessmentId],
      });
      onSuccess();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to save marks"
      );
    },
  });

  const handleMarksChange = (
    studentId: string,
    questionId: string,
    value: string
  ): void => {
    const maxMarks = maxMarksByQuestion.get(questionId) ?? Infinity;
    const numValue = Math.min(Math.max(0, Number(value) || 0), maxMarks);
    setStudentMarks((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [questionId]: numValue,
      },
    }));
  };

  const handleStatusChange = (
    studentId: string,
    value: StudentAssessmentStatusType
  ): void => {
    setStudentStatuses((prev) => ({
      ...prev,
      [studentId]: value,
    }));

    // When switching to ABSENT or MP, zero out all question marks for this student
    if (DISABLED_STATUSES.includes(value)) {
      setStudentMarks((prev) => {
        const studentEntry = prev[studentId];
        if (!studentEntry) return prev;
        const zeroed: Record<string, number> = {};
        Object.keys(studentEntry).forEach((qId) => {
          zeroed[qId] = 0;
        });
        return { ...prev, [studentId]: zeroed };
      });
      setStudentTotals((prev) => ({ ...prev, [studentId]: 0 }));
    }
  };

  const handleTotalChange = (studentId: string, value: string): void => {
    const nextValue = Math.max(0, Number(value) || 0);
    setStudentTotals((prev) => ({
      ...prev,
      [studentId]: nextValue,
    }));
  };

  const isStudentDisabled = (studentId: string): boolean => {
    const status = studentStatuses[studentId];
    return !!status && DISABLED_STATUSES.includes(status);
  };

  const handleSave = (): void => {
    if (!assessmentData) return;

    const marks: SaveAssessmentMarksType["marks"] = [];

    const hasQuestions = assessmentData.questions.length > 0;

    if (hasQuestions) {
      assessmentData.students.forEach((student: StudentInfo) => {
        const studentMarkData = studentMarks[student.studentId] || {};

        assessmentData.questions.forEach((question: QuestionInfo) => {
          const marksValue = studentMarkData[question.id] ?? 0;
          marks.push({
            studentId: student.studentId,
            questionId: question.id,
            marksObtained: marksValue,
          });
        });
      });
    }

    const studentTotalsPayload: StudentAssessmentTotalType[] =
      assessmentData.students.map((student: StudentInfo) => {
        const totalMarks = computedTotals.totals[student.studentId] ?? 0;

        return {
          studentId: student.studentId,
          totalMarks,
          status: studentStatuses[student.studentId] ?? "PRESENT",
        };
      });

    const payload: SaveAssessmentMarksType = {
      assessmentId,
      courseId,
      marks: hasQuestions ? marks : undefined,
      studentTotals: studentTotalsPayload,
    };

    saveMarks(payload);
  };

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="flex h-[95vh] max-h-[95vh] w-[98vw] !max-w-[98vw] flex-col p-4">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{assessmentTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!assessmentData) {
    return null;
  }

  const hasQuestions = assessmentData.questions.length > 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="flex h-[95vh] max-h-[95vh] w-[98vw] !max-w-[98vw] flex-col p-4">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{assessmentTitle}</DialogTitle>
        </DialogHeader>

        {hasQuestions ? (
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-muted sticky left-0 w-40">
                    Student (USN)
                  </TableHead>
                  <TableHead className="bg-muted sticky w-32 text-center">
                    Status
                  </TableHead>
                  {Array.from(questionStructure?.keys() || []).map(
                    (part: string) => {
                      const partQuestions = questionStructure?.get(part) || [];
                      return (
                        <TableHead
                          key={part}
                          colSpan={partQuestions.length}
                          className="border-r text-center"
                        >
                          {part} (Max: {computePartMaxMarks(partQuestions)})
                        </TableHead>
                      );
                    }
                  )}
                  <TableHead className="bg-muted sticky right-0 w-20 text-center">
                    Total
                  </TableHead>
                </TableRow>
                <TableRow>
                  <TableHead className="bg-muted sticky left-0"></TableHead>
                  <TableHead className="bg-muted sticky"></TableHead>
                  {questionStructure &&
                    Array.from(questionStructure.values())
                      .flat()
                      .map((question: QuestionInfo) => (
                        <TableHead
                          key={question.id}
                          className="text-center text-xs"
                        >
                          <div className="min-w-16">
                            <div>{question.qNumber}</div>
                            <div className="text-muted-foreground">
                              ({question.marks})
                            </div>
                            {question.orGroupId && (
                              <div className="rounded bg-blue-100 px-1 text-xs text-blue-700">
                                OR
                              </div>
                            )}
                          </div>
                        </TableHead>
                      ))}
                  <TableHead className="bg-muted sticky right-0"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessmentData &&
                  assessmentData.students.map((student: StudentInfo) => {
                    const disabled = isStudentDisabled(student.studentId);
                    return (
                      <TableRow
                        key={student.studentId}
                        className={disabled ? "opacity-50" : ""}
                      >
                        <TableCell className="bg-muted sticky left-0 w-40 font-medium">
                          <div className="text-sm">
                            <div>{student.usn}</div>
                            <div className="text-muted-foreground text-xs">
                              {student.name}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="bg-muted sticky w-32">
                          <Select
                            value={
                              studentStatuses[student.studentId] ?? "PRESENT"
                            }
                            onValueChange={(value) =>
                              handleStatusChange(
                                student.studentId,
                                value as StudentAssessmentStatusType
                              )
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        {Array.from(questionStructure?.values() || [])
                          .flat()
                          .map((question: QuestionInfo) => {
                            return (
                              <TableCell
                                key={`${student.studentId}-${question.id}`}
                                className="p-1 text-center"
                              >
                                <Input
                                  type="number"
                                  min="0"
                                  max={question.marks}
                                  value={
                                    studentMarks[student.studentId]?.[
                                      question.id
                                    ] ?? ""
                                  }
                                  onChange={(e) =>
                                    handleMarksChange(
                                      student.studentId,
                                      question.id,
                                      e.target.value
                                    )
                                  }
                                  disabled={disabled}
                                  className="h-8 w-full text-center text-sm"
                                  placeholder="0"
                                />
                              </TableCell>
                            );
                          })}
                        <TableCell
                          className={`bg-muted sticky right-0 w-20 text-center font-semibold ${computedTotals.multipleAttempts[student.studentId] ? "bg-primary/10 text-primary" : ""}`}
                        >
                          <div className="text-sm">
                            {computedTotals.totals[student.studentId] || 0}/
                            {assessmentData.totalMarks}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>USN</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-40">Status</TableHead>
                  <TableHead className="w-32 text-right">
                    Marks Obtained
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessmentData.students.map((student: StudentInfo) => {
                  const disabled = isStudentDisabled(student.studentId);
                  return (
                    <TableRow
                      key={student.studentId}
                      className={disabled ? "opacity-50" : ""}
                    >
                      <TableCell>{student.usn}</TableCell>
                      <TableCell>{student.name}</TableCell>
                      <TableCell>
                        <Select
                          value={
                            studentStatuses[student.studentId] ?? "PRESENT"
                          }
                          onValueChange={(value) =>
                            handleStatusChange(
                              student.studentId,
                              value as StudentAssessmentStatusType
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          max={assessmentData.totalMarks}
                          value={studentTotals[student.studentId] ?? ""}
                          onChange={(e) =>
                            handleTotalChange(student.studentId, e.target.value)
                          }
                          disabled={disabled}
                          className="h-8 text-right"
                          placeholder="0"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Marks
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
