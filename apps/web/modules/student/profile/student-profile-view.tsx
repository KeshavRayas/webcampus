"use client";

import { getApiErrorMessage } from "@/lib/api-client";
import {
  useRequestStudentProfileApproval,
  useStudentProfile,
  useUpdateStudentProfile,
  type StudentProfilePayload,
} from "./use-student-profile";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@webcampus/ui/components/avatar";
import { Badge } from "@webcampus/ui/components/badge";
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
import Link from "next/link";
import { useMemo, useState } from "react";

const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENDER_OPTIONS = ["Male", "Female", "Other"];
const AIDED_STATUS_OPTIONS = [
  { label: "Aided", value: "AIDED" },
  { label: "Un-Aided", value: "UNAIDED" },
];

const getInitials = (name?: string | null) => {
  if (!name) return "NA";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "NA";
  if (parts.length === 1) {
    return (parts[0] || "NA").slice(0, 2).toUpperCase();
  }
  const first = parts[0] || "N";
  const second = parts[1] || "A";
  return `${first[0] || "N"}${second[0] || "A"}`.toUpperCase();
};

const formatDate = (value?: string | null) => {
  if (!value) return "No Data Available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No Data Available";
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const displayValue = (value?: string | number | null) => {
  if (value === null || value === undefined || value === "") {
    return "No Data Available";
  }
  return String(value);
};

const statusVariant = (status?: StudentProfilePayload["admissionStatus"]) => {
  if (status === "APPROVED") return "default" as const;
  if (status === "SUBMITTED") return "secondary" as const;
  if (status === "REJECTED") return "destructive" as const;
  return "outline" as const;
};

const DataField = ({ label, value }: { label: string; value?: React.ReactNode }) => {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="font-medium break-words">{value || "No Data Available"}</p>
    </div>
  );
};

const CardShell = ({
  title,
  trigger,
  children,
}: {
  title: string;
  trigger?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="bg-card rounded-xl border p-6">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h4 className="text-lg font-semibold">{title}</h4>
      {trigger}
    </div>
    {children}
  </section>
);

const allowedFileMime = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
]);

const isAllowedFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  return (
    allowedFileMime.has(file.type) ||
    lowerName.endsWith(".pdf") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg")
  );
};

export const StudentProfileView = () => {
  const { data: profile, isLoading, isError, error } = useStudentProfile();
  const updateProfile = useUpdateStudentProfile();
  const requestApproval = useRequestStudentProfileApproval();

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border p-6">
        <p className="text-muted-foreground text-sm">Loading student profile...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-secondary/20 rounded-xl border p-6 text-center">
        <p className="text-muted-foreground text-sm">
          {getApiErrorMessage(error, "Unable to load student profile")}
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-secondary/20 rounded-xl border p-6 text-center">
        <p className="text-muted-foreground text-sm">Student profile is not available.</p>
      </div>
    );
  }

  const admissionStatusLabel = profile.admissionStatus ?? "PENDING";

  return (
    <div className="mt-2 grid grid-cols-1 items-start gap-6 lg:grid-cols-[18rem_1fr]">
      <div className="bg-card flex w-full flex-col items-center gap-4 rounded-xl border p-6 lg:w-[18rem]">
        <Avatar className="h-28 w-28 border">
          <AvatarImage src={profile.user.image || profile.profile.documents?.photo || undefined} alt={profile.user.name} />
          <AvatarFallback className="text-xl font-semibold">
            {getInitials(profile.user.name)}
          </AvatarFallback>
        </Avatar>

        <div className="w-full space-y-2 text-center">
          <p className="text-lg font-semibold">{displayValue(profile.profile.fullName || profile.user.name)}</p>
          <p className="text-muted-foreground text-sm break-all">
            {displayValue(profile.profile.collegeEmail || profile.user.email)}
          </p>
          <p className="text-muted-foreground text-sm">{displayValue(profile.profile.mobileNumber)}</p>
        </div>

        <div className="w-full space-y-3 border-t pt-4">
          <DataField label="USN" value={displayValue(profile.usn)} />
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm">Profile Status</p>
            <Badge variant={statusVariant(profile.admissionStatus)}>{admissionStatusLabel}</Badge>
          </div>
          <Button
            className="w-full"
            onClick={() => requestApproval.mutate()}
            disabled={requestApproval.isPending || profile.admissionStatus === "APPROVED"}
          >
            {requestApproval.isPending ? "Submitting..." : "Request for Profile Approval"}
          </Button>
          <Button className="w-full" variant="outline" asChild>
            <Link href="/forgot-password">Change Password</Link>
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <PersonalDetailsCard
          profile={profile}
          onSave={(payload) => updateProfile.mutate(payload)}
          isSaving={updateProfile.isPending}
        />
        <AddressDetailsCard
          profile={profile}
          onSave={(payload) => updateProfile.mutate(payload)}
          isSaving={updateProfile.isPending}
        />
        <FamilyDetailsCard
          profile={profile}
          onSave={(payload) => updateProfile.mutate(payload)}
          isSaving={updateProfile.isPending}
        />
        <AcademicDetailsCard profile={profile} />
        <EducationDetailsCard
          profile={profile}
          onSave={(payload) => updateProfile.mutate(payload)}
          isSaving={updateProfile.isPending}
        />
        <DocumentsCard
          profile={profile}
          onSave={(payload) => updateProfile.mutate(payload)}
          isSaving={updateProfile.isPending}
        />
      </div>
    </div>
  );
};

const PersonalDetailsCard = ({
  profile,
  onSave,
  isSaving,
}: {
  profile: StudentProfilePayload;
  onSave: (payload: Record<string, unknown>) => void;
  isSaving: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [aadhaarError, setAadhaarError] = useState("");
  const [form, setForm] = useState({
    fullName: profile.profile.fullName || profile.user.name || "",
    dob: profile.profile.dob ? new Date(profile.profile.dob).toISOString().slice(0, 10) : "",
    gender: profile.profile.gender || "",
    bloodGroup: profile.profile.bloodGroup || "",
    aidedStatus: profile.profile.aidedStatus || "",
    category: profile.profile.category || "",
    personalEmail: profile.profile.personalEmail || "",
    alternatePhone: profile.profile.alternatePhone || "",
    aadhaarNumber: profile.profile.aadhaarNumber || "",
    admissionQuota: profile.profile.admissionQuota || "",
    nationality: profile.profile.nationality || "",
    passportNumber: profile.profile.passportNumber || "",
    visaValidityDetails: profile.profile.visaValidityDetails || "",
  });

  return (
    <CardShell
      title="Personal Details"
      trigger={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">Update Details</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] w-[95vw] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Update Personal Details</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 py-2 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Full Name</Label>
                <Input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input type="date" value={form.dob} onChange={(e) => setForm((p) => ({ ...p, dob: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={(value) => setForm((p) => ({ ...p, gender: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Blood Group</Label>
                <Select value={form.bloodGroup} onValueChange={(value) => setForm((p) => ({ ...p, bloodGroup: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOOD_GROUP_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Aided / Un-Aided</Label>
                <Select value={form.aidedStatus} onValueChange={(value) => setForm((p) => ({ ...p, aidedStatus: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {AIDED_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Personal Email</Label>
                <Input type="email" value={form.personalEmail} onChange={(e) => setForm((p) => ({ ...p, personalEmail: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Alternate Phone</Label>
                <Input value={form.alternatePhone} onChange={(e) => setForm((p) => ({ ...p, alternatePhone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Aadhaar Number</Label>
                <Input value={form.aadhaarNumber} onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, "").slice(0, 12);
                  setForm((p) => ({ ...p, aadhaarNumber: next }));
                  if (next.length === 0 || next.length === 12) {
                    setAadhaarError("");
                  } else {
                    setAadhaarError("Aadhaar number must be exactly 12 digits");
                  }
                }} />
                {aadhaarError ? <p className="text-destructive text-xs">{aadhaarError}</p> : null}
              </div>
              <div className="space-y-2">
                <Label>Admission Quota</Label>
                <Input value={form.admissionQuota} onChange={(e) => setForm((p) => ({ ...p, admissionQuota: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Nationality</Label>
                <Input value={form.nationality} onChange={(e) => setForm((p) => ({ ...p, nationality: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Passport Number (optional)</Label>
                <Input value={form.passportNumber} onChange={(e) => setForm((p) => ({ ...p, passportNumber: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Visa Validity Details (optional)</Label>
                <Input value={form.visaValidityDetails} onChange={(e) => setForm((p) => ({ ...p, visaValidityDetails: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={isSaving || Boolean(aadhaarError)}
                onClick={() => {
                  if (form.aadhaarNumber && !/^\d{12}$/.test(form.aadhaarNumber)) {
                    setAadhaarError("Aadhaar number must be exactly 12 digits");
                    return;
                  }

                  onSave({
                    fullName: form.fullName || null,
                    dob: form.dob || null,
                    gender: form.gender || null,
                    bloodGroup: form.bloodGroup || null,
                    aidedStatus: form.aidedStatus || null,
                    category: form.category || null,
                    personalEmail: form.personalEmail || null,
                    alternatePhone: form.alternatePhone || null,
                    aadhaarNumber: form.aadhaarNumber || null,
                    admissionQuota: form.admissionQuota || null,
                    nationality: form.nationality || null,
                    passportNumber: form.passportNumber || null,
                    visaValidityDetails: form.visaValidityDetails || null,
                  });
                  setOpen(false);
                }}
              >
                {isSaving ? "Saving..." : "Update Details"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DataField label="Date of Birth" value={formatDate(profile.profile.dob)} />
        <DataField label="Gender" value={displayValue(profile.profile.gender)} />
        <DataField label="Blood Group" value={displayValue(profile.profile.bloodGroup)} />
        <DataField label="Aided / Un-Aided" value={displayValue(profile.profile.aidedStatus)} />
        <DataField label="Category" value={displayValue(profile.profile.category)} />
        <DataField label="Personal Email" value={displayValue(profile.profile.personalEmail)} />
        <DataField label="Alternate Phone" value={displayValue(profile.profile.alternatePhone)} />
        <DataField label="Aadhaar Number" value={displayValue(profile.profile.aadhaarNumber)} />
        <DataField label="Admission Quota" value={displayValue(profile.profile.admissionQuota)} />
        <DataField label="Nationality" value={displayValue(profile.profile.nationality)} />
        <DataField label="Passport Number" value={displayValue(profile.profile.passportNumber)} />
        <DataField label="Visa Validity Details" value={displayValue(profile.profile.visaValidityDetails)} />
      </div>
    </CardShell>
  );
};

const AddressDetailsCard = ({
  profile,
  onSave,
  isSaving,
}: {
  profile: StudentProfilePayload;
  onSave: (payload: Record<string, unknown>) => void;
  isSaving: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [presentAddress, setPresentAddress] = useState(profile.profile.presentAddress || "");
  const [permanentAddress, setPermanentAddress] = useState(profile.profile.permanentAddress || "");
  const [sameAsPermanent, setSameAsPermanent] = useState(Boolean(profile.profile.sameAsPermanentAddress));

  return (
    <CardShell
      title="Address Details"
      trigger={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">Update Details</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] w-[95vw] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Update Address Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Permanent Address</Label>
                <textarea
                  className="border-input bg-background w-full rounded-md border p-3 text-sm"
                  rows={4}
                  value={permanentAddress}
                  onChange={(e) => setPermanentAddress(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="sameAsPermanentAddress"
                  checked={sameAsPermanent}
                  onCheckedChange={(checked) => {
                    const next = Boolean(checked);
                    setSameAsPermanent(next);
                    if (next) {
                      setPresentAddress(permanentAddress);
                    }
                  }}
                />
                <Label htmlFor="sameAsPermanentAddress">Same as Permanent Address</Label>
              </div>
              <div className="space-y-2">
                <Label>Present Address</Label>
                <textarea
                  className="border-input bg-background w-full rounded-md border p-3 text-sm"
                  rows={4}
                  value={presentAddress}
                  onChange={(e) => setPresentAddress(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={isSaving}
                onClick={() => {
                  onSave({
                    permanentAddress: permanentAddress || null,
                    presentAddress: sameAsPermanent ? permanentAddress || null : presentAddress || null,
                    sameAsPermanentAddress: sameAsPermanent,
                  });
                  setOpen(false);
                }}
              >
                {isSaving ? "Saving..." : "Update Details"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DataField label="Permanent Address" value={displayValue(profile.profile.permanentAddress)} />
        <DataField label="Present Address" value={displayValue(profile.profile.presentAddress)} />
      </div>
    </CardShell>
  );
};

const FamilyDetailsCard = ({
  profile,
  onSave,
  isSaving,
}: {
  profile: StudentProfilePayload;
  onSave: (payload: Record<string, unknown>) => void;
  isSaving: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [father, setFather] = useState({
    name: profile.profile.father?.name || "",
    occupation: profile.profile.father?.occupation || "",
    qualification: profile.profile.father?.qualification || "",
    mobile: profile.profile.father?.mobile || "",
    email: profile.profile.father?.email || "",
  });
  const [mother, setMother] = useState({
    name: profile.profile.mother?.name || "",
    occupation: profile.profile.mother?.occupation || "",
    qualification: profile.profile.mother?.qualification || "",
    mobile: profile.profile.mother?.mobile || "",
    email: profile.profile.mother?.email || "",
  });

  return (
    <CardShell
      title="Family Details"
      trigger={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">Update Details</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] w-[95vw] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Update Family Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-2">
              <div className="space-y-3">
                <h5 className="font-medium">Father/Guardian</h5>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Input placeholder="Name" value={father.name} onChange={(e) => setFather((p) => ({ ...p, name: e.target.value }))} />
                  <Input placeholder="Occupation" value={father.occupation} onChange={(e) => setFather((p) => ({ ...p, occupation: e.target.value }))} />
                  <Input placeholder="Qualification" value={father.qualification} onChange={(e) => setFather((p) => ({ ...p, qualification: e.target.value }))} />
                  <Input placeholder="Mobile" value={father.mobile} onChange={(e) => setFather((p) => ({ ...p, mobile: e.target.value }))} />
                  <Input placeholder="Email" type="email" value={father.email} onChange={(e) => setFather((p) => ({ ...p, email: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-3">
                <h5 className="font-medium">Mother</h5>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Input placeholder="Name" value={mother.name} onChange={(e) => setMother((p) => ({ ...p, name: e.target.value }))} />
                  <Input placeholder="Occupation" value={mother.occupation} onChange={(e) => setMother((p) => ({ ...p, occupation: e.target.value }))} />
                  <Input placeholder="Qualification" value={mother.qualification} onChange={(e) => setMother((p) => ({ ...p, qualification: e.target.value }))} />
                  <Input placeholder="Mobile" value={mother.mobile} onChange={(e) => setMother((p) => ({ ...p, mobile: e.target.value }))} />
                  <Input placeholder="Email" type="email" value={mother.email} onChange={(e) => setMother((p) => ({ ...p, email: e.target.value }))} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={isSaving}
                onClick={() => {
                  onSave({
                    fatherName: father.name || null,
                    fatherOccupation: father.occupation || null,
                    fatherQualification: father.qualification || null,
                    fatherMobile: father.mobile || null,
                    fatherEmail: father.email || null,
                    motherName: mother.name || null,
                    motherOccupation: mother.occupation || null,
                    motherQualification: mother.qualification || null,
                    motherMobile: mother.mobile || null,
                    motherEmail: mother.email || null,
                  });
                  setOpen(false);
                }}
              >
                {isSaving ? "Saving..." : "Update Details"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h5 className="font-medium">Father/Guardian</h5>
          <DataField label="Name" value={displayValue(profile.profile.father?.name)} />
          <DataField label="Occupation" value={displayValue(profile.profile.father?.occupation)} />
          <DataField label="Qualification" value={displayValue(profile.profile.father?.qualification)} />
          <DataField label="Mobile" value={displayValue(profile.profile.father?.mobile)} />
          <DataField label="Email" value={displayValue(profile.profile.father?.email)} />
        </div>
        <div className="space-y-3">
          <h5 className="font-medium">Mother</h5>
          <DataField label="Name" value={displayValue(profile.profile.mother?.name)} />
          <DataField label="Occupation" value={displayValue(profile.profile.mother?.occupation)} />
          <DataField label="Qualification" value={displayValue(profile.profile.mother?.qualification)} />
          <DataField label="Mobile" value={displayValue(profile.profile.mother?.mobile)} />
          <DataField label="Email" value={displayValue(profile.profile.mother?.email)} />
        </div>
      </div>
    </CardShell>
  );
};

const AcademicDetailsCard = ({ profile }: { profile: StudentProfilePayload }) => {
  const row = useMemo(
    () => [
      {
        academicYear: profile.profile.academic?.academicYear || profile.academicYear,
        departmentName: profile.profile.academic?.departmentName || profile.departmentName,
        programme:
          profile.profile.academic?.programme ||
          (profile.programType ? `BE - ${profile.programType}` : null),
        semester: profile.profile.academic?.semester || profile.currentSemester,
        section: profile.profile.academic?.section || null,
      },
    ],
    [profile]
  );

  return (
    <CardShell
      title="Academic Details"
      trigger={<Button variant="outline" size="sm" disabled>Update Details</Button>}
    >
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Academic Year</TableHead>
              <TableHead>Department Name</TableHead>
              <TableHead>Programme</TableHead>
              <TableHead>Semester</TableHead>
              <TableHead>Section</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {row.map((entry, index) => (
              <TableRow key={index}>
                <TableCell>{displayValue(entry.academicYear)}</TableCell>
                <TableCell>{displayValue(entry.departmentName)}</TableCell>
                <TableCell>{displayValue(entry.programme)}</TableCell>
                <TableCell>{displayValue(entry.semester)}</TableCell>
                <TableCell>{displayValue(entry.section)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </CardShell>
  );
};

const EducationDetailsCard = ({
  profile,
  onSave,
  isSaving,
}: {
  profile: StudentProfilePayload;
  onSave: (payload: Record<string, unknown>) => void;
  isSaving: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    class10School: profile.profile.education?.class10?.school || "",
    class10Board: profile.profile.education?.class10?.board || "",
    class10Percentage:
      profile.profile.education?.class10?.percentage != null
        ? String(profile.profile.education?.class10?.percentage)
        : "",
    class10Year: profile.profile.education?.class10?.year || "",
    class12Institute: profile.profile.education?.class12OrDiploma?.school || "",
    class12Board: profile.profile.education?.class12OrDiploma?.board || "",
    class12Percentage:
      profile.profile.education?.class12OrDiploma?.percentage != null
        ? String(profile.profile.education?.class12OrDiploma?.percentage)
        : "",
    class12Year: profile.profile.education?.class12OrDiploma?.year || "",
    entranceExamDetails: profile.profile.education?.entranceExamDetails || "",
  });

  return (
    <CardShell
      title="Education Details"
      trigger={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">Update Details</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] w-[95vw] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Update Education Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <div className="space-y-3">
                <h5 className="font-medium">10th Details</h5>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Input placeholder="School" value={form.class10School} onChange={(e) => setForm((p) => ({ ...p, class10School: e.target.value }))} />
                  <Input placeholder="Board" value={form.class10Board} onChange={(e) => setForm((p) => ({ ...p, class10Board: e.target.value }))} />
                  <Input placeholder="Percentage" value={form.class10Percentage} onChange={(e) => setForm((p) => ({ ...p, class10Percentage: e.target.value }))} />
                  <Input placeholder="Year" value={form.class10Year} onChange={(e) => setForm((p) => ({ ...p, class10Year: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-3">
                <h5 className="font-medium">12th / Diploma Details</h5>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Input placeholder="Institute" value={form.class12Institute} onChange={(e) => setForm((p) => ({ ...p, class12Institute: e.target.value }))} />
                  <Input placeholder="Board" value={form.class12Board} onChange={(e) => setForm((p) => ({ ...p, class12Board: e.target.value }))} />
                  <Input placeholder="Percentage" value={form.class12Percentage} onChange={(e) => setForm((p) => ({ ...p, class12Percentage: e.target.value }))} />
                  <Input placeholder="Year" value={form.class12Year} onChange={(e) => setForm((p) => ({ ...p, class12Year: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Entrance Exam Details (optional)</Label>
                <Input value={form.entranceExamDetails} onChange={(e) => setForm((p) => ({ ...p, entranceExamDetails: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={isSaving}
                onClick={() => {
                  onSave({
                    class10School: form.class10School || null,
                    class10Board: form.class10Board || null,
                    class10Percentage: form.class10Percentage ? Number(form.class10Percentage) : null,
                    class10Year: form.class10Year || null,
                    class12Institute: form.class12Institute || null,
                    class12Board: form.class12Board || null,
                    class12Percentage: form.class12Percentage ? Number(form.class12Percentage) : null,
                    class12Year: form.class12Year || null,
                    entranceExamDetails: form.entranceExamDetails || null,
                  });
                  setOpen(false);
                }}
              >
                {isSaving ? "Saving..." : "Update Details"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <h5 className="font-medium">10th Details</h5>
          <DataField label="School" value={displayValue(profile.profile.education?.class10?.school)} />
          <DataField label="Board" value={displayValue(profile.profile.education?.class10?.board)} />
          <DataField label="Percentage" value={displayValue(profile.profile.education?.class10?.percentage)} />
          <DataField label="Year" value={displayValue(profile.profile.education?.class10?.year)} />
        </div>
        <div className="space-y-2">
          <h5 className="font-medium">12th / Diploma Details</h5>
          <DataField label="Institute" value={displayValue(profile.profile.education?.class12OrDiploma?.school)} />
          <DataField label="Board" value={displayValue(profile.profile.education?.class12OrDiploma?.board)} />
          <DataField label="Percentage" value={displayValue(profile.profile.education?.class12OrDiploma?.percentage)} />
          <DataField label="Year" value={displayValue(profile.profile.education?.class12OrDiploma?.year)} />
        </div>
      </div>
      <div className="mt-4">
        <DataField label="Entrance Exam Details" value={displayValue(profile.profile.education?.entranceExamDetails)} />
      </div>
    </CardShell>
  );
};

const DocumentsCard = ({
  profile,
  onSave,
  isSaving,
}: {
  profile: StudentProfilePayload;
  onSave: (payload: Record<string, unknown>) => void;
  isSaving: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    aadhaarCardUrl: profile.profile.documents?.aadhaarCard || "",
    photoUrl: profile.profile.documents?.photo || "",
    marksCardsUrl: profile.profile.documents?.marksCards || "",
    otherDocumentsUrl: profile.profile.documents?.otherDocuments || "",
  });
  const [preview, setPreview] = useState({
    photo: "",
    aadhaarCard: "",
    marksCards: "",
    otherDocuments: "",
  });
  const [fileError, setFileError] = useState("");

  const onPickFile = (key: keyof typeof preview, file?: File) => {
    if (!file) return;
    if (!isAllowedFile(file)) {
      setFileError("Only PDF/JPG/PNG files are allowed");
      return;
    }
    setFileError("");
    setPreview((prev) => ({ ...prev, [key]: URL.createObjectURL(file) }));
  };

  return (
    <CardShell
      title="Documents"
      trigger={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">Update Details</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] w-[95vw] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Update Documents</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {fileError ? <p className="text-destructive text-sm">{fileError}</p> : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Aadhaar Card</Label>
                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => onPickFile("aadhaarCard", e.target.files?.[0])} />
                  <Input placeholder="Aadhaar Card URL" value={form.aadhaarCardUrl} onChange={(e) => setForm((p) => ({ ...p, aadhaarCardUrl: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Photo</Label>
                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => onPickFile("photo", e.target.files?.[0])} />
                  <Input placeholder="Photo URL" value={form.photoUrl} onChange={(e) => setForm((p) => ({ ...p, photoUrl: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Marks Cards</Label>
                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => onPickFile("marksCards", e.target.files?.[0])} />
                  <Input placeholder="Marks Cards URL" value={form.marksCardsUrl} onChange={(e) => setForm((p) => ({ ...p, marksCardsUrl: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Other Documents</Label>
                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => onPickFile("otherDocuments", e.target.files?.[0])} />
                  <Input placeholder="Other Documents URL" value={form.otherDocumentsUrl} onChange={(e) => setForm((p) => ({ ...p, otherDocumentsUrl: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <DataField label="Aadhaar Card Preview" value={displayValue(preview.aadhaarCard || form.aadhaarCardUrl)} />
                <DataField label="Photo Preview" value={displayValue(preview.photo || form.photoUrl)} />
                <DataField label="Marks Cards Preview" value={displayValue(preview.marksCards || form.marksCardsUrl)} />
                <DataField label="Other Documents Preview" value={displayValue(preview.otherDocuments || form.otherDocumentsUrl)} />
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={isSaving}
                onClick={() => {
                  onSave({
                    aadhaarCardUrl: form.aadhaarCardUrl || null,
                    photoUrl: form.photoUrl || null,
                    marksCardsUrl: form.marksCardsUrl || null,
                    otherDocumentsUrl: form.otherDocumentsUrl || null,
                  });
                  setOpen(false);
                }}
              >
                {isSaving ? "Saving..." : "Update Details"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DataField label="Aadhaar Card" value={displayValue(profile.profile.documents?.aadhaarCard)} />
        <DataField label="Photo" value={displayValue(profile.profile.documents?.photo)} />
        <DataField label="Marks Cards" value={displayValue(profile.profile.documents?.marksCards)} />
        <DataField label="Other Documents" value={displayValue(profile.profile.documents?.otherDocuments)} />
      </div>
    </CardShell>
  );
};
