"use client";

import { TimetableList } from "@/modules/timetable/timetable-list";
import { useFacultyTimetable } from "@/modules/timetable/use-timetable";

export default function FacultyTimetablePage() {
  const timetable = useFacultyTimetable();
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Teaching timetable</h1>
        <p className="text-muted-foreground text-sm">Your assigned classes</p>
      </div>
      <TimetableList entries={timetable.data ?? []} title="Weekly schedule" />
    </div>
  );
}
