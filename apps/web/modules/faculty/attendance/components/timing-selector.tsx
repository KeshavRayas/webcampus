import { Button } from "@webcampus/ui/components/button";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";
import { Clock } from "lucide-react";
import { ATTENDANCE_TIME_SLOTS } from "../attendance-time-slots";
import { FacultyAttendanceFormState } from "../faculty-attendance-types";

type TimingSelectorProps = {
  form: FacultyAttendanceFormState;
  onTimingModeChange: (mode: "FIXED" | "CUSTOM") => void;
  onFixedSlotChange: (code: FacultyAttendanceFormState["fixedTimingCode"]) => void;
  onCustomStartTimeChange: (value: string) => void;
  onCustomEndTimeChange: (value: string) => void;
};

export const TimingSelector = ({
  form,
  onTimingModeChange,
  onFixedSlotChange,
  onCustomStartTimeChange,
  onCustomEndTimeChange,
}: TimingSelectorProps) => {
  const timeFieldClassName =
    "absolute inset-0 h-full w-full cursor-pointer border-0 bg-transparent p-0 opacity-0 shadow-none focus-visible:ring-0";

  const TimeField = ({
    id,
    value,
    onChange,
  }: {
    id: string;
    value: string;
    onChange: (nextValue: string) => void;
  }) => {
    const hasValue = value.length > 0;

    return (
      <div className="relative h-12 overflow-hidden rounded-xl border border-white/10 bg-background/60 shadow-sm transition-colors focus-within:border-ring focus-within:ring-ring/40 focus-within:ring-[3px]">
        <div
          aria-hidden="true"
          className={`pointer-events-none flex h-full items-center rounded-xl px-4 pr-11 text-base tabular-nums whitespace-nowrap overflow-hidden text-ellipsis ${
            hasValue ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {hasValue ? value : "--:--"}
        </div>
        <Input
          id={id}
          type="time"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onClick={(event) => event.currentTarget.showPicker?.()}
          className={timeFieldClassName}
        />
        <Clock className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 whitespace-nowrap">
        <Clock className="text-muted-foreground h-4 w-4 flex-shrink-0" />
        <Label className="text-muted-foreground text-xs uppercase tracking-wide">Selector</Label>
      </div>

      <div className="inline-flex rounded-full border border-white/10 bg-muted/30 p-1">
        <Button
          type="button"
          size="sm"
          variant={form.timingMode === "FIXED" ? "default" : "ghost"}
          onClick={() => onTimingModeChange("FIXED")}
          className="h-9 min-w-24 rounded-full"
        >
          Fixed
        </Button>
        <Button
          type="button"
          size="sm"
          variant={form.timingMode === "CUSTOM" ? "default" : "ghost"}
          onClick={() => onTimingModeChange("CUSTOM")}
          className="h-9 min-w-24 rounded-full"
        >
          Custom
        </Button>
      </div>

      {form.timingMode === "FIXED" ? (
        <div className="flex flex-wrap gap-2.5">
          {ATTENDANCE_TIME_SLOTS.map((slot) => {
            const isSelected = form.fixedTimingCode === slot.code;

            return (
              <Button
                key={slot.code}
                type="button"
                size="sm"
                variant={isSelected ? "default" : "outline"}
                onClick={() => onFixedSlotChange(slot.code)}
                className="h-10 rounded-xl px-4 text-sm"
              >
                {slot.startTime} - {slot.endTime}
              </Button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="attendance-custom-start">Start Time</Label>
            <TimeField id="attendance-custom-start" value={form.customStartTime} onChange={onCustomStartTimeChange} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="attendance-custom-end">End Time</Label>
            <TimeField id="attendance-custom-end" value={form.customEndTime} onChange={onCustomEndTimeChange} />
          </div>
        </div>
      )}
    </div>
  );
};
