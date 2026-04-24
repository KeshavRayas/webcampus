"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@webcampus/ui/components/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import {
  RegistrationTrackingRow,
  StudentRegisteredCourseRow,
  useStudentRegisteredCourses,
} from "./use-registration-tracking";

interface StudentCoursesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: RegistrationTrackingRow | null;
  semesterId: string;
  academicTermId: string;
}

const EmptyCoursesState = () => (
  <div className="text-muted-foreground rounded-md border p-6 text-center text-sm">
    No registered courses found for this student.
  </div>
);

const CoursesTable = ({
  courses,
}: {
  courses: StudentRegisteredCourseRow[];
}) => {
  const totalCredits = courses.reduce(
    (sum, course) => sum + course.totalCredits,
    0
  );

  return (
    <div className="max-h-[60vh] overflow-auto rounded-md border">
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
          {courses.map((course) => (
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
              {totalCredits}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
};

export const StudentCoursesSheet = ({
  open,
  onOpenChange,
  student,
  semesterId,
  academicTermId,
}: StudentCoursesSheetProps) => {
  const { data: courses = [], isLoading } = useStudentRegisteredCourses(
    open ? student?.studentId : undefined,
    open ? semesterId : undefined,
    open ? academicTermId : undefined
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Registered Courses</SheetTitle>
          <SheetDescription>
            {student
              ? `${student.studentName} (${student.usn})`
              : "Student Courses"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="text-muted-foreground rounded-md border p-6 text-center text-sm">
              Loading registered courses...
            </div>
          ) : courses.length === 0 ? (
            <EmptyCoursesState />
          ) : (
            <CoursesTable courses={courses} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
