"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { frontendEnv } from "@webcampus/common/env";
import type { ProjectMappingExcelError } from "@webcampus/schemas/department";
import type { BaseResponse } from "@webcampus/types/api";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { Checkbox } from "@webcampus/ui/components/checkbox";
import { DataTable } from "@webcampus/ui/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import {
  FilterActions,
  FilterBuilder,
  FilterFieldConfig,
  FilterPanel,
} from "@webcampus/ui/components/filter-builder";
import { Input } from "@webcampus/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@webcampus/ui/components/tabs";
import axios, { AxiosError } from "axios";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  buildExcelPreviewModel,
  buildFacultyGroupRows,
  buildGroupDetailModel,
  buildSavePayload,
  deriveStudentFaculty,
  PW_DETAIL_TABS,
  type ExcelAssignmentInput,
  type ExcelFacultyAssignmentInput,
  type ExcelPreviewModel,
  type FacultyGroupRow,
} from "./detail-view-model";

type ProjectGroupingScope = "WITHIN_SECTION" | "DEPARTMENT_WIDE";

type DetailStudent = {
  studentId: string;
  usn: string;
  name: string;
  sectionId: string | null;
  sectionName: string | null;
  electiveBatchId: string | null;
  batchName: string | null;
  batchSectionId: string | null;
  locked: boolean;
};

type DetailBatch = {
  id: string;
  name: string;
  sortOrder: number;
  sectionId: string | null;
  studentCount: number;
  facultyId: string | null;
  facultyName: string | null;
};

type DetailCourse = {
  id: string;
  code: string;
  name: string;
  projectGroupingScope: ProjectGroupingScope;
  numberOfBatches: number | null;
  studentsPerBatch: number | null;
  electiveMappingVersion: number;
  semesterId: string;
  cycle: string;
  hasAttendanceOrMarks: boolean;
};

type DetailData = {
  course: DetailCourse;
  students: DetailStudent[];
  batches: DetailBatch[];
};

type GroupItem = {
  id: string;
  name: string;
  sectionId: string | null;
  sectionName: string | null;
  studentCount: number;
  studentsPerGroup: number;
  facultyId: string | null;
  facultyName: string | null;
  status: "ASSIGNED" | "UNASSIGNED";
};

type GroupMember = {
  studentId: string;
  usn: string;
  name: string;
  sectionId: string | null;
  sectionName: string | null;
};

type GroupDetail = {
  group: {
    id: string;
    name: string;
    sortOrder: number;
    sectionId: string | null;
    sectionName: string | null;
    studentsPerGroup: number;
    facultyId: string | null;
    facultyName: string | null;
  };
  members: GroupMember[];
};

type GroupsData = {
  items: GroupItem[];
  pagination: { page: number; limit: number; total: number; pages: number };
  summary: { total: number; assigned: number; unassigned: number };
};

type FacultyOption = {
  id: string;
  name: string;
  departmentAbbreviation: string;
};

type GroupFilters = {
  search: string;
  status: "ASSIGNED" | "UNASSIGNED" | "ALL";
  facultyId: string;
  sectionId: string;
};

const EMPTY_GROUP_FILTERS: GroupFilters = {
  search: "",
  status: "ALL",
  facultyId: "",
  sectionId: "",
};

type StudentFilters = {
  usn: string;
  name: string;
  group: string;
  assigned: string;
  section: string;
};

const EMPTY_STUDENT_FILTERS: StudentFilters = {
  usn: "",
  name: "",
  group: "",
  assigned: "",
  section: "",
};

type Props = {
  courseId: string;
  basePath: "/department" | "/admin";
  departmentId?: string;
};

export function ProjectMappingDetailView({
  courseId,
  basePath,
  departmentId,
}: Props) {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const apiBase = `${NEXT_PUBLIC_API_BASE_URL}${basePath}/project-mapping`;
  const facultyApi = `${NEXT_PUBLIC_API_BASE_URL}${basePath}/course-assignment/faculty`;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("students");
  const [localAssignments, setLocalAssignments] = useState<
    Record<string, string | null>
  >({});
  const [draftStudentFilters, setDraftStudentFilters] =
    useState<StudentFilters>(EMPTY_STUDENT_FILTERS);
  const [appliedStudentFilters, setAppliedStudentFilters] =
    useState<StudentFilters>(EMPTY_STUDENT_FILTERS);
  const [draftGroupFilters, setDraftGroupFilters] =
    useState<GroupFilters>(EMPTY_GROUP_FILTERS);
  const [appliedGroupFilters, setAppliedGroupFilters] =
    useState<GroupFilters>(EMPTY_GROUP_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(
    new Set()
  );
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [bulkFacultyId, setBulkFacultyId] = useState<string>("");
  const [localFaculty, setLocalFaculty] = useState<
    Record<string, string | null>
  >({});
  const [excelErrors, setExcelErrors] = useState<ProjectMappingExcelError[]>(
    []
  );
  const [excelPreview, setExcelPreview] = useState<{
    assignments: ExcelAssignmentInput[];
    facultyAssignments: ExcelFacultyAssignmentInput[];
  } | null>(null);

  const detailQuery = useQuery({
    queryKey: ["project-mapping-detail", courseId, departmentId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<DetailData>>(
        `${apiBase}/${courseId}`,
        { params: { departmentId }, withCredentials: true }
      );
      return res.data.status === "success" ? res.data.data : null;
    },
    enabled: Boolean(courseId),
  });

  const facultyQuery = useQuery({
    queryKey: ["course-assignment-faculty", basePath],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<FacultyOption[]>>(facultyApi, {
        withCredentials: true,
      });
      return res.data.status === "success" ? res.data.data : [];
    },
    enabled: Boolean(courseId),
  });

  const groupsQuery = useQuery({
    queryKey: [
      "project-mapping-groups",
      courseId,
      page,
      appliedGroupFilters,
      departmentId,
    ],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<GroupsData>>(
        `${apiBase}/${courseId}/groups`,
        {
          params: {
            page,
            limit: 25,
            search: appliedGroupFilters.search || undefined,
            status:
              appliedGroupFilters.status === "ALL"
                ? undefined
                : appliedGroupFilters.status,
            facultyId: appliedGroupFilters.facultyId || undefined,
            sectionId: appliedGroupFilters.sectionId || undefined,
            departmentId,
          },
          withCredentials: true,
        }
      );
      return res.data.status === "success" ? res.data.data : null;
    },
    enabled: Boolean(courseId),
  });

  const groupDetailQuery = useQuery({
    queryKey: ["project-mapping-group", courseId, openGroupId, departmentId],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<GroupDetail>>(
        `${apiBase}/${courseId}/groups/${openGroupId}`,
        { params: { departmentId }, withCredentials: true }
      );
      return res.data.status === "success" ? res.data.data : null;
    },
    enabled: Boolean(openGroupId),
  });

  useEffect(() => {
    const data = detailQuery.data;
    if (!data) return;
    const next: Record<string, string | null> = {};
    for (const s of data.students) next[s.studentId] = s.electiveBatchId;
    setLocalAssignments(next);
    const nextFaculty: Record<string, string | null> = {};
    for (const b of data.batches) nextFaculty[b.id] = b.facultyId;
    setLocalFaculty(nextFaculty);
  }, [detailQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = detailQuery.data;
      if (!data) return;
      const payload = buildSavePayload({
        courseId,
        electiveMappingVersion: data.course.electiveMappingVersion,
        localAssignments,
        localFaculty,
        departmentId,
      });
      const res = await axios.put<
        BaseResponse<{ electiveMappingVersion: number }>
      >(`${apiBase}/save-full`, payload, { withCredentials: true });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Project group mapping saved.");
      setExcelErrors([]);
      queryClient.invalidateQueries({ queryKey: ["project-mapping-detail"] });
      queryClient.invalidateQueries({ queryKey: ["project-mapping-groups"] });
      queryClient.invalidateQueries({ queryKey: ["project-mapping-list"] });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof AxiosError
          ? (error.response?.data as { message?: string })?.message
          : undefined;
      toast.error(message ?? "Failed to save project group mapping.");
    },
  });

  const applyFacultyToGroups = (
    facultyId: string | null,
    groupIds: string[]
  ): void => {
    if (groupIds.length === 0) return;
    setLocalFaculty((prev) => {
      const next = { ...prev };
      for (const groupId of groupIds) next[groupId] = facultyId;
      return next;
    });
  };

  const excelValidateMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("courseId", courseId);
      if (departmentId) formData.append("departmentId", departmentId);
      const res = await axios.post<
        BaseResponse<{
          assignments: { studentId: string; electiveBatchId: string }[];
          facultyAssignments: {
            electiveBatchId: string;
            facultyId: string | null;
          }[];
        }>
      >(`${apiBase}/${courseId}/excel/validate`, formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: (data) => {
      const assignments: ExcelAssignmentInput[] =
        data.status === "success" ? (data.data?.assignments ?? []) : [];
      const facultyAssignments: ExcelFacultyAssignmentInput[] =
        data.status === "success" ? (data.data?.facultyAssignments ?? []) : [];
      setExcelErrors([]);
      setExcelPreview({ assignments, facultyAssignments });
      toast.success(
        "Excel validated. Review the staged changes, then confirm to update the draft."
      );
    },
    onError: (error: unknown) => {
      const responseData =
        error instanceof AxiosError
          ? (error.response?.data as {
              message?: string;
              data?: { errors?: ProjectMappingExcelError[] };
            })
          : undefined;
      const errors = responseData?.data?.errors;
      if (errors && errors.length > 0) {
        setExcelErrors(errors);
        toast.error(`Excel validation failed with ${errors.length} error(s).`);
        return;
      }
      setExcelErrors([]);
      toast.error(responseData?.message ?? "Excel validation failed.");
    },
  });

  const handleDownloadTemplate = async () => {
    try {
      const res = await axios.get(`${apiBase}/${courseId}/excel/template`, {
        params: { departmentId },
        responseType: "blob",
        withCredentials: true,
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${detailQuery.data?.course.code ?? "project"}_mapping_template.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download Excel template");
    }
  };

  const handleExcelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelErrors([]);
    setExcelPreview(null);
    excelValidateMutation.mutate(file);
    e.target.value = "";
  };

  const handleExcelPreviewConfirm = () => {
    if (!excelPreview) return;
    const { assignments, facultyAssignments } = excelPreview;
    if (assignments.length > 0) {
      setLocalAssignments((prev) => {
        const next = { ...prev };
        for (const a of assignments) next[a.studentId] = a.electiveBatchId;
        return next;
      });
    }
    if (facultyAssignments.length > 0) {
      setLocalFaculty((prev) => {
        const next = { ...prev };
        for (const f of facultyAssignments)
          next[f.electiveBatchId] = f.facultyId;
        return next;
      });
    }
    setExcelPreview(null);
    toast.success(
      "Excel changes staged into the mapping draft. Review and Save."
    );
  };

  const handleExcelPreviewDiscard = () => {
    setExcelPreview(null);
  };

  const excelPreviewModel = useMemo(() => {
    if (!excelPreview) return null;
    const detail = detailQuery.data;
    const students = detail?.students ?? [];
    const batches = (detail?.batches ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      sectionName:
        students.find((s) => s.electiveBatchId === b.id)?.sectionName ?? null,
    }));
    return buildExcelPreviewModel({
      assignments: excelPreview.assignments,
      facultyAssignments: excelPreview.facultyAssignments,
      students,
      batches,
      facultyOptions: facultyQuery.data ?? [],
      currentAssignments: localAssignments,
      currentFaculty: localFaculty,
    });
  }, [
    excelPreview,
    detailQuery.data,
    facultyQuery.data,
    localAssignments,
    localFaculty,
  ]);

  const filteredStudents = useMemo(() => {
    const data = detailQuery.data;
    if (!data) return [];
    const f = appliedStudentFilters;
    return data.students.filter((s) => {
      if (f.usn && !s.usn.toLowerCase().includes(f.usn.toLowerCase()))
        return false;
      if (f.name && !s.name.toLowerCase().includes(f.name.toLowerCase()))
        return false;
      if (f.group && s.batchName !== f.group) return false;
      if (f.assigned === "assigned" && !s.electiveBatchId) return false;
      if (f.assigned === "unassigned" && s.electiveBatchId) return false;
      if (f.section && s.sectionName !== f.section) return false;
      return true;
    });
  }, [detailQuery.data, appliedStudentFilters]);

  const studentSectionOptions = useMemo(() => {
    const data = detailQuery.data;
    if (!data) return [];
    const map = new Map<string, string>();
    for (const s of data.students) {
      if (s.sectionName) map.set(s.sectionName, s.sectionName);
    }
    return Array.from(map.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [detailQuery.data]);

  const studentGroupOptions = useMemo(() => {
    const data = detailQuery.data;
    if (!data) return [];
    return data.batches.map((b) => ({ value: b.name, label: b.name }));
  }, [detailQuery.data]);

  const studentFilterFields = useMemo<FilterFieldConfig<StudentFilters>[]>(
    () => [
      {
        key: "usn",
        label: "USN",
        type: "text",
        placeholder: "Search USN...",
      },
      {
        key: "name",
        label: "Name",
        type: "text",
        placeholder: "Search name...",
      },
      {
        key: "group",
        label: "Group",
        type: "select",
        options: studentGroupOptions,
        allOptionLabel: "All groups",
      },
      {
        key: "assigned",
        label: "Assigned",
        type: "select",
        options: [
          { value: "assigned", label: "Assigned" },
          { value: "unassigned", label: "Unassigned" },
        ],
        allOptionLabel: "All",
      },
      {
        key: "section",
        label: "Section",
        type: "select",
        options: studentSectionOptions,
        allOptionLabel: "All sections",
      },
    ],
    [studentGroupOptions, studentSectionOptions]
  );

  const studentColumns = useMemo<ColumnDef<DetailStudent>[]>(
    () => [
      {
        accessorKey: "usn",
        header: "USN",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.usn}</span>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "sectionName",
        header: "Section",
        cell: ({ row }) => row.original.sectionName ?? "—",
      },
      {
        id: "group",
        header: "Group",
        cell: ({ row }) => {
          const student = row.original;
          return (
            <Select
              value={localAssignments[student.studentId] ?? ""}
              onValueChange={(value) =>
                setLocalAssignments((prev) => ({
                  ...prev,
                  [student.studentId]: value || null,
                }))
              }
              disabled={student.locked}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Assign group" />
              </SelectTrigger>
              <SelectContent>
                {(detailQuery.data?.batches ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
      },
      {
        id: "faculty",
        header: "Faculty",
        cell: ({ row }) => {
          const student = row.original;
          const facultyName = deriveStudentFaculty(
            student,
            localAssignments,
            localFaculty,
            facultyQuery.data ?? []
          );
          return <span>{facultyName ?? "—"}</span>;
        },
      },
    ],
    [
      localAssignments,
      localFaculty,
      facultyQuery.data,
      detailQuery.data?.batches,
    ]
  );

  const groupsData = groupsQuery.data;
  const totalPages = groupsData?.pagination.pages ?? 1;
  const goToPage = (nextPage: number) => {
    const bounded = Math.min(Math.max(nextPage, 1), totalPages);
    setPage(bounded);
  };

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleAllGroups = () => {
    setSelectedGroupIds((prev) => {
      const items = groupsData?.items ?? [];
      const allSelected =
        items.length > 0 && items.every((g) => prev.has(g.id));
      const next = new Set(prev);
      if (allSelected) {
        for (const g of items) next.delete(g.id);
      } else {
        for (const g of items) next.add(g.id);
      }
      return next;
    });
  };

  const groupFilterFields = useMemo<FilterFieldConfig<GroupFilters>[]>(() => {
    const data = detailQuery.data;
    const sectionOptions =
      data?.course.projectGroupingScope === "WITHIN_SECTION"
        ? Array.from(
            new Set(
              (data?.students ?? [])
                .map((s) => s.sectionName)
                .filter((s): s is string => Boolean(s))
            )
          ).map((value) => ({ value, label: value }))
        : [];
    return [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "ASSIGNED", label: "Assigned" },
          { value: "UNASSIGNED", label: "Unassigned" },
        ],
        allOptionLabel: "All",
      },
      {
        key: "facultyId",
        label: "Faculty",
        type: "select",
        options: (facultyQuery.data ?? []).map((f) => ({
          value: f.id,
          label: f.name,
        })),
        allOptionLabel: "All faculty",
      },
      ...(sectionOptions.length > 0
        ? [
            {
              key: "sectionId" as const,
              label: "Section" as const,
              type: "select" as const,
              options: sectionOptions,
              allOptionLabel: "All sections",
            },
          ]
        : []),
    ];
  }, [detailQuery.data, facultyQuery.data]);

  const facultyOptions = useMemo(
    () => facultyQuery.data ?? [],
    [facultyQuery.data]
  );

  const facultyGroupRows = useMemo(
    () =>
      buildFacultyGroupRows(
        groupsData?.items ?? [],
        localFaculty,
        facultyOptions
      ),
    [groupsData, localFaculty, facultyOptions]
  );

  const groupColumns = useMemo<ColumnDef<FacultyGroupRow>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <Checkbox
            checked={
              (groupsData?.items.length ?? 0) > 0 &&
              (groupsData?.items ?? []).every((g) => selectedGroupIds.has(g.id))
            }
            onCheckedChange={() => toggleAllGroups()}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedGroupIds.has(row.original.id)}
            onCheckedChange={() => toggleGroupSelection(row.original.id)}
          />
        ),
      },
      {
        accessorKey: "facultyName",
        header: "Faculty",
        cell: ({ row }) => {
          const groupId = row.original.id;
          const value = row.original.facultyId ?? "";
          return (
            <Select
              value={value}
              onValueChange={(v) => applyFacultyToGroups(v || null, [groupId])}
              disabled={detailQuery.data?.course.hasAttendanceOrMarks}
            >
              <SelectTrigger className="min-w-44">
                <SelectValue placeholder="Select faculty" />
              </SelectTrigger>
              <SelectContent>
                {facultyOptions.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
      },
      {
        accessorKey: "name",
        header: "Group",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "sectionName",
        header: "Section",
        cell: ({ row }) => row.original.sectionName ?? "—",
      },
      {
        accessorKey: "studentsLabel",
        header: "Students",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === "ASSIGNED" ? "default" : "outline"}
          >
            {row.original.status === "ASSIGNED" ? "Assigned" : "Unassigned"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setOpenGroupId(row.original.id)}
          >
            View
          </Button>
        ),
      },
    ],
    [
      groupsData,
      selectedGroupIds,
      detailQuery.data,
      localFaculty,
      facultyOptions,
    ]
  );

  const groupDetail = groupDetailQuery.data;

  if (detailQuery.isLoading) {
    return <Loader2 className="m-12 animate-spin" />;
  }

  const data = detailQuery.data;
  if (!data) {
    return <p>Failed to load project mapping.</p>;
  }

  const softOverfill = data.batches.some(
    (b) => b.studentCount > (data.course.studentsPerBatch ?? 0)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Button asChild size="sm" variant="ghost">
            <Link href={`${basePath}/project-mapping`}>← Back</Link>
          </Button>
          <h2 className="text-xl font-semibold">
            {data.course.code} — {data.course.name}
          </h2>
          <p className="text-muted-foreground text-sm">
            Project / Mini-Project group mapping
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {PW_DETAIL_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="students" className="space-y-4">
          {softOverfill && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              One or more project groups exceed the configured
              students-per-group limit.
            </div>
          )}

          {excelErrors.length > 0 && <ExcelErrorList errors={excelErrors} />}

          <FilterPanel>
            <FilterBuilder
              fields={studentFilterFields}
              draftFilters={draftStudentFilters}
              onDraftChange={(key, value) =>
                setDraftStudentFilters((prev) => ({
                  ...prev,
                  [key]: value,
                }))
              }
              action={
                <FilterActions
                  onApply={() => setAppliedStudentFilters(draftStudentFilters)}
                  onReset={() => {
                    setDraftStudentFilters(EMPTY_STUDENT_FILTERS);
                    setAppliedStudentFilters(EMPTY_STUDENT_FILTERS);
                  }}
                />
              }
            />
          </FilterPanel>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <ExcelActionButtons
              onDownload={handleDownloadTemplate}
              onUpload={handleExcelFile}
            />
            <Button
              type="button"
              size="sm"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              Save Mapping
            </Button>
          </div>

          <DataTable columns={studentColumns} data={filteredStudents} />
        </TabsContent>

        <TabsContent value="faculty-groups" className="space-y-4">
          {excelErrors.length > 0 && <ExcelErrorList errors={excelErrors} />}
          {groupsQuery.isLoading ? (
            <Loader2 className="m-12 animate-spin" />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="bg-card rounded-lg border p-4">
                  <p className="text-muted-foreground text-sm">Total Groups</p>
                  <p className="text-2xl font-semibold">
                    {groupsData?.summary.total ?? 0}
                  </p>
                </div>
                <div className="bg-card rounded-lg border p-4">
                  <p className="text-muted-foreground text-sm">Assigned</p>
                  <p className="text-2xl font-semibold">
                    {groupsData?.summary.assigned ?? 0}
                  </p>
                </div>
                <button
                  type="button"
                  className="bg-card hover:bg-muted rounded-lg border p-4 text-left"
                  onClick={() => {
                    setDraftGroupFilters((prev) => ({
                      ...prev,
                      status: "UNASSIGNED",
                    }));
                    setAppliedGroupFilters((prev) => ({
                      ...prev,
                      status: "UNASSIGNED",
                    }));
                  }}
                >
                  <p className="text-muted-foreground text-sm">Unassigned</p>
                  <p className="text-2xl font-semibold">
                    {groupsData?.summary.unassigned ?? 0}
                  </p>
                </button>
              </div>

              <FilterPanel>
                <FilterBuilder
                  fields={groupFilterFields}
                  draftFilters={draftGroupFilters}
                  onDraftChange={(key, value) =>
                    setDraftGroupFilters((prev) => ({ ...prev, [key]: value }))
                  }
                  action={
                    <FilterActions
                      onApply={() => {
                        setPage(1);
                        setAppliedGroupFilters(draftGroupFilters);
                      }}
                      onReset={() => {
                        setDraftGroupFilters(EMPTY_GROUP_FILTERS);
                        setAppliedGroupFilters(EMPTY_GROUP_FILTERS);
                        setPage(1);
                      }}
                    />
                  }
                />
              </FilterPanel>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <ExcelActionButtons
                  onDownload={handleDownloadTemplate}
                  onUpload={handleExcelFile}
                />
                <Input
                  placeholder="Search group, USN or student name..."
                  value={draftGroupFilters.search}
                  onChange={(e) =>
                    setDraftGroupFilters((prev) => ({
                      ...prev,
                      search: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setPage(1);
                      setAppliedGroupFilters((prev) => ({
                        ...prev,
                        search: draftGroupFilters.search,
                      }));
                    }
                  }}
                  className="max-w-xs"
                />
                <Button
                  type="button"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? "Saving..." : "Save Mapping"}
                </Button>
                {selectedGroupIds.size > 0 && (
                  <Dialog
                    open={selectedGroupIds.size > 0}
                    onOpenChange={(open) => {
                      if (!open) {
                        setSelectedGroupIds(new Set());
                        setBulkFacultyId("");
                      }
                    }}
                  >
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Assign Faculty</DialogTitle>
                        <DialogDescription>
                          Assign {selectedGroupIds.size} selected group(s) to a
                          faculty member.
                        </DialogDescription>
                      </DialogHeader>
                      <Select
                        value={bulkFacultyId}
                        onValueChange={setBulkFacultyId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select faculty..." />
                        </SelectTrigger>
                        <SelectContent>
                          {facultyOptions.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setSelectedGroupIds(new Set());
                            setBulkFacultyId("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          disabled={!bulkFacultyId || saveMutation.isPending}
                          onClick={() => {
                            applyFacultyToGroups(
                              bulkFacultyId,
                              Array.from(selectedGroupIds)
                            );
                            setSelectedGroupIds(new Set());
                            setBulkFacultyId("");
                            saveMutation.mutate();
                          }}
                        >
                          Assign
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              <DataTable columns={groupColumns} data={facultyGroupRows} />

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <span className="text-muted-foreground text-sm">
                  Page {groupsData?.pagination.page ?? page} of {totalPages}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={Boolean(openGroupId)}
        onOpenChange={(open) => {
          if (!open) setOpenGroupId(null);
        }}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          {groupDetail && (
            <GroupDetailBody
              groupDetail={groupDetail}
              localFaculty={localFaculty}
              facultyOptions={facultyOptions}
              hasAttendanceOrMarks={
                detailQuery.data?.course.hasAttendanceOrMarks ?? false
              }
              onFacultyChange={(groupId, value) =>
                applyFacultyToGroups(value || null, [groupId])
              }
            />
          )}
        </DialogContent>
      </Dialog>

      {excelPreviewModel && (
        <ExcelPreviewDialog
          preview={excelPreviewModel}
          onConfirm={handleExcelPreviewConfirm}
          onDiscard={handleExcelPreviewDiscard}
        />
      )}
    </div>
  );
}

function GroupDetailBody({
  groupDetail,
  localFaculty,
  facultyOptions,
  hasAttendanceOrMarks,
  onFacultyChange,
}: {
  groupDetail: GroupDetail;
  localFaculty: Record<string, string | null>;
  facultyOptions: FacultyOption[];
  hasAttendanceOrMarks: boolean;
  onFacultyChange: (groupId: string, value: string | null) => void;
}) {
  const model = buildGroupDetailModel(
    groupDetail,
    localFaculty,
    facultyOptions
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>{model.groupName}</DialogTitle>
        <DialogDescription>
          {model.facultyName
            ? `Faculty: ${model.facultyName} · `
            : "Faculty: — · "}
          {model.sectionName ? `Section ${model.sectionName} · ` : ""}
          {model.studentsLabel} students
        </DialogDescription>
      </DialogHeader>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left">
              <th className="px-3 py-2">USN</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Section</th>
            </tr>
          </thead>
          <tbody>
            {model.members.map((m) => (
              <tr key={m.studentId} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{m.usn}</td>
                <td className="px-3 py-2">{m.name}</td>
                <td className="px-3 py-2">{m.sectionName ?? "—"}</td>
              </tr>
            ))}
            {model.members.length === 0 && (
              <tr>
                <td
                  className="text-muted-foreground px-3 py-6 text-center"
                  colSpan={3}
                >
                  No students in this group yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Faculty</p>
        <Select
          value={model.facultyId ?? ""}
          onValueChange={(value) =>
            onFacultyChange(groupDetail.group.id, value)
          }
          disabled={hasAttendanceOrMarks}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select faculty..." />
          </SelectTrigger>
          <SelectContent>
            {facultyOptions.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

function ExcelActionButtons({
  onDownload,
  onUpload,
}: {
  onDownload: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={onDownload}>
        Download Excel
      </Button>
      <label>
        <input
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={onUpload}
        />
        <Button type="button" size="sm" variant="outline" asChild>
          <span>Upload Excel</span>
        </Button>
      </label>
    </div>
  );
}

function ExcelErrorList({ errors }: { errors: ProjectMappingExcelError[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p className="font-medium">
        Excel validation failed with {errors.length} error(s):
      </p>
      <ul className="mt-2 max-h-48 list-inside list-disc space-y-1 overflow-y-auto">
        {errors.slice(0, 50).map((e, i) => (
          <li key={i}>
            {e.row ? `Row ${e.row}: ` : ""}
            {e.message}
          </li>
        ))}
        {errors.length > 50 && <li>…and {errors.length - 50} more.</li>}
      </ul>
    </div>
  );
}

function ExcelPreviewDialog({
  preview,
  onConfirm,
  onDiscard,
}: {
  preview: ExcelPreviewModel;
  onConfirm: () => void;
  onDiscard: () => void;
}) {
  const { studentChanges, facultyChanges } = preview;
  return (
    <Dialog open onOpenChange={(open) => !open && onDiscard()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review Excel Changes</DialogTitle>
          <DialogDescription>
            The Excel file represents the complete project group mapping.
            Confirm to stage these changes into the draft; they are saved only
            when you press Save Mapping.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">
              Group → Faculty ({facultyChanges.length} change
              {facultyChanges.length === 1 ? "" : "s"})
            </p>
            {facultyChanges.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No faculty changes.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted border-b">
                    <tr>
                      <th className="px-3 py-2">Group</th>
                      <th className="px-3 py-2">Section</th>
                      <th className="px-3 py-2">Faculty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facultyChanges.map((c) => (
                      <tr
                        key={c.electiveBatchId}
                        className="border-b last:border-0"
                      >
                        <td className="px-3 py-2 font-medium">{c.groupName}</td>
                        <td className="px-3 py-2">{c.sectionName ?? "—"}</td>
                        <td className="px-3 py-2">
                          {c.previousFacultyName
                            ? `${c.previousFacultyName} → `
                            : "— → "}
                          <span className="font-medium">
                            {c.nextFacultyName ?? "No faculty"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">
              Student → Group ({studentChanges.length} change
              {studentChanges.length === 1 ? "" : "s"})
            </p>
            {studentChanges.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No student group changes.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted border-b">
                    <tr>
                      <th className="px-3 py-2">USN</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Section</th>
                      <th className="px-3 py-2">Group</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentChanges.map((c) => (
                      <tr key={c.studentId} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">{c.usn}</td>
                        <td className="px-3 py-2">{c.name}</td>
                        <td className="px-3 py-2">{c.sectionName ?? "—"}</td>
                        <td className="px-3 py-2">
                          {c.previousGroupName
                            ? `${c.previousGroupName} → `
                            : "— → "}
                          <span className="font-medium">
                            {c.nextGroupName ?? "No group"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDiscard}>
            Discard
          </Button>
          <Button type="button" onClick={onConfirm}>
            Confirm & Stage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
