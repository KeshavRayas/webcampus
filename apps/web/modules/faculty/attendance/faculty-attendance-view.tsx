"use client";

import { getApiErrorMessage } from "@/lib/api-client";
import { dayjs } from "@webcampus/common/dayjs";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { Checkbox } from "@webcampus/ui/components/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
} from "@webcampus/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { Skeleton } from "@webcampus/ui/components/skeleton";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { ATTENDANCE_TIME_SLOTS } from "./attendance-time-slots";
import { AttendanceForm } from "./components/attendance-form";
import { ManageSessionsModal } from "./components/manage-sessions-modal";
import { RecentSessions } from "./components/recent-sessions";
import {
  AttendanceChecklistRow,
  FacultyAttendanceFormState,
} from "./faculty-attendance-types";
import {
  useCreateOrOpenFacultyAttendanceSession,
  useFacultyAttendanceSessionDetail,
  useFacultyAttendanceFilterOptions,
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
  const [hours, minutes] = value.split(":").map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
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

  if ([startA, endA, startB, endB].some((value) => value === null)) {
    return false;
  }

  return startA! < endB! && endA! > startB!;
};

export const FacultyAttendanceView = () => {
  const [form, setForm] = useState<FacultyAttendanceFormState>(INITIAL_FORM_STATE);
  const [studentChecklist, setStudentChecklist] = useState<AttendanceChecklistRow[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [isSessionPanelVisible, setIsSessionPanelVisible] = useState(false);
  const [openingSessionId, setOpeningSessionId] = useState<string | null>(null);
  const [submitAction, setSubmitAction] = useState<"OPEN" | "SAVE" | null>(null);
  const [isSessionsDialogOpen, setIsSessionsDialogOpen] = useState(false);
  const [sessionModalFilters, setSessionModalFilters] = useState<AttendanceSessionModalFilters>(
    EMPTY_SESSION_MODAL_FILTERS
  );
  const [appliedSessionFilters, setAppliedSessionFilters] = useState<AttendanceSessionQueryState>(
    INITIAL_SESSION_QUERY_STATE
  );

  const filterOptionsQuery = useFacultyAttendanceFilterOptions();
  const createOrOpenMutation = useCreateOrOpenFacultyAttendanceSession();
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

  const recentSessionsQuery = useFacultyAttendanceSessions(
    {
      page: 1,
      limit: 5,
    },
    true
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

    return ATTENDANCE_TIME_SLOTS.find((slot) => slot.code === form.fixedTimingCode) ?? null;
  }, [form.fixedTimingCode]);

  const hasValidTiming = useMemo(() => {
    if (form.timingMode === "FIXED") {
      return Boolean(form.fixedTimingCode);
    }

    if (!form.customStartTime || !form.customEndTime) {
      return false;
    }

    return form.customStartTime < form.customEndTime;
  }, [form.customEndTime, form.customStartTime, form.fixedTimingCode, form.timingMode]);

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
  }, [form.customEndTime, form.customStartTime, form.timingMode, selectedFixedSlot]);

  const overlapCheckQuery = useFacultyAttendanceSessions(
    {
      sessionDate: form.sessionDate ? dayjs(form.sessionDate).format("YYYY-MM-DD") : undefined,
      courseId: form.courseId || undefined,
      sectionId: form.sectionId || undefined,
      page: 1,
      limit: 200,
    },
    Boolean(form.sessionDate && form.courseId && form.sectionId && selectedTimingWindow)
  );

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

  const overlapError = overlappingSession
    ? "Session already exists for selected time"
    : null;

  const resetActiveSessionContext = () => {
    setActiveSessionId("");
    setOpeningSessionId(null);
    setIsSessionPanelVisible(false);
    setStudentChecklist([]);
  };

  const hydrateFormFromSession = (session: {
    sessionDate: string;
    courseId: string;
    sectionId: string;
    timingCode: string;
    timingStartTime: string;
    timingEndTime: string;
  }) => {
    const isFixedTiming = ATTENDANCE_TIME_SLOTS.some(
      (slot) => slot.code === session.timingCode
    );

    setForm({
      sessionDate: new Date(session.sessionDate),
      courseId: session.courseId,
      sectionId: session.sectionId,
      timingMode: isFixedTiming ? "FIXED" : "CUSTOM",
      fixedTimingCode: isFixedTiming
        ? (session.timingCode as FacultyAttendanceFormState["fixedTimingCode"])
        : "",
      customStartTime: isFixedTiming ? "" : session.timingStartTime,
      customEndTime: isFixedTiming ? "" : session.timingEndTime,
    });
  };

  useEffect(() => {
    if (!sessionDetailQuery.data) {
      return;
    }

    hydrateFormFromSession(sessionDetailQuery.data.session);
    setStudentChecklist(sessionDetailQuery.data.students);
    setIsSessionPanelVisible(true);
    setOpeningSessionId(null);
  }, [
    sessionDetailQuery.data,
  ]);

  useEffect(() => {
    if (!sessionDetailQuery.isError || !activeSessionId) {
      return;
    }

    toast.error(
      getApiErrorMessage(sessionDetailQuery.error, "Failed to load attendance session detail")
    );
    resetActiveSessionContext();
  }, [activeSessionId, sessionDetailQuery.error, sessionDetailQuery.isError]);

  const totalStudents = studentChecklist.length;
  const presentCount = useMemo(
    () => studentChecklist.filter((student) => student.status === "PRESENT").length,
    [studentChecklist]
  );
  const absentCount = totalStudents - presentCount;

  const updateStudentStatus = (
    studentId: string,
    nextStatus: "PRESENT" | "ABSENT"
  ) => {
    setStudentChecklist((current) =>
      current.map((student) =>
        student.studentId === studentId
          ? {
              ...student,
              status: nextStatus,
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
  }, [form.courseId, form.sectionId, form.sessionDate, hasValidTiming, overlapError]);

  const canSaveAttendance = useMemo(() => {
    if (!isSessionPanelVisible) {
      return false;
    }

    if (!canOpenSession) {
      return false;
    }

    return studentChecklist.length > 0;
  }, [canOpenSession, isSessionPanelVisible, studentChecklist.length]);

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

  const openSessionsDialog = () => {
    const initialFilters: AttendanceSessionModalFilters = {
      sessionDate: form.sessionDate,
      courseId: form.courseId,
      sectionId: form.sectionId,
    };

    setSessionModalFilters(initialFilters);
    setAppliedSessionFilters({
      ...initialFilters,
      page: 1,
      limit: DEFAULT_SESSION_PAGE_SIZE,
    });
    setIsSessionsDialogOpen(true);
  };

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
    resetActiveSessionContext();
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
    resetActiveSessionContext();
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

  const handleCreateOrOpenSession = async () => {
    if (!canOpenSession || !form.sessionDate) {
      return;
    }

    try {
      setSubmitAction("OPEN");
      const response = await createOrOpenMutation.mutateAsync({
        courseId: form.courseId,
        sectionId: form.sectionId,
        sessionDate: dayjs(form.sessionDate).format("YYYY-MM-DD"),
        timingMode: form.timingMode,
        timingCode:
          form.timingMode === "FIXED" ? form.fixedTimingCode || undefined : undefined,
        timingStartTime:
          form.timingMode === "CUSTOM" ? form.customStartTime : undefined,
        timingEndTime: form.timingMode === "CUSTOM" ? form.customEndTime : undefined,
      });

      setActiveSessionId(response.session.id);
      setIsSessionPanelVisible(true);

      toast.success(
        response.created
          ? "Session created. You can now mark attendance and save."
          : "Existing session opened. You can now review and save attendance."
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create/open attendance session"));
    } finally {
      setSubmitAction(null);
    }
  };

  const handleSaveAttendance = async () => {
    if (!canSaveAttendance || !form.sessionDate) {
      return;
    }

    try {
      setSubmitAction("SAVE");
      const response = await createOrOpenMutation.mutateAsync({
        courseId: form.courseId,
        sectionId: form.sectionId,
        sessionDate: dayjs(form.sessionDate).format("YYYY-MM-DD"),
        timingMode: form.timingMode,
        timingCode:
          form.timingMode === "FIXED" ? form.fixedTimingCode || undefined : undefined,
        timingStartTime:
          form.timingMode === "CUSTOM" ? form.customStartTime : undefined,
        timingEndTime: form.timingMode === "CUSTOM" ? form.customEndTime : undefined,
        studentStatuses: studentChecklist.map((student) => ({
          studentId: student.studentId,
          status: student.status,
        })),
      });

      setActiveSessionId(response.session.id);

      toast.success(
        `Attendance saved successfully (${presentCount} present, ${absentCount} absent)`
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to save attendance"));
    } finally {
      setSubmitAction(null);
    }
  };

  const handleSelectSessionFromModal = (sessionId: string) => {
    setOpeningSessionId(sessionId);
    setStudentChecklist([]);
    setActiveSessionId(sessionId);
    setIsSessionPanelVisible(true);
    setIsSessionsDialogOpen(false);
  };

  const handleUpdateSessionFromModal = (sessionId: string) => {
    handleSelectSessionFromModal(sessionId);
    toast.info("Session loaded. You can adjust fields and start session to apply updates.");
  };

  const handleDeleteSessionFromModal = (_sessionId: string) => {
    toast.info("Delete is currently unavailable for attendance sessions.");
  };

  return (
    <div className="space-y-6">
      <AttendanceForm
        form={form}
        courses={filterOptionsQuery.data?.courses ?? []}
        sections={sectionsForSelectedCourse}
        onDateChange={(date) => {
          resetActiveSessionContext();
          setForm((current) => ({
            ...current,
            sessionDate: date,
          }));
        }}
        onCourseChange={updateCourse}
        onSectionChange={(sectionId) => {
          resetActiveSessionContext();
          setForm((current) => ({
            ...current,
            sectionId,
          }));
        }}
        onTimingModeChange={updateTimingMode}
        onFixedSlotChange={(fixedTimingCode) => {
          resetActiveSessionContext();
          setForm((current) => ({
            ...current,
            fixedTimingCode,
          }));
        }}
        onCustomStartTimeChange={(customStartTime) => {
          resetActiveSessionContext();
          setForm((current) => ({
            ...current,
            customStartTime,
          }));
        }}
        onCustomEndTimeChange={(customEndTime) => {
          resetActiveSessionContext();
          setForm((current) => ({
            ...current,
            customEndTime,
          }));
        }}
        onStartSession={handleCreateOrOpenSession}
        onManageSessions={openSessionsDialog}
        canStartSession={canOpenSession}
        isStartingSession={createOrOpenMutation.isPending && submitAction === "OPEN"}
        overlapError={overlapError}
      />

      <RecentSessions
        sessions={recentSessionsQuery.data?.items ?? []}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSessionFromModal}
      />

      {isSessionPanelVisible ? (
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Session Students</p>
                <p className="text-muted-foreground text-xs">
                  Mark students and save attendance updates.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Total {totalStudents}</Badge>
                <Badge>Present {presentCount}</Badge>
                <Badge variant="outline">Absent {absentCount}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAllStudentsStatus("PRESENT")}
                disabled={studentChecklist.length === 0 || createOrOpenMutation.isPending}
              >
                Mark All Present
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAllStudentsStatus("ABSENT")}
                disabled={studentChecklist.length === 0 || createOrOpenMutation.isPending}
              >
                Mark All Absent
              </Button>
            </div>

            {sessionDetailQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-9 w-full" />
                ))}
              </div>
            ) : studentChecklist.length === 0 ? (
              <div className="text-muted-foreground rounded-md border p-3 text-sm">
                No students were found for this attendance session.
              </div>
            ) : (
              <>
                <div className="max-h-72 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>USN</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-36 text-center">Present</TableHead>
                        <TableHead className="w-36 text-center">Absent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentChecklist.map((student) => (
                        <TableRow key={student.studentId}>
                          <TableCell>{student.usn}</TableCell>
                          <TableCell>{student.name}</TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={student.status === "PRESENT"}
                              onCheckedChange={() =>
                                updateStudentStatus(student.studentId, "PRESENT")
                              }
                              aria-label={`Mark ${student.name} as present`}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={student.status === "ABSENT"}
                              onCheckedChange={() =>
                                updateStudentStatus(student.studentId, "ABSENT")
                              }
                              aria-label={`Mark ${student.name} as absent`}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    onClick={handleSaveAttendance}
                    disabled={!canSaveAttendance || createOrOpenMutation.isPending}
                  >
                    {createOrOpenMutation.isPending && submitAction === "SAVE"
                      ? "Saving..."
                      : "Save Attendance"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

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
        page={sessionPagination.page}
        totalPages={sessionPagination.totalPages}
        isFetching={sessionsQuery.isFetching}
        onPrevPage={() => goToSessionPage(sessionPagination.page - 1)}
        onNextPage={() => goToSessionPage(sessionPagination.page + 1)}
        onOpenSession={handleSelectSessionFromModal}
        onUpdateSession={handleUpdateSessionFromModal}
        onDeleteSession={handleDeleteSessionFromModal}
      />
    </div>
  );
};
