import { dayjs } from "@webcampus/common/dayjs";
import { FacultyAttendanceSessionDTO } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import { Calendar } from "@webcampus/ui/components/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { Label } from "@webcampus/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@webcampus/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import { Skeleton } from "@webcampus/ui/components/skeleton";
import { cn } from "@webcampus/ui/lib/utils";
import { CalendarIcon } from "lucide-react";

type CourseOption = {
  id: string;
  code: string;
  name: string;
  label?: string;
};

type SectionOption = {
  id: string;
  name: string;
  courseId: string;
  label?: string;
};

type ManageSessionFilters = {
  sessionDate: Date | undefined;
  courseId: string;
  sectionId: string;
};

type AttendanceEditListProps = {
  filters: ManageSessionFilters;
  selectedCourseValue?: string;
  selectedSectionValue?: string;
  onDateChange: (date: Date | undefined) => void;
  onCourseChange: (courseId: string) => void;
  onSectionChange: (sectionId: string) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  courses: CourseOption[];
  sections: SectionOption[];
  sessions: FacultyAttendanceSessionDTO[];
  activeSessionId: string;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  openingSessionId: string | null;
  deletingSessionId: string | null;
  page: number;
  totalPages: number;
  isFetching: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
};

export const AttendanceEditList = ({
  filters,
  selectedCourseValue,
  selectedSectionValue,
  onDateChange,
  onCourseChange,
  onSectionChange,
  onApplyFilters,
  onClearFilters,
  courses,
  sections,
  sessions,
  activeSessionId,
  isLoading,
  isError,
  errorMessage,
  openingSessionId,
  deletingSessionId,
  page,
  totalPages,
  isFetching,
  onPrevPage,
  onNextPage,
  onSelectSession,
  onDeleteSession,
}: AttendanceEditListProps) => {
  const isMutatingSession = Boolean(openingSessionId || deletingSessionId);

  return (
    <Card className="border-primary/20 bg-background/95 shadow-sm">
      <CardHeader>
        <CardTitle>Previous Attendance Sessions</CardTitle>
        <CardDescription>
          Filter sessions by date, course, and section to edit existing
          attendance records.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="bg-muted/20 space-y-4 rounded-lg border p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="session-filter-date">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="session-filter-date"
                    variant="outline"
                    className={cn(
                      "w-full justify-between text-left font-normal",
                      !filters.sessionDate && "text-muted-foreground"
                    )}
                  >
                    {filters.sessionDate
                      ? dayjs(filters.sessionDate).format("MMM D, YYYY")
                      : "All dates"}
                    <CalendarIcon className="h-4 w-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.sessionDate}
                    onSelect={onDateChange}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-filter-course">Course</Label>
              <Select
                value={selectedCourseValue || filters.courseId || undefined}
                onValueChange={onCourseChange}
              >
                <SelectTrigger id="session-filter-course" className="w-full">
                  <SelectValue placeholder="All courses" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.label ?? `${course.code} - ${course.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-filter-section">Section</Label>
              <Select
                value={selectedSectionValue || filters.sectionId || undefined}
                onValueChange={onSectionChange}
              >
                <SelectTrigger id="session-filter-section" className="w-full">
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem
                      key={`${section.id}:${section.courseId}`}
                      value={section.id}
                    >
                      {section.label ?? section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 border-t pt-4">
            <Button type="button" onClick={onApplyFilters}>
              Apply Filters
            </Button>
            <Button type="button" variant="outline" onClick={onClearFilters}>
              Clear Filters
            </Button>
          </div>
        </div>

        {isError ? (
          <div className="text-destructive border-destructive/20 bg-destructive/5 rounded-lg border p-4 text-sm">
            {errorMessage ?? "Failed to load sessions"}
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border p-4 py-10 text-center text-sm">
            No sessions found for selected filters.
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "space-y-3 rounded-lg border p-4 transition-colors",
                  activeSessionId === session.id
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50"
                )}
              >
                <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                  <p className="font-medium">
                    {session.courseCode} - {session.courseName}
                  </p>
                  <p className="text-muted-foreground font-medium md:text-right">
                    Section {session.sectionName}
                  </p>
                  <p className="text-muted-foreground">
                    {dayjs(session.sessionDate).format("MMM D, YYYY")}
                  </p>
                  <p className="text-muted-foreground md:text-right">
                    {session.timingLabel}
                  </p>
                </div>

                <div className="border-border/40 mt-2 flex flex-wrap gap-2 border-t pt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onSelectSession(session.id)}
                    disabled={isMutatingSession}
                  >
                    {openingSessionId === session.id
                      ? "Loading..."
                      : "Edit Attendance"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => onDeleteSession(session.id)}
                    disabled={isMutatingSession}
                  >
                    {deletingSessionId === session.id
                      ? "Deleting..."
                      : "Delete Session"}
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between border-t pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onPrevPage}
                disabled={page <= 1 || isFetching || isMutatingSession}
              >
                Previous
              </Button>
              <span className="text-muted-foreground text-sm font-medium">
                Page {page} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onNextPage}
                disabled={page >= totalPages || isFetching || isMutatingSession}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
