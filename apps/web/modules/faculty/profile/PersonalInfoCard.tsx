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

  const formatAddressBlock = (
    line?: string | null,
    city?: string | null,
    state?: string | null,
    pincode?: string | null
  ) => {
    const parts = [line, city, state, pincode].filter(Boolean);
    if (!parts.length) {
      return "-";
    }
    return <span className="whitespace-pre-line">{parts.join("\n")}</span>;
  };

  return (
    <section className="bg-card rounded-xl border p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="border-b pb-2 text-lg font-semibold">Contact Details</h4>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Update
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-4xl xl:max-w-6xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Update Contact Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                {isSaving ? "Saving..." : "Update"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <DataField label="Mobile" value={profile.mobileNumber || profile.phoneNumber} />
        <DataField label="Alt. Contact" value={profile.alternateContactNumber} />
        <DataField label="Official Email" value={profile.user.email} />
        <DataField label="Personal Email" value={profile.personalEmail} />
      </div>

      <div className="grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2">
        <DataField
          label="Present Address"
          value={
            formatAddressBlock(
              profile.presentAddressLine,
              profile.presentCity,
              profile.presentState,
              profile.presentPincode
            )
          }
        />
        <DataField
          label="Permanent Address"
          value={
            formatAddressBlock(
              profile.permanentAddressLine,
              profile.permanentCity,
              profile.permanentState,
              profile.permanentPincode
            )
          }
        />
      </div>
    </section>
  );
};
