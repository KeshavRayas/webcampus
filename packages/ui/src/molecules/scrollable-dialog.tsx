"use client";

import { cn } from "@webcampus/ui/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@webcampus/ui/components/dialog";
import * as React from "react";

interface ScrollableDialogContentProps {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function ScrollableDialogContent({
  title,
  description,
  children,
  footer,
  className,
}: ScrollableDialogContentProps) {
  return (
    <DialogContent
      className={cn(
        "flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-md",
        className
      )}
    >
      <DialogHeader className="shrink-0 px-6 pb-4 pt-6">
        <DialogTitle>{title}</DialogTitle>
        {description ? (
          <DialogDescription>{description}</DialogDescription>
        ) : null}
      </DialogHeader>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-4">{children}</div>
      </div>
      {footer ? (
        <DialogFooter className="bg-background shrink-0 border-t px-6 py-4">
          {footer}
        </DialogFooter>
      ) : null}
    </DialogContent>
  );
}

interface ScrollableDialogProps extends ScrollableDialogContentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
}

export function ScrollableDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  className,
}: ScrollableDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <ScrollableDialogContent
        title={title}
        description={description}
        footer={footer}
        className={className}
      >
        {children}
      </ScrollableDialogContent>
    </Dialog>
  );
}
