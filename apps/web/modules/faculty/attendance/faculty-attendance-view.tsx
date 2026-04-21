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
import { ManageSessionsModal } from "./components/manage-sessions-modal";
import {
  AttendanceChecklistRow,
  FacultyAttendanceFormState,
} from "./faculty-attendance-types";
import {
  useCreateOrOpenFacultyAttendanceSession,
  useDeleteFacultyAttendanceSession,
  useFacultyAttendanceFilterOptions,
  useFacultyAttendanceSessionDetail,
  useFacultyAttendanceSessionStudents,
  useFacultyAttendanceSessions,
} from "./use-faculty-attendance";

type AttendanceSessionModalFilters = {
  sessionDate: Date | undefined;
  courseId: string;
  sectionId: string;
};

type AttendanceSessionQueryState = AttendanceSessionModalFilters & {
  page: number;
  limit: number;
};

const DEFAULT_SESSION_PAGE_SIZE = 10;

const EMPTY_SESSION_MODAL_FILTERS: AttendanceSessionModalFilters = {
  sessionDate: undefined,
  courseId: "",
  sectionId: "",
};

const INITIAL_SESSION_QUERY_STATE: AttendanceSessionQueryState = {
  ...EMPTY_SESSION_MODAL_FILTERS,
  page: 1,
  limit: DEFAULT_SESSION_PAGE_SIZE,
};

const INITIAL_FORM_STATE: FacultyAttendanceFormState = {
  sessionDate: undefined,
  courseId: "",
  sectionId: "",
  timingMode: "FIXED",
  fixedTimingCode: "",
  customStartTime: "",
  customEndTime: "",
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

  if (
    startA === null ||
    endA === null ||
    startB === null ||
    endB === null
  ) {
    return false;
  }

  return startA < endB && endA > startB;
};

const isFixedTimingCode = (
  timingCode: string
): timingCode is Exclude<FacultyAttendanceFormState["fixedTimingCode"], ""> => {
  return ATTENDANCE_TIME_SLOTS.some((slot) => slot.code === timingCode);
};

const parseSessionDate = (sessionDate: string) => {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(sessionDate);

  return new Date(
    isDateOnly ? `${sessionDate}T00:00:00` : sessionDate
  );
};

const toStableAttendancePercentage = (studentId: string, usn: string) => {
  const seed = `${studentId}:${usn}`;
  const hash = seed
    .split("")
    .reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0);

  return 65 + (hash % 31);
};

const withUiChecklistMetadata = (
  rows: Array<{
    studentId: string;
    usn: string;
    name: string;
    status: "PRESENT" | "ABSENT";
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
    previousAttendancePercentage: toStableAttendancePercentage(
      student.studentId,
      student.usn
    ),
  }));
};

export const FacultyAttendanceView = () => {
  const [form, setForm] =
    useState<FacultyAttendanceFormState>(INITIAL_FORM_STATE);
  const [studentChecklist, setStudentChecklist] = useState<
    AttendanceChecklistRow[]
  >([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [isTakeAttendanceModalOpen, setIsTakeAttendanceModalOpen] =
    useState(false);
  const [openingSessionId, setOpeningSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(
    null
  );
  const [deleteConfirmSessionId, setDeleteConfirmSessionId] = useState<
    string | null
  >(null);
  const [isSessionsDialogOpen, setIsSessionsDialogOpen] = useState(false);
  const [sessionModalFilters, setSessionModalFilters] =
    useState<AttendanceSessionModalFilters>(EMPTY_SESSION_MODAL_FILTERS);
  const [appliedSessionFilters, setAppliedSessionFilters] =
    useState<AttendanceSessionQueryState>(INITIAL_SESSION_QUERY_STATE);
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

  const sessionsQuery = useFacultyAttendanceSessions(
    {
      sessionDate: appliedSessionFilters.sessionDate
        ? dayjs(appliedSessionFilters.sessionDate).format("YYYY-MM-DD")
        : undefined,
      courseId: appliedSessionFilters.courseId || undefined,
      sectionId: appliedSessionFilters.sectionId || undefined,
      page: appliedSessionFilters.page,
      limit: appliedSessionFilters.limit,
    },
    isSessionsDialogOpen
  );

  const sectionsForSelectedCourse = useMemo(() => {
    const allSections = filterOptionsQuery.data?.sections ?? [];

    if (!form.courseId) {
      return allSections;
    }

    return allSections.filter((section) => section.courseId === form.courseId);
  }, [filterOptionsQuery.data?.sections, form.courseId]);

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
      page: 1,
      limit: 200,
    },
    Boolean(
      form.sessionDate &&
        form.courseId &&
        form.sectionId &&
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

  const overlapError = !exactSession && overlappingSession
    ? "Selected time slot overlaps another session"
    : null;

  const resetActiveSessionContext = () => {
    setActiveSessionId("");
    setOpeningSessionId(null);
    setIsTakeAttendanceModalOpen(false);
    setStudentChecklist([]);
  };

  const clearActiveSessionOnly = () => {
    setActiveSessionId("");
    setOpeningSessionId(null);
    setStudentChecklist([]);
    // Keep modal open to avoid race conditions with async queries
  };

  const hydrateFormFromSession = (session: {
    sessionDate: string;
    courseId: string;
    sectionId: string;
    timingCode: string;
    timingStartTime: string;
    timingEndTime: string;
  }) => {
    const fixedTimingCode = isFixedTimingCode(session.timingCode)
      ? session.timingCode
      : "";

    setForm({
      sessionDate: parseSessionDate(session.sessionDate),
      courseId: session.courseId,
      sectionId: session.sectionId,
      timingMode: fixedTimingCode ? "FIXED" : "CUSTOM",
      fixedTimingCode,
      customStartTime: fixedTimingCode ? "" : session.timingStartTime,
      customEndTime: fixedTimingCode ? "" : session.timingEndTime,
    });
  };

  useEffect(() => {
    if (!sessionDetailQuery.data) {
      return;
    }

    if (sessionDetailQuery.data.session.id !== activeSessionId) {
      return;
    }

    hydrateFormFromSession(sessionDetailQuery.data.session);
    setStudentChecklist(withUiChecklistMetadata(sessionDetailQuery.data.students));
    setOpeningSessionId(null);
  }, [activeSessionId, sessionDetailQuery.data]);

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
    resetActiveSessionContext();
  }, [activeSessionId, sessionDetailQuery.error, sessionDetailQuery.isError]);

  const totalStudents = studentChecklist.length;
  const presentCount = useMemo(
    () =>
      studentChecklist.filter((student) => student.status === "PRESENT").length,
    [studentChecklist]
  );
  const absentCount = useMemo(
    () => studentChecklist.filter((student) => student.status === "ABSENT").length,
    [studentChecklist]
  );
  const unmarkedCount = totalStudents - presentCount - absentCount;
  const markedCount = presentCount + absentCount;
  const presentRate =
    markedCount > 0 ? Math.round((presentCount / markedCount) * 1000) / 10 : 0;

  const updateStudentStatus = (
    studentId: string,
    nextStatus: "PRESENT" | "ABSENT"
  ) => {
    setStudentChecklist((current) =>
      current.map((student) =>
        student.studentId === studentId
          ? {
              ...student,
              status: student.status === nextStatus ? null : nextStatus,
            }
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
    if (!form.sessionDate || !form.courseId || !form.sectionId) {
      return false;
    }

    if (!hasValidTiming) {
      return false;
    }

    return !overlapError;
  }, [
    form.courseId,
    form.sectionId,
    form.sessionDate,
    hasValidTiming,
    overlapError,
  ]);

  const canSaveAttendance = useMemo(() => {
    if (!canOpenSession) {
      return false;
    }

    return studentChecklist.length > 0 && unmarkedCount === 0;
  }, [canOpenSession, studentChecklist.length, unmarkedCount]);

  const modalSectionsForSelectedCourse = useMemo(() => {
    const allSections = filterOptionsQuery.data?.sections ?? [];

    if (!sessionModalFilters.courseId) {
      return allSections;
    }

    return allSections.filter(
      (section) => section.courseId === sessionModalFilters.courseId
    );
  }, [filterOptionsQuery.data?.sections, sessionModalFilters.courseId]);

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

  const applySessionFilters = () => {
    setAppliedSessionFilters({
      ...sessionModalFilters,
      page: 1,
      limit: DEFAULT_SESSION_PAGE_SIZE,
    });
  };

  const resetSessionFilters = () => {
    setSessionModalFilters(EMPTY_SESSION_MODAL_FILTERS);
    setAppliedSessionFilters(INITIAL_SESSION_QUERY_STATE);
  };

  const handleSessionCourseChange = (courseId: string) => {
    setSessionModalFilters((current) => {
      const nextSections = (filterOptionsQuery.data?.sections ?? []).filter(
        (section) => section.courseId === courseId
      );

      const isCurrentSectionStillValid = nextSections.some(
        (section) => section.id === current.sectionId
      );

      return {
        ...current,
        courseId,
        sectionId: isCurrentSectionStillValid ? current.sectionId : "",
      };
    });
  };

  const goToSessionPage = (nextPage: number) => {
    const totalPages = sessionsQuery.data?.pagination.totalPages ?? 1;
    const boundedPage = Math.min(Math.max(nextPage, 1), totalPages);

    setAppliedSessionFilters((current) => ({
      ...current,
      page: boundedPage,
    }));
  };

  const sessionPagination = sessionsQuery.data?.pagination ?? {
    page: appliedSessionFilters.page,
    limit: appliedSessionFilters.limit,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };

  const sessionRows = sessionsQuery.data?.items ?? [];

  const updateCourse = (courseId: string) => {
    clearActiveSessionOnly();
    setForm((current) => {
      const nextSections = (filterOptionsQuery.data?.sections ?? []).filter(
        (section) => section.courseId === courseId
      );

      const isCurrentSectionStillValid = nextSections.some(
        (section) => section.id === current.sectionId
      );

      return {
        ...current,
        courseId,
        sectionId: isCurrentSectionStillValid ? current.sectionId : "",
      };
    });
  };

  const updateTimingMode = (timingMode: "FIXED" | "CUSTOM") => {
    clearActiveSessionOnly();
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
    form.courseId && form.sectionId && !activeSessionId
  );

  const sessionStudentsQuery = useFacultyAttendanceSessionStudents(
    {
      courseId: form.courseId,
      sectionId: form.sectionId,
    },
    isSessionStudentsQueryEnabled
  );

  useEffect(() => {
    if (!selectedSession || activeSessionId === selectedSession.id) {
      return;
    }

    setActiveSessionId(selectedSession.id);
  }, [activeSessionId, selectedSession]);

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
    resetActiveSessionContext();
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

    try {
      const response = await createOrOpenMutation.mutateAsync({
        courseId: form.courseId,
        sectionId: form.sectionId,
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

  const handleSelectSessionFromModal = (sessionId: string) => {
    setOpeningSessionId(sessionId);
    setStudentChecklist([]);
    setActiveSessionId(sessionId);
    setIsTakeAttendanceModalOpen(true);
    setIsSessionsDialogOpen(false);
  };

  const handleDeleteSessionFromModal = (sessionId: string) => {
    setDeleteConfirmSessionId(sessionId);
  };

  const handleEditAttendance = () => {
    setIsSessionsDialogOpen(true);
  };

  const handleTakeAttendance = () => {
    if (!canOpenSession) {
      return;
    }

    if (selectedSession && activeSessionId !== selectedSession.id) {
      setOpeningSessionId(selectedSession.id);
      setStudentChecklist([]);
      setActiveSessionId(selectedSession.id);
    }

    if (!selectedSession) {
      setStudentChecklist([]);
    }

    setIsTakeAttendanceModalOpen(true);

    if (!selectedSession) {
      // Refetch to refresh roster state even when React Query serves a structurally shared payload.
      sessionStudentsQuery.refetch();
    }
  };

  const handleDeleteSessionConfirm = async () => {
    if (!deleteConfirmSessionId) {
      return;
    }

    try {
      setDeletingSessionId(deleteConfirmSessionId);
      await deleteSessionMutation.mutateAsync(deleteConfirmSessionId);

      if (activeSessionId === deleteConfirmSessionId) {
        resetActiveSessionContext();
      }

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
    const course = (filterOptionsQuery.data?.courses ?? []).find(
      (entry) => entry.id === form.courseId
    );
    return course ? `${course.code} - ${course.name}` : "Not selected";
  }, [filterOptionsQuery.data?.courses, form.courseId]);

  const selectedSectionLabel = useMemo(() => {
    const section = (filterOptionsQuery.data?.sections ?? []).find(
      (entry) => entry.id === form.sectionId
    );
    return section ? section.name : "Not selected";
  }, [filterOptionsQuery.data?.sections, form.sectionId]);

  return (
    <AttendancePageShell
      toastMessage={
        showSaveSuccessToast ? "Attendance saved successfully" : null
      }
    >
      <AttendanceForm
        form={form}
        courses={filterOptionsQuery.data?.courses ?? []}
        sections={sectionsForSelectedCourse}
        onDateChange={(date) => {
          clearActiveSessionOnly();
          setForm((current) => ({
            ...current,
            sessionDate: date,
          }));
        }}
        onCourseChange={updateCourse}
        onSectionChange={(sectionId) => {
          clearActiveSessionOnly();
          setForm((current) => ({
            ...current,
            sectionId,
          }));
        }}
        onTimingModeChange={updateTimingMode}
        onFixedSlotChange={(fixedTimingCode) => {
          clearActiveSessionOnly();
          setForm((current) => ({
            ...current,
            fixedTimingCode,
          }));
        }}
        onCustomStartTimeChange={(customStartTime) => {
          clearActiveSessionOnly();
          setForm((current) => ({
            ...current,
            customStartTime,
          }));
        }}
        onCustomEndTimeChange={(customEndTime) => {
          clearActiveSessionOnly();
          setForm((current) => ({
            ...current,
            customEndTime,
          }));
        }}
        onEditAttendance={handleEditAttendance}
        onTakeAttendance={handleTakeAttendance}
        isEditAttendanceDisabled={createOrOpenMutation.isPending}
        isTakeAttendanceDisabled={!canOpenSession || createOrOpenMutation.isPending}
        overlapError={overlapError}
      />

      <ManageSessionsModal
        isOpen={isSessionsDialogOpen}
        onOpenChange={setIsSessionsDialogOpen}
        filters={sessionModalFilters}
        onDateChange={(sessionDate) =>
          setSessionModalFilters((current) => ({
            ...current,
            sessionDate,
          }))
        }
        onCourseChange={handleSessionCourseChange}
        onSectionChange={(sectionId) =>
          setSessionModalFilters((current) => ({
            ...current,
            sectionId,
          }))
        }
        onApplyFilters={applySessionFilters}
        onClearFilters={resetSessionFilters}
        courses={filterOptionsQuery.data?.courses ?? []}
        sections={modalSectionsForSelectedCourse}
        sessions={sessionRows}
        activeSessionId={activeSessionId}
        isLoading={sessionsQuery.isLoading}
        isError={sessionsQuery.isError}
        errorMessage={
          sessionsQuery.isError
            ? getApiErrorMessage(sessionsQuery.error, "Failed to load sessions")
            : null
        }
        openingSessionId={openingSessionId}
        deletingSessionId={deletingSessionId}
        page={sessionPagination.page}
        totalPages={sessionPagination.totalPages}
        isFetching={sessionsQuery.isFetching}
        onPrevPage={() => goToSessionPage(sessionPagination.page - 1)}
        onNextPage={() => goToSessionPage(sessionPagination.page + 1)}
        onSelectSession={handleSelectSessionFromModal}
        onDeleteSession={handleDeleteSessionFromModal}
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

          <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/20 p-4 text-sm md:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Course:</span>{" "}
              {selectedCourseLabel}
            </p>
            <p>
              <span className="text-muted-foreground">Section:</span>{" "}
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
            isLoading={sessionDetailQuery.isLoading || sessionStudentsQuery.isLoading}
            isSaving={createOrOpenMutation.isPending}
            onAllPresent={() => setAllStudentsStatus("PRESENT")}
            onAllAbsent={() => setAllStudentsStatus("ABSENT")}
            onToggleStatus={updateStudentStatus}
            markedCount={markedCount}
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
              <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
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
