"use client";

import { TimetableList } from "@/modules/timetable/timetable-list";
import {
  useFacultyCurrentSemester,
  useFacultyTimetable,
} from "@/modules/timetable/use-timetable";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import { Skeleton } from "@webcampus/ui/components/skeleton";
import { useState } from "react";

export default function FacultyTimetablePage() {
  const { terms, currentSemesterId, isLoading } = useFacultyCurrentSemester();
  const [selectedSemesterId, setSelectedSemesterId] = useState<
    string | undefined
  >(undefined);
  const activeSemesterId = selectedSemesterId || currentSemesterId;
  const timetable = useFacultyTimetable(activeSemesterId);
  const semesters = terms.data?.flatMap((term) => term.Semester ?? []) ?? [];

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold">Teaching timetable</h1>
          <p className="text-muted-foreground text-sm">Your assigned classes</p>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Teaching timetable</h1>
        <p className="text-muted-foreground text-sm">Your assigned classes</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Semester</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={activeSemesterId}
            onValueChange={setSelectedSemesterId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select semester" />
            </SelectTrigger>
            <SelectContent>
              {semesters.map((semester) => (
                <SelectItem key={semester.id} value={semester.id}>
                  {semester.programType} · Semester {semester.semesterNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      {timetable.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <TimetableList entries={timetable.data ?? []} title="Weekly schedule" />
      )}
    </div>
  );
}
