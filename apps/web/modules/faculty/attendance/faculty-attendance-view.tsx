"use client";

import { getApiErrorMessage } from "@/lib/api-client";
import { dayjs } from "@webcampus/common/dayjs";
import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { ATTENDANCE_TIME_SLOTS } from "./attendance-time-slots";
import { AttendanceForm } from "./components/attendance-form";
import { AttendancePageShell } from "./components/attendance-page-shell";
import { AttendanceSection } from "./components/attendance-section";
import {
  AttendanceChecklistRow,
  FacultyAttendanceFormState,
} from "./faculty-attendance-types";
import {
  useCreateOrOpenFacultyAttendanceSession,
  useDeleteFacultyAttendanceSession,
  useFacultyAttendanceFilterOptions,
  useFacultyAttendanceSessionDetail,
  useFacultyAttendanceSessions,
  useFacultyAttendanceSessionStudents,
} from "./use-faculty-attendance";

const INITIAL_FORM_STATE: FacultyAttendanceFormState = {
  sessionDate: undefined,
  courseId: "",
  sectionId: "",
  batchId: undefined,
  timingMode: "FIXED",
  fixedTimingCode: "",
  customStartTime: "",
  customEndTime: "",
};

const COURSE_SELECTION_DELIMITER = "::";

const toCourseSelectionKey = (courseId: string, batchId?: string) => {
  return `${courseId}${COURSE_SELECTION_DELIMITER}${batchId ?? "theory"}`;
};

const parseCourseSelectionKey = (value: string) => {
  const [courseId = "", rawBatchId] = value.split(COURSE_SELECTION_DELIMITER);
  return {
    courseId,
    batchId: rawBatchId && rawBatchId !== "theory" ? rawBatchId : undefined,
  };
};

const parseSectionSelectionKey = (value: string) => {
  const [sectionId = "", rawBatchId] = value.split(COURSE_SELECTION_DELIMITER);
  return {
    sectionId,
    batchId: rawBatchId && rawBatchId !== "theory" ? rawBatchId : undefined,
  };
};

const formatCourseDropdownLabel = (
  code: string,
  name: string,
  labBatchNumber?: number
) => {
  if (!labBatchNumber) {
    return `${code} - ${name}`;
  }

  return `${code}-${name}(Lab Batch ${labBatchNumber})`;
};

const toMinutes = (value: string) => {
  const parts = value.split(":").map(Number);
  const hours = parts[0];
  const minutes = parts[1];

  if (
    hours === undefined ||
    minutes === undefined ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return null;
  }

  return hours * 60 + minutes;
};

const hasTimeOverlap = (
  startTimeA: string,
  endTimeA: string,
  startTimeB: string,
  endTimeB: string
) => {
  const startA = toMinutes(startTimeA);
  const endA = toMinutes(endTimeA);
  const startB = toMinutes(startTimeB);
  const endB = toMinutes(endTimeB);

  if (startA === null || endA === null || startB === null || endB === null) {
    return false;
  }

  return startA < endB && endA > startB;
};

const withUiChecklistMetadata = (
  rows: Array<{
    studentId: string;
    usn: string;
    name: string;
    status: "PRESENT" | "ABSENT";
    previousAttendancePercentage?: number;
  }>,
  options?: {
    defaultStatus?: "PRESENT" | "ABSENT";
  }
): AttendanceChecklistRow[] => {
  return rows.map((student) => ({
    studentId: student.studentId,
    usn: student.usn,
    name: student.name,
    status: options?.defaultStatus ?? student.status,
    previousAttendancePercentage: student.previousAttendancePercentage ?? 0,
  }));
};

export const FacultyAttendanceView = () => {
  const [form, setForm] =
    useState<FacultyAttendanceFormState>(INITIAL_FORM_STATE);
  const [courseSelectionKey, setCourseSelectionKey] = useState<string>("");
  const [sectionSelectionKey, setSectionSelectionKey] = useState<string>("");

  const [studentChecklist, setStudentChecklist] = useState<
    AttendanceChecklistRow[]
  >([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [isTakeAttendanceModalOpen, setIsTakeAttendanceModalOpen] =
    useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(
    null
  );
  const [deleteConfirmSessionId, setDeleteConfirmSessionId] = useState<
    string | null
  >(null);
  const [showSaveSuccessToast, setShowSaveSuccessToast] =
    useState<boolean>(false);

  const filterOptionsQuery = useFacultyAttendanceFilterOptions();
  const createOrOpenMutation = useCreateOrOpenFacultyAttendanceSession();
  const deleteSessionMutation = useDeleteFacultyAttendanceSession();

  const sessionDetailQuery = useFacultyAttendanceSessionDetail(
    {
      sessionId: activeSessionId,
    },
    Boolean(activeSessionId)
  );

  const assignmentOptions = useMemo(() => {
    const courses = filterOptionsQuery.data?.courses ?? [];
    const sections = filterOptionsQuery.data?.sections ?? [];
    const courseById = new Map(courses.map((course) => [course.id, course]));

    return sections
      .map((section) => {
        const course = courseById.get(section.courseId);
        if (!course) {
          return null;
        }

        const selectionKey = toCourseSelectionKey(course.id, section.batchId);
        return {
          selectionKey,
          courseId: course.id,
          sectionId: section.id,
          batchId: section.batchId,
          sectionName: section.name,
          courseCode: course.code,
          courseName: course.name,
          labBatchNumber: section.labBatchNumber,
          courseLabel: formatCourseDropdownLabel(
            course.code,
            course.name,
            section.labBatchNumber
          ),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }, [filterOptionsQuery.data?.courses, filterOptionsQuery.data?.sections]);

  const electiveBatchOptions = useMemo(() => {
    const courses = filterOptionsQuery.data?.courses ?? [];
    const electiveBatches = filterOptionsQuery.data?.electiveBatches ?? [];
    const courseById = new Map(courses.map((course) => [course.id, course]));

    return electiveBatches.map((batch) => {
      const course = courseById.get(batch.courseId);
      return {
        id: batch.id,
        name: batch.name,
        courseId: batch.courseId,
        courseCode: course?.code ?? "",
        courseName: course?.name ?? "",
        label: `${course?.code ?? ""} - ${course?.name ?? ""} (${batch.name})`,
      };
    });
  }, [
    filterOptionsQuery.data?.courses,
    filterOptionsQuery.data?.electiveBatches,
  ]);

  const isElectiveCourse = useMemo(() => {
    const selectedCourse = parseCourseSelectionKey(courseSelectionKey);
    if (!selectedCourse.courseId) {
      return false;
    }
    const hasSections = assignmentOptions.some(
      (assignment) => assignment.courseId === selectedCourse.courseId
    );
    const hasElectiveBatches = electiveBatchOptions.some(
      (option) => option.courseId === selectedCourse.courseId
    );
    // A course is treated as elective (PE) when it has elective batches and
    // no section-based assignments.
    return !hasSections && hasElectiveBatches;
  }, [assignmentOptions, courseSelectionKey, electiveBatchOptions]);

  const courseOptions = useMemo(() => {
    const optionsByKey = new Map<
      string,
      { id: string; code: string; name: string; label: string }
    >();

    for (const assignment of assignmentOptions) {
      optionsByKey.set(assignment.selectionKey, {
        id: assignment.selectionKey,
        code: assignment.courseCode,
        name: assignment.courseName,
        label: assignment.courseLabel,
      });
    }

    for (const batch of electiveBatchOptions) {
      optionsByKey.set(`${batch.courseId}${COURSE_SELECTION_DELIMITER}pe`, {
        id: `${batch.courseId}${COURSE_SELECTION_DELIMITER}pe`,
        code: batch.courseCode,
        name: batch.courseName,
        label: batch.label,
      });
    }

    return Array.from(optionsByKey.values());
  }, [assignmentOptions, electiveBatchOptions]);

  const electiveBatchesForSelectedCourse = useMemo(() => {
    const selectedCourse = parseCourseSelectionKey(courseSelectionKey);
    return electiveBatchOptions.filter(
      (option) => option.courseId === selectedCourse.courseId
    );
  }, [courseSelectionKey, electiveBatchOptions]);

  const sectionsForSelectedCourse = useMemo(() => {
    const selectedCourse = parseCourseSelectionKey(courseSelectionKey);

    const filteredAssignments = assignmentOptions.filter((assignment) => {
      if (!selectedCourse.courseId) {
        return true;
      }

      if (assignment.courseId !== selectedCourse.courseId) {
        return false;
      }

      return (assignment.batchId ?? undefined) === selectedCourse.batchId;
    });

    return filteredAssignments.map((assignment) => ({
      id: `${assignment.sectionId}${COURSE_SELECTION_DELIMITER}${assignment.batchId ?? "theory"}`,
      name: assignment.sectionName,
      courseId: assignment.courseId,
      label: assignment.sectionName,
    }));
  }, [assignmentOptions, courseSelectionKey]);

  const selectedFixedSlot = useMemo(() => {
    if (!form.fixedTimingCode) {
      return null;
    }

    return (
      ATTENDANCE_TIME_SLOTS.find(
        (slot) => slot.code === form.fixedTimingCode
      ) ?? null
    );
  }, [form.fixedTimingCode]);

  const hasValidTiming = useMemo(() => {
    if (form.timingMode === "FIXED") {
      return Boolean(form.fixedTimingCode);
    }

    if (!form.customStartTime || !form.customEndTime) {
      return false;
    }

    return form.customStartTime < form.customEndTime;
  }, [
    form.customEndTime,
    form.customStartTime,
    form.fixedTimingCode,
    form.timingMode,
  ]);

  const selectedTimingWindow = useMemo(() => {
    if (form.timingMode === "FIXED") {
      if (!selectedFixedSlot) {
        return null;
      }

      return {
        startTime: selectedFixedSlot.startTime,
        endTime: selectedFixedSlot.endTime,
        label: selectedFixedSlot.label,
      };
    }

    if (!form.customStartTime || !form.customEndTime) {
      return null;
    }

    return {
      startTime: form.customStartTime,
      endTime: form.customEndTime,
      label: `${form.customStartTime} - ${form.customEndTime}`,
    };
  }, [
    form.customEndTime,
    form.customStartTime,
    form.timingMode,
    selectedFixedSlot,
  ]);

  const overlapCheckQuery = useFacultyAttendanceSessions(
    {
      sessionDate: form.sessionDate
        ? dayjs(form.sessionDate).format("YYYY-MM-DD")
        : undefined,
      courseId: form.courseId || undefined,
      sectionId: form.sectionId || undefined,
      batchId: form.batchId,
      electiveBatchId: form.electiveBatchId,
      page: 1,
      limit: 100,
    },
    Boolean(
      form.sessionDate &&
        form.courseId &&
        (isElectiveCourse ? form.electiveBatchId : form.sectionId) &&
        selectedTimingWindow
    )
  );

  const exactSession = useMemo(() => {
    if (!selectedTimingWindow) {
      return null;
    }

    const sessions = overlapCheckQuery.data?.items ?? [];

    return (
      sessions.find((session) => {
        return (
          session.timingStartTime === selectedTimingWindow.startTime &&
          session.timingEndTime === selectedTimingWindow.endTime
        );
      }) ?? null
    );
  }, [overlapCheckQuery.data?.items, selectedTimingWindow]);

  const overlappingSession = useMemo(() => {
    if (!selectedTimingWindow) {
      return null;
    }

    const sessions = overlapCheckQuery.data?.items ?? [];

    return (
      sessions.find((session) => {
        if (session.id === activeSessionId) {
          return false;
        }

        const isExactMatch =
          session.timingStartTime === selectedTimingWindow.startTime &&
          session.timingEndTime === selectedTimingWindow.endTime;

        if (isExactMatch) {
          return false;
        }

        return hasTimeOverlap(
          selectedTimingWindow.startTime,
          selectedTimingWindow.endTime,
          session.timingStartTime,
          session.timingEndTime
        );
      }) ?? null
    );
  }, [activeSessionId, overlapCheckQuery.data?.items, selectedTimingWindow]);

  const overlapError = exactSession
    ? "Attendance already taken for this slot. Please use the Edit Attendance tab to modify it."
    : overlappingSession
      ? "Selected time slot overlaps another session"
      : null;

  useEffect(() => {
    if (!sessionDetailQuery.isError || !activeSessionId) {
      return;
    }

    toast.error(
      getApiErrorMessage(
        sessionDetailQuery.error,
        "Failed to load attendance session detail"
      )
    );
  }, [activeSessionId, sessionDetailQuery.error, sessionDetailQuery.isError]);

  const totalStudents = studentChecklist.length;
  const presentCount = useMemo(
    () =>
      studentChecklist.filter((student) => student.status === "PRESENT").length,
    [studentChecklist]
  );
  const absentCount = useMemo(
    () =>
      studentChecklist.filter((student) => student.status === "ABSENT").length,
    [studentChecklist]
  );
  const unmarkedCount = totalStudents - presentCount - absentCount;
  const markedCount = presentCount + absentCount;
  const presentRate =
    markedCount > 0 ? Math.round((presentCount / markedCount) * 1000) / 10 : 0;

  const updateStudentStatus = (studentId: string, isPresent: boolean) => {
    setStudentChecklist((current) =>
      current.map((student) =>
        student.studentId === studentId
          ? { ...student, status: isPresent ? "PRESENT" : "ABSENT" }
          : student
      )
    );
  };

  const setAllStudentsStatus = (nextStatus: "PRESENT" | "ABSENT") => {
    setStudentChecklist((current) =>
      current.map((student) => ({
        ...student,
        status: nextStatus,
      }))
    );
  };

  const canOpenSession = useMemo(() => {
    if (!form.sessionDate || !form.courseId) {
      return false;
    }

    if (isElectiveCourse ? !form.electiveBatchId : !form.sectionId) {
      return false;
    }

    if (!hasValidTiming) {
      return false;
    }

    if (overlapCheckQuery.isFetching || overlapCheckQuery.isLoading) {
      return false;
    }

    if (overlapError) {
      return false;
    }

    return true;
  }, [
    form.courseId,
    form.electiveBatchId,
    form.sessionDate,
    form.sectionId,
    hasValidTiming,
    isElectiveCourse,
    overlapError,
    overlapCheckQuery.isFetching,
    overlapCheckQuery.isLoading,
  ]);

  const canSaveAttendance = useMemo(() => {
    if (!canOpenSession) {
      return false;
    }

    return studentChecklist.length > 0 && unmarkedCount === 0;
  }, [canOpenSession, studentChecklist.length, unmarkedCount]);

  useEffect(() => {
    setForm((current) =>
      current.sessionDate
        ? current
        : {
            ...current,
            sessionDate: new Date(),
          }
    );
  }, []);

  const updateCourse = (selectionValue: string) => {
    const parsed = parseCourseSelectionKey(selectionValue);
    setCourseSelectionKey(selectionValue);
    setSectionSelectionKey("");

    setForm((current) => {
      return {
        ...current,
        courseId: parsed.courseId,
        batchId: parsed.batchId,
        sectionId: "",
        electiveBatchId: undefined,
      };
    });
  };

  const updateElectiveBatch = (electiveBatchId: string) => {
    setForm((current) => {
      return {
        ...current,
        electiveBatchId,
        sectionId: "",
        batchId: undefined,
      };
    });
  };

  const updateTimingMode = (timingMode: "FIXED" | "CUSTOM") => {
    setForm((current) => {
      if (timingMode === "FIXED") {
        return {
          ...current,
          timingMode,
          customStartTime: "",
          customEndTime: "",
        };
      }
      return {
        ...current,
        timingMode,
        fixedTimingCode: "",
      };
    });
  };

  const selectedSession = exactSession;
  const isSessionStudentsQueryEnabled = Boolean(
    form.courseId &&
      (isElectiveCourse ? form.electiveBatchId : form.sectionId) &&
      !activeSessionId
  );

  const sessionStudentsQuery = useFacultyAttendanceSessionStudents(
    {
      courseId: form.courseId,
      sectionId: isElectiveCourse ? undefined : form.sectionId,
      batchId: form.batchId,
      electiveBatchId: isElectiveCourse ? form.electiveBatchId : undefined,
    },
    isSessionStudentsQueryEnabled
  );

  useEffect(() => {
    if (
      !isTakeAttendanceModalOpen ||
      !sessionStudentsQuery.data ||
      activeSessionId ||
      selectedSession
    ) {
      return;
    }

    setStudentChecklist(
      withUiChecklistMetadata(sessionStudentsQuery.data.students, {
        defaultStatus: "PRESENT",
      })
    );
  }, [
    activeSessionId,
    isTakeAttendanceModalOpen,
    selectedSession,
    sessionStudentsQuery.data,
    sessionStudentsQuery.dataUpdatedAt,
  ]);

  useEffect(() => {
    if (!isTakeAttendanceModalOpen || !sessionStudentsQuery.isError) {
      return;
    }

    toast.error(
      getApiErrorMessage(
        sessionStudentsQuery.error,
        "Failed to load attendance roster"
      )
    );
  }, [
    isTakeAttendanceModalOpen,
    sessionStudentsQuery.error,
    sessionStudentsQuery.isError,
  ]);

  useEffect(() => {
    if (!showSaveSuccessToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowSaveSuccessToast(false);
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showSaveSuccessToast]);

  const handleSaveAttendance = async () => {
    if (!canSaveAttendance || !form.sessionDate) {
      return;
    }

    // Re-check overlap before saving in case data loaded after modal opened
    if (exactSession) {
      toast.error(
        "Attendance already taken for this session. Please use the Edit Attendance tab to modify it."
      );
      setIsTakeAttendanceModalOpen(false);
      return;
    }

    try {
      const response = await createOrOpenMutation.mutateAsync({
        courseId: form.courseId,
        sectionId: isElectiveCourse ? undefined : form.sectionId,
        batchId: isElectiveCourse ? undefined : form.batchId,
        electiveBatchId: isElectiveCourse ? form.electiveBatchId : undefined,
        sessionDate: dayjs(form.sessionDate).format("YYYY-MM-DD"),
        timingMode: form.timingMode,
        timingCode:
          form.timingMode === "FIXED"
            ? form.fixedTimingCode || undefined
            : undefined,
        timingStartTime:
          form.timingMode === "CUSTOM" ? form.customStartTime : undefined,
        timingEndTime:
          form.timingMode === "CUSTOM" ? form.customEndTime : undefined,
        studentStatuses: studentChecklist.map((student) => ({
          studentId: student.studentId,
          status: student.status ?? "PRESENT",
        })),
      });

      setActiveSessionId(response.session.id);
      setIsTakeAttendanceModalOpen(false);
      setShowSaveSuccessToast(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to save attendance"));
    }
  };

  const handleTakeAttendance = () => {
    if (!canOpenSession) {
      return;
    }

    // Strictly for creating NEW attendance: clear the checklist, open modal, and fetch the roster
    setStudentChecklist([]);
    setActiveSessionId("");
    setIsTakeAttendanceModalOpen(true);
    sessionStudentsQuery.refetch();
  };

  const handleDeleteSessionConfirm = async () => {
    if (!deleteConfirmSessionId) {
      return;
    }

    try {
      setDeletingSessionId(deleteConfirmSessionId);
      await deleteSessionMutation.mutateAsync(deleteConfirmSessionId);
      setDeleteConfirmSessionId(null);
      toast.success("Attendance session deleted successfully");
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Failed to delete attendance session")
      );
    } finally {
      setDeletingSessionId(null);
    }
  };

  const selectedCourseLabel = useMemo(() => {
    if (isElectiveCourse) {
      const option = electiveBatchOptions.find(
        (entry) => entry.courseId === form.courseId
      );
      return option
        ? `${option.courseCode} - ${option.courseName}`
        : "Not selected";
    }
    const course = assignmentOptions.find(
      (entry) =>
        entry.courseId === form.courseId &&
        (entry.batchId ?? undefined) === (form.batchId ?? undefined)
    );
    return course ? course.courseLabel : "Not selected";
  }, [
    assignmentOptions,
    electiveBatchOptions,
    form.batchId,
    form.courseId,
    isElectiveCourse,
  ]);

  const selectedSectionLabel = useMemo(() => {
    if (isElectiveCourse) {
      const batch = electiveBatchOptions.find(
        (entry) => entry.id === form.electiveBatchId
      );
      return batch ? batch.name : "Not selected";
    }
    const section = assignmentOptions.find(
      (entry) =>
        entry.sectionId === form.sectionId &&
        entry.courseId === form.courseId &&
        (entry.batchId ?? undefined) === (form.batchId ?? undefined)
    );
    return section ? section.sectionName : "Not selected";
  }, [
    assignmentOptions,
    electiveBatchOptions,
    form.batchId,
    form.courseId,
    form.electiveBatchId,
    form.sectionId,
    isElectiveCourse,
  ]);

  return (
    <AttendancePageShell
      toastMessage={
        showSaveSuccessToast ? "Attendance saved successfully" : null
      }
    >
      <AttendanceForm
        form={form}
        courses={courseOptions}
        sections={sectionsForSelectedCourse}
        electiveBatches={electiveBatchesForSelectedCourse}
        selectedCourseValue={courseSelectionKey}
        selectedSectionValue={sectionSelectionKey}
        selectedElectiveBatchId={form.electiveBatchId}
        isLabBatch={Boolean(form.batchId)} // Added property to detect lab batch
        isElective={isElectiveCourse}
        onDateChange={(date) => {
          setForm((current) => ({
            ...current,
            sessionDate: date,
          }));
        }}
        onCourseChange={updateCourse}
        onSectionChange={(sectionSelection) => {
          const parsed = parseSectionSelectionKey(sectionSelection);
          setSectionSelectionKey(sectionSelection);
          setForm((current) => ({
            ...current,
            sectionId: parsed.sectionId,
            batchId: parsed.batchId,
            electiveBatchId: undefined,
          }));
        }}
        onElectiveBatchChange={updateElectiveBatch}
        onTimingModeChange={updateTimingMode}
        onFixedSlotChange={(fixedTimingCode) => {
          setForm((current) => ({
            ...current,
            fixedTimingCode,
          }));
        }}
        onCustomStartTimeChange={(customStartTime) => {
          setForm((current) => ({
            ...current,
            customStartTime,
          }));
        }}
        onCustomEndTimeChange={(customEndTime) => {
          setForm((current) => ({
            ...current,
            customEndTime,
          }));
        }}
        onTakeAttendance={handleTakeAttendance}
        isTakeAttendanceDisabled={
          !canOpenSession || createOrOpenMutation.isPending
        }
        overlapError={overlapError}
      />

      <Dialog
        open={isTakeAttendanceModalOpen}
        onOpenChange={setIsTakeAttendanceModalOpen}
      >
        <DialogContent className="max-h-[90vh] w-[96vw] max-w-[96vw] overflow-y-auto sm:w-[94vw] sm:max-w-5xl lg:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Take Attendance</DialogTitle>
            <DialogDescription>
              Review context, mark student attendance, and save this session.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/20 grid grid-cols-1 gap-3 rounded-lg border p-4 text-sm md:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Course:</span>{" "}
              {selectedCourseLabel}
            </p>
            <p>
              <span className="text-muted-foreground">
                {isElectiveCourse ? "Elective Batch:" : "Section:"}
              </span>{" "}
              {selectedSectionLabel}
            </p>
            <p>
              <span className="text-muted-foreground">Date:</span>{" "}
              {form.sessionDate
                ? dayjs(form.sessionDate).format("MMM D, YYYY")
                : "Not selected"}
            </p>
            <p>
              <span className="text-muted-foreground">Time Slot:</span>{" "}
              {selectedTimingWindow?.label ?? "Not selected"}
            </p>
          </div>

          <AttendanceSection
            studentChecklist={studentChecklist}
            isLoading={
              sessionDetailQuery.isLoading || sessionStudentsQuery.isLoading
            }
            isSaving={createOrOpenMutation.isPending}
            onAllPresent={() => setAllStudentsStatus("PRESENT")}
            onAllAbsent={() => setAllStudentsStatus("ABSENT")}
            onToggleStatus={updateStudentStatus}
            totalStudents={totalStudents}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-700">
                Present: {presentCount}
              </span>
              <span className="rounded-md bg-rose-500/10 px-2 py-1 text-rose-700">
                Absent: {absentCount}
              </span>
              <span className="bg-muted text-muted-foreground rounded-md px-2 py-1">
                Unmarked: {unmarkedCount}
              </span>
              <span className="text-muted-foreground">
                Present Rate: {presentRate}%
              </span>
            </div>

            <Button
              type="button"
              onClick={handleSaveAttendance}
              disabled={!canSaveAttendance || createOrOpenMutation.isPending}
              className="min-w-52"
            >
              {createOrOpenMutation.isPending
                ? "Saving..."
                : canSaveAttendance
                  ? "Save Attendance"
                  : `Mark Remaining (${unmarkedCount})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteConfirmSessionId)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteConfirmSessionId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Attendance Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this attendance session? This
              action cannot be undone. Session attendance records will be
              removed and totals will be recalculated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmSessionId(null)}
              disabled={deletingSessionId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSessionConfirm}
              disabled={deletingSessionId !== null}
            >
              {deletingSessionId === deleteConfirmSessionId
                ? "Deleting..."
                : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AttendancePageShell>
  );
};
