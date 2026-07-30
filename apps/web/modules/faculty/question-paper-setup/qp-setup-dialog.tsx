import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import { QPSetupForm } from "./qp-setup-form";
import { SetupContext } from "./question-paper-dashboard";

interface QPSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setupContext: SetupContext;
}

export const QPSetupDialog = ({
  open,
  onOpenChange,
  setupContext,
}: QPSetupDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-7xl">
        <DialogHeader className="mb-4">
          <div className="flex items-center justify-between pr-8">
            <div>
              <DialogTitle>Setup {setupContext.assessmentTitle} for {setupContext.course.name}</DialogTitle>
              <DialogDescription>
                Configure the question paper template for {setupContext.course.code}. 
                The maximum marks are locked to the department configuration.
              </DialogDescription>
            </div>
            <div className="bg-primary/10 text-primary rounded-lg px-4 py-2 text-lg font-semibold border border-primary/20">
              Required Marks: {setupContext.maxMarks}
            </div>
          </div>
        </DialogHeader>

        <QPSetupForm
          setupContext={setupContext}
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};