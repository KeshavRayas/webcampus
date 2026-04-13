import { dayjs } from "@webcampus/common/dayjs";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { Calendar } from "@webcampus/ui/components/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@webcampus/ui/components/card";
import { Label } from "@webcampus/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@webcampus/ui/components/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@webcampus/ui/components/select";
import { cn } from "@webcampus/ui/lib/utils";
import { CalendarIcon, Loader2 } from "lucide-react";
import { TimingSelector } from "./timing-selector";
import { FacultyAttendanceFormState } from "../faculty-attendance-types";
import { ATTENDANCE_TIME_SLOTS } from "../attendance-time-slots";

type CourseOption = {
  id: string;
  code: string;
  name: string;
};

type SectionOption = {
  id: string;
  name: string;
  courseId: string;
};

type AttendanceFormProps = {
  form: FacultyAttendanceFormState;
  courses: CourseOption[];
  sections: SectionOption[];
  onDateChange: (date: Date | undefined) => void;
  onCourseChange: (courseId: string) => void;
  onSectionChange: (sectionId: string) => void;
  onTimingModeChange: (mode: "FIXED" | "CUSTOM") => void;
  onFixedSlotChange: (code: FacultyAttendanceFormState["fixedTimingCode"]) => void;
  onCustomStartTimeChange: (value: string) => void;
  onCustomEndTimeChange: (value: string) => void;
  onStartSession: () => void;
  onManageSessions: () => void;
  canStartSession: boolean;
  isStartingSession: boolean;
  overlapError: string | null;
};

export const AttendanceForm = ({
  form,
  courses,
  sections,
  onDateChange,
  onCourseChange,
  onSectionChange,
  onTimingModeChange,
  onFixedSlotChange,
  onCustomStartTimeChange,
  onCustomEndTimeChange,
  onStartSession,
  onManageSessions,
  canStartSession,
  isStartingSession,
  overlapError,
}: AttendanceFormProps) => {
  const selectedCourse = courses.find((course) => course.id === form.courseId) ?? null;
  const selectedSection = sections.find((section) => section.id === form.sectionId) ?? null;

  const selectedSlotLabel =
    form.timingMode === "FIXED"
      ? ATTENDANCE_TIME_SLOTS.find((slot) => slot.code === form.fixedTimingCode)?.code ?? "--"
      : form.customStartTime && form.customEndTime
        ? `${form.customStartTime}-${form.customEndTime}`
        : "--";

  const selectedDateLabel = form.sessionDate ? dayjs(form.sessionDate).format("MMM D, YYYY") : "--";

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background via-background to-primary/5">
      <CardHeader>
        <CardTitle>Faculty Attendance</CardTitle>
        <CardDescription>
          Start attendance in seconds with quick slot selection and reusable session controls.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="attendance-session-date" className="text-muted-foreground text-xs uppercase tracking-wide">
              Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="attendance-session-date"
                  variant="outline"
                  className={cn(
                    "h-10 w-full justify-between rounded-xl border-white/10 bg-background/60 px-3 text-left text-sm font-normal",
                    !form.sessionDate && "text-muted-foreground"
                  )}
                >
                  {form.sessionDate ? dayjs(form.sessionDate).format("MMM D, YYYY") : "Select date"}
                  <CalendarIcon className="h-4 w-4 opacity-70" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={form.sessionDate} onSelect={onDateChange} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="attendance-course" className="text-muted-foreground text-xs uppercase tracking-wide">
              Course
            </Label>
            <Select value={form.courseId} onValueChange={onCourseChange}>
              <SelectTrigger id="attendance-course" className="h-12 w-full rounded-xl border-white/10 bg-background/60 px-3.5 text-base">
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.code} - {course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="attendance-section" className="text-muted-foreground text-xs uppercase tracking-wide">
              Section
            </Label>
            <Select value={form.sectionId} onValueChange={onSectionChange}>
              <SelectTrigger id="attendance-section" className="h-12 w-full rounded-xl border-white/10 bg-background/60 px-3.5 text-base">
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section) => (
                  <SelectItem key={`${section.id}:${section.courseId}`} value={section.id}>
                    {section.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.2em]">Timing</span>
          <div className="h-px flex-1 bg-border/70" />
        </div>

        <TimingSelector
          form={form}
          onTimingModeChange={onTimingModeChange}
          onFixedSlotChange={onFixedSlotChange}
          onCustomStartTimeChange={onCustomStartTimeChange}
          onCustomEndTimeChange={onCustomEndTimeChange}
        />

        {overlapError ? <p className="text-destructive text-sm">{overlapError}</p> : null}

        <div className="grid grid-cols-2 gap-4 rounded-xl border border-primary/30 bg-primary/10 p-5 sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Course</p>
            <p className="text-sm font-semibold">{selectedCourse ? `${selectedCourse.code} - ${selectedCourse.name}` : "--"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Section</p>
            <p className="text-sm font-semibold">{selectedSection?.name ?? "--"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Slot</p>
            <p className="text-sm font-semibold">{selectedSlotLabel}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Date</p>
            <p className="text-sm font-semibold">{selectedDateLabel}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={onStartSession}
            disabled={!canStartSession || isStartingSession}
            className="min-w-36"
          >
            {isStartingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Start Session
          </Button>
          <Button type="button" variant="outline" onClick={onManageSessions}>
            Manage Sessions
          </Button>
          <Badge className="ml-auto bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/20" variant="secondary">
            {canStartSession ? "Ready" : "Incomplete"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
