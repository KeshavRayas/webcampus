"use client";

import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";
import { useEffect, useState } from "react";

interface WindowDaysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (days: number) => void;
  isSaving: boolean;
  isEditing?: boolean;
  initialDays?: number;
}

export const WindowDaysDialog = ({
  open,
  onOpenChange,
  onConfirm,
  isSaving,
  isEditing = false,
  initialDays = 1,
}: WindowDaysDialogProps) => {
  const [days, setDays] = useState<number>(1);

  useEffect(() => {
    if (open) {
      setDays(initialDays);
    }
  }, [open, initialDays]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? "Edit Bonus Attendance Days"
              : "Set Bonus Attendance Days"}
          </DialogTitle>
          <DialogDescription>
            Specify how many days into the future faculty can take attendance
            when this window is open.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="days" className="text-right">
              Days
            </Label>
            <Input
              id="days"
              type="number"
              min={1}
              className="col-span-3"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value) || 1)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm(days);
              onOpenChange(false);
            }}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : isEditing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
