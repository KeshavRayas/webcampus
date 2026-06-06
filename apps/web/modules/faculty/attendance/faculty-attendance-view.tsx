"use client";

import { getApiErrorMessage } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
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
  useFacultyAttendanceSessions,
  useFacultyAttendanceSessionStudents,
} from "./use-faculty-attendance";

type AttendanceSessionModalFilters = {
  sessionDate: Date | undefined;
  courseId: string;
  sectionId: string;
  batchId?: string;
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
  batchId: undefined,
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

const isFixedTimingCode = (
  timingCode: string
): timingCode is Exclude<FacultyAttendanceFormState["fixedTimingCode"], ""> => {
  return ATTENDANCE_TIME_SLOTS.some((slot) => slot.code === timingCode);
};

const parseSessionDate = (sessionDate: string) => {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(sessionDate);

  return new Date(isDateOnly ? `${sessionDate}T00:00:00` : sessionDate);
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
  const [modalCourseSelectionKey, setModalCourseSelectionKey] =
    useState<string>("");
  const [modalSectionSelectionKey, setModalSectionSelectionKey] =
    useState<string>("");
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
  const queryClient = useQueryClient();
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
      batchId: appliedSessionFilters.batchId,
      page: appliedSessionFilters.page,
      limit: appliedSessionFilters.limit,
    },
    isSessionsDialogOpen
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

    return Array.from(optionsByKey.values());
  }, [assignmentOptions]);

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

  const overlapError =
    !exactSession && overlappingSession
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
    batchId?: string;
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
      batchId: session.batchId,
      timingMode: fixedTimingCode ? "FIXED" : "CUSTOM",
      fixedTimingCode,
      customStartTime: fixedTimingCode ? "" : session.timingStartTime,
      customEndTime: fixedTimingCode ? "" : session.timingEndTime,
    });

    setCourseSelectionKey(
      toCourseSelectionKey(session.courseId, session.batchId)
    );
    setSectionSelectionKey(
      `${session.sectionId}${COURSE_SELECTION_DELIMITER}${session.batchId ?? "theory"}`
    );
  };

  useEffect(() => {
    const data = sessionDetailQuery.data;
    if (
      !data ||
      typeof data !== "object" ||
      !("session" in data) ||
      !("students" in data)
    ) {
      return;
    }

    if (data.session.id !== activeSessionId) {
      return;
    }

    hydrateFormFromSession(data.session);
    setStudentChecklist(withUiChecklistMetadata(data.students));
    setOpeningSessionId(null);
  }, [
    activeSessionId,
    sessionDetailQuery.data,
    sessionDetailQuery.dataUpdatedAt,
  ]);

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
    setOpeningSessionId(null);
    resetActiveSessionContext();
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
    const selectedCourse = parseCourseSelectionKey(modalCourseSelectionKey);

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
  }, [assignmentOptions, modalCourseSelectionKey]);

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
    setModalCourseSelectionKey("");
    setModalSectionSelectionKey("");
  };

  const handleSessionCourseChange = (selectionValue: string) => {
    const parsed = parseCourseSelectionKey(selectionValue);
    setModalCourseSelectionKey(selectionValue);
    setModalSectionSelectionKey("");

    setSessionModalFilters((current) => ({
      ...current,
      courseId: parsed.courseId,
      batchId: parsed.batchId,
      sectionId: "",
    }));
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

  const updateCourse = (selectionValue: string) => {
    const parsed = parseCourseSelectionKey(selectionValue);
    clearActiveSessionOnly();
    setCourseSelectionKey(selectionValue);
    setSectionSelectionKey("");

    setForm((current) => {
      return {
        ...current,
        courseId: parsed.courseId,
        batchId: parsed.batchId,
        sectionId: "",
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
      batchId: form.batchId,
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
        batchId: form.batchId,
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

  const handleSelectSessionFromModal = async (sessionId: string) => {
    setOpeningSessionId(sessionId);
    setStudentChecklist([]);
    setActiveSessionId(sessionId);
    setIsTakeAttendanceModalOpen(true);
    setIsSessionsDialogOpen(false);

    try {
      await queryClient.invalidateQueries({
        queryKey: ["faculty-attendance", "session-detail"],
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load session details"));
      setOpeningSessionId(null);
      setActiveSessionId("");
      setIsTakeAttendanceModalOpen(false);
    }
  };

  const handleDeleteSessionFromModal = (sessionId: string) => {
    setDeleteConfirmSessionId(sessionId);
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
    const course = assignmentOptions.find(
      (entry) =>
        entry.courseId === form.courseId &&
        (entry.batchId ?? undefined) === (form.batchId ?? undefined)
    );
    return course ? course.courseLabel : "Not selected";
  }, [assignmentOptions, form.batchId, form.courseId]);

  const selectedSectionLabel = useMemo(() => {
    const section = assignmentOptions.find(
      (entry) =>
        entry.sectionId === form.sectionId &&
        entry.courseId === form.courseId &&
        (entry.batchId ?? undefined) === (form.batchId ?? undefined)
    );
    return section ? section.sectionName : "Not selected";
  }, [assignmentOptions, form.batchId, form.courseId, form.sectionId]);

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
        selectedCourseValue={courseSelectionKey}
        selectedSectionValue={sectionSelectionKey}
        isLabBatch={Boolean(form.batchId)} // Added property to detect lab batch
        onDateChange={(date) => {
          clearActiveSessionOnly();
          setForm((current) => ({
            ...current,
            sessionDate: date,
          }));
        }}
        onCourseChange={updateCourse}
        onSectionChange={(sectionSelection) => {
          const parsed = parseSectionSelectionKey(sectionSelection);
          clearActiveSessionOnly();
          setSectionSelectionKey(sectionSelection);
          setForm((current) => ({
            ...current,
            sectionId: parsed.sectionId,
            batchId: parsed.batchId,
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
        onTakeAttendance={handleTakeAttendance}
        isTakeAttendanceDisabled={
          !canOpenSession || createOrOpenMutation.isPending
        }
        overlapError={overlapError}
      />

      <ManageSessionsModal
        isOpen={isSessionsDialogOpen}
        onOpenChange={setIsSessionsDialogOpen}
        filters={sessionModalFilters}
        selectedCourseValue={modalCourseSelectionKey}
        selectedSectionValue={modalSectionSelectionKey}
        onDateChange={(sessionDate) =>
          setSessionModalFilters((current) => ({
            ...current,
            sessionDate,
          }))
        }
        onCourseChange={handleSessionCourseChange}
        onSectionChange={(sectionSelection) => {
          const parsed = parseSectionSelectionKey(sectionSelection);
          setModalSectionSelectionKey(sectionSelection);
          setSessionModalFilters((current) => ({
            ...current,
            sectionId: parsed.sectionId,
            batchId: parsed.batchId,
          }));
        }}
        onApplyFilters={applySessionFilters}
        onClearFilters={resetSessionFilters}
        courses={courseOptions}
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

          <div className="bg-muted/20 grid grid-cols-1 gap-3 rounded-lg border p-4 text-sm md:grid-cols-2">
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
