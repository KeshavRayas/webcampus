"use client";

import { useDepartments } from "@/lib/use-departments";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { getTermLabel } from "@webcampus/common/term-label";
import { BaseResponse } from "@webcampus/types/api";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { Checkbox } from "@webcampus/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { ScrollableDialog } from "@webcampus/ui/molecules/scrollable-dialog";
import axios from "axios";
import { useMemo, useState } from "react";
import type { TermBundle } from "./term-bundle";
import {
  useAddSupplementaryOffering,
  useAssignSupplementaryStudents,
  useCreateSupplementarySection,
  useDeleteSupplementaryOffering,
  useSupplementaryCandidateCourses,
  useSupplementaryDemand,
  useSupplementaryOfferings,
  useSupplementaryRegistrations,
  useSupplementarySections,
} from "./use-supplementary-admin";

interface AdminSupplementaryOfferingBlockProps {
  semesterId: string;
  semesterNumber: number;
  term: TermBundle;
}

const isBatchManaged = (courseType: string) =>
  courseType === "PE" || courseType === "OE" || courseType === "PW";

interface FacultyOption {
  id: string;
  name: string;
}

const useFacultyForDepartment = (departmentId?: string) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  return useQuery({
    queryKey: ["admin-faculty-for-supplementary", departmentId],
    queryFn: async () => {
      if (!departmentId) return [] as FacultyOption[];
      const res = await axios.get<BaseResponse<unknown>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/faculty/department/${departmentId}`,
        { withCredentials: true }
      );
      if (res.data.status === "success" && Array.isArray(res.data.data)) {
        const rows = res.data.data as Array<{
          id: string;
          user: { name: string };
          name?: string;
        }>;
        return rows.map((row) => ({
          id: row.id,
          name: row.user?.name ?? row.name ?? row.id,
        }));
      }
      // fallback to generic faculty endpoint without filter
      const fallback = await axios.get<BaseResponse<FacultyOption[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/faculty`,
        { withCredentials: true }
      );
      if (
        fallback.data.status === "success" &&
        Array.isArray(fallback.data.data)
      ) {
        return fallback.data.data as unknown as FacultyOption[];
      }
      return [] as FacultyOption[];
    },
    enabled: !!departmentId,
  });
};

export const AdminSupplementaryOfferingBlock = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  semesterId: _semesterId,
  semesterNumber,
  term,
}: AdminSupplementaryOfferingBlockProps) => {
  const [offeringDialogOpen, setOfferingDialogOpen] = useState(false);
  const [dialogDepartmentId, setDialogDepartmentId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");

  const [expandedOfferingId, setExpandedOfferingId] = useState<string | null>(
    null
  );

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createOfferingId, setCreateOfferingId] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [selectedFacultyId, setSelectedFacultyId] = useState("");

  const [placeDialogOpen, setPlaceDialogOpen] = useState(false);
  const [placeSectionId, setPlaceSectionId] = useState<string | null>(null);
  const [placeOfferingId, setPlaceOfferingId] = useState<string | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const { data: departmentsData = [] } = useDepartments();
  const departments = departmentsData.filter((d) => d.type !== "SERVICE");

  const offeringsQuery = useSupplementaryOfferings(term.id);
  const offerings = offeringsQuery.data ?? [];

  const demandQuery = useSupplementaryDemand(term.id);
  const demandRows = demandQuery.data ?? [];
  const demandByOfferingId = useMemo(() => {
    const map = new Map<string, (typeof demandRows)[number]>();
    for (const row of demandRows) map.set(row.offeringId, row);
    return map;
  }, [demandRows]);

  const registrationsQuery = useSupplementaryRegistrations(term.id);
  const registrations = registrationsQuery.data ?? [];

  const expandedSectionsQuery = useSupplementarySections(
    expandedOfferingId ?? undefined
  );
  const expandedSections = expandedSectionsQuery.data ?? [];

  const expandedOffering =
    offerings.find((o) => o.id === expandedOfferingId) ?? null;
  const createOffering =
    offerings.find((o) => o.id === createOfferingId) ?? null;
  const createDeptId =
    createOffering?.departmentId ?? expandedOffering?.departmentId;

  const facultyQuery = useFacultyForDepartment(createDeptId);
  const facultyOptions = facultyQuery.data ?? [];

  const placeOffering = offerings.find((o) => o.id === placeOfferingId) ?? null;
  const placeableRegistrations = placeOffering
    ? registrations.filter((r) => r.courseId === placeOffering.courseId)
    : [];

  const approvedCoursesQuery = useSupplementaryCandidateCourses(
    dialogDepartmentId || undefined,
    term.parity
  );
  const approvedCourses = approvedCoursesQuery.data ?? [];

  const { mutate: addOffering, isPending: isAdding } =
    useAddSupplementaryOffering();
  const { mutate: deleteOffering, isPending: isDeleting } =
    useDeleteSupplementaryOffering();
  const { mutate: createSection, isPending: isCreatingSection } =
    useCreateSupplementarySection();
  const { mutate: assignStudents, isPending: isAssigning } =
    useAssignSupplementaryStudents();

  const handleAddOffering = () => {
    if (!term.id || !selectedCourseId) return;
    addOffering(
      { academicTermId: term.id, courseId: selectedCourseId },
      {
        onSuccess: () => {
          setOfferingDialogOpen(false);
          setDialogDepartmentId("");
          setSelectedCourseId("");
        },
      }
    );
  };

  const handleCreateSection = () => {
    if (!createOfferingId || !newSectionName.trim() || !selectedFacultyId)
      return;
    createSection(
      {
        offeringId: createOfferingId,
        name: newSectionName.trim(),
        facultyId: selectedFacultyId,
      },
      {
        onSuccess: () => {
          setCreateDialogOpen(false);
          setNewSectionName("");
          setSelectedFacultyId("");
          setCreateOfferingId(null);
        },
      }
    );
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((curr) =>
      curr.includes(studentId)
        ? curr.filter((id) => id !== studentId)
        : [...curr, studentId]
    );
  };

  const handleAssign = () => {
    if (!placeSectionId || selectedStudentIds.length === 0) return;
    assignStudents(
      { sectionId: placeSectionId, studentIds: selectedStudentIds },
      {
        onSuccess: () => {
          setPlaceDialogOpen(false);
          setPlaceSectionId(null);
          setPlaceOfferingId(null);
          setSelectedStudentIds([]);
        },
      }
    );
  };

  return (
    <div className="bg-card text-card-foreground mb-12 space-y-4 rounded-lg border p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold tracking-tight">
          Semester {semesterNumber}
          <span className="text-muted-foreground ml-2 text-sm font-normal">
            — {getTermLabel(term.type, term.year, term.parity)}
          </span>
        </h3>
        <ScrollableDialog
          open={offeringDialogOpen}
          onOpenChange={setOfferingDialogOpen}
          trigger={
            <Button onClick={() => setOfferingDialogOpen(true)}>
              {`Add Offering to Sem ${semesterNumber}`}
            </Button>
          }
          title={`Add Offering — ${getTermLabel(term.type, term.year, term.parity)} (Semester ${semesterNumber})`}
          description={`Re-offer an existing approved course in this supplementary term. Complete course configuration is not done here — the course definition stays in its original term. Parity-matched: ${term.parity ? `${term.parity} semesters only` : "all semesters"}.`}
          className="sm:max-w-lg"
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => setOfferingDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddOffering}
                disabled={isAdding || !selectedCourseId}
              >
                {isAdding ? "Adding..." : "Add Offering"}
              </Button>
            </>
          }
        >
          {term.parity && (
            <p className="text-muted-foreground text-xs">
              Showing {term.parity}-semester approved courses for{" "}
              {getTermLabel(term.type, term.year, term.parity)}.
            </p>
          )}
          <div className="space-y-2">
            <Label>Department</Label>
            <Select
              value={dialogDepartmentId}
              onValueChange={(value) => {
                setDialogDepartmentId(value);
                setSelectedCourseId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Course (approved only)</Label>
            <Select
              value={selectedCourseId}
              onValueChange={setSelectedCourseId}
              disabled={!dialogDepartmentId || !term.id}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !term.id
                      ? "Select a supplementary term first"
                      : !dialogDepartmentId
                        ? "Pick department first"
                        : approvedCoursesQuery.isLoading
                          ? "Loading courses..."
                          : approvedCourses.length === 0
                            ? "No approved courses for this parity/department"
                            : "Select course"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {approvedCourses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.code} — {course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {term.parity
                ? `Only ${term.parity}-semester approved courses are shown (parity must match the supplementary term).`
                : "Courses are original approved offerings; this creates a link for supplementary examination."}
            </p>
          </div>
        </ScrollableDialog>
      </div>

      {offeringsQuery.isLoading ? (
        <div className="text-muted-foreground py-8 text-center text-sm">
          Loading offerings...
        </div>
      ) : offerings.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          No courses offered for this supplementary term yet. Use{" "}
          <span className="font-medium">Add Offering</span> to re-offer an
          approved course.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Last Taught</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offerings.map((offering) => {
                const demand = demandByOfferingId.get(offering.id);
                const isExpanded = expandedOfferingId === offering.id;
                return (
                  <>
                    <TableRow key={offering.id}>
                      <TableCell className="font-medium">
                        {offering.code}
                      </TableCell>
                      <TableCell>{offering.name}</TableCell>
                      <TableCell>{offering.courseType}</TableCell>
                      <TableCell>{offering.totalCredits}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {demand?.activeRegistrationCount ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {demand ? (
                          <Badge
                            variant={
                              demand.windowOpen ? "destructive" : "default"
                            }
                            className={
                              demand.windowOpen
                                ? "bg-amber-500 text-white"
                                : "bg-emerald-600"
                            }
                          >
                            {demand.windowOpen ? "Open" : "Settled"}
                          </Badge>
                        ) : (
                          <Badge variant="outline">—</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[160px] truncate text-xs">
                        {demand?.lastTaughtBy?.length
                          ? demand.lastTaughtBy.join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant={isExpanded ? "secondary" : "outline"}
                            size="sm"
                            onClick={() =>
                              setExpandedOfferingId(
                                isExpanded ? null : offering.id
                              )
                            }
                          >
                            {isExpanded ? "Hide" : "Sections"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isDeleting}
                            onClick={() => deleteOffering(offering.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${offering.id}-expand`}>
                        <TableCell colSpan={8} className="bg-muted/30 p-0">
                          <div className="space-y-4 p-4">
                            {isBatchManaged(offering.courseType) ? (
                              <div className="text-muted-foreground rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                Section creation not available for batch-managed
                                courses (PE/OE/PW).
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-semibold">
                                    Sections for {offering.code}
                                  </h4>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setCreateOfferingId(offering.id);
                                      setNewSectionName("");
                                      setSelectedFacultyId("");
                                      setCreateDialogOpen(true);
                                    }}
                                  >
                                    Create Section
                                  </Button>
                                </div>
                                {expandedSectionsQuery.isLoading ? (
                                  <div className="text-muted-foreground py-4 text-center text-sm">
                                    Loading sections...
                                  </div>
                                ) : expandedSections.length === 0 ? (
                                  <div className="text-muted-foreground rounded border bg-white p-4 text-center text-sm">
                                    No sections yet. Create one after the
                                    registration window is settled.
                                  </div>
                                ) : (
                                  <div className="overflow-hidden rounded border bg-white">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Section</TableHead>
                                          <TableHead>Faculty</TableHead>
                                          <TableHead>Students</TableHead>
                                          <TableHead className="text-right">
                                            Actions
                                          </TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {expandedSections.map((section) => (
                                          <TableRow key={section.id}>
                                            <TableCell className="font-medium">
                                              {section.name}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                              {section.courses
                                                .map((c) => c.facultyName)
                                                .filter(Boolean)
                                                .join(", ") || "Not mapped"}
                                            </TableCell>
                                            <TableCell>
                                              {section.studentCount}
                                            </TableCell>
                                            <TableCell className="text-right">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                  setPlaceSectionId(section.id);
                                                  setPlaceOfferingId(
                                                    offering.id
                                                  );
                                                  setSelectedStudentIds([]);
                                                  setPlaceDialogOpen(true);
                                                }}
                                              >
                                                Place Students
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                                <p className="text-muted-foreground text-xs">
                                  Sections can only be created after the
                                  supplementary registration window is settled —
                                  the API rejects creation while open. Faculty
                                  is chosen manually per section (same
                                  department only).
                                </p>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            setNewSectionName("");
            setSelectedFacultyId("");
            setCreateOfferingId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Supplementary Section</DialogTitle>
            <DialogDescription>
              Section will be created in the host semester for{" "}
              {createOffering?.code ?? "this offering"} with the selected
              faculty. Ensure the registration window is already settled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Section name</Label>
              <Input
                value={newSectionName}
                placeholder="e.g. SUP-CSE101-A"
                onChange={(e) => setNewSectionName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Faculty (same department only)</Label>
              <Select
                value={selectedFacultyId}
                onValueChange={setSelectedFacultyId}
                disabled={facultyQuery.isLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      facultyQuery.isLoading
                        ? "Loading faculty..."
                        : "Select faculty"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {facultyOptions.map((fac) => (
                    <SelectItem key={fac.id} value={fac.id}>
                      {fac.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createOffering && (
                <p className="text-muted-foreground text-xs">
                  Only faculty from the course&apos;s department can be
                  assigned. Offering type: {createOffering.courseType}.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSection}
              disabled={
                isCreatingSection ||
                !newSectionName.trim() ||
                !selectedFacultyId
              }
            >
              {isCreatingSection ? "Creating..." : "Create Section"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={placeDialogOpen}
        onOpenChange={(open) => {
          setPlaceDialogOpen(open);
          if (!open) {
            setSelectedStudentIds([]);
            setPlaceSectionId(null);
            setPlaceOfferingId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Place Students into Section</DialogTitle>
            <DialogDescription>
              Only students with an active supplementary registration for{" "}
              {placeOffering?.code ?? "this course"} can be placed. Bulk
              selection supported.
            </DialogDescription>
          </DialogHeader>
          {placeableRegistrations.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border p-6 text-center text-sm">
              No supplementary registrations found for this course in the
              selected term.
            </div>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-muted-foreground text-xs">
                  {selectedStudentIds.length} of {placeableRegistrations.length}{" "}
                  selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (
                      selectedStudentIds.length ===
                      placeableRegistrations.length
                    ) {
                      setSelectedStudentIds([]);
                    } else {
                      setSelectedStudentIds(
                        placeableRegistrations.map((r) => r.studentId)
                      );
                    }
                  }}
                >
                  {selectedStudentIds.length === placeableRegistrations.length
                    ? "Clear all"
                    : "Select all"}
                </Button>
              </div>
              {placeableRegistrations.map((registration) => (
                <label
                  key={registration.id}
                  className="flex cursor-pointer items-center gap-3 text-sm"
                >
                  <Checkbox
                    checked={selectedStudentIds.includes(
                      registration.studentId
                    )}
                    onCheckedChange={() =>
                      toggleStudent(registration.studentId)
                    }
                  />
                  <span className="font-medium">{registration.usn}</span>
                  <span className="text-muted-foreground">
                    {registration.studentName}
                  </span>
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlaceDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={isAssigning || selectedStudentIds.length === 0}
            >
              {isAssigning
                ? "Placing..."
                : `Place Students (${selectedStudentIds.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
