"use client";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { TimetableList } from "@/modules/timetable/timetable-list";
import {
  useDepartmentTimetable,
  useTimetableTemplate,
} from "@/modules/timetable/use-timetable";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { Input } from "@webcampus/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import { useState } from "react";
import { toast } from "react-toastify";

type Slot = {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
};
type ImportResult = {
  valid: boolean;
  errors: Array<{ cell: string; message: string }>;
  entries: unknown[];
};

const defaultSlots: Slot[] = [
  { id: "slot-0", label: "09:00-10:00", startTime: "09:00", endTime: "10:00" },
  { id: "slot-1", label: "10:00-11:00", startTime: "10:00", endTime: "11:00" },
  { id: "slot-2", label: "11:15-12:15", startTime: "11:15", endTime: "12:15" },
];

export default function DepartmentTimetablePage() {
  const terms = useAcademicTerms();
  const semesters = terms.data?.flatMap((term) => term.Semester ?? []) ?? [];
  const queryClient = useQueryClient();
  const [semesterId, setSemesterId] = useState("");
  const [slots, setSlots] = useState<Slot[]>(defaultSlots);
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [canSave, setCanSave] = useState(true);
  useTimetableTemplate(semesterId);

  const { data: departmentId } = useQuery({
    queryKey: ["department-info"],
    queryFn: async () => {
      const response = await apiClient.get<{
        status: string;
        data?: { id?: string };
      }>("/department/section/department-info");
      return response.data.data?.id ?? "";
    },
  });

  const timetable = useDepartmentTimetable(departmentId, semesterId);

  const saveSlots = async () => {
    const invalid = slots.some(
      (slot) =>
        !slot.label ||
        !slot.startTime ||
        !slot.endTime ||
        slot.startTime >= slot.endTime
    );
    if (invalid) {
      toast.error(
        "Each time slot must have a label and valid start/end times (start < end)."
      );
      return;
    }
    setCanSave(false);
    try {
      await apiClient.put(`/timetable/template/${semesterId}`, { slots });
      toast.success("Timetable template saved successfully");
      void queryClient.invalidateQueries({ queryKey: ["timetable-template"] });
      void queryClient.invalidateQueries({ queryKey: ["timetable"] });
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Failed to save timetable template")
      );
    } finally {
      setCanSave(true);
    }
  };

  const importEntries = async () => {
    if (!importResult || !importResult.valid) return;
    setImporting(true);
    try {
      await apiClient.post("/timetable/excel/import", {
        semesterId,
        entries: importResult.entries,
      });
      setImportResult(null);
      toast.success(
        `${importResult.entries.length} entries imported successfully`
      );
      void queryClient.invalidateQueries({
        queryKey: ["department-timetable"],
      });
      void queryClient.invalidateQueries({ queryKey: ["timetable-template"] });
      void queryClient.invalidateQueries({ queryKey: ["timetable"] });
      void queryClient.invalidateQueries({ queryKey: ["student-timetable"] });
      void queryClient.invalidateQueries({
        queryKey: ["student-timetable-today"],
      });
      void queryClient.invalidateQueries({ queryKey: ["faculty-timetable"] });
      void queryClient.invalidateQueries({
        queryKey: ["faculty-timetable-today"],
      });
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Failed to import timetable entries")
      );
    } finally {
      setImporting(false);
    }
  };

  const downloadWorkbook = async () => {
    const response = await apiClient.get("/timetable/excel/template", {
      params: { semesterId, slots: JSON.stringify(slots) },
      responseType: "blob",
    });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "timetable-template.xlsx";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const validateWorkbook = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("semesterId", semesterId);
    formData.append("slots", JSON.stringify(slots));
    const response = await apiClient.post<{ data: ImportResult }>(
      "/timetable/excel/validate",
      formData
    );
    setImportResult(response.data.data);
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Department timetable</h1>
        <p className="text-muted-foreground text-sm">
          Configure semester timings, download a workbook, and upload section
          schedules.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Term, semester and section</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={semesterId} onValueChange={setSemesterId}>
            <SelectTrigger>
              <SelectValue placeholder="Select semester" />
            </SelectTrigger>
            <SelectContent>
              {semesters.map((semester) => (
                <SelectItem key={semester.id} value={semester.id}>
                  {semester.programType} · Semester {semester.semesterNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {semesterId && (
        <Card>
          <CardHeader>
            <CardTitle>Semester timing template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {slots.map((slot) => (
              <div className="grid gap-2 sm:grid-cols-4" key={slot.id}>
                <Input
                  value={slot.label}
                  placeholder="Column label"
                  onChange={(event) =>
                    setSlots((current) =>
                      current.map((item) =>
                        item.id === slot.id
                          ? { ...item, label: event.target.value }
                          : item
                      )
                    )
                  }
                />
                <Input
                  type="time"
                  value={slot.startTime}
                  onChange={(event) =>
                    setSlots((current) =>
                      current.map((item) =>
                        item.id === slot.id
                          ? { ...item, startTime: event.target.value }
                          : item
                      )
                    )
                  }
                />
                <Input
                  type="time"
                  value={slot.endTime}
                  onChange={(event) =>
                    setSlots((current) =>
                      current.map((item) =>
                        item.id === slot.id
                          ? { ...item, endTime: event.target.value }
                          : item
                      )
                    )
                  }
                />
                <Button
                  variant="destructive"
                  onClick={() =>
                    setSlots((current) =>
                      current.filter((item) => item.id !== slot.id)
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setSlots((current) => [
                    ...current,
                    {
                      id: `slot-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                      label: "",
                      startTime: "",
                      endTime: "",
                    },
                  ])
                }
              >
                Add timing
              </Button>
              <Button disabled={!canSave} variant="default" onClick={saveSlots}>
                Save timings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {semesterId && (
        <Card>
          <CardHeader>
            <CardTitle>Excel timetable import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Enter course codes in the timetable cells. The Course Reference
              sheet lists valid codes and names.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={downloadWorkbook}>
                Download Excel template
              </Button>
              <Input
                className="max-w-xs"
                type="file"
                accept=".xlsx"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <Button disabled={!file} onClick={validateWorkbook}>
                Validate upload
              </Button>
            </div>
            {importResult && (
              <div className="rounded-lg border p-3">
                <p className="font-medium">
                  {importResult.valid
                    ? `${importResult.entries.length} entries ready for import`
                    : `${importResult.errors.length} errors found`}
                </p>
                {importResult.errors.map((error) => (
                  <p
                    className="text-destructive text-sm"
                    key={`${error.cell}-${error.message}`}
                  >
                    {error.cell}: {error.message}
                  </p>
                ))}
                {importResult.valid && (
                  <Button
                    variant="default"
                    onClick={importEntries}
                    disabled={importing}
                  >
                    {importing
                      ? "Importing..."
                      : `Import ${importResult.entries.length} entries`}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <TimetableList entries={timetable.data ?? []} title="Existing entries" />
    </div>
  );
}
