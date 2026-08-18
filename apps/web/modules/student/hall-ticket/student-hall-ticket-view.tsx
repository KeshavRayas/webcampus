"use client";

import {
  downloadHallTicketPdf,
  useStudentHallTicketData,
  useStudentHallTickets,
} from "@/modules/student/hall-ticket/use-hall-ticket";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { Card, CardContent } from "@webcampus/ui/components/card";
import { HallTicketPreview } from "@webcampus/ui/components/hall-ticket-preview";
import { HallTicketTemplate } from "@webcampus/ui/components/hall-ticket-template";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import type { HallTicketTemplateData } from "@webcampus/ui/lib/hall-ticket-template";
import { CheckCircle2, Clock, Download, FileText, XCircle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "react-toastify";

export const StudentHallTicketView = () => {
  const { data: tickets, isLoading } = useStudentHallTickets();
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);

  const { data: hallTicketData, isLoading: dataLoading } =
    useStudentHallTicketData(selectedTermId);

  const handleDownload = async () => {
    if (!selectedTermId) return;
    try {
      await downloadHallTicketPdf(selectedTermId);
      toast.success("Hall ticket downloaded");
    } catch {
      toast.error("Failed to download hall ticket");
    }
  };

  const renderDoc = useCallback(
    (data: HallTicketTemplateData) => <HallTicketTemplate data={data} />,
    []
  );

  const previewTemplateData = useMemo((): HallTicketTemplateData | null => {
    if (
      !hallTicketData ||
      "notAvailable" in hallTicketData ||
      !("allCoursesFrozen" in hallTicketData)
    )
      return null;
    return {
      id: `${selectedTermId}`,
      isSent: hallTicketData.isSent,
      sentAt: hallTicketData.sentAt,
      sentBy: hallTicketData.sentBy ?? null,
      generatedAt: hallTicketData.sentAt ?? new Date().toISOString(),
      student: {
        usn: hallTicketData.usn,
        name: hallTicketData.name,
        photo: hallTicketData.photo,
        departmentName: hallTicketData.departmentName,
        currentSemester: hallTicketData.currentSemester,
        programType: hallTicketData.programType,
        academicTermLabel: hallTicketData.academicTermLabel,
        sectionName: hallTicketData.sectionName,
      },
      courses: hallTicketData.courses.map((c) => ({
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
      qrPayload: hallTicketData.verificationToken
        ? `WCHT_VERIFY:${hallTicketData.verificationToken}`
        : undefined,
    };
  }, [hallTicketData, selectedTermId]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Hall Ticket</h2>
        <p className="text-muted-foreground text-sm">
          View and download your examination hall ticket.
        </p>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          Loading hall tickets...
        </div>
      ) : !tickets || tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <FileText className="text-muted-foreground size-12" />
            <p className="text-muted-foreground text-sm">
              No hall tickets available yet. Please check back after your
              courses are finalized.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Select
              value={selectedTermId ?? ""}
              onValueChange={(v) => setSelectedTermId(v)}
            >
              <SelectTrigger className="w-80">
                <SelectValue placeholder="Select academic term" />
              </SelectTrigger>
              <SelectContent>
                {tickets.map((t) => (
                  <SelectItem key={t.academicTermId} value={t.academicTermId}>
                    {t.academicYear} - Semester {t.currentSemester}
                    {" — "}
                    {t.allCoursesFrozen
                      ? t.isSent
                        ? "Sent"
                        : "Ready"
                      : "Pending Freeze"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {dataLoading ? (
            <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
              Loading hall ticket data...
            </div>
          ) : hallTicketData && "notAvailable" in hallTicketData ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <Clock className="text-muted-foreground size-12" />
                <p className="text-muted-foreground max-w-md text-center text-sm">
                  {hallTicketData.reason}
                </p>
              </CardContent>
            </Card>
          ) : hallTicketData && "allCoursesFrozen" in hallTicketData ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {hallTicketData.isSent ? (
                    <Badge
                      variant="default"
                      className="gap-1 bg-emerald-500 text-white dark:bg-emerald-500/20 dark:text-emerald-400"
                    >
                      <CheckCircle2 className="size-3" /> Sent
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <Clock className="size-3" /> Not Yet Sent
                    </Badge>
                  )}
                  {hallTicketData.eligible ? (
                    <Badge
                      variant="default"
                      className="gap-1 bg-emerald-500 text-white dark:bg-emerald-500/20 dark:text-emerald-400"
                    >
                      <CheckCircle2 className="size-3" /> All Eligible
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <XCircle className="size-3" /> Some Courses Not Eligible
                    </Badge>
                  )}
                </div>
                {hallTicketData.isSent && (
                  <Button variant="default" size="sm" onClick={handleDownload}>
                    <Download className="mr-2 size-4" />
                    Download PDF
                  </Button>
                )}
              </div>

              <div className="h-[calc(100vh-320px)] min-h-[500px]">
                <HallTicketPreview<HallTicketTemplateData>
                  data={previewTemplateData}
                  renderDocument={renderDoc}
                  showHeader={false}
                  loading={dataLoading}
                  empty={<div>No Hall Ticket available.</div>}
                />
              </div>
            </div>
          ) : selectedTermId ? (
            <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
              Unable to load hall ticket data for the selected term.
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};
