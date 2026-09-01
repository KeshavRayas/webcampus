"use client";

import { getApiErrorMessage } from "@/lib/api-client";
import {
  EnrolledSemesterGroup,
  useEnrolledCourses,
} from "@/modules/student/courses/use-course-registration";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import { Card, CardContent } from "@webcampus/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { useState } from "react";

const SemesterCoursesTable = ({ group }: { group: EnrolledSemesterGroup }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <h4 className="text-sm font-medium">
        {group.academicTermLabel} — {group.semesterLabel}
      </h4>
    </div>
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Course Code</TableHead>
            <TableHead>Course Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>L-T-P-S</TableHead>
            <TableHead className="text-right">Credits</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {group.courses.map((course) => (
            <TableRow key={course.id}>
              <TableCell className="font-medium">{course.code}</TableCell>
              <TableCell>{course.name}</TableCell>
              <TableCell>{course.courseType}</TableCell>
              <TableCell>{course.ltp}</TableCell>
              <TableCell className="text-right">
                {course.totalCredits}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={4} className="font-semibold">
              Total Credits
            </TableCell>
            <TableCell className="text-right font-semibold">
              {group.totalCredits}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  </div>
);

export const EnrolledCoursesView = () => {
  const [selectedSemesterId, setSelectedSemesterId] = useState<
    string | undefined
  >(undefined);

  const {
    data: enrolledData,
    isLoading,
    isError,
    error,
  } = useEnrolledCourses(selectedSemesterId);

  const allSemesters = enrolledData?.semesters ?? [];

  // Build a unique semester list for the dropdown from the "all" data
  const { data: allData } = useEnrolledCourses(undefined);
  const semesterFilterOptions = (allData?.semesters ?? []).map((group) => ({
    label: `${group.academicTermLabel} — ${group.semesterLabel}`,
    value: group.semesterId,
  }));

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Enrolled Courses</h2>
        <p className="text-muted-foreground text-sm">
          View your registered courses for each semester.
        </p>
      </header>

      {semesterFilterOptions.length > 0 && (
        <div className="flex items-center gap-3">
          <label
            htmlFor="semester-filter"
            className="whitespace-nowrap text-sm font-medium"
          >
            Filter by Semester:
          </label>
          <Select
            value={selectedSemesterId ?? "all"}
            onValueChange={(value) => {
              setSelectedSemesterId(value === "all" ? undefined : value);
            }}
          >
            <SelectTrigger id="semester-filter" className="h-[3.15rem] w-72 rounded-full">
              <SelectValue placeholder="All semesters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Semesters</SelectItem>
              {semesterFilterOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading ? (
        <Card className="course-registration-status overflow-hidden">
          <CardContent className="p-6">
            <p className="text-muted-foreground text-sm">
              Loading enrolled courses...
            </p>
          </CardContent>
        </Card>
      ) : isError ? (
        <Card className="course-registration-status overflow-hidden bg-secondary/20">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground text-sm">
              {getApiErrorMessage(error, "Unable to load enrolled courses")}
            </p>
          </CardContent>
        </Card>
      ) : allSemesters.length === 0 ? (
        <Card className="course-registration-status overflow-hidden">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground text-sm">
              No enrolled courses found. Complete course registration first.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {allSemesters.map((group) => (
            <SemesterCoursesTable
              key={`${group.academicTermId}_${group.semesterId}`}
              group={group}
            />
          ))}
        </div>
      )}
    </section>
  );
};
