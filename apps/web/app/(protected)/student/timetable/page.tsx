"use client";

import { useStudentProfile } from "@/modules/student/profile/use-student-profile";
import { TimetableList } from "@/modules/timetable/timetable-list";
import { useStudentTimetable } from "@/modules/timetable/use-timetable";
import { Skeleton } from "@webcampus/ui/components/skeleton";

export default function StudentTimetablePage() {
  const profile = useStudentProfile();
  const timetable = useStudentTimetable(profile.data?.semesterId ?? undefined);
  if (profile.isLoading || timetable.isLoading)
    return (
      <div className="p-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">My timetable</h1>
        <p className="text-muted-foreground text-sm">
          {profile.data?.departmentName ?? "Current semester schedule"}
        </p>
      </div>
      <TimetableList entries={timetable.data ?? []} title="Weekly schedule" />
    </div>
  );
}
