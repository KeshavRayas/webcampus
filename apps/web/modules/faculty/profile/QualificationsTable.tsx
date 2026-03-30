"use client";

import { useMemo, useState } from "react";
import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
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
  FacultyProfilePayload,
  qualificationProgramTypeOptions,
} from "./use-faculty-profile";

type QualificationPayload = {
  program: string;
  degree: string;
  specialization: string;
  institution: string;
  programType: "FULL_TIME" | "PART_TIME";
  yearPassed: number;
};

const initialQualification: QualificationPayload = {
  program: "",
  degree: "",
  specialization: "",
  institution: "",
  programType: "FULL_TIME",
  yearPassed: new Date().getFullYear(),
};

export const QualificationsTable = ({
  profile,
  onCreate,
  onUpdate,
  onDelete,
  isWorking,
}: {
  profile: FacultyProfilePayload;
  onCreate: (payload: QualificationPayload) => void;
  onUpdate: (id: string, payload: QualificationPayload) => void;
  onDelete: (id: string) => void;
  isWorking: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<QualificationPayload>(initialQualification);

  const title = useMemo(
    () => (editingId ? "Update Qualification" : "Add Qualification"),
    [editingId]
  );

  const resetForm = () => {
    setEditingId(null);
    setFormData(initialQualification);
  };

  return (
    <section className="bg-card rounded-xl border p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="border-b pb-2 text-lg font-semibold">Academic Qualifications</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
          disabled={isWorking}
        >
          Update
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            resetForm();
          }
        }}
      >
        <DialogContent className="max-h-[85vh] w-[95vw] sm:max-w-xl md:max-w-3xl lg:max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Program</Label>
                <Input
                  value={formData.program}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, program: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Program Type</Label>
                <Select
                  value={formData.programType}
                  onValueChange={(value: "FULL_TIME" | "PART_TIME") =>
                    setFormData((prev) => ({ ...prev, programType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {qualificationProgramTypeOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option === "FULL_TIME" ? "Full Time" : "Part Time"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year Passed</Label>
                <Input
                  type="number"
                  value={formData.yearPassed}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      yearPassed: Number(event.target.value) || new Date().getFullYear(),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Degree</Label>
                <Input
                  value={formData.degree}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, degree: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Specialization</Label>
                <Input
                  value={formData.specialization}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, specialization: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Institution / University Name</Label>
                <Input
                  value={formData.institution}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, institution: event.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={isWorking}
              onClick={() => {
                if (editingId) {
                  onUpdate(editingId, formData);
                } else {
                  onCreate(formData);
                }
                setOpen(false);
              }}
            >
              {isWorking ? "Saving..." : editingId ? "Update" : "Add"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Program</TableHead>
              <TableHead>Degree</TableHead>
              <TableHead>Specialization</TableHead>
              <TableHead>Institution</TableHead>
              <TableHead>Year Passed</TableHead>
              <TableHead className="w-[130px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profile.qualifications.length ? (
              profile.qualifications.map((qualification) => (
                <TableRow key={qualification.id}>
                  <TableCell>{qualification.program}</TableCell>
                  <TableCell>{qualification.degree}</TableCell>
                  <TableCell>{qualification.specialization}</TableCell>
                  <TableCell>{qualification.institution}</TableCell>
                  <TableCell>{qualification.yearPassed}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(qualification.id);
                          setFormData({
                            program: qualification.program,
                            degree: qualification.degree,
                            specialization: qualification.specialization,
                            institution: qualification.institution,
                            programType: qualification.programType,
                            yearPassed: qualification.yearPassed,
                          });
                          setOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => onDelete(qualification.id)}
                        disabled={isWorking}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                  No qualifications added yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
};
