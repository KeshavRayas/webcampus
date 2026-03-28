"use client";

import { useMemo, useState } from "react";
import { DataField } from "./data-field";
import { FacultyProfilePayload } from "./use-faculty-profile";
import { Badge } from "@webcampus/ui/components/badge";
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

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
};

export const FacultyDetailsCard = ({
  profile,
  onSave,
  isSaving,
}: {
  profile: FacultyProfilePayload;
  onSave: (payload: Record<string, unknown>) => void;
  isSaving: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [qualification, setQualification] = useState(profile.qualification || "");
  const [researchArea, setResearchArea] = useState(profile.researchArea || "");
  const [officeRoom, setOfficeRoom] = useState(profile.officeRoom || "");

  const designationText = useMemo(() => {
    return profile.designation
      ?.split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  }, [profile.designation]);

  return (
    <section className="bg-card rounded-xl border p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-lg font-semibold">Faculty Details</h4>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Edit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Faculty Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="qualification">Qualification</Label>
                <Input
                  id="qualification"
                  value={qualification}
                  onChange={(event) => setQualification(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="researchArea">Research Area</Label>
                <Input
                  id="researchArea"
                  value={researchArea}
                  onChange={(event) => setResearchArea(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="officeRoom">Office Room</Label>
                <Input
                  id="officeRoom"
                  value={officeRoom}
                  onChange={(event) => setOfficeRoom(event.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => {
                  onSave({ qualification, researchArea, officeRoom });
                  setOpen(false);
                }}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <DataField label="Employee ID" value={profile.employeeId} />
        <DataField label="Department" value={profile.department.name} />
        <DataField label="Designation" value={designationText} />

        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">Staff Type</p>
          <p className="font-medium break-words">{profile.staffType || "-"}</p>
          <Badge variant="outline" className="mt-1 text-xs">
            Admin only
          </Badge>
        </div>
        <DataField label="Qualification" value={profile.qualification} />
        <DataField
          label="Experience"
          value={
            profile.experiences.length
              ? `${profile.experiences.length} role${profile.experiences.length === 1 ? "" : "s"}`
              : "-"
          }
        />

        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">Joining Date</p>
          <p className="font-medium break-words">{formatDate(profile.dateOfJoining)}</p>
          <Badge variant="outline" className="mt-1 text-xs">
            Admin only
          </Badge>
        </div>
        <DataField label="Research Area" value={profile.researchArea} />
        <DataField label="Office Room" value={profile.officeRoom} />
      </div>
    </section>
  );
};
