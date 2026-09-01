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
import {
  FilterBuilder,
  type FilterFieldConfig,
} from "@webcampus/ui/components/filter-builder";
import { FilterIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

export const ADMISSION_FILTER_ALL_VALUE = "__all__";

export function AdmissionFilterBar<TFilters extends Record<string, string>>({
  simpleFields,
  advancedFields,
  draftFilters,
  onDraftChange,
  onApply,
  onReset,
  allValue = ADMISSION_FILTER_ALL_VALUE,
  dialogTitle = "Advanced Filters",
  dialogDescription = "Use advanced filters to narrow down the results.",
  onGenerateReport,
  reportButtonLabel = "Generate Report PDF",
  onGenerateExcel,
  reportExcelButtonLabel = "Generate Report Excel",
  fieldToggles,
  onToggleField,
  actionSlot,
  showFieldToggles = true,
}: {
  simpleFields: FilterFieldConfig<TFilters>[];
  advancedFields: FilterFieldConfig<TFilters>[];
  draftFilters: TFilters;
  onDraftChange: (key: Extract<keyof TFilters, string>, value: string) => void;
  onApply: () => void;
  onReset: () => void;
  allValue?: string;
  dialogTitle?: string;
  dialogDescription?: string;
  onGenerateReport?: () => void;
  reportButtonLabel?: string;
  onGenerateExcel?: () => void;
  reportExcelButtonLabel?: string;
  fieldToggles?: Record<string, boolean>;
  onToggleField?: (columnKey: string) => void;
  actionSlot?: ReactNode;
  showFieldToggles?: boolean;
}) {
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  const handleApply = () => {
    onApply();
    setIsFilterDialogOpen(false);
  };

  const handleReset = () => {
    onReset();
    setIsFilterDialogOpen(false);
  };

  return (
    <div className="admission-filter-panel space-y-4">
      <FilterBuilder
        fields={simpleFields}
        draftFilters={draftFilters}
        onDraftChange={onDraftChange}
        allValue={allValue}
        className="filter-builder-simple grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2"
      />

      <div
        className={`admission-filter-actions ${actionSlot ? "has-create-action" : "three-actions"} flex flex-wrap items-center gap-2`}
      >
        <Button type="button" onClick={onApply}>
          Apply Filters
        </Button>
        <Button type="button" onClick={onReset}>
          Reset Filters
        </Button>

        <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="icon" title="Filters">
              <FilterIcon className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="admission-filter-dialog sm:max-w-xl md:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
              <DialogDescription>{dialogDescription}</DialogDescription>
            </DialogHeader>
            <div className="max-h-[65dvh] overflow-y-auto pr-1">
              <FilterBuilder
                fields={advancedFields}
                draftFilters={draftFilters}
                onDraftChange={onDraftChange}
                allValue={allValue}
                toggles={fieldToggles}
                onToggle={onToggleField}
                className="grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleReset}>
                Reset Filters
              </Button>
              <Button type="button" onClick={handleApply}>
                Apply Filters
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {actionSlot}
      </div>
    </div>
  );
}
