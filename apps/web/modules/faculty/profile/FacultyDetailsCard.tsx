"use client";

import { useMemo, useState } from "react";
import { DataField } from "./data-field";
import { FacultyProfilePayload } from "./use-faculty-profile";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";

const bloodGroupOptions = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
};

const formatDateInput = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().split("T")[0] || "";
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
  const [gender, setGender] = useState(profile.gender || "");
  const [bloodGroup, setBloodGroup] = useState(profile.bloodGroup || "");
  const [maritalStatus, setMaritalStatus] = useState(profile.maritalStatus || "");
  const [aboutYourself, setAboutYourself] = useState(profile.aboutYourself || "");
  const [researchInterests, setResearchInterests] = useState(profile.researchInterests || "");
  const [otherInformation, setOtherInformation] = useState(profile.otherInformation || "");

  const designationText = useMemo(() => {
    return profile.designation
      ?.split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  }, [profile.designation]);

  return (
    <section className="bg-card rounded-xl border p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="border-b pb-2 text-lg font-semibold">Personal Details</h4>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Update
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-4xl xl:max-w-6xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Update Personal Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Employee ID</Label>
                  <Input value={profile.employeeId || ""} readOnly disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qualification">Qualification</Label>
                  <Input
                    id="qualification"
                    value={qualification}
                    onChange={(event) => setQualification(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Staff Type</Label>
                  <Input value={profile.staffType || ""} readOnly disabled />
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input value={formatDateInput(profile.dob)} readOnly disabled />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={gender || undefined} onValueChange={setGender}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Blood Group</Label>
                  <Select value={bloodGroup || undefined} onValueChange={setBloodGroup}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {bloodGroupOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maritalStatus">Marital Status</Label>
                  <Input
                    id="maritalStatus"
                    value={maritalStatus}
                    onChange={(event) => setMaritalStatus(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date of Joining</Label>
                  <Input value={formatDateInput(profile.dateOfJoining)} readOnly disabled />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aboutYourself">About Yourself</Label>
                <textarea
                  id="aboutYourself"
                  value={aboutYourself}
                  onChange={(event) => setAboutYourself(event.target.value)}
                  rows={4}
                  className="placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="researchInterests">Research Interests</Label>
                <textarea
                  id="researchInterests"
                  value={researchInterests}
                  onChange={(event) => setResearchInterests(event.target.value)}
                  rows={4}
                  className="placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="otherInformation">Other Info</Label>
                <textarea
                  id="otherInformation"
                  value={otherInformation}
                  onChange={(event) => setOtherInformation(event.target.value)}
                  rows={4}
                  className="placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input value={profile.department.name} readOnly disabled />
                </div>
                <div className="space-y-2">
                  <Label>Designation</Label>
                  <Input value={designationText || ""} readOnly disabled />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => {
                  onSave({
                    gender: gender || null,
                    bloodGroup: bloodGroup || null,
                    maritalStatus: maritalStatus || null,
                    qualification: qualification || null,
                    aboutYourself: aboutYourself || null,
                    researchInterests: researchInterests || null,
                    otherInformation: otherInformation || null,
                  });
                  setOpen(false);
                }}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Update"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DataField label="Employee ID" value={profile.employeeId} />
        <DataField label="Gender" value={profile.gender} />
        <DataField label="Date of Birth" value={formatDate(profile.dob)} />
        <DataField label="Marital Status" value={profile.maritalStatus} />
        <DataField label="Date of Joining" value={formatDate(profile.dateOfJoining)} />
        <DataField label="Blood Group" value={profile.bloodGroup} />
        <DataField label="Staff Type" value={profile.staffType || "-"} />
        <DataField label="Department" value={profile.department.name} />
        <DataField label="Designation" value={designationText} />
        <DataField label="Nationality" value={profile.nationality} />
        <DataField label="Qualification" value={profile.qualification} />
      </div>

      <div className="mt-4 space-y-4 border-t pt-4">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">About Yourself</p>
          <p className="font-medium break-words">{profile.aboutYourself || "-"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">Research Interests</p>
          <p className="font-medium break-words">{profile.researchInterests || "-"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">Other Information</p>
          <p className="font-medium break-words">{profile.otherInformation || "-"}</p>
        </div>
      </div>
    </section>
  );
};
