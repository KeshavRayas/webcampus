"use client";

import { authClient } from "@/lib/auth-client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@webcampus/ui/components/avatar";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@webcampus/ui/components/dialog";
import { FileDown, Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useRef, useState } from "react";
import { toast } from "react-toastify";
import { AdmissionAcknowledgement } from "../applicant/admission-acknowledgement";
import {
  AdmissionDocument,
  type DocData,
} from "../applicant/admission-document";
import { renderNodeToPdf } from "../applicant/admission-pdf";
import { AdmissionResponse } from "./admin-admission-columns";

const getStatusVariant = (status: AdmissionResponse["status"]) => {
  switch (status) {
    case "APPROVED":
      return "default";
    case "SUBMITTED":
      return "secondary";
    case "REJECTED":
      return "destructive";
    case "EXITED":
      return "outline";
    default:
      return "outline";
  }
};

const getInitials = (name?: string | null) => {
  if (!name) return "NA";
  const parts = name.trim().split(/\s+/);
  if (!parts.length) return "NA";
  if (parts.length === 1) return (parts[0] ?? "NA").slice(0, 2).toUpperCase();
  const firstInitial = parts[0]?.[0] ?? "N";
  const secondInitial = parts[1]?.[0] ?? "A";
  return `${firstInitial}${secondInitial}`.toUpperCase();
};

const DataField = ({
  label,
  value,
}: {
  label: string;
  value?: string | number | boolean | Date | null;
}) => {
  let displayValue = "-";
  if (value !== undefined && value !== null && value !== "") {
    if (typeof value === "boolean") {
      displayValue = value ? "Yes" : "No";
    } else if (value instanceof Date) {
      displayValue = value.toLocaleDateString();
    } else if (
      typeof value === "string" &&
      !isNaN(Date.parse(value)) &&
      value.includes("T")
    ) {
      displayValue = new Date(value).toLocaleDateString();
    } else {
      displayValue = String(value);
    }
  }

  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="break-words font-medium" suppressHydrationWarning>
        {displayValue}
      </p>
    </div>
  );
};

const toDate = (value?: string | Date | null) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
};

const yesNo = (value?: boolean | null) => (value ? "Yes" : "No");

const buildDocData = (admission: AdmissionResponse): DocData => {
  const currentFullAddress = [
    admission.currentAddress,
    admission.currentArea,
    admission.currentCity,
    admission.currentDistrict,
    admission.currentState,
    admission.currentCountry,
    admission.currentPincode,
  ]
    .filter(Boolean)
    .join(", ");
  const permanentFullAddress = [
    admission.permanentAddress,
    admission.permanentArea,
    admission.permanentCity,
    admission.permanentDistrict,
    admission.permanentState,
    admission.permanentCountry,
    admission.permanentPincode,
  ]
    .filter(Boolean)
    .join(", ");

  const fullName =
    admission.student?.user?.name ||
    admission.nameAsPer10th ||
    [admission.firstName, admission.middleName, admission.lastName]
      .filter(Boolean)
      .join(" ") ||
    "";

  const admissionBasedOn =
    admission.admissionBasedOn === "CLASS_12_PUC"
      ? "Class 12th / PUC"
      : admission.admissionBasedOn === "DIPLOMA"
        ? "Diploma"
        : (admission.admissionBasedOn ?? "");

  return {
    student_name: fullName,
    dob: toDate(admission.dob),
    blood_group: admission.bloodGroup ?? "",
    gender: admission.gender ?? "",
    primary_phone: admission.primaryPhoneNumber ?? "",
    secondary_phone: admission.secondaryPhoneNumber ?? "",
    emergency_phone: admission.emergencyContactNumber ?? "",
    primary_email: admission.primaryEmail ?? "",
    secondary_email: admission.secondaryEmail ?? "",
    current_address: admission.currentAddress ?? "",
    current_area: admission.currentArea ?? "",
    current_district: admission.currentDistrict ?? "",
    current_state: admission.currentState ?? "",
    current_country: admission.currentCountry ?? "",
    current_pincode: admission.currentPincode ?? "",
    permanent_address: admission.permanentAddress ?? "",
    permanent_area: admission.permanentArea ?? "",
    permanent_district: admission.permanentDistrict ?? "",
    permanent_state: admission.permanentState ?? "",
    permanent_country: admission.permanentCountry ?? "",
    permanent_pincode: admission.permanentPincode ?? "",
    current_full: currentFullAddress,
    permanent_full: permanentFullAddress,
    place_of_birth: admission.placeOfBirth ?? "",
    domicile_state: admission.stateOfBirth ?? "",
    religion: admission.religion ?? "",
    caste: admission.caste ?? "",
    sub_caste: admission.subCaste ?? "",
    mother_tongue: admission.motherTongue ?? "",
    nationality: admission.nationality ?? "",
    aadhar_number: admission.aadharNumber ?? "",
    nri: yesNo(admission.nri),
    disability: yesNo(admission.disability),
    disability_type: admission.disabilityType ?? "",
    economically_backward: yesNo(admission.economicallyBackward),
    passport_number: admission.passportNumber ?? "",
    passport_expiry: toDate(admission.passportExpiryDate),
    visa_number: admission.visaNumber ?? "",
    visa_expiry: toDate(admission.visaExpiryDate),
    application_id: admission.applicationId ?? "",
    mode_of_admission: admission.modeOfAdmission ?? "",
    branch: admission.department?.name ?? "",
    admission_type: admission.admissionType ?? "",
    admission_based_on: admissionBasedOn,
    semester: "",
    category_claimed: admission.categoryClaimed ?? "",
    category_allotted: admission.categoryAllotted ?? "",
    quota: admission.quota ?? "",
    entrance_exam_rank: admission.entranceExamRank ?? "",
    sport_name: "",
    admission_order_number: admission.originalAdmissionOrderNumber ?? "",
    admission_order_date: toDate(admission.originalAdmissionOrderDate),
    counselling_round: admission.counsellingRound ?? "",
    abc_apar_id: admission.abcAparId ?? "",
    receiving_scholarship: yesNo(admission.scholarship),
    fee_paid: admission.feePaid != null ? String(admission.feePaid) : "",
    fee_receipt: admission.feeReceiptNumber ?? "",
    class10_school_name: admission.class10thSchoolName ?? "",
    class10_reg_number: admission.class10thRollRegNumber ?? "",
    class10_school_type: admission.class10thSchoolType ?? "",
    class10_country: "",
    class10_state: admission.class10thSchoolState ?? "",
    class10_city: admission.class10thSchoolCity ?? "",
    class10_year: admission.class10thYearOfPassing ?? "",
    class10_marks:
      admission.class10thAggregateScore != null
        ? String(admission.class10thAggregateScore)
        : "",
    class10_total:
      admission.class10thAggregateTotal != null
        ? String(admission.class10thAggregateTotal)
        : "",
    class10_medium: admission.class10thMediumOfTeaching ?? "",
    class10_kannada: yesNo(admission.studiedKannadaIn10th),
    class12_institute_name: admission.class12thInstituteName ?? "",
    class12_institute_type: admission.class12thInstituteType ?? "",
    class12_country: "",
    class12_state: admission.class12thInstituteState ?? "",
    class12_city: admission.class12thInstituteCity ?? "",
    class12_branch: admission.class12thBranch ?? "",
    class12_reg_number: admission.class12thRollRegNumber ?? "",
    class12_year: admission.class12thYearOfPassing ?? "",
    class12_medium: admission.class12thMediumOfTeaching ?? "",
    class12_marks:
      admission.class12thAggregateScore != null
        ? String(admission.class12thAggregateScore)
        : "",
    class12_total:
      admission.class12thAggregateTotal != null
        ? String(admission.class12thAggregateTotal)
        : "",
    physics_marks:
      admission.physicsMarks != null ? String(admission.physicsMarks) : "",
    physics_max:
      admission.physicsMaxMarks != null
        ? String(admission.physicsMaxMarks)
        : "",
    chemistry_marks:
      admission.chemistryMarks != null ? String(admission.chemistryMarks) : "",
    chemistry_max:
      admission.chemistryMaxMarks != null
        ? String(admission.chemistryMaxMarks)
        : "",
    maths_marks:
      admission.mathematicsMarks != null
        ? String(admission.mathematicsMarks)
        : "",
    maths_max:
      admission.mathematicsMaxMarks != null
        ? String(admission.mathematicsMaxMarks)
        : "",
    pcm_percentage:
      admission.pcmPercentage != null ? String(admission.pcmPercentage) : "",
    diploma_institute_name: admission.diplomaInstituteName ?? "",
    diploma_institute_type: admission.diplomaInstituteType ?? "",
    diploma_country: "",
    diploma_state: admission.diplomaInstituteState ?? "",
    diploma_city: admission.diplomaInstituteCity ?? "",
    diploma_branch: admission.diplomaBranch ?? "",
    diploma_year: admission.diplomaYearOfPassing ?? "",
    diploma_medium: admission.diplomaMediumOfTeaching ?? "",
    diploma_marks:
      admission.diplomaAggregateScore != null
        ? String(admission.diplomaAggregateScore)
        : "",
    diploma_total:
      admission.diplomaAggregateTotal != null
        ? String(admission.diplomaAggregateTotal)
        : "",
    father_name: admission.fatherName ?? "",
    father_occupation: admission.fatherOccupation ?? "",
    father_income: "",
    father_mobile: admission.fatherNumber ?? "",
    father_email: admission.fatherEmail ?? "",
    father_address: admission.fatherPermanentAddress ?? "",
    parent_passport: admission.parentPassportNumber ?? "",
    parent_visa: admission.parentVisaNumber ?? "",
    parent_visa_expiry: toDate(admission.parentVisaExpiryDate),
    mother_name: admission.motherName ?? "",
    mother_occupation: admission.motherOccupation ?? "",
    mother_income: "",
    mother_mobile: admission.motherNumber ?? "",
    mother_email: admission.motherEmail ?? "",
    mother_address: admission.motherPermanentAddress ?? "",
    guardian_name: admission.guardianName ?? "",
    guardian_occupation: admission.guardianOccupation ?? "",
    guardian_income: "",
    guardian_mobile: admission.guardianNumber ?? "",
    guardian_email: admission.guardianEmail ?? "",
    guardian_address: admission.guardianPermanentAddress ?? "",
    signature: "",
    date: new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  };
};

export const AdminAdmissionActions = ({
  admission,
}: {
  admission: AdmissionResponse;
}) => {
  const { data: session } = authClient.useSession();
  const role = session?.user?.role;
  const router = useRouter();
  const canEdit =
    role === "admin" || role === "admission" || role === "admission-instructor";

  const isPending = admission.status === "PENDING";
  const [open, setOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [docData, setDocData] = useState<DocData | null>(null);
  const documentRef = useRef<HTMLDivElement | null>(null);
  const acknowledgementRef = useRef<HTMLDivElement | null>(null);

  // Compute Full Name
  const fullName =
    admission.student?.user?.name ||
    admission.nameAsPer10th ||
    [admission.firstName, admission.middleName, admission.lastName]
      .filter(Boolean)
      .join(" ") ||
    "";

  const openFillForm = () => {
    const path =
      role === "admission-instructor"
        ? "/admission-instructor/fill-applicant"
        : "/admission/fill-applicant";
    const params = new URLSearchParams();
    if (admission.semesterId) params.set("semester", admission.semesterId);
    if (admission.primaryEmail) params.set("email", admission.primaryEmail);
    if (admission.applicationId)
      params.set("applicationId", admission.applicationId);
    router.push(`${path}?${params.toString()}`);
  };

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (value && !docData) {
      setDocData(buildDocData(admission));
    }
  };

  const handleDownloadPdf = async () => {
    const node = documentRef.current;
    if (!node) return;
    setIsGeneratingPdf(true);
    try {
      await renderNodeToPdf(
        node,
        `admission-form-${admission.applicationId ?? "application"}.pdf`
      );
      toast.success("Verification PDF downloaded.");
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadAcknowledgement = async () => {
    const node = acknowledgementRef.current;
    if (!node) return;
    setIsGeneratingPdf(true);
    try {
      await renderNodeToPdf(
        node,
        `admission-acknowledgement-${admission.applicationId ?? "application"}.pdf`
      );
      toast.success("Acknowledgement PDF downloaded.");
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 h-3.5 w-3.5" />
            View Details
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[92vh] w-full overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="px-4 pt-4 sm:px-8 sm:pt-8">
            <DialogTitle className="text-left text-2xl">
              Admission Details
            </DialogTitle>
            <DialogDescription>
              Review the full admission record for the selected applicant.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(92vh-8rem)] overflow-y-auto px-4 pb-4 sm:px-8 sm:pb-8">
            <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[18rem_1fr]">
              <div className="bg-card flex w-full flex-col items-center gap-4 rounded-xl border p-6 lg:w-72">
                <Avatar className="h-28 w-28 border">
                  <AvatarImage
                    src={admission.photo || undefined}
                    alt={fullName || "Student photo"}
                  />
                  <AvatarFallback className="text-xl font-semibold">
                    {getInitials(fullName)}
                  </AvatarFallback>
                </Avatar>

                <div className="w-full space-y-3 text-center">
                  <p className="text-lg font-semibold">{fullName || "-"}</p>
                  <p className="text-muted-foreground break-all text-sm">
                    {admission.primaryEmail || "-"}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {admission.primaryPhoneNumber || "-"}
                  </p>
                </div>

                <div className="w-full space-y-3 border-t pt-4">
                  <DataField
                    label="Mode of Admission"
                    value={admission.modeOfAdmission}
                  />
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">Status</p>
                    <Badge variant={getStatusVariant(admission.status)}>
                      {admission.status}
                    </Badge>
                  </div>
                  <DataField label="Temporary USN" value={admission.tempUsn} />
                  <DataField label="USN" value={admission.student?.usn} />
                </div>
              </div>

              <div className="min-w-0">
                <div className="mb-6 flex flex-wrap items-center gap-3">
                  {canEdit && (
                    <Button size="sm" onClick={openFillForm}>
                      Edit Application
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDownloadPdf()}
                    disabled={isGeneratingPdf || isPending}
                  >
                    {isGeneratingPdf ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <FileDown className="mr-2 h-4 w-4" />
                        Download Form PDF
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDownloadAcknowledgement()}
                    disabled={isGeneratingPdf || isPending}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    Download Acknowledgement
                  </Button>
                </div>

                {isPending ? (
                  <div className="bg-secondary/20 rounded-xl border p-6 text-center">
                    <p className="text-muted-foreground text-sm">
                      This applicant has not yet submitted their details.
                    </p>
                  </div>
                ) : (
                  <>
                    <section className="bg-card mb-6 rounded-xl border p-6">
                      <h4 className="mb-4 text-lg font-semibold">
                        Admission Details
                      </h4>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <DataField
                          label="Branch/Dept"
                          value={admission.department?.name}
                        />
                        {role !== "admission-instructor" && (
                          <DataField
                            label="Filled By"
                            value={`${admission.filledBy.name} (${admission.filledBy.role ?? admission.filledBy.email})`}
                          />
                        )}
                        <DataField
                          label="Admission Based On"
                          value={
                            admission.admissionBasedOn === "CLASS_12_PUC"
                              ? "Class 12th / PUC"
                              : admission.admissionBasedOn === "DIPLOMA"
                                ? "Diploma"
                                : admission.admissionBasedOn
                          }
                        />
                        <DataField label="Quota" value={admission.quota} />
                        <DataField
                          label="Entrance Exam Rank"
                          value={admission.entranceExamRank}
                        />
                        <DataField
                          label="Counselling Round"
                          value={admission.counsellingRound}
                        />
                        <DataField
                          label="Admission Type"
                          value={admission.admissionType}
                        />
                        <DataField
                          label="Category Claimed"
                          value={admission.categoryClaimed}
                        />
                        <DataField
                          label="Category Allotted"
                          value={admission.categoryAllotted}
                        />
                        <DataField
                          label="Admission Order No."
                          value={admission.originalAdmissionOrderNumber}
                        />
                        <DataField
                          label="ABC/APAAR ID"
                          value={admission.abcAparId}
                        />
                        <DataField
                          label="Receiving Scholarship?"
                          value={yesNo(admission.scholarship)}
                        />
                        <DataField
                          label="Fee Paid (₹)"
                          value={
                            admission.feePaid != null
                              ? String(admission.feePaid)
                              : null
                          }
                        />
                        <DataField
                          label="Fee Receipt No."
                          value={admission.feeReceiptNumber}
                        />
                        <DataField
                          label="Hostel Required"
                          value={yesNo(admission.hostel)}
                        />
                      </div>
                    </section>

                    <section className="bg-card mb-6 rounded-xl border p-6">
                      <h4 className="mb-4 border-b pb-2 text-lg font-semibold">
                        Personal Information
                      </h4>
                      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                        <DataField
                          label="Name as per 10th"
                          value={admission.nameAsPer10th}
                        />
                        <DataField
                          label="Date of Birth"
                          value={admission.dob}
                        />
                        <DataField label="Gender" value={admission.gender} />
                        <DataField
                          label="Blood Group"
                          value={admission.bloodGroup}
                        />
                        <DataField
                          label="Mother Tongue"
                          value={admission.motherTongue}
                        />
                        <DataField
                          label="Religion"
                          value={admission.religion}
                        />
                        <DataField label="Caste" value={admission.caste} />
                        <DataField
                          label="Sub Caste"
                          value={admission.subCaste}
                        />
                        <DataField
                          label="Place of Birth"
                          value={admission.placeOfBirth}
                        />
                        <DataField
                          label="Domicile of State"
                          value={admission.stateOfBirth}
                        />
                        <DataField
                          label="Nationality"
                          value={admission.nationality}
                        />
                        <DataField label="NRI" value={yesNo(admission.nri)} />
                        <DataField
                          label="Disability"
                          value={yesNo(admission.disability)}
                        />
                        {admission.disability ? (
                          <DataField
                            label="Disability Type"
                            value={admission.disabilityType}
                          />
                        ) : (
                          <div />
                        )}
                        <DataField
                          label="Economically Backward"
                          value={yesNo(admission.economicallyBackward)}
                        />
                        <DataField
                          label="Aadhaar Number"
                          value={admission.aadharNumber}
                        />
                      </div>
                      <div className="mb-4 grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-3">
                        <DataField
                          label="Primary Email"
                          value={admission.primaryEmail}
                        />
                        <DataField
                          label="Secondary Email"
                          value={admission.secondaryEmail}
                        />
                        <DataField
                          label="Primary Phone"
                          value={admission.primaryPhoneNumber}
                        />
                        <DataField
                          label="Secondary Phone"
                          value={admission.secondaryPhoneNumber}
                        />
                        <DataField
                          label="Emergency Contact"
                          value={admission.emergencyContactNumber}
                        />
                        <DataField
                          label="Student Passport No."
                          value={admission.passportNumber}
                        />
                        <DataField
                          label="Passport Expiry"
                          value={toDate(admission.passportExpiryDate)}
                        />
                        <DataField
                          label="Student Visa No."
                          value={admission.visaNumber}
                        />
                        <DataField
                          label="Visa Expiry"
                          value={toDate(admission.visaExpiryDate)}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-sm">
                            Current Address
                          </p>
                          <p className="break-words font-medium">
                            {[
                              admission.currentAddress,
                              admission.currentArea,
                              admission.currentCity,
                              admission.currentDistrict,
                              admission.currentState,
                              admission.currentCountry,
                              admission.currentPincode,
                            ]
                              .filter(Boolean)
                              .join(", ") || "-"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-sm">
                            Permanent Address
                          </p>
                          <p className="break-words font-medium">
                            {[
                              admission.permanentAddress,
                              admission.permanentArea,
                              admission.permanentCity,
                              admission.permanentDistrict,
                              admission.permanentState,
                              admission.permanentCountry,
                              admission.permanentPincode,
                            ]
                              .filter(Boolean)
                              .join(", ") || "-"}
                          </p>
                        </div>
                      </div>
                    </section>

                    <section className="bg-card mb-6 rounded-xl border p-6">
                      <h4 className="mb-4 border-b pb-2 text-lg font-semibold">
                        Education Details
                      </h4>
                      <h5 className="text-md text-primary mb-3 font-semibold">
                        10th Grade
                      </h5>
                      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                        <DataField
                          label="School Name"
                          value={admission.class10thSchoolName}
                        />
                        <DataField
                          label="Roll / Registration Number"
                          value={admission.class10thRollRegNumber}
                        />
                        <DataField
                          label="School Type"
                          value={admission.class10thSchoolType}
                        />
                        <DataField
                          label="Medium of Teaching"
                          value={admission.class10thMediumOfTeaching}
                        />
                        <DataField
                          label="School City"
                          value={admission.class10thSchoolCity}
                        />
                        <DataField
                          label="School State"
                          value={admission.class10thSchoolState}
                        />
                        <DataField
                          label="Year of Passing"
                          value={admission.class10thYearOfPassing}
                        />
                        <DataField
                          label="Aggregate Score"
                          value={admission.class10thAggregateScore}
                        />
                        <DataField
                          label="Aggregate Total"
                          value={admission.class10thAggregateTotal}
                        />
                        <DataField
                          label="Percentage"
                          value={
                            admission.class10thAggregateScore != null &&
                            admission.class10thAggregateTotal
                              ? `${((admission.class10thAggregateScore / admission.class10thAggregateTotal) * 100).toFixed(2)}%`
                              : "-"
                          }
                        />
                        <DataField
                          label="Studied Kannada in 10th"
                          value={yesNo(admission.studiedKannadaIn10th)}
                        />
                      </div>

                      <h5 className="text-md text-primary mb-3 border-t pt-4 font-semibold">
                        12th Grade / PUC
                      </h5>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <DataField
                          label="Institute Name"
                          value={admission.class12thInstituteName}
                        />
                        <DataField
                          label="Roll / Registration Number"
                          value={admission.class12thRollRegNumber}
                        />
                        <DataField
                          label="Institute Type"
                          value={admission.class12thInstituteType}
                        />
                        <DataField
                          label="Branch/Dept"
                          value={admission.class12thBranch}
                        />
                        <DataField
                          label="Medium of Teaching"
                          value={admission.class12thMediumOfTeaching}
                        />
                        <DataField
                          label="Institute City"
                          value={admission.class12thInstituteCity}
                        />
                        <DataField
                          label="Institute State"
                          value={admission.class12thInstituteState}
                        />
                        <DataField
                          label="Year of Passing"
                          value={admission.class12thYearOfPassing}
                        />
                        <DataField
                          label="Aggregate Score"
                          value={admission.class12thAggregateScore}
                        />
                        <DataField
                          label="Aggregate Total"
                          value={admission.class12thAggregateTotal}
                        />
                        <DataField
                          label="Percentage"
                          value={
                            admission.class12thAggregateScore != null &&
                            admission.class12thAggregateTotal
                              ? `${((admission.class12thAggregateScore / admission.class12thAggregateTotal) * 100).toFixed(2)}%`
                              : "-"
                          }
                        />
                        <DataField
                          label="Physics Marks / Max"
                          value={`${admission.physicsMarks ?? "-"} / ${admission.physicsMaxMarks ?? "-"}`}
                        />
                        <DataField
                          label="Chemistry Marks / Max"
                          value={`${admission.chemistryMarks ?? "-"} / ${admission.chemistryMaxMarks ?? "-"}`}
                        />
                        <DataField
                          label="Mathematics Marks / Max"
                          value={`${admission.mathematicsMarks ?? "-"} / ${admission.mathematicsMaxMarks ?? "-"}`}
                        />
                        <DataField
                          label="PCM Grade (%)"
                          value={
                            admission.pcmPercentage != null
                              ? `${admission.pcmPercentage.toFixed(2)}%`
                              : "-"
                          }
                        />
                      </div>
                    </section>

                    <section className="bg-card mb-6 rounded-xl border p-6">
                      <h4 className="mb-4 border-b pb-2 text-lg font-semibold">
                        Parent Details
                      </h4>
                      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                        <div className="space-y-4">
                          <h5 className="text-md text-primary font-semibold">
                            Father&apos;s Details
                          </h5>
                          <DataField
                            label="Name"
                            value={admission.fatherName}
                          />
                          <DataField
                            label="Phone"
                            value={admission.fatherNumber}
                          />
                          <DataField
                            label="Email"
                            value={admission.fatherEmail}
                          />
                          <DataField
                            label="Occupation"
                            value={admission.fatherOccupation}
                          />
                        </div>
                        <div className="space-y-4">
                          <h5 className="text-md text-primary font-semibold">
                            Mother&apos;s Details
                          </h5>
                          <DataField
                            label="Name"
                            value={admission.motherName}
                          />
                          <DataField
                            label="Phone"
                            value={admission.motherNumber}
                          />
                          <DataField
                            label="Email"
                            value={admission.motherEmail}
                          />
                          <DataField
                            label="Occupation"
                            value={admission.motherOccupation}
                          />
                        </div>
                        <div className="space-y-4">
                          <h5 className="text-md text-primary font-semibold">
                            Guardian&apos;s Details
                          </h5>
                          <DataField
                            label="Name"
                            value={admission.guardianName}
                          />
                          <DataField
                            label="Phone"
                            value={admission.guardianNumber}
                          />
                          <DataField
                            label="Email"
                            value={admission.guardianEmail}
                          />
                          <DataField
                            label="Occupation"
                            value={admission.guardianOccupation}
                          />
                        </div>
                      </div>
                    </section>

                    <section className="bg-card mb-6 rounded-xl border p-6">
                      <h4 className="mb-4 border-b pb-2 text-lg font-semibold">
                        Documents
                      </h4>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {[
                          ["Passport Photo", admission.photo],
                          ["Aadhaar Card", admission.aadharCard],
                          ["10th Marks Card", admission.class10thMarksPdf],
                          ["12th Marks Card", admission.class12thMarksPdf],
                          ["Caste Certificate", admission.casteCertificate],
                          [
                            "Disability Certificate",
                            admission.disabilityCertificate,
                          ],
                          [
                            "EWS Certificate",
                            admission.economicallyBackwardCertificate,
                          ],
                          [
                            "Transfer Certificate",
                            admission.transferCertificate,
                          ],
                          ["Study Certificate", admission.studyCertificate],
                        ].map(([label, url]) => (
                          <div className="space-y-1" key={String(label)}>
                            <p className="text-muted-foreground text-sm">
                              {String(label)}
                            </p>
                            {url ? (
                              <a
                                href={String(url)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary font-medium hover:underline"
                              >
                                View file
                              </a>
                            ) : (
                              <p className="font-medium">-</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {docData && (
        <div
          className="pointer-events-none absolute left-[-10000px] top-0"
          aria-hidden="true"
        >
          <div ref={documentRef}>
            <AdmissionDocument data={docData ?? {}} />
          </div>
          <div ref={acknowledgementRef}>
            <AdmissionAcknowledgement data={docData ?? {}} />
          </div>
        </div>
      )}
    </div>
  );
};
