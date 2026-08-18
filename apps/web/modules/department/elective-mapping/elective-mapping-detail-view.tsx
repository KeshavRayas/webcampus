"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { frontendEnv } from "@webcampus/common/env";
import { BaseResponse } from "@webcampus/types/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@webcampus/ui/components/alert-dialog";
import { Button } from "@webcampus/ui/components/button";
import { DataTable } from "@webcampus/ui/components/data-table";
import {
  FilterActions,
  FilterBuilder,
  FilterFieldConfig,
  FilterPanel,
} from "@webcampus/ui/components/filter-builder";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import axios, { AxiosError } from "axios";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { AutoDistributeDialog } from "./auto-distribute-dialog";
import { EditBatchesDialog } from "./edit-batches-dialog";

type DetailStudent = {
  studentId: string;
  usn: string;
  name: string;
  sectionId: string | null;
  sectionName: string | null;
  electiveBatchId: string | null;
  locked: boolean;
};

type DetailBatch = {
  id: string;
  name: string;
  sortOrder: number;
};

type PePeer = {
  courseId: string;
  code: string;
  name: string;
};

type DetailData = {
  courseId: string;
  code: string;
  name: string;
  semesterId: string;
  cycle: "PHYSICS" | "CHEMISTRY" | null;
  studentsPerBatch: number | null;
  electiveMappingVersion: number;
  hasAttendanceOrMarks: boolean;
  batches: DetailBatch[];
  students: DetailStudent[];
};

type ElectiveMappingDetailViewProps = {
  courseId: string;
  basePath: "/department" | "/admin";
  departmentId?: string;
};

type CsvRow = {
  usn: string;
  batchName?: string;
  batchId?: string;
};

type StudentFilters = {
  usn: string;
  name: string;
  batch: string;
  assigned: string;
  section: string;
};

const EMPTY_STUDENT_FILTERS: StudentFilters = {
  usn: "",
  name: "",
  batch: "",
  assigned: "",
  section: "",
};

const escapeCsv = (value: string): string => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const downloadCsvFile = (filename: string, content: string) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const parseElectiveCsv = (text: string): CsvRow[] => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const header = lines[0]!.toLowerCase();
  const hasHeader = /usn/.test(header);
  const headerCols = header.split(",").map((col) => col.trim());
  const idxOf = (names: string[]) =>
    headerCols.findIndex((col) => names.includes(col));
  const usnIdx = idxOf(["usn"]);
  const batchNameIdx = idxOf(["batchname", "batch_name"]);
  const batchIdIdx = idxOf(["batchid", "batch_id"]);

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows: CsvRow[] = [];
  for (const line of dataLines) {
    const cols = line.split(",").map((col) => col.trim());
    const pick = (idx: number) =>
      idx >= 0 && idx < cols.length ? cols[idx] : undefined;
    rows.push({
      usn: hasHeader
        ? ((usnIdx >= 0 ? pick(usnIdx) : "") ?? "")
        : (cols[0] ?? ""),
      batchName: hasHeader
        ? batchNameIdx >= 0
          ? pick(batchNameIdx)
          : undefined
        : cols[1],
      batchId: hasHeader
        ? batchIdIdx >= 0
          ? pick(batchIdIdx)
          : undefined
        : undefined,
    });
  }
  return rows;
};

export const ElectiveMappingDetailView = ({
  courseId,
  basePath,
  departmentId,
}: ElectiveMappingDetailViewProps) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const apiBase = `${NEXT_PUBLIC_API_BASE_URL}${basePath}/elective-mapping`;
  const queryClient = useQueryClient();

  const [draftFilters, setDraftFilters] = useState<StudentFilters>(
    EMPTY_STUDENT_FILTERS
  );
  const [appliedFilters, setAppliedFilters] = useState<StudentFilters>(
    EMPTY_STUDENT_FILTERS
  );
  const [sortBy, setSortBy] = useState<"usn" | "section">("usn");
  const [localAssignments, setLocalAssignments] = useState<
    Record<string, string | null>
  >({});
  const [selectAllBatchId, setSelectAllBatchId] = useState("");
  const [overrideToCourseId, setOverrideToCourseId] = useState("");
  const [overrideStudentId, setOverrideStudentId] = useState("");
  const [batchToDelete, setBatchToDelete] = useState<DetailBatch | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["elective-mapping-detail", courseId, departmentId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<DetailData>>(
        `${apiBase}/${courseId}`,
        {
          params: { departmentId },
          withCredentials: true,
        }
      );
      if (res.data.status !== "success" || !res.data.data) {
        throw new Error(res.data.message || "Failed to load");
      }
      return res.data.data;
    },
  });

  // Peers for the Override dropdown: PE courses in the same semester + cycle
  const { data: peList } = useQuery({
    queryKey: [
      "elective-mapping-peers",
      data?.semesterId,
      data?.cycle,
      basePath,
      departmentId,
    ],
    queryFn: async () => {
      if (!data) return [] as PePeer[];
      const res = await axios.get<BaseResponse<PePeer[]>>(apiBase, {
        params: {
          semesterId: data.semesterId,
          ...(data.cycle ? { cycle: data.cycle } : {}),
          ...(basePath === "/admin" && departmentId ? { departmentId } : {}),
        },
        withCredentials: true,
      });
      if (res.data.status !== "success") return [];
      return (res.data.data ?? []).filter((p) => p.courseId !== data.courseId);
    },
    enabled: Boolean(data?.semesterId),
  });

  useEffect(() => {
    if (!data) return;
    const next: Record<string, string | null> = {};
    for (const s of data.students) {
      next[s.studentId] = s.electiveBatchId;
    }
    setLocalAssignments(next);
  }, [data]);

  const sectionOptions = useMemo(() => {
    if (!data) return [] as { label: string; value: string }[];
    return Array.from(
      new Map(
        data.students
          .filter((s) => s.sectionId)
          .map((s) => [s.sectionId!, s.sectionName ?? s.sectionId!])
      ).entries()
    ).map(([value, label]) => ({ label, value }));
  }, [data]);

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    let rows = [...data.students];
    if (appliedFilters.usn.trim()) {
      rows = rows.filter((s) =>
        s.usn.toLowerCase().includes(appliedFilters.usn.trim().toLowerCase())
      );
    }
    if (appliedFilters.name.trim()) {
      rows = rows.filter((s) =>
        s.name.toLowerCase().includes(appliedFilters.name.trim().toLowerCase())
      );
    }
    if (appliedFilters.batch) {
      rows = rows.filter(
        (s) =>
          (localAssignments[s.studentId] ?? s.electiveBatchId) ===
          appliedFilters.batch
      );
    }
    if (appliedFilters.assigned === "assigned") {
      rows = rows.filter((s) =>
        Boolean(localAssignments[s.studentId] ?? s.electiveBatchId)
      );
    }
    if (appliedFilters.assigned === "unassigned") {
      rows = rows.filter(
        (s) => !Boolean(localAssignments[s.studentId] ?? s.electiveBatchId)
      );
    }
    if (appliedFilters.section) {
      rows = rows.filter((s) => s.sectionId === appliedFilters.section);
    }
    rows.sort((a, b) => {
      if (sortBy === "section") {
        return (a.sectionName ?? "").localeCompare(b.sectionName ?? "");
      }
      return a.usn.localeCompare(b.usn);
    });
    return rows;
  }, [data, appliedFilters, sortBy, localAssignments]);

  const studentColumns = useMemo<ColumnDef<DetailStudent>[]>(() => {
    const batches = data?.batches ?? [];
    return [
      {
        accessorKey: "usn",
        header: "USN",
        cell: ({ row }) => (
          <div className="font-medium">{row.original.usn}</div>
        ),
      },
      { accessorKey: "name", header: "Name" },
      {
        accessorKey: "sectionName",
        header: "Section",
        cell: ({ row }) => row.original.sectionName ?? "—",
      },
      {
        id: "batch",
        header: "Elective Batch",
        cell: ({ row }) => (
          <Select
            value={localAssignments[row.original.studentId] ?? ""}
            onValueChange={(v) =>
              setLocalAssignments((prev) => ({
                ...prev,
                [row.original.studentId]: v,
              }))
            }
            disabled={row.original.locked}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Assign batch" />
            </SelectTrigger>
            <SelectContent>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      },
    ];
  }, [data?.batches, localAssignments]);

  const softOverfillWarning = useMemo(() => {
    if (!data?.studentsPerBatch) return null;
    const counts = new Map<string, number>();
    for (const studentId of Object.keys(localAssignments)) {
      const batchId = localAssignments[studentId];
      if (!batchId) continue;
      counts.set(batchId, (counts.get(batchId) ?? 0) + 1);
    }
    const oversized = [...counts.entries()].filter(
      ([, count]) => count > (data.studentsPerBatch ?? 0)
    );
    if (oversized.length === 0) return null;
    return `Warning: ${oversized.length} batch(es) exceed students-per-batch guideline (${data.studentsPerBatch}).`;
  }, [localAssignments, data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error("No data");
      const assignments = Object.entries(localAssignments)
        .filter(([, batchId]) => Boolean(batchId))
        .map(([studentId, electiveBatchId]) => ({
          studentId,
          electiveBatchId: electiveBatchId!,
        }));
      return axios.put(
        `${apiBase}/save`,
        {
          courseId,
          electiveMappingVersion: data.electiveMappingVersion,
          assignments,
          departmentId,
        },
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["elective-mapping-detail", courseId],
      });
      queryClient.invalidateQueries({ queryKey: ["elective-mapping-list"] });
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.message
          : "Failed to save elective mapping";
      toast.error(message || "Failed to save elective mapping");
      queryClient.invalidateQueries({
        queryKey: ["elective-mapping-detail", courseId],
      });
    },
  });

  const overrideMutation = useMutation({
    mutationFn: async () => {
      if (!overrideStudentId || !overrideToCourseId) {
        throw new Error("Select student and target PE");
      }
      return axios.post(
        `${apiBase}/override-pe`,
        {
          studentId: overrideStudentId,
          fromCourseId: courseId,
          toCourseId: overrideToCourseId,
          fromCourseVersion: data?.electiveMappingVersion,
          departmentId,
        },
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["elective-mapping-detail", courseId],
      });
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.message
          : "Override failed";
      toast.error(message || "Override failed");
      queryClient.invalidateQueries({
        queryKey: ["elective-mapping-detail", courseId],
      });
    },
  });

  const csvMutation = useMutation({
    mutationFn: async (rows: CsvRow[]) => {
      return axios.post(
        `${apiBase}/validate-csv`,
        { courseId, rows, departmentId },
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      const assignments = res.data?.data?.assignments as
        | { studentId: string; electiveBatchId: string }[]
        | undefined;
      if (!assignments) {
        toast.error("CSV validation returned no assignments");
        return;
      }
      setLocalAssignments((prev) => {
        const next = { ...prev };
        for (const a of assignments) {
          next[a.studentId] = a.electiveBatchId;
        }
        return next;
      });
      toast.success(
        `${assignments.length} student(s) staged from CSV. Review and Save.`
      );
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.message
          : "CSV validation failed";
      toast.error(message || "CSV validation failed", { autoClose: 6000 });
    },
  });

  const handleCsvFile = async (file: File) => {
    if (!data) return;
    try {
      const text = await file.text();
      const rows = parseElectiveCsv(text).filter(
        (r) => r.usn && (r.batchName || r.batchId)
      );
      if (rows.length === 0) {
        toast.error("No valid rows found. Expected columns: usn, batchName");
        return;
      }
      csvMutation.mutate(rows);
    } catch {
      toast.error("Failed to read CSV file");
    }
  };

  const handleDownloadTemplate = () => {
    if (!data) return;
    const batchNameById = new Map(data.batches.map((b) => [b.id, b.name]));
    const lines: string[] = ["usn,batchName"];
    for (const s of data.students) {
      const existingBatch = s.electiveBatchId
        ? batchNameById.get(s.electiveBatchId)
        : undefined;
      lines.push(`${escapeCsv(s.usn)},${escapeCsv(existingBatch ?? "")}`);
    }
    downloadCsvFile(
      `${data.code}-elective-mapping-template.csv`,
      `${lines.join("\n")}\n`
    );
  };

  const renameMutation = useMutation({
    mutationFn: async (payload: { electiveBatchId: string; name: string }) => {
      return axios.post(
        `${apiBase}/rename-batch`,
        { ...payload, departmentId },
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({
        queryKey: ["elective-mapping-detail", courseId],
      });
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.message
          : "Rename failed";
      toast.error(message || "Rename failed");
    },
  });

  const deleteBatchMutation = useMutation({
    mutationFn: async (electiveBatchId: string) => {
      return axios.post(
        `${apiBase}/delete-batch`,
        { electiveBatchId, departmentId },
        { withCredentials: true }
      );
    },
    onSuccess: (res) => {
      toast.success(res.data.message);
      setBatchToDelete(null);
      queryClient.invalidateQueries({
        queryKey: ["elective-mapping-detail", courseId],
      });
      queryClient.invalidateQueries({ queryKey: ["elective-mapping-list"] });
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.message
          : "Delete failed";
      toast.error(message || "Delete failed");
    },
  });

  if (isLoading || !data) {
    return (
      <div className="text-muted-foreground flex items-center justify-center p-12">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  const filterFields: FilterFieldConfig<StudentFilters>[] = [
    {
      key: "usn",
      label: "USN",
      type: "text",
      inputId: "elective-usn-filter",
      placeholder: "Search by USN",
    },
    {
      key: "name",
      label: "Name",
      type: "text",
      inputId: "elective-name-filter",
      placeholder: "Search by name",
    },
    {
      key: "batch",
      label: "Batch",
      type: "select",
      placeholder: "Batch",
      allOptionLabel: "All batches",
      options: data.batches.map((b) => ({ label: b.name, value: b.id })),
    },
    {
      key: "assigned",
      label: "Assigned",
      type: "select",
      placeholder: "All",
      allOptionLabel: "All",
      options: [
        { label: "Assigned", value: "assigned" },
        { label: "Unassigned", value: "unassigned" },
      ],
    },
    {
      key: "section",
      label: "Section",
      type: "select",
      placeholder: "Section",
      allOptionLabel: "All sections",
      options: sectionOptions,
    },
  ];

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 px-0">
            <Link href={`${basePath}/elective-mapping`}>← Back</Link>
          </Button>
          <h2 className="text-xl font-semibold">
            {data.code} — {data.name}
          </h2>
          <p className="text-muted-foreground text-sm">
            Assign every registered student to an elective batch, then Save.
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          Save Mapping
        </Button>
      </div>

      {softOverfillWarning ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {softOverfillWarning}
        </p>
      ) : null}

      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <FilterPanel className="w-full">
            <FilterBuilder
              fields={filterFields}
              draftFilters={draftFilters}
              onDraftChange={(key, value) =>
                setDraftFilters((prev) => ({ ...prev, [key]: value }))
              }
            />
            <FilterActions
              onApply={() => setAppliedFilters(draftFilters)}
              onReset={() => {
                setDraftFilters(EMPTY_STUDENT_FILTERS);
                setAppliedFilters(EMPTY_STUDENT_FILTERS);
              }}
            />
          </FilterPanel>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-2">
              <label className="text-muted-foreground text-xs font-medium">
                Sort by
              </label>
              <Select
                value={sortBy}
                onValueChange={(v) => setSortBy(v as "usn" | "section")}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usn">Sort by USN</SelectItem>
                  <SelectItem value="section">Sort by Section</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <AutoDistributeDialog
              batches={data.batches}
              students={data.students}
              currentAssignments={localAssignments}
              defaultStudentsPerBatch={data.studentsPerBatch}
              onGenerate={(next) =>
                setLocalAssignments((prev) => ({ ...prev, ...next }))
              }
            />
            <EditBatchesDialog
              batches={data.batches}
              hasAttendanceOrMarks={data.hasAttendanceOrMarks}
              renamePending={renameMutation.isPending}
              deletePending={deleteBatchMutation.isPending}
              onRename={(electiveBatchId, name) =>
                renameMutation.mutate({ electiveBatchId, name })
              }
              onDelete={(batch) => setBatchToDelete(batch)}
            />
            <Button variant="outline" onClick={handleDownloadTemplate}>
              Download template
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                document.getElementById("elective-csv-input")?.click()
              }
              disabled={csvMutation.isPending}
            >
              {csvMutation.isPending ? "Validating…" : "Upload CSV"}
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          Download the template, fill in the{" "}
          <code className="bg-muted rounded px-1">batchName</code> column using
          the exact batch names (see <b>Edit batches</b>), then upload the CSV.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          id="elective-csv-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleCsvFile(file);
            e.target.value = "";
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectAllBatchId} onValueChange={setSelectAllBatchId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select-all batch" />
            </SelectTrigger>
            <SelectContent>
              {data.batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!selectAllBatchId) return;
              setLocalAssignments((prev) => {
                const next = { ...prev };
                for (const s of filteredStudents) {
                  if (s.locked) continue;
                  next[s.studentId] = selectAllBatchId;
                }
                return next;
              });
            }}
          >
            Select all into batch
          </Button>
        </div>

        <DataTable columns={studentColumns} data={filteredStudents} />
      </div>

      {!data.hasAttendanceOrMarks ? (
        <div className="bg-card space-y-2 rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold">Override PE course</h3>
          <p className="text-muted-foreground text-xs">
            Move a registered student to another PE in this semester/cycle (may
            exceed capacity). Clears their batch assignment.
          </p>
          <div className="flex flex-wrap gap-2">
            <Select
              value={overrideStudentId}
              onValueChange={setOverrideStudentId}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Student" />
              </SelectTrigger>
              <SelectContent>
                {data.students.map((s) => (
                  <SelectItem key={s.studentId} value={s.studentId}>
                    {s.usn} — {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={overrideToCourseId}
              onValueChange={setOverrideToCourseId}
            >
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Select target PE course" />
              </SelectTrigger>
              <SelectContent>
                {peList?.length ? (
                  peList.map((p) => (
                    <SelectItem key={p.courseId} value={p.courseId}>
                      {p.code} — {p.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__none" disabled>
                    No other PE courses in this semester/cycle
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => overrideMutation.mutate()}
              disabled={overrideMutation.isPending}
            >
              Override
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Attendance/marks exist — PE override and moves of mapped students are
          locked. New unassigned students can still be assigned.
        </p>
      )}

      <AlertDialog
        open={Boolean(batchToDelete)}
        onOpenChange={(open) => {
          if (!open) setBatchToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete elective batch</AlertDialogTitle>
            <AlertDialogDescription>
              Delete batch “{batchToDelete?.name}”? Its faculty assignment and
              student assignments will be removed. You cannot delete the last
              remaining batch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (batchToDelete) deleteBatchMutation.mutate(batchToDelete.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
