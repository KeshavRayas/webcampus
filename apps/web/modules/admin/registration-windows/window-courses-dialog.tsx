"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import {
  RegistrationWindowCourseRow,
  RegistrationWindowRow,
  useRegistrationWindowCourses,
} from "./use-registration-windows";

interface WindowCoursesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedWindow: RegistrationWindowRow | null;
}

const EmptyCoursesState = () => (
  <div className="text-muted-foreground rounded-md border p-6 text-center text-sm">
    No approved courses found for this registration instance.
  </div>
);

const CoursesTable = ({
  courses,
}: {
  courses: RegistrationWindowCourseRow[];
}) => (
  <div className="max-h-[50vh] overflow-auto rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Course Code</TableHead>
          <TableHead>Course Name</TableHead>
          <TableHead>Course Type</TableHead>
          <TableHead>L-T-P-S</TableHead>
          <TableHead className="text-right">Total Credits</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {courses.map((course) => (
          <TableRow key={course.id}>
            <TableCell className="font-medium">{course.code}</TableCell>
            <TableCell>{course.name}</TableCell>
            <TableCell>{course.courseType}</TableCell>
            <TableCell>{course.ltp}</TableCell>
            <TableCell className="text-right">{course.totalCredits}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

export const WindowCoursesDialog = ({
  open,
  onOpenChange,
  selectedWindow,
}: WindowCoursesDialogProps) => {
  const { data: courses = [], isLoading } = useRegistrationWindowCourses(
    open ? selectedWindow?.id : undefined
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Approved Courses</DialogTitle>
          <DialogDescription>
            {selectedWindow?.instanceName || "Registration instance"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-muted-foreground rounded-md border p-6 text-center text-sm">
            Loading approved courses...
          </div>
        ) : courses.length === 0 ? (
          <EmptyCoursesState />
        ) : (
          <CoursesTable courses={courses} />
        )}
      </DialogContent>
    </Dialog>
  );
};
