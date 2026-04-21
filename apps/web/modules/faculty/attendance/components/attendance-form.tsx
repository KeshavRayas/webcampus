import { dayjs } from "@webcampus/common/dayjs";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@webcampus/ui/components/toggle-group";
import { Clock } from "lucide-react";
import { ATTENDANCE_TIME_SLOTS } from "../attendance-time-slots";
import { FacultyAttendanceFormState } from "../faculty-attendance-types";

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

type AttendanceFormProps = {
  form: FacultyAttendanceFormState;
  courses: CourseOption[];
  sections: SectionOption[];
  selectedCourseValue?: string;
  selectedSectionValue?: string;
  onDateChange: (date: Date | undefined) => void;
  onCourseChange: (courseId: string) => void;
  onSectionChange: (sectionId: string) => void;
  onTimingModeChange: (mode: "FIXED" | "CUSTOM") => void;
  onFixedSlotChange: (
    code: Exclude<FacultyAttendanceFormState["fixedTimingCode"], "">
  ) => void;
  onCustomStartTimeChange: (value: string) => void;
  onCustomEndTimeChange: (value: string) => void;
  onEditAttendance: () => void;
  onTakeAttendance: () => void;
  isEditAttendanceDisabled?: boolean;
  isTakeAttendanceDisabled?: boolean;
  overlapError: string | null;
};

const isFixedTimingCode = (
  value: string
): value is Exclude<FacultyAttendanceFormState["fixedTimingCode"], ""> => {
  return ATTENDANCE_TIME_SLOTS.some((slot) => slot.code === value);
};

const toMinutes = (value: string) => {
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
};

const formatClockLabel = (value: string) => {
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return value;
  }

  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;

  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`;
};

const formatCustomTimingLabel = (startTime: string, endTime: string) => {
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);

  if (
    startMinutes === null ||
    endMinutes === null ||
    endMinutes <= startMinutes
  ) {
    return null;
  }

  const duration = endMinutes - startMinutes;

  return `${formatClockLabel(startTime)} - ${formatClockLabel(endTime)} (${duration} min)`;
};

export const AttendanceForm = ({
  form,
  courses,
  sections,
  selectedCourseValue,
  selectedSectionValue,
  onDateChange,
  onCourseChange,
  onSectionChange,
  onTimingModeChange,
  onFixedSlotChange,
  onCustomStartTimeChange,
  onCustomEndTimeChange,
  onEditAttendance,
  onTakeAttendance,
  isEditAttendanceDisabled = false,
  isTakeAttendanceDisabled = false,
  overlapError,
}: AttendanceFormProps) => {
  const hasCustomTimingValues =
    form.customStartTime.length > 0 && form.customEndTime.length > 0;

  const isCustomTimingValid =
    hasCustomTimingValues && form.customEndTime > form.customStartTime;

  const customTimingError =
    form.timingMode === "CUSTOM" &&
    hasCustomTimingValues &&
    !isCustomTimingValid
      ? "End time must be later than start time."
      : null;

  const TimeInputField = ({
    id,
    label,
    value,
    onChange,
  }: {
    id: string;
    label: string;
    value: string;
    onChange: (nextValue: string) => void;
  }) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="border-input bg-background relative h-11 overflow-hidden rounded-xl border">
        <div className="text-muted-foreground pointer-events-none flex h-full items-center justify-between px-4 text-sm">
          <span
            className={value ? "text-foreground font-medium tabular-nums" : ""}
          >
            {value || "--:--"}
          </span>
          <Clock className="h-4 w-4" />
        </div>
        <Input
          id={id}
          type="time"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onClick={(event) => event.currentTarget.showPicker?.()}
          className="absolute inset-0 h-full w-full cursor-pointer border-0 bg-transparent p-0 opacity-0 shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );

  return (
    <Card className="border-primary/20 from-background via-background to-primary/5 bg-gradient-to-br">
      <CardHeader>
        <CardTitle>Session Context</CardTitle>
        <CardDescription>
          Set date, course, section, and time slot before editing or taking
          attendance.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label
              htmlFor="attendance-session-date"
              className="text-muted-foreground text-xs uppercase tracking-wide"
            >
              Date
            </Label>
            <Input
              id="attendance-session-date"
              type="date"
              value={
                form.sessionDate
                  ? dayjs(form.sessionDate).format("YYYY-MM-DD")
                  : ""
              }
              onChange={(event) => {
                const value = event.target.value;
                onDateChange(value ? new Date(`${value}T00:00:00`) : undefined);
              }}
              className="h-11 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="attendance-course"
              className="text-muted-foreground text-xs uppercase tracking-wide"
            >
              Course
            </Label>
            <Select
              value={selectedCourseValue || form.courseId || undefined}
              onValueChange={onCourseChange}
            >
              <SelectTrigger
                id="attendance-course"
                className="bg-background/60 h-11 rounded-xl border-white/10"
              >
                <SelectValue placeholder="Select course" />
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
            <Label
              htmlFor="attendance-section"
              className="text-muted-foreground text-xs uppercase tracking-wide"
            >
              Section
            </Label>
            <Select
              value={selectedSectionValue || form.sectionId || undefined}
              onValueChange={onSectionChange}
            >
              <SelectTrigger
                id="attendance-section"
                className="bg-background/60 h-11 rounded-xl border-white/10"
              >
                <SelectValue placeholder="Select section" />
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

          <fieldset className="space-y-3 md:col-span-3">
            <legend className="text-muted-foreground text-xs uppercase tracking-wide">
              Time Slot
            </legend>
            <ToggleGroup
              type="single"
              value={form.timingMode}
              onValueChange={(value) => {
                if (value === "FIXED" || value === "CUSTOM") {
                  onTimingModeChange(value);
                }
              }}
              variant="outline"
              className="w-full"
              aria-label="Attendance time slot mode"
            >
              <ToggleGroupItem
                value="FIXED"
                className="h-11 flex-1 rounded-l-xl text-sm"
                aria-label="Use predefined time slot"
              >
                Predefined
              </ToggleGroupItem>
              <ToggleGroupItem
                value="CUSTOM"
                className="h-11 flex-1 rounded-r-xl text-sm"
                aria-label="Use custom time slot"
              >
                Custom
              </ToggleGroupItem>
            </ToggleGroup>

            {form.timingMode === "FIXED" ? (
              <div className="space-y-2">
                <Label id="attendance-time-slot-label">
                  Predefined Time Slot
                </Label>
                <ToggleGroup
                  type="single"
                  value={form.fixedTimingCode || undefined}
                  onValueChange={(value) => {
                    if (isFixedTimingCode(value)) {
                      onFixedSlotChange(value);
                    }
                  }}
                  aria-labelledby="attendance-time-slot-label"
                  className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4"
                >
                  {ATTENDANCE_TIME_SLOTS.map((slot) => (
                    <ToggleGroupItem
                      key={slot.code}
                      value={slot.code}
                      variant="outline"
                      className="border-border/60 bg-background/60 hover:border-primary/40 hover:bg-primary/5 data-[state=on]:border-primary/70 data-[state=on]:bg-primary/10 data-[state=on]:text-primary h-auto w-full justify-start whitespace-normal rounded-xl px-4 py-3 text-left text-sm leading-relaxed transition-all duration-200 data-[state=on]:shadow-sm"
                      aria-label={`Use predefined slot ${slot.label}`}
                    >
                      {slot.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TimeInputField
                  id="attendance-custom-start"
                  label="Start Time"
                  value={form.customStartTime}
                  onChange={onCustomStartTimeChange}
                />
                <TimeInputField
                  id="attendance-custom-end"
                  label="End Time"
                  value={form.customEndTime}
                  onChange={onCustomEndTimeChange}
                />
              </div>
            )}
            {form.timingMode === "CUSTOM" &&
            isCustomTimingValid &&
            formatCustomTimingLabel(
              form.customStartTime,
              form.customEndTime
            ) ? (
              <p className="text-muted-foreground text-sm">
                {formatCustomTimingLabel(
                  form.customStartTime,
                  form.customEndTime
                )}
              </p>
            ) : null}
            {customTimingError ? (
              <p className="text-destructive text-sm">{customTimingError}</p>
            ) : null}
          </fieldset>
        </div>

        {overlapError ? (
          <p className="text-destructive text-sm">{overlapError}</p>
        ) : null}

        <div className="border-border/60 flex flex-wrap items-center justify-end gap-3 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onEditAttendance}
            disabled={isEditAttendanceDisabled}
          >
            Edit Attendance
          </Button>
          <Button
            type="button"
            onClick={onTakeAttendance}
            disabled={isTakeAttendanceDisabled}
          >
            Take Attendance
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
