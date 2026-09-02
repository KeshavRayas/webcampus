"use client";

import { getTermLabel } from "@webcampus/common/term-label";
import { Button } from "@webcampus/ui/components/button";
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
import { useState } from "react";
import { useDepartments } from "@/lib/use-departments";
import {
  useAddSupplementaryOffering,
  useDeleteSupplementaryOffering,
  useSupplementaryCandidateCourses,
  useSupplementaryOfferings,
} from "../supplementary/use-supplementary-admin";

interface TermBundle {
  id: string;
  type: string;
  parity: string | null;
  year: string;
}

interface AdminSupplementaryOfferingBlockProps {
  semesterId: string;
  semesterNumber: number;
  term: TermBundle;
}

export const AdminSupplementaryOfferingBlock = ({
  semesterId: _semesterId,
  semesterNumber,
  term,
}: AdminSupplementaryOfferingBlockProps) => {
  const [offeringDialogOpen, setOfferingDialogOpen] = useState(false);
  const [dialogDepartmentId, setDialogDepartmentId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");

  const { data: departmentsData = [] } = useDepartments();
  const departments = departmentsData.filter((d) => d.type !== "SERVICE");

  const offeringsQuery = useSupplementaryOfferings(term.id);
  const offerings = offeringsQuery.data ?? [];

  const approvedCoursesQuery = useSupplementaryCandidateCourses(
    dialogDepartmentId || undefined,
    term.parity
  );
  const approvedCourses = approvedCoursesQuery.data ?? [];

  const { mutate: addOffering, isPending: isAdding } =
    useAddSupplementaryOffering();
  const { mutate: deleteOffering, isPending: isDeleting } =
    useDeleteSupplementaryOffering();

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
              <Button variant="outline" onClick={() => setOfferingDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddOffering} disabled={isAdding || !selectedCourseId}>
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
        <div className="text-muted-foreground py-8 text-center text-sm">Loading offerings...</div>
      ) : offerings.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
          No courses offered for this supplementary term yet. Use <span className="font-medium">Add Offering</span> to re-offer an approved course.
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
                  <TableCell className="font-medium">{offering.code}</TableCell>
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
    </div>
  );
};
