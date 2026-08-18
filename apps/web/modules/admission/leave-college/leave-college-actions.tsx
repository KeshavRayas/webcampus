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
import { useState } from "react";
import { AdmissionResponse } from "../admin/admin-admission-columns";
import { useExitAdmission } from "./use-exit-admission";

export function LeaveCollegeActions({
  admission,
}: {
  admission: AdmissionResponse;
}) {
  const [open, setOpen] = useState(false);

  const { exitAdmission, isPending } = useExitAdmission();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          disabled={!admission.student?.usn}
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
              {admission.student?.user.name ?? admission.nameAsPer10th}
            </strong>{" "}
            as exited from the college.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>

          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() =>
              exitAdmission(admission.id, {
                onSuccess: () => setOpen(false),
              })
            }
          >
            {isPending ? "Processing..." : "Confirm Exit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
