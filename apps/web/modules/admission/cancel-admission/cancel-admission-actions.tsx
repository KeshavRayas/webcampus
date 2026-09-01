"use client";

import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@webcampus/ui/components/dialog";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import { useState } from "react";
import {
  AdmissionResponse,
  isAdmissionPorted,
} from "../admin/admin-admission-columns";
import { CancellationReason, useCancelAdmission } from "./use-cancel-admission";

export function CancelAdmissionActions({
  admission,
}: {
  admission: AdmissionResponse;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CancellationReason | "">("");
  const [otherReason, setOtherReason] = useState("");
  const [description, setDescription] = useState("");
  const { cancelAdmission, isPending } = useCancelAdmission();

  const isPorted = isAdmissionPorted(admission);

  const submit = () => {
    if (!reason || (reason === "OTHER" && !otherReason.trim())) return;

    cancelAdmission(
      {
        id: admission.id,
        reason,
        otherReason: reason === "OTHER" ? otherReason.trim() : undefined,
        description: description.trim() || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setReason("");
          setOtherReason("");
          setDescription("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="default"
          size="sm"
          disabled={admission.status === "CANCELLED" || isPorted}
          title={
            isPorted
              ? "This admission has been ported to students and cannot be cancelled."
              : undefined
          }
          className={
            admission.status === "CANCELLED"
              ? "bg-red-200! text-red-400! hover:bg-red-200! disabled:opacity-100"
              : isPorted
                ? "bg-red-600/30! text-red-300! hover:bg-red-600/30! disabled:opacity-100"
                : "bg-red-600! text-white! hover:bg-red-700! disabled:opacity-100"
          }
        >
          Cancel Admission
        </Button>
      </DialogTrigger>
      <DialogContent className="admission-theme-dialog">
        <DialogHeader>
          <DialogTitle>Cancel Admission</DialogTitle>
          <DialogDescription>
            This will archive the admission and mark it as cancelled. This
            action cannot be repeated for the same admission.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Cancellation Reason</Label>
            <Select
              value={reason}
              onValueChange={(value) => setReason(value as CancellationReason)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LEAVE_COLLEGE">Leave College</SelectItem>
                <SelectItem value="CHANGE_ADMISSION_MODE">
                  Change Admission Mode
                </SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {reason === "OTHER" && (
            <div className="space-y-2">
              <Label htmlFor="otherCancellationReason">Reason</Label>
              <Input
                id="otherCancellationReason"
                value={otherReason}
                onChange={(event) => setOtherReason(event.target.value)}
                placeholder="Enter cancellation reason"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="cancellationDescription">
              Description (Optional)
            </Label>
            <textarea
              id="cancellationDescription"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add additional context for this cancellation"
              maxLength={2000}
              rows={3}
              className="admission-cancellation-textarea border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[60px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="bg-red-600! text-white! hover:bg-red-700!"
            disabled={
              isPending ||
              !reason ||
              (reason === "OTHER" && !otherReason.trim())
            }
            onClick={submit}
          >
            {isPending ? "Processing..." : "Confirm Cancellation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
