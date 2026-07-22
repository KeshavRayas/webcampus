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
import { Label } from "@webcampus/ui/components/label";
import { ChangeEvent, useState } from "react";

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isRequired?: boolean;
}

export const ReasonDialog = ({
  open,
  onOpenChange,
  onConfirm,
  isRequired = true,
}: ReasonDialogProps) => {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (isRequired && !reason.trim()) return;
    onConfirm(reason);
    setReason("");
  };

  const handleCancel = () => {
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Reason for Override{isRequired ? "" : " (Optional)"}
          </DialogTitle>
          <DialogDescription>
            {isRequired
              ? "This course is locked or approved. Please provide a reason for making changes."
              : "Please provide a reason for this override (optional)."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="reason">Reason</Label>
          <textarea
            id="reason"
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Describe why this change is necessary..."
            value={reason}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              setReason(e.target.value)
            }
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isRequired && !reason.trim()}
          >
            Confirm Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
