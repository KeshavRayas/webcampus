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
import { useState } from "react";
import { AdmissionResponse } from "../admin/admin-admission-columns";
import { useExitAdmission } from "./use-exit-admission";

export function LeaveCollegeActions({
  admission,
}: {
  admission: AdmissionResponse;
}) {
  const [open, setOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationDescription, setCancellationDescription] = useState("");

  const { exitAdmission, isPending } = useExitAdmission();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          disabled={!admission.student?.usn || admission.status === "POSTED"}
        >
          Exit College
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave College</DialogTitle>

          <DialogDescription>
            This will permanently mark{" "}
            <strong>
              {admission.student?.user.name ??
                `${admission.firstName} ${admission.lastName}`}
            </strong>{" "}
            as exited from the college.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cancellationReason">Cancellation Reason *</Label>
            <Input
              id="cancellationReason"
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
              placeholder="e.g. Student withdrew admission"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cancellationDescription">
              Additional Description
            </Label>
            <textarea
              id="cancellationDescription"
              value={cancellationDescription}
              onChange={(event) =>
                setCancellationDescription(event.target.value)
              }
              placeholder="Provide additional details (optional)"
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>

          <Button
            variant="destructive"
            disabled={isPending || !cancellationReason.trim()}
            onClick={() =>
              exitAdmission(
                {
                  id: admission.id,
                  cancellationReason,
                  cancellationDescription,
                },
                {
                  onSuccess: () => setOpen(false),
                }
              )
            }
          >
            {isPending ? "Processing..." : "Confirm Exit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
