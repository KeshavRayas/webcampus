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
import { Label } from "@webcampus/ui/components/label";
import { Wand2 } from "lucide-react";
import { useMemo, useState } from "react";

type AutoDistributeBatch = {
  id: string;
  name: string;
};

type AutoDistributeStudent = {
  studentId: string;
  usn: string;
  name: string;
  locked: boolean;
};

type AutoDistributeDialogProps = {
  batches: AutoDistributeBatch[];
  students: AutoDistributeStudent[];
  currentAssignments: Record<string, string | null>;
  defaultStudentsPerBatch?: number | null;
  onGenerate: (next: Record<string, string>) => void;
};

export const AutoDistributeDialog = ({
  batches,
  students,
  currentAssignments,
  defaultStudentsPerBatch,
  onGenerate,
}: AutoDistributeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [perBatch, setPerBatch] = useState<string>(
    String(defaultStudentsPerBatch ?? 30)
  );

  const unassigned = useMemo(
    () =>
      students.filter(
        (s) => !s.locked && !(currentAssignments[s.studentId] ?? null)
      ),
    [students, currentAssignments]
  );

  const perBatchNumber = Math.max(1, parseInt(perBatch, 10) || 1);

  const projected = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of batches) counts.set(b.id, 0);
    for (const s of students) {
      const batchId = currentAssignments[s.studentId];
      if (batchId && counts.has(batchId)) {
        counts.set(batchId, (counts.get(batchId) ?? 0) + 1);
      }
    }
    const order = [...batches];
    let cursor = 0;
    for (let n = 0; n < unassigned.length; n++) {
      let placed = false;
      for (let i = 0; i < order.length; i++) {
        const idx = (cursor + i) % order.length;
        const target = order[idx]!;
        if ((counts.get(target.id) ?? 0) < perBatchNumber) {
          counts.set(target.id, (counts.get(target.id) ?? 0) + 1);
          cursor = (idx + 1) % order.length;
          placed = true;
          break;
        }
      }
      if (!placed) {
        const last = order[cursor]!;
        counts.set(last.id, (counts.get(last.id) ?? 0) + 1);
        cursor = (cursor + 1) % order.length;
      }
    }
    return counts;
  }, [batches, students, currentAssignments, unassigned, perBatchNumber]);

  const handleGenerate = () => {
    const next: Record<string, string> = {};
    const order = [...batches];
    let cursor = 0;
    const counts = new Map<string, number>();
    for (const b of batches) counts.set(b.id, 0);
    for (const s of students) {
      const batchId = currentAssignments[s.studentId];
      if (batchId && counts.has(batchId))
        counts.set(batchId, (counts.get(batchId) ?? 0) + 1);
    }
    for (const s of unassigned) {
      let placed = false;
      for (let i = 0; i < order.length; i++) {
        const idx = (cursor + i) % order.length;
        const target = order[idx]!;
        if ((counts.get(target.id) ?? 0) < perBatchNumber) {
          next[s.studentId] = target.id;
          counts.set(target.id, (counts.get(target.id) ?? 0) + 1);
          cursor = (idx + 1) % order.length;
          placed = true;
          break;
        }
      }
      if (!placed) {
        const last = order[cursor]!;
        next[s.studentId] = last.id;
        counts.set(last.id, (counts.get(last.id) ?? 0) + 1);
        cursor = (cursor + 1) % order.length;
      }
    }
    onGenerate(next);
    setOpen(false);
  };

  const generateCount = unassigned.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={batches.length === 0 || unassigned.length === 0}
        >
          <Wand2 className="mr-2 size-4" />
          Auto-assign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Auto-assign unassigned students</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="auto-distribute-per-batch">
              Students per batch
            </Label>
            <Input
              id="auto-distribute-per-batch"
              type="number"
              min={1}
              value={perBatch}
              onChange={(e) => setPerBatch(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              {unassigned.length} unassigned student(s) will be distributed
              across {batches.length} batch(es). Locked students are skipped.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Projected fill</p>
            <div className="space-y-1">
              {batches.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
                >
                  <span>{b.name}</span>
                  <span className="text-muted-foreground">
                    {projected.get(b.id) ?? 0} student(s)
                    {(projected.get(b.id) ?? 0) > perBatchNumber ? (
                      <span className="ml-2 text-amber-600">
                        over guideline
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={generateCount === 0}>
            Generate {generateCount} assignment
            {generateCount === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
