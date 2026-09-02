"use client";

import { useDepartments } from "@/lib/use-departments";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { getTermLabel } from "@webcampus/common/term-label";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@webcampus/ui/components/tabs";
import { useState } from "react";
import {
  SupplementaryDemandRow,
  SupplementaryOfferingItem,
  SupplementaryRegistrationItem,
  SupplementarySectionItem,
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

export const SupplementaryAdminView = () => {
  const { data: termsData } = useAcademicTerms();
  const { data: departmentsData } = useDepartments();
  const terms = termsData ?? [];
  const departments = departmentsData ?? [];

  const [academicTermId, setAcademicTermId] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [dialogDepartmentId, setDialogDepartmentId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");

  const offeringsQuery = useSupplementaryOfferings(academicTermId || undefined);
  const registrationsQuery = useSupplementaryRegistrations(
    academicTermId || undefined
  );
  const demandQuery = useSupplementaryDemand(academicTermId || undefined);

  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [newSectionName, setNewSectionName] = useState("");
  const [placeDialogOpen, setPlaceDialogOpen] = useState(false);
  const [placeSectionId, setPlaceSectionId] = useState("");
  const [placedStudentIds, setPlacedStudentIds] = useState<string[]>([]);

  const sectionsQuery = useSupplementarySections(
    selectedOfferingId || undefined
  );

  const selectedTerm = terms.find((term) => term.id === academicTermId);
  const selectedParity = selectedTerm?.parity ?? null;

  const approvedCoursesQuery = useSupplementaryCandidateCourses(
    dialogDepartmentId || undefined,
    selectedParity
  );

  const { mutate: addOffering, isPending: isAdding } =
    useAddSupplementaryOffering();
  const { mutate: deleteOffering, isPending: isDeleting } =
    useDeleteSupplementaryOffering();
  const { mutate: createSection, isPending: isCreatingSection } =
    useCreateSupplementarySection();
  const { mutate: assignStudents, isPending: isAssigning } =
    useAssignSupplementaryStudents();

  const offerings: SupplementaryOfferingItem[] = offeringsQuery.data ?? [];
  const registrations: SupplementaryRegistrationItem[] =
    registrationsQuery.data ?? [];
  const demandRows: SupplementaryDemandRow[] = demandQuery.data ?? [];
  const sections: SupplementarySectionItem[] = sectionsQuery.data ?? [];
  const approvedCourses = approvedCoursesQuery.data ?? [];

  // selectedTerm already derived above for parity filtering

  const selectedOffering = offerings.find(
    (offering) => offering.id === selectedOfferingId
  );
  const placeableRegistrations = selectedOffering
    ? registrations.filter(
        (registration) => registration.courseId === selectedOffering.courseId
      )
    : [];

  const handleAddOffering = () => {
    if (!academicTermId || !selectedCourseId) {
      return;
    }

    addOffering(
      { academicTermId, courseId: selectedCourseId },
      {
        onSuccess: () => {
          setAddDialogOpen(false);
          setDialogDepartmentId("");
          setSelectedCourseId("");
        },
      }
    );
  };

  const handleCreateSection = () => {
    if (!selectedOfferingId || !newSectionName.trim()) {
      return;
    }

    createSection(
      { offeringId: selectedOfferingId, name: newSectionName.trim() },
      {
        onSuccess: () => {
          setNewSectionName("");
        },
      }
    );
  };

  const togglePlacedStudent = (studentId: string) => {
    setPlacedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    );
  };

  const handleAssignStudents = () => {
    if (!placeSectionId || placedStudentIds.length === 0) {
      return;
    }

    assignStudents(
      { sectionId: placeSectionId, studentIds: placedStudentIds },
      {
        onSuccess: () => {
          setPlaceDialogOpen(false);
          setPlaceSectionId("");
          setPlacedStudentIds([]);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold tracking-tight">
          Supplementary Offerings
        </h3>
        <p className="text-muted-foreground text-sm">
          Manage which courses are offered for supplementary examination per
          academic term.
        </p>
      </div>

      <div className="max-w-sm space-y-2">
        <Label>Academic Term</Label>
        <Select value={academicTermId} onValueChange={setAcademicTermId}>
          <SelectTrigger>
            <SelectValue placeholder="Select term" />
          </SelectTrigger>
          <SelectContent>
            {terms.map((term) => (
              <SelectItem key={term.id} value={term.id}>
                {getTermLabel(term.type, term.year, term.parity)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!academicTermId ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          Select an academic term to manage supplementary offerings.
        </div>
      ) : (
        <Tabs defaultValue="offerings">
          <TabsList>
            <TabsTrigger value="offerings">Offerings</TabsTrigger>
            <TabsTrigger value="sections">Sections</TabsTrigger>
            <TabsTrigger value="registrations">Registrations</TabsTrigger>
            <TabsTrigger value="demand">Demand</TabsTrigger>
          </TabsList>

          <TabsContent value="offerings" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setAddDialogOpen(true)}>
                Add Offering
              </Button>
            </div>

            {!offeringsQuery.isLoading && offerings.length === 0 ? (
              <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
                No courses offered for this term yet.
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
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {offerings.map((offering) => (
                      <TableRow key={offering.id}>
                        <TableCell className="font-medium">
                          {offering.code}
                        </TableCell>
                        <TableCell>{offering.name}</TableCell>
                        <TableCell>{offering.courseType}</TableCell>
                        <TableCell>{offering.totalCredits}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isDeleting}
                            onClick={() => deleteOffering(offering.id)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="sections" className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="max-w-sm flex-1 space-y-2">
                <Label>Offering</Label>
                <Select
                  value={selectedOfferingId}
                  onValueChange={(value) => {
                    setSelectedOfferingId(value);
                    setPlaceSectionId("");
                    setPlacedStudentIds([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select offering" />
                  </SelectTrigger>
                  <SelectContent>
                    {offerings.map((offering) => (
                      <SelectItem key={offering.id} value={offering.id}>
                        {offering.code} — {offering.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="max-w-xs flex-1 space-y-2">
                <Label>New section name</Label>
                <Input
                  value={newSectionName}
                  placeholder="e.g. SUP-CSE101-A"
                  onChange={(event) => setNewSectionName(event.target.value)}
                />
              </div>
              <Button
                onClick={handleCreateSection}
                disabled={
                  isCreatingSection ||
                  !selectedOfferingId ||
                  !newSectionName.trim()
                }
              >
                {isCreatingSection ? "Creating..." : "Create Section"}
              </Button>
            </div>

            {!selectedOfferingId ? (
              <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
                Select an offering to manage its supplementary sections.
              </div>
            ) : sectionsQuery.isLoading ? null : sections.length === 0 ? (
              <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
                No sections created for this offering yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Section</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Faculty</TableHead>
                      <TableHead>Semester</TableHead>
                      <TableHead>Students</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sections.map((section) => (
                      <TableRow key={section.id}>
                        <TableCell className="font-medium">
                          {section.name}
                        </TableCell>
                        <TableCell>{section.courseCode}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {section.courses
                            .map((course) => course.facultyName)
                            .filter(Boolean)
                            .join(", ") || "Not mapped"}
                        </TableCell>
                        <TableCell>{section.semesterNumber}</TableCell>
                        <TableCell>{section.studentCount}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPlaceSectionId(section.id);
                              setPlacedStudentIds([]);
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
          </TabsContent>

          <TabsContent value="registrations">
            {!registrationsQuery.isLoading && registrations.length === 0 ? (
              <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
                No supplementary registrations for this term.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>USN</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Semester</TableHead>
                      <TableHead>Registered At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrations.map((registration) => (
                      <TableRow key={registration.id}>
                        <TableCell className="font-medium">
                          {registration.usn}
                        </TableCell>
                        <TableCell>{registration.studentName}</TableCell>
                        <TableCell>
                          {registration.code} — {registration.courseName}
                        </TableCell>
                        <TableCell>{registration.totalCredits}</TableCell>
                        <TableCell>{registration.semesterLabel}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {new Date(
                            registration.registrationDate
                          ).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="demand" className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Registration demand per offered course. Create sections and place
              students only after the supplementary registration window closes —
              the API rejects section creation while a window is open.
            </p>
            {demandQuery.isLoading ? (
              <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
                Loading demand report...
              </div>
            ) : demandRows.length === 0 ? (
              <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
                No supplementary offerings for this term yet.
              </div>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead>Last Taught By</TableHead>
                      <TableHead>Sections</TableHead>
                      <TableHead>Window</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {demandRows.map((row) => (
                      <TableRow key={row.offeringId}>
                        <TableCell className="font-medium">
                          {row.code} — {row.name}
                        </TableCell>
                        <TableCell>
                          {row.programType} · Sem {row.semesterNumber}
                        </TableCell>
                        <TableCell>{row.activeRegistrationCount}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {row.lastTaughtBy.length > 0
                            ? row.lastTaughtBy.join(", ")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.sections.length > 0
                            ? row.sections
                                .map(
                                  (section) =>
                                    `${section.name} (${section.studentCount})`
                                )
                                .join(", ")
                            : "None yet"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              row.windowOpen
                                ? "text-xs font-medium text-amber-600"
                                : "text-xs font-medium text-emerald-600"
                            }
                          >
                            {row.windowOpen ? "Open" : "Settled"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) {
            setDialogDepartmentId("");
            setSelectedCourseId("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Supplementary Offering</DialogTitle>
            <DialogDescription>
              Select original approved courses to offer in the supplementary
              term (parity-matched). No semester copy is needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTerm?.parity && (
              <p className="text-muted-foreground text-xs">
                Showing {selectedTerm.parity}-semester courses for{" "}
                {getTermLabel(
                  selectedTerm.type,
                  selectedTerm.year,
                  selectedTerm.parity
                )}
                .
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
                disabled={!dialogDepartmentId || !academicTermId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !academicTermId
                        ? "Select a supplementary term first"
                        : !dialogDepartmentId
                          ? "Pick department first"
                          : approvedCoursesQuery.isLoading
                            ? "Loading courses..."
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
                {selectedParity
                  ? `Only ${selectedParity}-semester approved courses are shown (parity must match the supplementary term).`
                  : "Courses are original approved offerings; supplementary offerings reference the original course."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddOffering}
              disabled={isAdding || !selectedCourseId}
            >
              {isAdding ? "Adding..." : "Add Offering"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={placeDialogOpen} onOpenChange={setPlaceDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Place Students into Section</DialogTitle>
            <DialogDescription>
              Only students with an active supplementary registration for{" "}
              {selectedOffering?.code ?? "this course"} can be placed.
            </DialogDescription>
          </DialogHeader>
          {placeableRegistrations.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border p-6 text-center text-sm">
              No supplementary registrations found for this course in the
              selected term.
            </div>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border p-3">
              {placeableRegistrations.map((registration) => (
                <label
                  key={registration.id}
                  className="flex cursor-pointer items-center gap-3 text-sm"
                >
                  <Checkbox
                    checked={placedStudentIds.includes(registration.studentId)}
                    onCheckedChange={() =>
                      togglePlacedStudent(registration.studentId)
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
              onClick={handleAssignStudents}
              disabled={isAssigning || placedStudentIds.length === 0}
            >
              {isAssigning ? "Placing..." : "Place Students"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
