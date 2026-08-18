"use client";

import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@webcampus/ui/components/dialog";
import { Input } from "@webcampus/ui/components/input";
import { Settings2 } from "lucide-react";
import { useState } from "react";

type EditBatchesBatch = {
  id: string;
  name: string;
  sortOrder: number;
};

type EditBatchesDialogProps = {
  batches: EditBatchesBatch[];
  hasAttendanceOrMarks: boolean;
  renamePending: boolean;
  deletePending: boolean;
  onRename: (electiveBatchId: string, name: string) => void;
  onDelete: (batch: EditBatchesBatch) => void;
};

export const EditBatchesDialog = ({
  batches,
  hasAttendanceOrMarks,
  renamePending,
  deletePending,
  onRename,
  onDelete,
}: EditBatchesDialogProps) => {
  const [open, setOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState<Record<string, string>>({});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={batches.length === 0}>
          <Settings2 className="mr-2 size-4" />
          Edit batches
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit batches</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {batches.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-2 rounded-md border px-2 py-1.5"
            >
              <Input
                className="h-8 flex-1"
                value={renameDraft[b.id] ?? b.name}
                placeholder={b.name}
                onChange={(e) =>
                  setRenameDraft((prev) => ({
                    ...prev,
                    [b.id]: e.target.value,
                  }))
                }
                disabled={hasAttendanceOrMarks}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={
                  renamePending ||
                  hasAttendanceOrMarks ||
                  !(renameDraft[b.id] ?? "").trim()
                }
                onClick={() => onRename(b.id, (renameDraft[b.id] ?? "").trim())}
              >
                Rename
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={deletePending}
                onClick={() => onDelete(b)}
              >
                Delete
              </Button>
            </div>
          ))}
          <p className="text-muted-foreground pt-1 text-xs">
            Batch names are editable anytime. Deleting a batch also removes its
            faculty and student assignments.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
