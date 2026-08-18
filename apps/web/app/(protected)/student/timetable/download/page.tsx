"use client";

import { useStudentProfile } from "@/modules/student/profile/use-student-profile";
import {
  downloadTimetablePdf,
  sortTimetableEntries,
} from "@/modules/timetable/timetable-pdf";
import { useStudentTimetable } from "@/modules/timetable/use-timetable";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { Skeleton } from "@webcampus/ui/components/skeleton";

const dayOrder = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const dayLabel = (day: string) => day.charAt(0) + day.slice(1).toLowerCase();

export default function StudentTimetableDownloadPage() {
  const profile = useStudentProfile();
  const semesterId = profile.data?.semesterId ?? undefined;
  const sectionId = profile.data?.sectionId ?? undefined;
  const timetable = useStudentTimetable(semesterId, sectionId);
  const entries = sortTimetableEntries(timetable.data?.entries ?? []);
  const noSection = !profile.isLoading && !profile.data?.sectionId;

  const handleDownload = () => {
    downloadTimetablePdf({
      entries,
      slots: timetable.data?.slots,
      student: profile.data,
    });
  };

  if (profile.isLoading || timetable.isLoading)
    return (
      <div className="p-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Download timetable</h1>
        <p className="text-muted-foreground text-sm">
          Your section&apos;s weekly schedule as a PDF
        </p>
      </div>

      {noSection ? (
        <p className="text-muted-foreground text-sm">
          You have not been assigned to a section yet.
        </p>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Preview</CardTitle>
            <Button disabled={!entries.length} onClick={handleDownload}>
              Download PDF
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {entries.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No published timetable entries for your section.
              </p>
            )}
            {dayOrder.map((day) => {
              const dayEntries = entries.filter(
                (entry) => entry.dayOfWeek === day
              );
              if (!dayEntries.length) return null;
              return (
                <div key={day}>
                  <p className="mb-2 text-sm font-medium">{dayLabel(day)}</p>
                  <div className="space-y-2">
                    {dayEntries.map((entry) => (
                      <div
                        className="flex items-center justify-between rounded-lg border p-3"
                        key={entry.id}
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {entry.course?.code ?? "Course"} ·{" "}
                            {entry.course?.name ?? "Unnamed course"}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {entry.faculty?.user?.name ??
                              entry.faculty?.shortName ??
                              "Faculty not assigned"}
                          </p>
                        </div>
                        <p className="text-muted-foreground shrink-0 text-xs">
                          {entry.startTime} - {entry.endTime} ·{" "}
                          {entry.roomNumber}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
