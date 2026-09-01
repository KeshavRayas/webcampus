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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
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

type ElectiveBatchOption = {
  id: string;
  name: string;
  courseId: string;
};

type AttendanceFormProps = {
  form: FacultyAttendanceFormState;
  courses: CourseOption[];
  sections: SectionOption[];
  electiveBatches?: ElectiveBatchOption[];
  selectedCourseValue?: string;
  selectedSectionValue?: string;
  selectedElectiveBatchId?: string;
  isLabBatch?: boolean;
  isElective?: boolean;
  onDateChange: (date: Date | undefined) => void;
  onCourseChange: (courseId: string) => void;
  onSectionChange: (sectionId: string) => void;
  onElectiveBatchChange?: (id: string) => void;
  onTimingModeChange: (mode: "FIXED" | "CUSTOM") => void;
  onFixedSlotChange: (
    code: Exclude<FacultyAttendanceFormState["fixedTimingCode"], "">
  ) => void;
  onCustomStartTimeChange: (value: string) => void;
  onCustomEndTimeChange: (value: string) => void;
  onTakeAttendance: () => void;
  isTakeAttendanceDisabled?: boolean;
  overlapError: string | null;
};

type UITimeSlot = {
  code: string;
  label: string;
  startTime: string;
  endTime: string;
};

// Automatically generate 2-hour lab slots by combining back-to-back regular slots
const LAB_TIME_SLOTS = ATTENDANCE_TIME_SLOTS.reduce((acc, current, i, arr) => {
  const next = arr[i + 1];
  // If the current slot ends exactly when the next slot begins, combine them
  if (next && current.endTime === next.startTime) {
    acc.push({
      code: `${current.startTime}-${next.endTime}`,
      label: `${current.label.split(" - ")[0]} - ${next.label.split(" - ")[1]}`,
      startTime: current.startTime,
      endTime: next.endTime,
    });
  }
  return acc;
}, [] as UITimeSlot[]);

const isFixedTimingCode = (
  value: string
): value is Exclude<FacultyAttendanceFormState["fixedTimingCode"], ""> => {
  return (
    ATTENDANCE_TIME_SLOTS.some((slot) => slot.code === value) ||
    LAB_TIME_SLOTS.some((slot) => slot.code === value)
  );
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
  electiveBatches = [],
  selectedCourseValue,
  selectedSectionValue,
  selectedElectiveBatchId,
  isLabBatch = false,
  isElective = false,
  onDateChange,
  onCourseChange,
  onSectionChange,
  onElectiveBatchChange,
  onTimingModeChange,
  onFixedSlotChange,
  onCustomStartTimeChange,
  onCustomEndTimeChange,
  onTakeAttendance,
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

  // Determine which list of slots to show based on whether a lab batch is selected
  const activeTimeSlots = isLabBatch ? LAB_TIME_SLOTS : ATTENDANCE_TIME_SLOTS;

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
      <Input
        id={id}
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => event.currentTarget.showPicker?.()}
        className="h-[3.15rem] w-full cursor-pointer rounded-md"
      />
    </div>
  );

  return (
    <Card className="border-primary/20 from-background via-background to-primary/5 bg-linear-to-br">
      <CardHeader>
        <CardTitle>Session Context</CardTitle>
        <CardDescription>
          Set date, course, section, and time slot to take attendance.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-5">
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
              onClick={(event) => event.currentTarget.showPicker?.()}
              className="block h-[3.15rem] w-full cursor-pointer rounded-md"
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
                className="h-[3.15rem] rounded-md"
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
              {isElective ? "Elective Batch" : "Section"}
            </Label>
            {isElective ? (
              <Select
                value={selectedElectiveBatchId || undefined}
                onValueChange={(value) => onElectiveBatchChange?.(value)}
              >
                <SelectTrigger
                  id="attendance-section"
                  className="h-[3.15rem] rounded-md"
                >
                  <SelectValue placeholder="Select elective batch" />
                </SelectTrigger>
                <SelectContent>
                  {electiveBatches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={selectedSectionValue || form.sectionId || undefined}
                onValueChange={onSectionChange}
              >
                <SelectTrigger
                  id="attendance-section"
                  className="h-[3.15rem] rounded-md"
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
            )}
          </div>

          <fieldset className="space-y-3">
            <legend className="text-muted-foreground text-xs uppercase tracking-wide">
              Time Slot
            </legend>

            <Select
              value={
                form.timingMode === "CUSTOM"
                  ? "CUSTOM"
                  : form.fixedTimingCode || undefined
              }
              onValueChange={(value) => {
                if (value === "CUSTOM") {
                  onTimingModeChange("CUSTOM");
                } else if (isFixedTimingCode(value)) {
                  onTimingModeChange("FIXED");
                  onFixedSlotChange(value as never);
                }
              }}
            >
              <SelectTrigger className="h-[3.15rem] w-full rounded-md">
                <SelectValue placeholder="Select Time Slot" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>
                    {isLabBatch
                      ? "Lab Time Slots (2 Hrs)"
                      : "Regular Time Slots"}
                  </SelectLabel>
                  {activeTimeSlots.map((slot) => (
                    <SelectItem key={slot.code} value={slot.code}>
                      Regular: {slot.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectSeparator />
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>

            {form.timingMode === "CUSTOM" && (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          <div className="space-y-2">
            <span className="hidden text-muted-foreground text-xs uppercase tracking-wide md:block">
              &nbsp;
            </span>
            <Button
              type="button"
              onClick={onTakeAttendance}
              disabled={isTakeAttendanceDisabled}
              className="h-[3.15rem] w-full"
            >
              Take Attendance
            </Button>
          </div>
        </div>

        {overlapError ? (
          <p className="text-destructive text-sm">{overlapError}</p>
        ) : null}
      </CardContent>
    </Card>
  );
};
