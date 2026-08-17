"use client";

import { useStudentProfile } from "@/modules/student/profile/use-student-profile";
import { TimetableList } from "@/modules/timetable/timetable-list";
import { downloadTimetablePdf } from "@/modules/timetable/timetable-pdf";
import { useStudentTimetable } from "@/modules/timetable/use-timetable";
import { Button } from "@webcampus/ui/components/button";
import { Skeleton } from "@webcampus/ui/components/skeleton";

export default function StudentTimetablePage() {
  const profile = useStudentProfile();
  const timetable = useStudentTimetable(
    profile.data?.semesterId ?? undefined,
    profile.data?.sectionId ?? undefined
  );
  const noSection = !profile.isLoading && !profile.data?.sectionId;
  const entries = timetable.data?.entries ?? [];
  if (profile.isLoading || timetable.isLoading)
    return (
      <div className="p-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My timetable</h1>
          <p className="text-muted-foreground text-sm">
            {profile.data?.departmentName ?? "Current semester schedule"}
            {profile.data?.sectionName
              ? ` · Section ${profile.data.sectionName}`
              : ""}
          </p>
        </div>
        {!noSection && (
          <Button
            disabled={!entries.length}
            onClick={() =>
              downloadTimetablePdf({
                entries,
                slots: timetable.data?.slots,
                student: profile.data,
              })
            }
          >
            Download PDF
          </Button>
        )}
      </div>
      {noSection ? (
        <p className="text-muted-foreground text-sm">
          You have not been assigned to a section yet.
        </p>
      ) : (
        <TimetableList entries={entries} title="Weekly schedule" />
      )}
    </div>
  );
}
