"use client";

import { getApiErrorMessage } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { dayjs } from "@webcampus/common/dayjs";
import { FacultyAttendanceSessionDTO } from "@webcampus/types/api";
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
import { AttendanceEditList } from "./components/attendance-edit-list";
import { AttendancePageShell } from "./components/attendance-page-shell";
import { AttendanceSection } from "./components/attendance-section";
import { AttendanceChecklistRow } from "./faculty-attendance-types";
import {
  useCreateOrOpenFacultyAttendanceSession,
  useDeleteFacultyAttendanceSession,
  useFacultyAttendanceFilterOptions,
  useFacultyAttendanceSessionDetail,
  useFacultyAttendanceSessions,
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

const withUiChecklistMetadata = (
  rows: Array<{
    studentId: string;
    usn: string;
    name: string;
    status: "PRESENT" | "ABSENT";
    previousAttendancePercentage?: number;
  }>
): AttendanceChecklistRow[] => {
  return rows.map((student) => ({
    studentId: student.studentId,
    usn: student.usn,
    name: student.name,
    status: student.status,
    previousAttendancePercentage: student.previousAttendancePercentage ?? 0,
  }));
};

export const FacultyAttendanceEditView = () => {
  const [modalCourseSelectionKey, setModalCourseSelectionKey] =
    useState<string>("");
  const [modalSectionSelectionKey, setModalSectionSelectionKey] =
    useState<string>("");

  const [sessionModalFilters, setSessionModalFilters] =
    useState<AttendanceSessionModalFilters>(EMPTY_SESSION_MODAL_FILTERS);
  const [appliedSessionFilters, setAppliedSessionFilters] =
    useState<AttendanceSessionQueryState>(INITIAL_SESSION_QUERY_STATE);

  const [studentChecklist, setStudentChecklist] = useState<
    AttendanceChecklistRow[]
  >([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [editingSessionInfo, setEditingSessionInfo] =
    useState<FacultyAttendanceSessionDTO | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [openingSessionId, setOpeningSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(
    null
  );
  const [deleteConfirmSessionId, setDeleteConfirmSessionId] = useState<
    string | null
  >(null);
  const [showSaveSuccessToast, setShowSaveSuccessToast] =
    useState<boolean>(false);

  const queryClient = useQueryClient();
  const filterOptionsQuery = useFacultyAttendanceFilterOptions();
  const createOrOpenMutation = useCreateOrOpenFacultyAttendanceSession();
  const deleteSessionMutation = useDeleteFacultyAttendanceSession();

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
    true
  );

  const sessionDetailQuery = useFacultyAttendanceSessionDetail(
    { sessionId: activeSessionId },
    Boolean(activeSessionId)
  );

  // Derive Dropdown Options
  const assignmentOptions = useMemo(() => {
    const courses = filterOptionsQuery.data?.courses ?? [];
    const sections = filterOptionsQuery.data?.sections ?? [];
    const courseById = new Map(courses.map((course) => [course.id, course]));

    return sections
      .map((section) => {
        const course = courseById.get(section.courseId);
        if (!course) return null;

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
    const selectedCourse = parseCourseSelectionKey(modalCourseSelectionKey);
    const filteredAssignments = assignmentOptions.filter((assignment) => {
      if (!selectedCourse.courseId) return true;
      if (assignment.courseId !== selectedCourse.courseId) return false;
      return (assignment.batchId ?? undefined) === selectedCourse.batchId;
    });

    return filteredAssignments.map((assignment) => ({
      id: `${assignment.sectionId}${COURSE_SELECTION_DELIMITER}${assignment.batchId ?? "theory"}`,
      name: assignment.sectionName,
      courseId: assignment.courseId,
      label: assignment.sectionName,
    }));
  }, [assignmentOptions, modalCourseSelectionKey]);

  // Load checklist when session detail is fetched
  useEffect(() => {
    const data = sessionDetailQuery.data;
    if (
      !data ||
      typeof data !== "object" ||
      !("session" in data) ||
      !("students" in data)
    )
      return;
    if (data.session.id !== activeSessionId) return;

    setStudentChecklist(withUiChecklistMetadata(data.students));
    setOpeningSessionId(null);
    setIsEditModalOpen(true);
  }, [
    activeSessionId,
    sessionDetailQuery.data,
    sessionDetailQuery.dataUpdatedAt,
  ]);

  useEffect(() => {
    if (!sessionDetailQuery.isError || !activeSessionId) return;
    toast.error(
      getApiErrorMessage(
        sessionDetailQuery.error,
        "Failed to load attendance session detail"
      )
    );
    setOpeningSessionId(null);
    setActiveSessionId("");
  }, [activeSessionId, sessionDetailQuery.error, sessionDetailQuery.isError]);

  useEffect(() => {
    if (!showSaveSuccessToast) return;
    const timeoutId = window.setTimeout(
      () => setShowSaveSuccessToast(false),
      2200
    );
    return () => window.clearTimeout(timeoutId);
  }, [showSaveSuccessToast]);

  // Checklist Derived State
  const totalStudents = studentChecklist.length;
  const presentCount = studentChecklist.filter(
    (s) => s.status === "PRESENT"
  ).length;
  const absentCount = studentChecklist.filter(
    (s) => s.status === "ABSENT"
  ).length;
  const unmarkedCount = totalStudents - presentCount - absentCount;
  const markedCount = presentCount + absentCount;
  const presentRate =
    markedCount > 0 ? Math.round((presentCount / markedCount) * 1000) / 10 : 0;
  const canSaveAttendance = studentChecklist.length > 0 && unmarkedCount === 0;

  // Handlers
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

  const goToSessionPage = (nextPage: number) => {
    const totalPages = sessionsQuery.data?.pagination.totalPages ?? 1;
    const boundedPage = Math.min(Math.max(nextPage, 1), totalPages);
    setAppliedSessionFilters((current) => ({ ...current, page: boundedPage }));
  };

  const handleSelectSession = async (sessionId: string) => {
    const sessionToEdit = sessionsQuery.data?.items.find(
      (s) => s.id === sessionId
    );
    if (sessionToEdit) {
      setEditingSessionInfo(sessionToEdit);
    }

    setOpeningSessionId(sessionId);
    setStudentChecklist([]);
    setActiveSessionId(sessionId);

    try {
      await queryClient.invalidateQueries({
        queryKey: ["faculty-attendance", "session-detail"],
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load session details"));
      setOpeningSessionId(null);
      setActiveSessionId("");
    }
  };

  const handleSaveAttendance = async () => {
    if (!canSaveAttendance || !editingSessionInfo) return;

    try {
      await createOrOpenMutation.mutateAsync({
        courseId: editingSessionInfo.courseId,
        sectionId: editingSessionInfo.sectionId,
        batchId: editingSessionInfo.batchId,
        sessionDate: dayjs(editingSessionInfo.sessionDate).format("YYYY-MM-DD"),
        timingMode: "FIXED", // Fallback, the backend upserts using the existing IDs anyway
        studentStatuses: studentChecklist.map((student) => ({
          studentId: student.studentId,
          status: student.status ?? "PRESENT",
        })),
      });

      setIsEditModalOpen(false);
      setShowSaveSuccessToast(true);
      sessionsQuery.refetch();
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Failed to save edited attendance")
      );
    }
  };

  const handleDeleteSessionConfirm = async () => {
    if (!deleteConfirmSessionId) return;

    try {
      setDeletingSessionId(deleteConfirmSessionId);
      await deleteSessionMutation.mutateAsync(deleteConfirmSessionId);

      if (activeSessionId === deleteConfirmSessionId) {
        setActiveSessionId("");
        setStudentChecklist([]);
      }

      setDeleteConfirmSessionId(null);
      toast.success("Attendance session deleted successfully");
      sessionsQuery.refetch();
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Failed to delete attendance session")
      );
    } finally {
      setDeletingSessionId(null);
    }
  };

  const sessionPagination = sessionsQuery.data?.pagination ?? {
    page: appliedSessionFilters.page,
    limit: appliedSessionFilters.limit,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };

  return (
    <AttendancePageShell
      toastMessage={
        showSaveSuccessToast ? "Attendance updated successfully" : null
      }
    >
      <AttendanceEditList
        filters={sessionModalFilters}
        selectedCourseValue={modalCourseSelectionKey}
        selectedSectionValue={modalSectionSelectionKey}
        onDateChange={(sessionDate) =>
          setSessionModalFilters((current) => ({ ...current, sessionDate }))
        }
        onCourseChange={(selectionValue) => {
          const parsed = parseCourseSelectionKey(selectionValue);
          setModalCourseSelectionKey(selectionValue);
          setModalSectionSelectionKey("");
          setSessionModalFilters((current) => ({
            ...current,
            courseId: parsed.courseId,
            batchId: parsed.batchId,
            sectionId: "",
          }));
        }}
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
        sections={sectionsForSelectedCourse}
        sessions={sessionsQuery.data?.items ?? []}
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
        onSelectSession={handleSelectSession}
        onDeleteSession={setDeleteConfirmSessionId}
      />

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="flex max-h-[90vh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden rounded-xl p-0 sm:w-[94vw] sm:max-w-4xl lg:max-w-5xl">
          <DialogHeader className="bg-background border-b px-6 pb-4 pt-6">
            <DialogTitle className="text-xl">Edit Attendance</DialogTitle>
            <DialogDescription className="text-sm">
              Modify the student attendance roster and save your changes.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/10 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
            <div className="bg-background flex flex-col gap-2 rounded-lg border p-4 text-sm shadow-sm sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-3">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  Course:
                </span>
                <span className="text-foreground font-medium">
                  {editingSessionInfo?.courseCode} -{" "}
                  {editingSessionInfo?.courseName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  Section:
                </span>
                <span className="text-foreground font-medium">
                  {editingSessionInfo?.sectionName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  Date:
                </span>
                <span className="text-foreground font-medium">
                  {editingSessionInfo?.sessionDate
                    ? dayjs(editingSessionInfo.sessionDate).format(
                        "MMM D, YYYY"
                      )
                    : "Unknown"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  Time:
                </span>
                <span className="text-foreground font-medium">
                  {editingSessionInfo?.timingLabel ?? "Unknown"}
                </span>
              </div>
            </div>

            <AttendanceSection
              studentChecklist={studentChecklist}
              isLoading={sessionDetailQuery.isLoading}
              isSaving={createOrOpenMutation.isPending}
              onAllPresent={() =>
                setStudentChecklist((current) =>
                  current.map((s) => ({ ...s, status: "PRESENT" }))
                )
              }
              onAllAbsent={() =>
                setStudentChecklist((current) =>
                  current.map((s) => ({ ...s, status: "ABSENT" }))
                )
              }
              onToggleStatus={(studentId, isPresent) =>
                setStudentChecklist((current) =>
                  current.map((s) =>
                    s.studentId === studentId
                      ? { ...s, status: isPresent ? "PRESENT" : "ABSENT" }
                      : s
                  )
                )
              }
              totalStudents={totalStudents}
            />
          </div>

          <div className="bg-background flex flex-col-reverse justify-between gap-3 border-t px-6 py-4 shadow-[0_-4px_10px_rgba(0,0,0,0.02)] sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 text-xs font-medium sm:text-sm">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />{" "}
                Present: {presentCount}
              </span>
              <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-500">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Absent:{" "}
                {absentCount}
              </span>
              <span className="text-muted-foreground border-l pl-2">
                Rate: {presentRate}%
              </span>
            </div>

            <Button
              type="button"
              onClick={handleSaveAttendance}
              disabled={!canSaveAttendance || createOrOpenMutation.isPending}
              className="min-w-50 w-full sm:w-auto"
            >
              {createOrOpenMutation.isPending
                ? "Saving..."
                : canSaveAttendance
                  ? "Update Attendance"
                  : `Mark Remaining (${unmarkedCount})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteConfirmSessionId)}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmSessionId(null);
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
