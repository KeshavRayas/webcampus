"use client";

import { useState } from "react";
import { DataField } from "./data-field";
import { FacultyProfilePayload } from "./use-faculty-profile";
import { Button } from "@webcampus/ui/components/button";
import { Checkbox } from "@webcampus/ui/components/checkbox";
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

export const PersonalInfoCard = ({
  profile,
  onSave,
  isSaving,
}: {
  profile: FacultyProfilePayload;
  onSave: (payload: Record<string, unknown>) => void;
  isSaving: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [gender, setGender] = useState(profile.gender || "");
  const [bloodGroup, setBloodGroup] = useState(profile.bloodGroup || "");
  const [maritalStatus, setMaritalStatus] = useState(profile.maritalStatus || "");
  const [nationality, setNationality] = useState(profile.nationality || "");
  const [mobileNumber, setMobileNumber] = useState(profile.mobileNumber || "");
  const [alternateContactNumber, setAlternateContactNumber] = useState(
    profile.alternateContactNumber || ""
  );
  const [personalEmail, setPersonalEmail] = useState(profile.personalEmail || "");
  const [contactInformation, setContactInformation] = useState(
    profile.contactInformation || ""
  );

  const [presentAddressLine, setPresentAddressLine] = useState(
    profile.presentAddressLine || ""
  );
  const [presentCity, setPresentCity] = useState(profile.presentCity || "");
  const [presentState, setPresentState] = useState(profile.presentState || "");
  const [presentPincode, setPresentPincode] = useState(profile.presentPincode || "");
  const [permanentAddressLine, setPermanentAddressLine] = useState(
    profile.permanentAddressLine || ""
  );
  const [permanentCity, setPermanentCity] = useState(profile.permanentCity || "");
  const [permanentState, setPermanentState] = useState(profile.permanentState || "");
  const [permanentPincode, setPermanentPincode] = useState(profile.permanentPincode || "");
  const [sameAsPresentAddress, setSameAsPresentAddress] = useState(
    Boolean(profile.sameAsPresentAddress)
  );

  return (
    <section className="bg-card rounded-xl border p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="border-b pb-2 text-lg font-semibold">Personal Information</h4>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Edit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Personal Information</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Input value={gender} onChange={(event) => setGender(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Blood Group</Label>
                  <Input
                    value={bloodGroup}
                    onChange={(event) => setBloodGroup(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Marital Status</Label>
                  <Input
                    value={maritalStatus}
                    onChange={(event) => setMaritalStatus(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nationality</Label>
                  <Input
                    value={nationality}
                    onChange={(event) => setNationality(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mobile Number</Label>
                  <Input
                    value={mobileNumber}
                    onChange={(event) => setMobileNumber(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Alternate Contact Number</Label>
                  <Input
                    value={alternateContactNumber}
                    onChange={(event) => setAlternateContactNumber(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Personal Email</Label>
                  <Input
                    value={personalEmail}
                    onChange={(event) => setPersonalEmail(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Information</Label>
                  <Input
                    value={contactInformation}
                    onChange={(event) => setContactInformation(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Present Address</Label>
                <Input
                  value={presentAddressLine}
                  onChange={(event) => setPresentAddressLine(event.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={presentCity} onChange={(event) => setPresentCity(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input value={presentState} onChange={(event) => setPresentState(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Pincode</Label>
                  <Input
                    value={presentPincode}
                    onChange={(event) => setPresentPincode(event.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="sameAsPresentAddress"
                  checked={sameAsPresentAddress}
                  onCheckedChange={(checked) => {
                    const isChecked = Boolean(checked);
                    setSameAsPresentAddress(isChecked);
                    if (isChecked) {
                      setPermanentAddressLine(presentAddressLine);
                      setPermanentCity(presentCity);
                      setPermanentState(presentState);
                      setPermanentPincode(presentPincode);
                    }
                  }}
                />
                <Label htmlFor="sameAsPresentAddress">Same As Present Address</Label>
              </div>

              <div className="space-y-2">
                <Label>Permanent Address</Label>
                <Input
                  value={permanentAddressLine}
                  onChange={(event) => setPermanentAddressLine(event.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={permanentCity}
                    onChange={(event) => setPermanentCity(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    value={permanentState}
                    onChange={(event) => setPermanentState(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pincode</Label>
                  <Input
                    value={permanentPincode}
                    onChange={(event) => setPermanentPincode(event.target.value)}
                  />
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
                    nationality: nationality || null,
                    mobileNumber: mobileNumber || null,
                    alternateContactNumber: alternateContactNumber || null,
                    personalEmail: personalEmail || null,
                    contactInformation: contactInformation || null,
                    presentAddressLine: presentAddressLine || null,
                    presentCity: presentCity || null,
                    presentState: presentState || null,
                    presentPincode: presentPincode || null,
                    permanentAddressLine: permanentAddressLine || null,
                    permanentCity: permanentCity || null,
                    permanentState: permanentState || null,
                    permanentPincode: permanentPincode || null,
                    sameAsPresentAddress,
                  });
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

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <DataField label="Name" value={profile.user.name} />
        <DataField label="Gender" value={profile.gender} />
        <DataField label="Date of Birth" value={formatDate(profile.dob)} />

        <DataField label="Blood Group" value={profile.bloodGroup} />
        <DataField label="Nationality" value={profile.nationality} />
        <DataField label="Phone Number" value={profile.mobileNumber || profile.phoneNumber} />

        <DataField label="Official Email" value={profile.user.email} />
        <DataField label="Personal Email" value={profile.personalEmail} />
        <DataField label="Address" value={profile.presentAddressLine} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-3">
        <DataField label="Present City" value={profile.presentCity} />
        <DataField label="Present State" value={profile.presentState} />
        <DataField label="Present Pincode" value={profile.presentPincode} />
      </div>

      <div className="grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-3">
        <DataField label="Permanent City" value={profile.permanentCity} />
        <DataField label="Permanent State" value={profile.permanentState} />
        <DataField label="Permanent Pincode" value={profile.permanentPincode} />
      </div>
    </section>
  );
};
