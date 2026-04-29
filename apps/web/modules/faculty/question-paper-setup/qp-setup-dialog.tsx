import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import { useState } from "react";
import { QPSetupForm } from "./qp-setup-form";

interface CoordinatedCourse {
  id: string;
  code: string;
  name: string;
  semesterNumber: number;
  semesterId: string;
}

interface QPSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: CoordinatedCourse;
}

export const QPSetupDialog = ({
  open,
  onOpenChange,
  course,
}: QPSetupDialogProps) => {
  const [totalMarks, setTotalMarks] = useState(0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-7xl">
        <DialogHeader className="mb-4">
          <div className="flex items-center justify-between pr-8">
            <div>
              <DialogTitle>Setup Assessment for {course.name}</DialogTitle>
              <DialogDescription>
                Configure the question paper template for {course.code}.
              </DialogDescription>
            </div>
            <div className="bg-primary/10 text-primary rounded-lg px-4 py-2 text-lg font-semibold">
              Total Marks: {totalMarks}
            </div>
          </div>
        </DialogHeader>

        <QPSetupForm
          course={course}
          onSuccess={() => onOpenChange(false)}
          onMarksChange={setTotalMarks}
        />
      </DialogContent>
    </Dialog>
  );
};
