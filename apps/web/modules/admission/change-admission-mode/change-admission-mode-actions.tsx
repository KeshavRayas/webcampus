"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ChangeAdmissionModeSchema,
  ChangeAdmissionModeType,
} from "@webcampus/schemas/admission";
import {
  admissionModes,
  categoriesAllotted,
  categoriesClaimed,
  quotas,
} from "@webcampus/schemas/constants";
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
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { AdmissionResponse } from "../admin/admin-admission-columns";
import { useChangeAdmissionMode } from "./use-change-admission-mode";

export function ChangeAdmissionModeActions({
  admission,
}: {
  admission: AdmissionResponse;
}) {
  const [open, setOpen] = useState(false);

  const mutation = useChangeAdmissionMode();

  const form = useForm({
    resolver: zodResolver(ChangeAdmissionModeSchema),
    defaultValues: {
      modeOfAdmission: admission.modeOfAdmission,
      categoryClaimed: admission.categoryClaimed ?? "",
      categoryAllotted: admission.categoryAllotted ?? "",
      quota: admission.quota as ChangeAdmissionModeType["quota"],
      entranceExamRank:
        admission.entranceExamRank != null
          ? Number(admission.entranceExamRank)
          : undefined,
      originalAdmissionOrderNumber:
        admission.originalAdmissionOrderNumber ?? undefined,
      originalAdmissionOrderDate: admission.originalAdmissionOrderDate
        ? new Date(admission.originalAdmissionOrderDate)
            .toISOString()
            .split("T")[0]
        : undefined,
    },
  });

  console.log(form.formState.errors);
  const onSubmit = (data: ChangeAdmissionModeType) => {
    console.log("SUBMITTED", data);
    mutation.changeAdmissionMode({
      id: admission.id,
      data: {
        ...data,
        quota: selectedMode === "KCET" ? data.quota : undefined,
        originalAdmissionOrderDate: data.originalAdmissionOrderDate
          ? data.originalAdmissionOrderDate
          : undefined,
      },
    });
  };

  const selectedMode = form.watch(
    "modeOfAdmission"
  ) as keyof typeof categoriesClaimed;

  useEffect(() => {
    if (selectedMode !== "KCET") {
      form.setValue("quota", undefined, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, selectedMode]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={admission.status === "EXITED"}>
          Change Mode
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[80vh] w-[95vw] max-w-2xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Change Admission Mode</DialogTitle>

          <DialogDescription>
            Update admission details for this student.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Admission Mode */}
            <div className="space-y-2">
              <Label>Admission Mode</Label>

              <Select
                value={form.watch("modeOfAdmission")}
                onValueChange={(value) =>
                  form.setValue(
                    "modeOfAdmission",
                    value as ChangeAdmissionModeType["modeOfAdmission"]
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {admissionModes.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {mode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Claimed */}
            <div className="space-y-2">
              <Label>Category Claimed</Label>

              <Select
                value={form.watch("categoryClaimed")}
                onValueChange={(value) =>
                  form.setValue(
                    "categoryClaimed",
                    value as ChangeAdmissionModeType["categoryClaimed"]
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {(categoriesClaimed[selectedMode] ?? []).map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Allotted */}
            <div className="space-y-2">
              <Label>Category Allotted</Label>

              <Select
                value={form.watch("categoryAllotted")}
                onValueChange={(value) =>
                  form.setValue(
                    "categoryAllotted",
                    value as ChangeAdmissionModeType["categoryAllotted"]
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {(categoriesAllotted[selectedMode] ?? []).map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quota */}
            {selectedMode === "KCET" ? (
              <div className="space-y-2 md:col-span-2">
                <Label>Quota</Label>

                <Select
                  value={form.watch("quota")}
                  onValueChange={(value) =>
                    form.setValue(
                      "quota",
                      value as ChangeAdmissionModeType["quota"]
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {quotas.map((quota) => (
                      <SelectItem key={quota} value={quota}>
                        {quota}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2 md:col-span-2">
                <Label>Quota</Label>
                <div className="text-muted-foreground flex h-10 items-center rounded-md border border-dashed px-3 text-sm">
                  Not required for this admission mode
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Entrance Exam Rank</Label>

              <Input
                type="number"
                {...form.register("entranceExamRank", {
                  valueAsNumber: true,
                })}
              />
            </div>

            <div className="space-y-2">
              <Label>Admission Order Number</Label>

              <Input {...form.register("originalAdmissionOrderNumber")} />
            </div>

            <div className="space-y-2">
              <Label>Admission Order Date</Label>

              <Input
                type="date"
                {...form.register("originalAdmissionOrderDate")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>

            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Updating..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
