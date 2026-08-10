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
import { useState } from "react";

interface WindowDaysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (days: number) => void;
  isCreating: boolean;
}

export const WindowDaysDialog = ({
  open,
  onOpenChange,
  onConfirm,
  isCreating,
}: WindowDaysDialogProps) => {
  const [days, setDays] = useState<number>(1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Bonus Attendance Days</DialogTitle>
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
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm(days);
              onOpenChange(false);
            }}
            disabled={isCreating}
          >
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
