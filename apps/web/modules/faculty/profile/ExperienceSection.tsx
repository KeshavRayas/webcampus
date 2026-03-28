"use client";

import { useMemo, useState } from "react";
import { FacultyProfilePayload } from "./use-faculty-profile";
import { DataField } from "./data-field";
import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@webcampus/ui/components/dialog";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";

type ExperiencePayload = {
  designation: string;
  institutionName: string;
  startDate: string;
  endDate?: string;
};

const initialExperience: ExperiencePayload = {
  designation: "",
  institutionName: "",
  startDate: "",
  endDate: "",
};

export const ExperienceSection = ({
  profile,
  onCreate,
  onUpdate,
  onDelete,
  isWorking,
}: {
  profile: FacultyProfilePayload;
  onCreate: (payload: ExperiencePayload) => void;
  onUpdate: (id: string, payload: ExperiencePayload) => void;
  onDelete: (id: string) => void;
  isWorking: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ExperiencePayload>(initialExperience);

  const title = useMemo(
    () => (editingId ? "Edit Experience" : "Add Experience"),
    [editingId]
  );

  return (
    <section className="bg-card rounded-xl border p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="border-b pb-2 text-lg font-semibold">Working Experience</h4>
        <Dialog
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (!nextOpen) {
              setEditingId(null);
              setFormData(initialExperience);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Add experience
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Designation</Label>
                <Input
                  value={formData.designation}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, designation: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Institution Name</Label>
                <Input
                  value={formData.institutionName}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      institutionName: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, startDate: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={formData.endDate || ""}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, endDate: event.target.value }))
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
                  const payload = {
                    ...formData,
                    endDate: formData.endDate || undefined,
                  };
                  if (editingId) {
                    onUpdate(editingId, payload);
                  } else {
                    onCreate(payload);
                  }
                  setOpen(false);
                }}
              >
                {isWorking ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {profile.experiences.length ? (
          profile.experiences.map((experience) => (
            <div key={experience.id} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{experience.designation}</p>
                  <p className="text-muted-foreground text-sm">{experience.institutionName}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(experience.id);
                      setFormData({
                        designation: experience.designation,
                        institutionName: experience.institutionName,
                        startDate: new Date(experience.startDate)
                          .toISOString()
                          .slice(0, 10),
                        endDate: experience.endDate
                          ? new Date(experience.endDate).toISOString().slice(0, 10)
                          : "",
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
                    onClick={() => onDelete(experience.id)}
                    disabled={isWorking}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <DataField
                  label="Start Date"
                  value={new Date(experience.startDate).toLocaleDateString()}
                />
                <DataField
                  label="End Date"
                  value={
                    experience.endDate
                      ? new Date(experience.endDate).toLocaleDateString()
                      : "Present"
                  }
                />
                <DataField label="Duration" value={experience.durationLabel || "-"} />
              </div>
            </div>
          ))
        ) : (
          <div className="bg-secondary/20 rounded-xl border p-6 text-center">
            <p className="text-muted-foreground text-sm">No experience records added yet.</p>
          </div>
        )}
      </div>
    </section>
  );
};
