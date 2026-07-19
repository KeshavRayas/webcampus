"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { AdminStudentResponseType } from "@webcampus/schemas/admin";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@webcampus/ui/components/dropdown-menu";
import axios, { AxiosError } from "axios";
import { Eye, MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

type AdminStudentDetailResponse = {
  id: string;
  usn: string;
  departmentName: string;
  currentSemester: number;
  academicYear: string;
  semesterId?: string | null;
  programType?: "UG" | "PG" | null;
  academicTermId?: string | null;
  academicTermType?: "even" | "odd" | null;
  academicTermYear?: string | null;
  academicTermLabel?: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    username?: string | null;
    displayUsername?: string | null;
    image?: string | null;
    createdAt: string;
  };
  admission?: {
    id?: string;
    applicationId?: string;
    modeOfAdmission?: string;
    status?: string;
    quota?: string;
    categoryClaimed?: string;
    categoryAllotted?: string;
    entranceExamRank?: string;
    originalAdmissionOrderNumber?: string;
    originalAdmissionOrderDate?: string | Date | null;
    feePayable?: number | null;
    feePaid?: number | null;
    tempUsn?: string | null;
    uniqueId?: string | null;
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    primaryPhoneNumber?: string | null;
    secondaryPhoneNumber?: string | null;
    primaryEmail?: string | null;
    secondaryEmail?: string | null;
    emergencyContactNumber?: string | null;
    photo?: string | null;

    gender?: string | null;
    dob?: string | Date | null;
    bloodGroup?: string | null;
    motherTongue?: string | null;
    religion?: string | null;
    caste?: string | null;
    subCaste?: string | null;
    nationality?: string | null;
    nri?: boolean | null;
    aadharNumber?: string | null;
    passportNumber?: string | null;
    placeOfBirth?: string | null;
    stateOfBirth?: string | null;
    nameAsPer10th?: string | null;

    disability?: boolean | null;
    disabilityType?: string | null;
    economicallyBackward?: boolean | null;
    fatherName?: string | null;
    fatherEmail?: string | null;
    fatherNumber?: string | null;
    fatherOccupation?: string | null;
    fatherQualification?: string | null;
    fatherPermanentAddress?: string | null;
    motherName?: string | null;
    motherEmail?: string | null;
    motherNumber?: string | null;
    motherOccupation?: string | null;
    motherQualification?: string | null;
    motherPermanentAddress?: string | null;
    guardianName?: string | null;
    guardianEmail?: string | null;
    guardianNumber?: string | null;
    guardianOccupation?: string | null;
    guardianPermanentAddress?: string | null;
    class10thSchoolName?: string | null;
    class10thSchoolCity?: string | null;
    class10thSchoolState?: string | null;
    class10thSchoolCode?: string | null;
    class10thSchoolType?: string | null;
    class10thYearOfPassing?: string | null;
    class10thMediumOfTeaching?: string | null;
    class10thAggregateScore?: number | null;
    class10thAggregateTotal?: number | null;
    hasClass12?: boolean | null;
    class12thInstituteName?: string | null;
    class12thInstituteCity?: string | null;
    class12thInstituteState?: string | null;
    class12thInstituteCode?: string | null;
    class12thInstituteType?: string | null;
    class12thYearOfPassing?: string | null;
    class12thBranch?: string | null;
    class12thMediumOfTeaching?: string | null;
    class12thAggregateScore?: number | null;
    class12thAggregateTotal?: number | null;
    hasDiploma?: boolean | null;
    diplomaInstituteName?: string | null;
    diplomaInstituteCity?: string | null;
    diplomaInstituteState?: string | null;
    diplomaInstituteCode?: string | null;
    diplomaInstituteType?: string | null;
    diplomaYearOfPassing?: string | null;
    diplomaBranch?: string | null;
    diplomaMediumOfTeaching?: string | null;
    diplomaAggregateScore?: number | null;
    diplomaAggregateTotal?: number | null;
    hostel?: boolean | null;
    hostelRoomNumber?: string | null;
    visaValidityDetails?: string | null;
    currentAddress?: string | null;
    currentArea?: string | null;
    currentCity?: string | null;
    currentDistrict?: string | null;
    currentState?: string | null;
    currentCountry?: string | null;
    currentPincode?: string | null;
    permanentAddress?: string | null;
    permanentArea?: string | null;
    permanentCity?: string | null;
    permanentDistrict?: string | null;
    permanentState?: string | null;
    permanentCountry?: string | null;
    permanentPincode?: string | null;
    aadharCard?: string | null;
    casteCertificate?: string | null;
    disabilityCertificate?: string | null;
    economicallyBackwardCertificate?: string | null;
    class10thMarksPdf?: string | null;
    class12thMarksPdf?: string | null;
    diplomaMarksPdf?: string | null;
    studyCertificate?: string | null;
    transferCertificate?: string | null;
    departmentId?: string;
    studentId?: string | null;
    semesterId?: string;
    createdAt?: string | Date;
    updatedAt?: string | Date;
  } | null;
};

const getInitials = (name?: string | null) => {
  if (!name) return "ST";

  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "ST";
  if (parts.length === 1) {
    return (parts[0] ?? "ST").slice(0, 2).toUpperCase();
  }

  const first = parts[0]?.[0] ?? "S";
  const second = parts[1]?.[0] ?? "T";
  return `${first}${second}`.toUpperCase();
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

export const AdminStudentActions = ({
  student,
  menuOnly = false,
}: {
  student: AdminStudentResponseType;
  menuOnly?: boolean;
}) => {
  const queryClient = useQueryClient();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const {
    data: details,
    isLoading: isLoadingDetails,
    isError: isDetailsError,
    error: detailsError,
  } = useQuery({
    queryKey: ["admin-student-details", student.id],
    queryFn: async () => {
      const response = await axios.get<{
        status: "success" | "error";
        data: AdminStudentDetailResponse;
      }>(`${NEXT_PUBLIC_API_BASE_URL}/admin/student/${student.id}`, {
        withCredentials: true,
      });

      return response.data.data;
    },
    enabled: isDetailsOpen,
    retry: 1,
  });

  useEffect(() => {
    if (!isDetailsOpen || !isDetailsError) {
      return;
    }

    const message =
      detailsError instanceof AxiosError
        ? detailsError.response?.data?.error || "Failed to load student details"
        : "Failed to load student details";

    toast.error(message);
  }, [detailsError, isDetailsError, isDetailsOpen]);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await axios.delete(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/student/${student.id}`,
        { withCredentials: true }
      );
    },
    onSuccess: () => {
      toast.success(`Student ${student.usn} deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      setIsDeleteOpen(false);
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      toast.error(error.response?.data?.error || "Failed to delete student");
    },
  });

  const fullCurrentAddress = [
    details?.admission?.currentAddress,
    details?.admission?.currentArea,
    details?.admission?.currentCity,
    details?.admission?.currentDistrict,
    details?.admission?.currentState,
    details?.admission?.currentCountry,
    details?.admission?.currentPincode,
  ]
    .filter(Boolean)
    .join(", ");

  const fullPermanentAddress = [
    details?.admission?.permanentAddress,
    details?.admission?.permanentArea,
    details?.admission?.permanentCity,
    details?.admission?.permanentDistrict,
    details?.admission?.permanentState,
    details?.admission?.permanentCountry,
    details?.admission?.permanentPincode,
  ]
    .filter(Boolean)
    .join(", ");

  if (menuOnly) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => setIsDeleteOpen(true)}
              className="text-red-600 focus:text-red-600"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Student</DialogTitle>
              <DialogDescription>
                Are you sure you want to permanently delete{" "}
                <strong>{student.usn}</strong> ({student.name ?? "Unnamed"})?
                This will remove the student profile, their user account, all
                section assignments, course registrations, and marks. This
                action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsDetailsOpen(true)}
      >
        <Eye className="mr-2 h-4 w-4" />
        View Details
      </Button>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-h-[92vh] w-full overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="px-8 pt-8">
            <DialogTitle className="text-left text-2xl">
              Student Details
            </DialogTitle>
            <DialogDescription>USN: {student.usn}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(92vh-8rem)] overflow-y-auto px-8 pb-8">
            {isLoadingDetails ? (
              <p className="text-muted-foreground py-6 text-sm">
                Loading student details...
              </p>
            ) : isDetailsError ? (
              <div className="bg-secondary/20 rounded-xl border p-6 text-center">
                <p className="text-muted-foreground text-sm">
                  We could not load student details right now. Please try again.
                </p>
              </div>
            ) : !details ? (
              <div className="bg-secondary/20 rounded-xl border p-6 text-center">
                <p className="text-muted-foreground text-sm">
                  No additional details are available for this student.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[18rem_1fr]">
                <div className="bg-card flex w-full flex-col items-center gap-4 rounded-xl border p-6 lg:w-72">
                  <Avatar className="h-28 w-28 border">
                    <AvatarImage
                      src={
                        details.user.image ||
                        details.admission?.photo ||
                        undefined
                      }
                      alt={details.user.name || "Student"}
                    />
                    <AvatarFallback className="text-xl font-semibold">
                      {getInitials(details.user.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="w-full space-y-3 text-center">
                    <p className="text-lg font-semibold">
                      {details.user.name || student.name || "-"}
                    </p>
                    <p className="text-muted-foreground break-all text-sm">
                      {details.user.email || student.email || "-"}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {details.admission?.primaryPhoneNumber || "-"}
                    </p>
                  </div>

                  <div className="w-full space-y-3 border-t pt-4">
                    <DataField label="USN" value={details.usn} />
                    <DataField
                      label="Name"
                      value={details.user.displayUsername || details.user.name}
                    />
                    <DataField
                      label="Department"
                      value={details.departmentName}
                    />
                    <DataField
                      label="Program Type"
                      value={details.programType}
                    />
                    <DataField
                      label="Current Semester"
                      value={details.currentSemester}
                    />
                    <DataField
                      label="Academic Term"
                      value={
                        details.academicTermLabel || details.academicTermYear
                      }
                    />
                    <DataField
                      label="Academic Year"
                      value={details.academicYear}
                    />
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-sm">
                        Admission Status
                      </p>
                      <Badge variant="outline">
                        {details.admission?.status || "Not Linked"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <section className="bg-card rounded-xl border p-6">
                    <h4 className="mb-4 text-lg font-semibold">
                      Account Details
                    </h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <DataField
                        label="Name"
                        value={
                          details.user.displayUsername || details.user.name
                        }
                      />
                      <DataField label="Email" value={details.user.email} />
                    </div>
                  </section>

                  {/* FIX: Subarno - Added a new section for personal and contact info from the admission snapshot */}

                  {/* <section className="bg-card rounded-xl border p-6">
                    <h4 className="mb-4 text-lg font-semibold">
                      Personal & Contact Info (Admissions)
                    </h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <DataField
                        label="First Name"
                        value={details.admission?.firstName}
                      />
                      <DataField
                        label="Middle Name"
                        value={details.admission?.middleName}
                      />
                      <DataField
                        label="Last Name"
                        value={details.admission?.lastName}
                      />
                      <DataField
                        label="Primary Phone"
                        value={details.admission?.primaryPhoneNumber}
                      />
                      <DataField
                        label="Secondary Phone"
                        value={details.admission?.secondaryPhoneNumber}
                      />
                      <DataField
                        label="Primary Email"
                        value={details.admission?.primaryEmail}
                      />
                    </div>
                  </section>

                  <section className="bg-card rounded-xl border p-6">
                    <h4 className="mb-4 text-lg font-semibold">
                      Admission Details
                    </h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <DataField
                        label="Application ID"
                        value={details.admission?.applicationId || "-"}
                      />
                      <DataField
                        label="Admission Mode"
                        value={details.admission?.modeOfAdmission || "-"}
                      />
                      <DataField
                        label="Admission Status"
                        value={details.admission?.status || "-"}
                      />
                      <DataField
                        label="Quota"
                        value={details.admission?.quota || "-"}
                      />
                      <DataField
                        label="Category Claimed"
                        value={details.admission?.categoryClaimed || "-"}
                      />
                      <DataField
                        label="Category Allotted"
                        value={details.admission?.categoryAllotted || "-"}
                      />
                    </div>
                    {!details.admission && (
                      <div className="bg-secondary/20 mt-4 rounded-lg border p-4">
                        <p className="text-muted-foreground text-sm">
                          This student does not currently have linked admission details.
                        </p>
                      </div>
                    )}
                  </section> */}

                  {/* FIX: Subarno - updated the (Personal & Contact info) and (Academic snapshot) sections */}

                  <section className="bg-card rounded-xl border p-6">
                    <h4 className="mb-4 text-lg font-semibold">
                      Core Admission Info
                    </h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <DataField
                        label="Application ID"
                        value={details.admission?.applicationId}
                      />
                      <DataField
                        label="Admission Mode"
                        value={details.admission?.modeOfAdmission}
                      />
                      <DataField
                        label="Admission Status"
                        value={details.admission?.status}
                      />
                      <DataField
                        label="Quota"
                        value={details.admission?.quota}
                      />
                      <DataField
                        label="Category Claimed"
                        value={details.admission?.categoryClaimed}
                      />
                      <DataField
                        label="Category Allotted"
                        value={details.admission?.categoryAllotted}
                      />
                      <DataField
                        label="Entrance Rank"
                        value={details.admission?.entranceExamRank}
                      />
                      <DataField
                        label="Temp USN"
                        value={details.admission?.tempUsn}
                      />
                      <DataField
                        label="Unique ID"
                        value={details.admission?.uniqueId}
                      />
                      <DataField
                        label="Fee Payable"
                        value={details.admission?.feePayable}
                      />
                      <DataField
                        label="Fee Paid"
                        value={details.admission?.feePaid}
                      />
                      <DataField
                        label="Original Order No."
                        value={details.admission?.originalAdmissionOrderNumber}
                      />
                      <DataField
                        label="Original Order Date"
                        value={details.admission?.originalAdmissionOrderDate}
                      />
                      <DataField
                        label="Visa Details"
                        value={details.admission?.visaValidityDetails}
                      />
                    </div>
                  </section>

                  <section className="bg-card rounded-xl border p-6">
                    <h4 className="mb-4 text-lg font-semibold">
                      Identity & Demographics
                    </h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <DataField
                        label="First Name"
                        value={details.admission?.firstName}
                      />
                      <DataField
                        label="Middle Name"
                        value={details.admission?.middleName}
                      />
                      <DataField
                        label="Last Name"
                        value={details.admission?.lastName}
                      />
                      <DataField
                        label="Name as per 10th"
                        value={details.admission?.nameAsPer10th}
                      />
                      <DataField
                        label="Gender"
                        value={details.admission?.gender}
                      />
                      <DataField
                        label="Date of Birth"
                        value={details.admission?.dob}
                      />
                      <DataField
                        label="Blood Group"
                        value={details.admission?.bloodGroup}
                      />
                      <DataField
                        label="Religion"
                        value={details.admission?.religion}
                      />
                      <DataField
                        label="Caste"
                        value={details.admission?.caste}
                      />
                      <DataField
                        label="Sub-Caste"
                        value={details.admission?.subCaste}
                      />
                      <DataField
                        label="Mother Tongue"
                        value={details.admission?.motherTongue}
                      />
                      <DataField
                        label="Nationality"
                        value={details.admission?.nationality}
                      />
                      <DataField
                        label="Aadhar Number"
                        value={details.admission?.aadharNumber}
                      />
                      <DataField
                        label="Passport Number"
                        value={details.admission?.passportNumber}
                      />
                      <DataField
                        label="Place of Birth"
                        value={details.admission?.placeOfBirth}
                      />
                      <DataField
                        label="State of Birth"
                        value={details.admission?.stateOfBirth}
                      />
                      <DataField
                        label="Disability"
                        value={details.admission?.disability}
                      />
                      <DataField
                        label="Disability Type"
                        value={details.admission?.disabilityType}
                      />
                      <DataField
                        label="Economically Backward"
                        value={details.admission?.economicallyBackward}
                      />
                    </div>
                  </section>

                  <section className="bg-card rounded-xl border p-6">
                    <h4 className="mb-4 text-lg font-semibold">
                      Contact Information
                    </h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <DataField
                        label="Primary Phone"
                        value={details.admission?.primaryPhoneNumber}
                      />
                      <DataField
                        label="Secondary Phone"
                        value={details.admission?.secondaryPhoneNumber}
                      />
                      <DataField
                        label="Emergency Contact"
                        value={details.admission?.emergencyContactNumber}
                      />
                      <DataField
                        label="Primary Email"
                        value={details.admission?.primaryEmail}
                      />
                      <DataField
                        label="Secondary Email"
                        value={details.admission?.secondaryEmail}
                      />
                    </div>
                  </section>

                  <section className="bg-card rounded-xl border p-6">
                    <h4 className="mb-4 text-lg font-semibold">
                      Family Details
                    </h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <DataField
                        label="Father's Name"
                        value={details.admission?.fatherName}
                      />
                      <DataField
                        label="Father's Phone"
                        value={details.admission?.fatherNumber}
                      />
                      <DataField
                        label="Father's Occupation"
                        value={details.admission?.fatherOccupation}
                      />
                      <DataField
                        label="Father's Qualification"
                        value={details.admission?.fatherQualification}
                      />
                      <DataField
                        label="Father's Perm. Address"
                        value={details.admission?.fatherPermanentAddress}
                      />
                      <div className="my-2 border-t md:col-span-3" />
                      <DataField
                        label="Mother's Name"
                        value={details.admission?.motherName}
                      />
                      <DataField
                        label="Mother's Phone"
                        value={details.admission?.motherNumber}
                      />
                      <DataField
                        label="Mother's Occupation"
                        value={details.admission?.motherOccupation}
                      />
                      <DataField
                        label="Mother's Qualification"
                        value={details.admission?.motherQualification}
                      />
                      <DataField
                        label="Mother's Perm. Address"
                        value={details.admission?.motherPermanentAddress}
                      />
                      <div className="my-2 border-t md:col-span-3" />
                      <DataField
                        label="Guardian Name"
                        value={details.admission?.guardianName}
                      />
                      <DataField
                        label="Guardian Phone"
                        value={details.admission?.guardianNumber}
                      />
                      <DataField
                        label="Guardian Occupation"
                        value={details.admission?.guardianOccupation}
                      />
                      <DataField
                        label="Guardian's Perm. Address"
                        value={details.admission?.guardianPermanentAddress}
                      />
                    </div>
                  </section>

                  <section className="bg-card rounded-xl border p-6">
                    <h4 className="mb-4 text-lg font-semibold">
                      Academic Background
                    </h4>
                    <div className="space-y-6">
                      <div>
                        <h5 className="text-muted-foreground mb-3 text-sm font-semibold">
                          Class 10th
                        </h5>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                          <DataField
                            label="School Name"
                            value={details.admission?.class10thSchoolName}
                          />
                          <DataField
                            label="School Type"
                            value={details.admission?.class10thSchoolType}
                          />
                          <DataField
                            label="School City"
                            value={details.admission?.class10thSchoolCity}
                          />
                          <DataField
                            label="School State"
                            value={details.admission?.class10thSchoolState}
                          />
                          <DataField
                            label="School Code"
                            value={details.admission?.class10thSchoolCode}
                          />
                          <DataField
                            label="Passing Year"
                            value={details.admission?.class10thYearOfPassing}
                          />
                          <DataField
                            label="Medium of Teaching"
                            value={details.admission?.class10thMediumOfTeaching}
                          />
                          <DataField
                            label="Score"
                            value={details.admission?.class10thAggregateScore}
                          />
                          <DataField
                            label="Total"
                            value={details.admission?.class10thAggregateTotal}
                          />
                        </div>
                      </div>

                      {details.admission?.hasClass12 && (
                        <div>
                          <h5 className="text-muted-foreground mb-3 border-t pt-4 text-sm font-semibold">
                            Class 12th
                          </h5>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                            <DataField
                              label="Institute Name"
                              value={details.admission?.class12thInstituteName}
                            />
                            <DataField
                              label="Institute Type"
                              value={details.admission?.class12thInstituteType}
                            />
                            <DataField
                              label="Institute City"
                              value={details.admission?.class12thInstituteCity}
                            />
                            <DataField
                              label="Institute State"
                              value={details.admission?.class12thInstituteState}
                            />
                            <DataField
                              label="Institute Code"
                              value={details.admission?.class12thInstituteCode}
                            />
                            <DataField
                              label="Branch"
                              value={details.admission?.class12thBranch}
                            />
                            <DataField
                              label="Passing Year"
                              value={details.admission?.class12thYearOfPassing}
                            />
                            <DataField
                              label="Medium of Teaching"
                              value={
                                details.admission?.class12thMediumOfTeaching
                              }
                            />
                            <DataField
                              label="Score"
                              value={details.admission?.class12thAggregateScore}
                            />
                            <DataField
                              label="Total"
                              value={details.admission?.class12thAggregateTotal}
                            />
                          </div>
                        </div>
                      )}

                      {details.admission?.hasDiploma && (
                        <div>
                          <h5 className="text-muted-foreground mb-3 border-t pt-4 text-sm font-semibold">
                            Diploma
                          </h5>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                            <DataField
                              label="Institute Name"
                              value={details.admission?.diplomaInstituteName}
                            />
                            <DataField
                              label="Institute Type"
                              value={details.admission?.diplomaInstituteType}
                            />
                            <DataField
                              label="Institute City"
                              value={details.admission?.diplomaInstituteCity}
                            />
                            <DataField
                              label="Institute State"
                              value={details.admission?.diplomaInstituteState}
                            />
                            <DataField
                              label="Institute Code"
                              value={details.admission?.diplomaInstituteCode}
                            />
                            <DataField
                              label="Branch"
                              value={details.admission?.diplomaBranch}
                            />
                            <DataField
                              label="Passing Year"
                              value={details.admission?.diplomaYearOfPassing}
                            />
                            <DataField
                              label="Medium of Teaching"
                              value={details.admission?.diplomaMediumOfTeaching}
                            />
                            <DataField
                              label="Score"
                              value={details.admission?.diplomaAggregateScore}
                            />
                            <DataField
                              label="Total"
                              value={details.admission?.diplomaAggregateTotal}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="bg-card rounded-xl border p-6">
                    <h4 className="mb-4 text-lg font-semibold">
                      Hostel Details
                    </h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <DataField
                        label="Hostel Required"
                        value={details.admission?.hostel}
                      />
                      <DataField
                        label="Room Number"
                        value={details.admission?.hostelRoomNumber}
                      />
                    </div>
                  </section>

                  <section className="bg-card rounded-xl border p-6">
                    <h4 className="mb-4 text-lg font-semibold">
                      Documents & Certificates (Links)
                    </h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <DataField
                        label="Aadhar Card"
                        value={details.admission?.aadharCard}
                      />
                      <DataField
                        label="Caste Certificate"
                        value={details.admission?.casteCertificate}
                      />
                      <DataField
                        label="Disability Cert."
                        value={details.admission?.disabilityCertificate}
                      />
                      <DataField
                        label="EWS Certificate"
                        value={
                          details.admission?.economicallyBackwardCertificate
                        }
                      />
                      <DataField
                        label="10th Marks PDF"
                        value={details.admission?.class10thMarksPdf}
                      />
                      <DataField
                        label="12th Marks PDF"
                        value={details.admission?.class12thMarksPdf}
                      />
                      <DataField
                        label="Diploma Marks PDF"
                        value={details.admission?.diplomaMarksPdf}
                      />
                      <DataField
                        label="Study Certificate"
                        value={details.admission?.studyCertificate}
                      />
                      <DataField
                        label="Transfer Certificate"
                        value={details.admission?.transferCertificate}
                      />
                    </div>
                  </section>

                  <section className="bg-card rounded-xl border p-6">
                    <h4 className="mb-4 text-lg font-semibold">
                      Academic Context
                    </h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <DataField
                        label="Academic Term"
                        value={
                          details.academicTermLabel || details.academicTermYear
                        }
                      />
                      <DataField
                        label="Program Type"
                        value={details.programType}
                      />
                      <DataField
                        label="Semester"
                        value={
                          details.currentSemester
                            ? `Semester ${details.currentSemester}`
                            : null
                        }
                      />
                      <DataField
                        label="Semester ID"
                        value={details.semesterId}
                      />
                    </div>
                  </section>

                  <section className="bg-card rounded-xl border p-6">
                    <h4 className="mb-4 text-lg font-semibold">Address</h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <DataField
                        label="Current Address"
                        value={fullCurrentAddress}
                      />
                      <DataField
                        label="Permanent Address"
                        value={fullPermanentAddress}
                      />
                    </div>
                  </section>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
