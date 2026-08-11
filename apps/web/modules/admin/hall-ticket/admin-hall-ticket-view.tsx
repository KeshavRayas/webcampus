"use client";

import { useDepartments } from "@/lib/use-departments";
import { useSections } from "@/lib/use-sections";
import {
  downloadHallTicketPdf,
  useEligibleStudentsList,
  useSendHallTickets,
  useStudentHallTicketPreview,
  useUnsendHallTickets,
} from "@/modules/admin/hall-ticket/use-hall-ticket";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { Card, CardContent } from "@webcampus/ui/components/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import {
  FilterActions,
  FilterBuilder,
  FilterPanel,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import { HallTicketPreview } from "@webcampus/ui/components/hall-ticket-preview";
import { HallTicketTemplate } from "@webcampus/ui/components/hall-ticket-template";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import type { HallTicketTemplateData } from "@webcampus/ui/lib/hall-ticket-template";
import { cn } from "@webcampus/ui/lib/utils";
import {
  CheckCircle2,
  Download,
  Eye,
  Loader2,
  Send,
  Undo2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "react-toastify";

type FilterState = {
  academicTermId: string;
  semesterId: string;
  departmentId: string;
  sectionId: string;
  search: string;
};

const EMPTY_FILTERS: FilterState = {
  academicTermId: "",
  semesterId: "",
  departmentId: "",
  sectionId: "",
  search: "",
};

export const AdminHallTicketView = () => {
  const [draftFilters, setDraftFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterState>(EMPTY_FILTERS);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    new Set()
  );
  const [previewTarget, setPreviewTarget] = useState<{
    studentId: string;
    academicTermId: string;
  } | null>(null);

  const { data: previewData, isLoading: previewLoading } =
    useStudentHallTicketPreview(
      previewTarget?.studentId ?? null,
      previewTarget?.academicTermId ?? null
    );

  const renderDoc = useCallback(
    (data: HallTicketTemplateData) => <HallTicketTemplate data={data} />,
    []
  );

  const previewTemplateData = useMemo((): HallTicketTemplateData | null => {
    if (!previewData || !previewTarget) return null;
    return {
      id: `${previewTarget.studentId}-${previewTarget.academicTermId}`,
      isSent: previewData.isSent,
      sentAt: previewData.sentAt,
      sentBy: previewData.sentBy ?? null,
      generatedAt: previewData.sentAt ?? new Date().toISOString(),
      student: {
        usn: previewData.usn,
        name: previewData.name,
        photo: previewData.photo,
        departmentName: previewData.departmentName,
        currentSemester: previewData.currentSemester,
        programType: previewData.programType ?? null,
        academicTermLabel: previewData.academicTermLabel ?? "N/A",
        sectionName: previewData.sectionName,
      },
      courses: previewData.courses.map((c) => ({
        courseAssignmentId: c.courseAssignmentId,
        courseCode: c.courseCode,
        courseName: c.courseName,
        courseType: c.courseType,
        credits: c.credits,
        cieTotal: c.cieTotal,
        attendancePercentage: c.attendancePercentage,
        isFrozen: c.isFrozen,
        markEligible: c.markEligible,
        attendanceEligible: c.attendanceEligible,
        eligible: c.eligible,
        status: c.eligible ? ("ELIGIBLE" as const) : ("NOT_ELIGIBLE" as const),
      })),
      qrPayload: previewData.verificationToken
        ? `WCHT_VERIFY:${previewData.verificationToken}`
        : undefined,
    };
  }, [previewData, previewTarget]);

  const { data: termsData } = useAcademicTerms();
  const { data: departmentsData } = useDepartments();
  const terms = termsData ?? [];
  const departments = departmentsData ?? [];

  const selectedDraftTerm = terms.find(
    (term) => term.id === draftFilters.academicTermId
  );
  const semesterOptions = selectedDraftTerm?.Semester ?? [];

  const {
    data: sections = [],
    isLoading: sectionsLoading,
    isError: sectionsError,
  } = useSections(draftFilters.semesterId, draftFilters.departmentId);

  const queryEnabled = appliedFilters.academicTermId.length > 0;

  const {
    data: students,
    isLoading,
    isError,
    error,
  } = useEligibleStudentsList({
    ...(appliedFilters.academicTermId
      ? { academicTermId: appliedFilters.academicTermId }
      : {}),
    ...(appliedFilters.semesterId
      ? { semesterId: appliedFilters.semesterId }
      : {}),
    ...(appliedFilters.departmentId
      ? { departmentId: appliedFilters.departmentId }
      : {}),
    ...(appliedFilters.sectionId
      ? { sectionId: appliedFilters.sectionId }
      : {}),
    ...(appliedFilters.search ? { search: appliedFilters.search } : {}),
  });

  const sendMutation = useSendHallTickets();
  const unsendMutation = useUnsendHallTickets();

  const filterFields: FilterFieldConfig<FilterState>[] = useMemo(
    () => [
      {
        key: "academicTermId",
        label: "Academic Term",
        type: "select",
        hideAllOption: true,
        options: terms.map((term) => ({
          label: `${term.type.toUpperCase()} ${term.year}`,
          value: term.id,
        })),
      },
      {
        key: "semesterId",
        label: "Semester",
        type: "select",
        hideAllOption: true,
        placeholder: draftFilters.academicTermId
          ? "Select semester"
          : "Select term first",
        options: semesterOptions.map((semester) => ({
          label: `${semester.programType} - Semester ${semester.semesterNumber}`,
          value: semester.id,
        })),
      },
      {
        key: "departmentId",
        label: "Department",
        type: "select",
        options: departments.map((d) => ({ label: d.name, value: d.id })),
      },
      {
        key: "sectionId",
        label: "Section",
        type: "select",
        placeholder: sectionsLoading
          ? "Loading sections..."
          : sectionsError
            ? "Failed to load sections"
            : draftFilters.semesterId && draftFilters.departmentId
              ? "Select section"
              : "Select semester and department first",
        options: sections.map((s) => ({ label: s.name, value: s.id })),
      },
      {
        key: "search",
        label: "Search",
        type: "text",
        placeholder: "Name or USN...",
      },
    ],
    [
      terms,
      draftFilters.academicTermId,
      semesterOptions,
      departments,
      sections,
      sectionsLoading,
      sectionsError,
    ]
  );

  const handleApply = () => {
    setAppliedFilters(draftFilters);
    setSelectedStudentIds(new Set());
  };

  const handleReset = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setSelectedStudentIds(new Set());
  };

  const unsentStudents = useMemo(
    () => students?.filter((s) => s.allCoursesFrozen && !s.isSent) ?? [],
    [students]
  );

  const sentStudents = useMemo(
    () => students?.filter((s) => s.isSent) ?? [],
    [students]
  );

  const { sentSelected, unsentSelected, isMixedSelection } = useMemo(() => {
    const sent: string[] = [];
    const unsent: string[] = [];
    for (const s of students ?? []) {
      if (!selectedStudentIds.has(s.studentId)) continue;
      if (s.isSent) sent.push(s.studentId);
      else if (s.allCoursesFrozen) unsent.push(s.studentId);
    }
    return {
      sentSelected: sent,
      unsentSelected: unsent,
      isMixedSelection: sent.length > 0 && unsent.length > 0,
    };
  }, [students, selectedStudentIds]);

  const handleSendSelected = () => {
    if (unsentSelected.length === 0) {
      toast.error("No unsent, eligible students selected");
      return;
    }
    sendMutation.mutate({
      studentIds: unsentSelected,
      academicTermId: appliedFilters.academicTermId,
      semesterId: appliedFilters.semesterId,
    });
    setSelectedStudentIds(new Set());
  };

  const handleUnsendSelected = () => {
    if (sentSelected.length === 0) {
      toast.error("No sent students selected");
      return;
    }
    unsendMutation.mutate({
      studentIds: sentSelected,
      academicTermId: appliedFilters.academicTermId,
      semesterId: appliedFilters.semesterId,
    });
    setSelectedStudentIds(new Set());
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStudentIds(next);
  };

  const toggleAll = () => {
    if (!students) return;
    if (selectedStudentIds.size === students.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(students.map((s) => s.studentId)));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Hall Tickets</h2>
          <p className="text-muted-foreground text-sm">
            Review frozen students and send hall tickets.
          </p>
        </div>
        <FilterPanel>
          <FilterBuilder
            fields={filterFields}
            draftFilters={draftFilters}
            onDraftChange={(key, value) => {
              setDraftFilters((prev) => ({ ...prev, [key]: value }));

              if (key === "search") {
                setAppliedFilters((prev) => ({ ...prev, search: value }));
              }
            }}
          />
          <FilterActions onApply={handleApply} onReset={handleReset} />
        </FilterPanel>
        <div className="text-muted-foreground flex items-center justify-center gap-2 rounded-lg border p-12 text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Hall Tickets</h2>
        <p className="text-muted-foreground text-sm">
          Review frozen students and send hall tickets to eligible students.
        </p>
      </div>

      <FilterPanel>
        <FilterBuilder
          fields={filterFields}
          draftFilters={draftFilters}
          onDraftChange={(key, value) => {
            setDraftFilters((current) => {
              if (key === "academicTermId") {
                return {
                  ...current,
                  academicTermId: value,
                  semesterId: "",
                  sectionId: "",
                };
              }
              if (key === "semesterId") {
                return { ...current, semesterId: value, sectionId: "" };
              }
              if (key === "departmentId") {
                return { ...current, departmentId: value, sectionId: "" };
              }
              return { ...current, [key]: value };
            });
            if (key === "search") {
              setAppliedFilters((prev) => ({ ...prev, search: value }));
            }
          }}
        />
        <FilterActions onApply={handleApply} onReset={handleReset} />
      </FilterPanel>

      {!queryEnabled ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            Select an academic term to view eligible students.
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-destructive text-sm font-medium">
                Failed to load eligible students
              </p>
              <p className="text-muted-foreground text-xs">
                {(error as Error)?.message ??
                  "An unexpected error occurred. Please try again."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : !students || students.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            No eligible students found for the selected filters. Ensure courses
            have been frozen.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {students.length} students shown
              {sentStudents.length > 0 && (
                <> &middot; {sentStudents.length} sent</>
              )}
              {unsentStudents.length > 0 && (
                <> &middot; {unsentStudents.length} ready to send</>
              )}
            </span>
            <div className="flex-1" />
            {unsentSelected.length > 0 && (
              <Button
                size="sm"
                onClick={handleSendSelected}
                disabled={sendMutation.isPending}
              >
                {sendMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Send className="mr-2 size-4" />
                )}
                {isMixedSelection ? "Send Eligible" : "Send Selected"} (
                {unsentSelected.length})
              </Button>
            )}
            {sentSelected.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleUnsendSelected}
                disabled={unsendMutation.isPending}
              >
                {unsendMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Undo2 className="mr-2 size-4" />
                )}
                {isMixedSelection ? "Unsend Sent" : "Unsend Selected"} (
                {sentSelected.length})
              </Button>
            )}
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={
                        (students?.length ?? 0) > 0 &&
                        selectedStudentIds.size === (students?.length ?? 0)
                      }
                      onChange={toggleAll}
                      className="size-4"
                    />
                  </TableHead>
                  <TableHead>USN</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => (
                  <TableRow key={s.studentId}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.has(s.studentId)}
                        onChange={() => toggleSelection(s.studentId)}
                        className="size-4"
                        disabled={!s.allCoursesFrozen}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.usn}</TableCell>
                    <TableCell>{s.name}</TableCell>
                    <TableCell>{s.email ?? "—"}</TableCell>
                    <TableCell>{s.departmentName}</TableCell>
                    <TableCell>{s.currentSemester}</TableCell>
                    <TableCell>
                      {s.isSent ? (
                        <Badge
                          variant="default"
                          className="bg-emerald-500 text-white dark:bg-emerald-500/20 dark:text-emerald-400"
                        >
                          <CheckCircle2 className="mr-1 size-3" /> Sent
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Preview Hall Ticket"
                          onClick={() =>
                            setPreviewTarget({
                              studentId: s.studentId,
                              academicTermId: appliedFilters.academicTermId,
                            })
                          }
                        >
                          <Eye className="size-4" />
                        </Button>
                        {s.isSent && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Download Hall Ticket"
                            onClick={() =>
                              downloadHallTicketPdf(
                                s.studentId,
                                appliedFilters.academicTermId
                              ).catch(() =>
                                toast.error("Failed to download PDF")
                              )
                            }
                          >
                            <Download className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog
        open={previewTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewTarget(null);
        }}
      >
        <DialogContent
          className={cn(
            "xl:h-[95vh] xl:w-[95vw] xl:max-w-[1200px]",
            "md:h-[96vh] md:w-[98vw]",
            "max-md:!inset-0 max-md:h-screen max-md:w-screen max-md:!max-w-none max-md:!translate-x-0 max-md:!translate-y-0 max-md:!rounded-none max-md:!border-0",
            "min-h-0 grid-rows-[1fr] gap-0 overflow-hidden p-0"
          )}
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Hall Ticket Preview</DialogTitle>
          <HallTicketPreview<HallTicketTemplateData>
            data={previewTemplateData}
            renderDocument={renderDoc}
            title="Hall Ticket Preview"
            loading={previewLoading}
            empty={<div>No Hall Ticket selected.</div>}
            actions={
              previewTarget && (
                <>
                  <Button
                    size="sm"
                    className="min-h-11 md:min-h-9"
                    onClick={() =>
                      downloadHallTicketPdf(
                        previewTarget.studentId,
                        previewTarget.academicTermId
                      ).catch(() => toast.error("Failed to download PDF"))
                    }
                  >
                    <Download className="mr-2 size-4" />
                    Download PDF
                  </Button>
                  <DialogClose asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-11 md:min-h-9"
                    >
                      Close
                    </Button>
                  </DialogClose>
                </>
              )
            }
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
