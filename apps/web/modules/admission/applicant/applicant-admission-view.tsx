"use client";

import { useAdmissionDepartments } from "@/lib/use-departments";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  admissionModes,
  admissionTypes,
  categoriesAllotted,
  categoriesClaimed,
  quotas,
} from "@webcampus/schemas/constants";
import { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import { Checkbox } from "@webcampus/ui/components/checkbox";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";
import { PhoneNumberInput } from "@webcampus/ui/components/phone-input";
import { Progress } from "@webcampus/ui/components/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import { Tabs, TabsList, TabsTrigger } from "@webcampus/ui/components/tabs";
import axios, { isAxiosError } from "axios";
import { City, Country, State } from "country-state-city";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

type ApplicantAdmissionData = {
  applicationId: string;
  modeOfAdmission: string;
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED";
  department?: { id: string; name: string };
  firstName?: string;
  middleName?: string;
  lastName?: string;
  categoryClaimed?: string;
  categoryAllotted?: string;
  quota?: string;
  primaryEmail: string;
  filledBy?: { name: string; email: string; role?: string | null } | null;
  admissionType?: string | null;
  scholarship?: boolean | null;
  sspId?: string | null;
  abcAparId?: string | null;
  counsellingRound?: string | null;
  feeReceiptNumber?: string | null;
  dateOfAdmission?: string | null;
  studiedKannadaIn10th?: boolean | null;
  passportNumber?: string | null;
  passportExpiryDate?: string | null;
  visaNumber?: string | null;
  visaExpiryDate?: string | null;
  parentPassportNumber?: string | null;
  parentVisaNumber?: string | null;
  parentVisaExpiryDate?: string | null;
  placeOfBirth?: string | null;
  stateOfBirth?: string | null;
  semester?: {
    id: string;
    semesterNumber: number;
    programType: string;
    academicTerm: {
      type: string;
      year: string;
    };
  };
};

type StepKey = "admission" | "personal" | "education" | "parent" | "review";

const EMPTY_ADMISSION: ApplicantAdmissionData = {
  applicationId: "",
  modeOfAdmission: "KCET",
  status: "PENDING",
  primaryEmail: "",
};

const STEP_ORDER: StepKey[] = [
  "admission",
  "personal",
  "education",
  "parent",
  "review",
];

const STEP_LABELS: Record<StepKey, string> = {
  admission: "Admission Details",
  personal: "Personal Information",
  education: "Education Details",
  parent: "Parent / Guardian Details",
  review: "Review",
};

const VISIBLE_STEPS: StepKey[] = [
  "admission",
  "personal",
  "education",
  "parent",
];

export const ApplicantAdmissionView = ({
  staffMode = false,
}: {
  staffMode?: boolean;
}) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSameAddress, setIsSameAddress] = useState(false);
  const [activeStep, setActiveStep] = useState<StepKey>("admission");
  const [hostelEnabled, setHostelEnabled] = useState(false);
  const [nriEnabled, setNriEnabled] = useState(false);
  const [disabilityEnabled, setDisabilityEnabled] = useState(false);
  const [fatherAddressSource, setFatherAddressSource] = useState<
    "current" | "permanent" | "custom"
  >("current");

  const [motherAddressSource, setMotherAddressSource] = useState<
    "current" | "permanent" | "custom"
  >("current");

  const [guardianAddressSource, setGuardianAddressSource] = useState<
    "current" | "permanent" | "custom"
  >("current");
  const [currentCountry, setCurrentCountry] = useState("IN");
  const [currentState, setCurrentState] = useState("");
  const [currentDistrict, setCurrentDistrict] = useState("");

  const [currentAddress, setCurrentAddress] = useState("");
  const [currentArea, setCurrentArea] = useState("");
  const [currentPincode, setCurrentPincode] = useState("");

  const [permanentCountry, setPermanentCountry] = useState("IN");
  const [permanentState, setPermanentState] = useState("");
  const [permanentDistrict, setPermanentDistrict] = useState("");

  const [permanentAddress, setPermanentAddress] = useState("");
  const [permanentArea, setPermanentArea] = useState("");
  const [permanentPincode, setPermanentPincode] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  const [fatherPhone, setFatherPhone] = useState("");
  const [motherPhone, setMotherPhone] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [selectedAdmissionType, setSelectedAdmissionType] = useState("");
  const [admissionBasedOn, setAdmissionBasedOn] = useState("");
  const [scholarshipEnabled, setScholarshipEnabled] = useState(false);
  const [studiedKannadaEnabled, setStudiedKannadaEnabled] = useState(false);
  const [economicallyBackwardEnabled, setEconomicallyBackwardEnabled] =
    useState(false);
  const [class12Enabled, setClass12Enabled] = useState(true);
  const [diplomaEnabled, setDiplomaEnabled] = useState(false);
  const [reviewPdfUrl, setReviewPdfUrl] = useState<string | null>(null);
  const reviewPdfRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const sectionRefs = useRef<Record<StepKey, HTMLDivElement | null>>({
    admission: null,
    personal: null,
    education: null,
    parent: null,
    review: null,
  });
  const [birthState, setBirthState] = useState("");
  const [domicileState, setDomicileState] = useState("");
  // Class 10
  const [class10State, setClass10State] = useState("");
  const [class10City, setClass10City] = useState("");
  const [class10Country, setClass10Country] = useState("IN");

  // Class 12
  const [class12State, setClass12State] = useState("");
  const [class12City, setClass12City] = useState("");
  const [class12Country, setClass12Country] = useState("IN");

  const [pcmMarks, setPcmMarks] = useState({
    physicsMarks: "",
    physicsMaxMarks: "",
    physicsMinMarks: "",
    chemistryMarks: "",
    chemistryMaxMarks: "",
    chemistryMinMarks: "",
    mathematicsMarks: "",
    mathematicsMaxMarks: "",
    mathematicsMinMarks: "",
  });

  // Diploma
  const [diplomaState, setDiplomaState] = useState("");
  const [diplomaCity, setDiplomaCity] = useState("");
  const [diplomaCountry, setDiplomaCountry] = useState("IN");

  const [selectedMode, setSelectedMode] =
    useState<keyof typeof categoriesClaimed>("KCET");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedQuota, setSelectedQuota] = useState("");
  const [staffPrimaryEmail, setStaffPrimaryEmail] = useState("");
  const [staffSemesterId, setStaffSemesterId] = useState("");
  const { data: departments } = useAdmissionDepartments();
  const { data: academicTermsData } = useAcademicTerms(undefined, {
    enabled: staffMode,
  });
  const academicTerms = academicTermsData ?? [];
  const staffSemesterOptions = academicTerms.flatMap((term) =>
    (term.Semester ?? []).map((semester) => ({
      ...semester,
      termLabel: `${term.type} ${term.year}`,
    }))
  );
  const selectedStaffSemester = staffSemesterOptions.find(
    (semester) => semester.id === staffSemesterId
  );

  const updatePcmMark = (field: keyof typeof pcmMarks, value: string) => {
    setPcmMarks((current) => ({ ...current, [field]: value }));
  };

  const percentage = (marks: string, maxMarks: string) => {
    const marksValue = Number(marks);
    const maxMarksValue = Number(maxMarks);
    if (!marks || !maxMarks || maxMarksValue <= 0) return "";
    return ((marksValue / maxMarksValue) * 100).toFixed(2);
  };

  const pcmPercentage = (() => {
    const marks = [
      pcmMarks.physicsMarks,
      pcmMarks.chemistryMarks,
      pcmMarks.mathematicsMarks,
    ];
    const maxMarks = [
      pcmMarks.physicsMaxMarks,
      pcmMarks.chemistryMaxMarks,
      pcmMarks.mathematicsMaxMarks,
    ];
    if (marks.some((value) => !value) || maxMarks.some((value) => !value)) {
      return "";
    }
    const totalMarks = marks.reduce((sum, value) => sum + Number(value), 0);
    const totalMaxMarks = maxMarks.reduce(
      (sum, value) => sum + Number(value),
      0
    );
    return totalMaxMarks > 0
      ? ((totalMarks / totalMaxMarks) * 100).toFixed(2)
      : "";
  })();

  // Fetch the applicant's existing shell
  const {
    data: fetchedAdmission,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admission-me"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<ApplicantAdmissionData>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admission/me`,
        { withCredentials: true }
      );
      if (res.data.status === "success") return res.data.data;
      return null;
    },
    enabled: !staffMode,
    retry: false,
  });
  const admission = fetchedAdmission ?? EMPTY_ADMISSION;
  console.log("Admission:", admission);
  console.log("Primary Email:", admission?.primaryEmail);

  const fullName = [
    admission?.firstName,
    admission?.middleName,
    admission?.lastName,
  ]
    .filter(Boolean)
    .join(" ");
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    if (!class12Enabled && !diplomaEnabled) {
      toast.error("Please fill either Class 12 / PUC or Diploma details.");
      return;
    }

    setIsSubmitting(true);

    formData.set("hostel", hostelEnabled ? "true" : "false");
    formData.set("nri", nriEnabled ? "true" : "false");
    formData.set("disability", disabilityEnabled ? "true" : "false");
    formData.set(
      "economicallyBackward",
      economicallyBackwardEnabled ? "true" : "false"
    );
    formData.set("hasClass12", class12Enabled ? "true" : "false");
    formData.set("hasDiploma", diplomaEnabled ? "true" : "false");
    for (const [key, value] of formData.entries()) {
      console.log(key, value);
    }
    try {
      await axios({
        method: staffMode ? "post" : "put",
        url: `${NEXT_PUBLIC_API_BASE_URL}/admission/${staffMode ? "admission-submit" : "submit"}`,
        data: formData,
        withCredentials: true,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success("Application submitted successfully!");
      if (!staffMode) refetch();
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        toast.error(
          error.response?.data?.message || "Failed to submit application"
        );
      } else {
        toast.error("Failed to submit application");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeIndex = STEP_ORDER.indexOf(activeStep);
  const progressValue = ((activeIndex + 1) / STEP_ORDER.length) * 100;

  const validateStep = (step: StepKey) => {
    const section = sectionRefs.current[step];

    if (!section) return true;

    const fields = Array.from(
      section.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input, select, textarea")
    );

    // Validate normal fields only
    for (const field of fields) {
      if (field instanceof HTMLInputElement && field.type === "file") {
        continue;
      }

      if (!field.checkValidity()) {
        field.reportValidity();
        field.focus();
        return false;
      }
    }

    return true;
  };
  const saveAndNext = (step: StepKey) => {
    if (!validateStep(step)) {
      return;
    }

    const nextIndex = STEP_ORDER.indexOf(step) + 1;

    const nextStep = STEP_ORDER[
      Math.min(nextIndex, STEP_ORDER.length - 1)
    ] as StepKey;
    const form = formRef.current;

    if (form) {
      const fd = new FormData(form);

      console.log("====== FORM DATA ======");
      for (const [k, v] of fd.entries()) {
        console.log(k, v);
      }
    }
    setActiveStep(nextStep);
  };

  const goBack = (step: StepKey) => {
    const nextIndex = STEP_ORDER.indexOf(step) - 1;
    const previousStep = STEP_ORDER[Math.max(nextIndex, 0)] as StepKey;
    setActiveStep(previousStep);
  };

  const formatReviewKey = (key: string) =>
    key
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const formatReviewValue = (key: string, value: FormDataEntryValue | null) => {
    if (value === null) {
      return "-";
    }

    if (value instanceof File) {
      return value.name || "Attached file";
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return "-";
    }

    if (
      [
        "hostel",
        "nri",
        "disability",
        "economicallyBackward",
        "hasClass12",
        "hasDiploma",
      ].includes(key)
    ) {
      return trimmed === "true" ? "Yes" : "No";
    }

    return trimmed;
  };
  type JsPDFWithAutoTable = jsPDF & {
    lastAutoTable?: {
      finalY: number;
    };
  };

  const generateReviewPdf = () => {
    if (!formRef.current) return null;

    if (reviewPdfRef.current) {
      URL.revokeObjectURL(reviewPdfRef.current);
      reviewPdfRef.current = null;
    }

    const formData = new FormData(formRef.current);

    const doc = new jsPDF({
      orientation: "p",
      unit: "pt",
      format: "a4",
    });

    const pdf = doc as JsPDFWithAutoTable;

    const margin = 40;
    let cursorY = 44;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Application Review Summary", margin, cursorY);

    cursorY += 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleString()}`, margin, cursorY);

    cursorY += 20;

    const get = (key: string) => formatReviewValue(key, formData.get(key));

    const reviewSections = [
      {
        title: "Admission Details",
        fields: [
          "applicationId",
          "modeOfAdmission",
          "admissionType",
          "admissionBasedOn",
          "semesterId",
          "counsellingRound",
          "abcAparId",
          "feeReceiptNumber",
          "scholarship",
          "sspId",
          "firstName",
          "middleName",
          "lastName",
          "departmentId",
          "categoryClaimed",
          "categoryAllotted",
          "quota",
          "entranceExamRank",
          "originalAdmissionOrderNumber",
          "originalAdmissionOrderDate",
          "feePaid",
          "hostel",
          "hostelRoomNumber",
        ],
      },
      {
        title: "Personal Information",
        fields: [
          "nameAsPer10th",
          "dob",
          "bloodGroup",
          "gender",
          "primaryPhoneNumber",
          "secondaryPhoneNumber",
          "emergencyContactNumber",
          "primaryEmail",
          "secondaryEmail",
          "currentAddress",
          "currentArea",
          "currentDistrict",
          "currentState",
          "currentCountry",
          "currentPincode",
          "permanentAddress",
          "permanentArea",
          "permanentDistrict",
          "permanentState",
          "permanentCountry",
          "permanentPincode",
          "placeOfBirth",
          "stateOfBirth",
          "religion",
          "caste",
          "subCaste",
          "motherTongue",
          "nationality",
          "nri",
          "disability",
          "disabilityType",
          "economicallyBackward",
          "aadharNumber",
          "passportNumber",
          "passportExpiryDate",
          "visaNumber",
          "visaExpiryDate",
        ],
      },
      {
        title: "Education Details",
        fields: [
          "class10thSchoolName",
          "class10thRollRegNumber",
          "class10thSchoolType",
          "schoolCountry",
          "class10thSchoolCity",
          "class10thSchoolState",
          "class10thYearOfPassing",
          "class10thAggregateScore",
          "class10thAggregateTotal",
          "class10thMediumOfTeaching",
          "studiedKannadaIn10th",

          "hasClass12",
          "class12thInstituteName",
          "class12thRollRegNumber",
          "class12thInstituteType",
          "instituteCountry",
          "class12thInstituteCity",
          "class12thInstituteState",
          "class12thYearOfPassing",
          "class12thBranch",
          "class12thMediumOfTeaching",
          "class12thAggregateScore",
          "class12thAggregateTotal",
          "physicsMarks",
          "physicsMaxMarks",
          "physicsMinMarks",
          "physicsPercentage",
          "chemistryMarks",
          "chemistryMaxMarks",
          "chemistryMinMarks",
          "chemistryPercentage",
          "mathematicsMarks",
          "mathematicsMaxMarks",
          "mathematicsMinMarks",
          "mathematicsPercentage",
          "pcmPercentage",

          "hasDiploma",
          "diplomaInstituteName",
          "diplomaInstituteType",
          "diplomaCountry",
          "diplomaInstituteCity",
          "diplomaInstituteState",
          "diplomaYearOfPassing",
          "diplomaBranch",
          "diplomaMediumOfTeaching",
          "diplomaAggregateScore",
          "diplomaAggregateTotal",
        ],
      },
      {
        title: "Parent / Guardian Details",
        fields: [
          "fatherName",
          "fatherEmail",
          "fatherNumber",
          "fatherOccupation",
          "fatherPermanentAddress",
          "parentPassportNumber",
          "parentVisaNumber",
          "parentVisaExpiryDate",

          "motherName",
          "motherEmail",
          "motherNumber",
          "motherOccupation",
          "motherPermanentAddress",

          "guardianName",
          "guardianEmail",
          "guardianNumber",
          "guardianOccupation",
          "guardianPermanentAddress",
        ],
      },
    ];

    for (const section of reviewSections) {
      const body = section.fields.map((field) => [
        formatReviewKey(field),
        get(field),
      ]);

      doc.setFont("helvetica", "bold");
      doc.text(section.title, margin, cursorY);

      cursorY += 8;

      autoTable(doc, {
        startY: cursorY,
        head: [["Field", "Value"]],
        body,
        theme: "grid",
        styles: {
          fontSize: 8,
          cellPadding: 3,
          overflow: "linebreak",
          valign: "top",
        },
        headStyles: {
          fillColor: [55, 65, 81],
          textColor: 255,
          fontStyle: "bold",
        },
        margin: {
          left: margin,
          right: margin,
        },
        columnStyles: {
          0: { cellWidth: 170 },
          1: { cellWidth: 325 },
        },
      });

      cursorY = (pdf.lastAutoTable?.finalY ?? cursorY) + 18;
    }

    const blob = doc.output("blob");

    const url = URL.createObjectURL(blob);

    reviewPdfRef.current = url;
    setReviewPdfUrl(url);

    return url;
  };

  const handleReviewStep = () => {
    if (!validateStep("parent")) {
      return;
    }

    if (!class12Enabled && !diplomaEnabled) {
      toast.error("Please fill either Class 12 / PUC or Diploma details.");
      return;
    }

    const nextUrl = generateReviewPdf();
    if (!nextUrl) {
      return;
    }

    setActiveStep("review");
  };

  const handleTabChange = (nextStep: StepKey) => {
    const currentIndex = STEP_ORDER.indexOf(activeStep);
    const nextIndex = STEP_ORDER.indexOf(nextStep);

    if (nextIndex > currentIndex && !validateStep(activeStep)) {
      return;
    }

    setActiveStep(nextStep);
  };

  useEffect(() => {
    return () => {
      if (reviewPdfRef.current) {
        URL.revokeObjectURL(reviewPdfRef.current);
      }
    };
  }, []);

  const getAddress = (type: "current" | "permanent") => {
    if (type === "current") {
      return [
        currentAddress,
        currentArea,
        currentDistrict,
        currentState,
        currentCountry,
        currentPincode,
      ]
        .filter(Boolean)
        .join(", ");
    }

    return [
      permanentAddress,
      permanentArea,
      permanentDistrict,
      permanentState,
      permanentCountry,
      permanentPincode,
    ]
      .filter(Boolean)
      .join(", ");
  };

  const handleSameAsCurrentAddress = (checked: boolean) => {
    setIsSameAddress(checked);
  };
  useEffect(() => {
    if (admission?.department?.id) {
      setSelectedDepartment(admission.department.id);
    }

    if (admission?.modeOfAdmission) {
      setSelectedMode(
        admission.modeOfAdmission as keyof typeof categoriesClaimed
      );
    }

    if (admission?.admissionType) {
      setSelectedAdmissionType(admission.admissionType);
    }

    if (admission?.scholarship != null) {
      setScholarshipEnabled(admission.scholarship);
    }

    if (admission?.studiedKannadaIn10th != null) {
      setStudiedKannadaEnabled(admission.studiedKannadaIn10th);
    }
  }, [admission]);

  useEffect(() => {
    if (selectedMode !== "KCET") {
      setSelectedQuota("");
    }
  }, [selectedMode]);

  useEffect(() => {
    if (!isSameAddress) return;

    setPermanentCountry(currentCountry);
    setPermanentState(currentState);
    setPermanentDistrict(currentDistrict);

    setPermanentAddress(currentAddress);
    setPermanentArea(currentArea);
    setPermanentPincode(currentPincode);
  }, [
    isSameAddress,
    currentCountry,
    currentState,
    currentDistrict,
    currentAddress,
    currentArea,
    currentPincode,
  ]);

  const countries = Country.getAllCountries();

  const currentStates = State.getStatesOfCountry(currentCountry);

  const currentDistricts = City.getCitiesOfState(currentCountry, currentState);
  const permanentStates = State.getStatesOfCountry(permanentCountry);

  const permanentDistricts = City.getCitiesOfState(
    permanentCountry,
    permanentState
  );
  const birthStates = State.getStatesOfCountry("IN");

  const educationStates = State.getStatesOfCountry("IN");

  useEffect(() => {
    const placeOfBirthState = birthStates.find(
      (state) => state.name === admission?.placeOfBirth
    );
    const domicileStateOption = birthStates.find(
      (state) => state.name === admission?.stateOfBirth
    );

    if (placeOfBirthState) setBirthState(placeOfBirthState.isoCode);
    if (domicileStateOption) setDomicileState(domicileStateOption.isoCode);
  }, [admission, birthStates]);

  const semesterNumber = staffMode
    ? selectedStaffSemester?.semesterNumber
    : admission?.semester?.semesterNumber;
  const validAdmissionTypes =
    semesterNumber === 1
      ? admissionTypes.filter((type) => type.value === "REGULAR")
      : semesterNumber === 3
        ? admissionTypes.filter((type) => type.value !== "REGULAR")
        : [];

  const class10Cities = City.getCitiesOfState("IN", class10State);
  const class12Cities = City.getCitiesOfState("IN", class12State);
  const diplomaCities = City.getCitiesOfState("IN", diplomaState);

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <p className="text-muted-foreground animate-pulse">
          Loading your application profile...
        </p>
      </div>
    );
  }

  if (error) {
    const errorMessage = isAxiosError(error)
      ? error.response?.data?.message || error.message
      : "An unexpected error occurred";
    return (
      <div className="border-destructive bg-destructive/10 text-destructive rounded-lg border p-6 text-center">
        <h3 className="text-lg font-bold">Failed to load application</h3>
        <p className="mt-2 text-sm">{errorMessage}</p>
      </div>
    );
  }

  if (!staffMode && !fetchedAdmission) {
    return <div className="p-6 text-center">No admission profile found.</div>;
  }
  if (!staffMode && admission.status !== "PENDING") {
    return (
      <div className="bg-secondary/20 flex flex-col items-center justify-center rounded-lg border p-12 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          Application Submitted!
        </h2>
        <p className="text-muted-foreground mt-2">
          Your application (ID: {admission.applicationId}) is currently under
          review by the administration.
        </p>
        {admission.dateOfAdmission && (
          <p className="text-muted-foreground mt-2 text-sm">
            Date of admission:{" "}
            {new Date(admission.dateOfAdmission).toLocaleDateString()}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="bg-card rounded-lg border p-6 shadow-sm">
      <div className="mb-6 space-y-4">
        <div>
          <h3 className="text-lg font-medium">Complete Your Application</h3>
        </div>

        <Tabs
          value={activeStep}
          onValueChange={(value) => handleTabChange(value as StepKey)}
          className="space-y-4"
        >
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 p-1 md:grid-cols-4">
            {VISIBLE_STEPS.map((step) => (
              <TabsTrigger
                key={step}
                value={step}
                className="text-xs md:text-sm"
              >
                {STEP_LABELS[step]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="space-y-2">
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>Progress</span>
            <span>{Math.round(progressValue)}%</span>
          </div>
          <Progress value={progressValue} />
        </div>
      </div>

      <form
        ref={formRef}
        noValidate
        onSubmit={handleSubmit}
        className="space-y-10"
      >
        {/* ADMISSION DETAILS */}
        <div
          ref={(node) => {
            sectionRefs.current.admission = node;
          }}
          className={
            activeStep === "admission" ? "space-y-6" : "hidden space-y-6"
          }
        >
          <div className="border-b pb-2">
            <h3 className="text-xl font-semibold tracking-tight">
              1. Admission Details
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="applicationId">Application ID *</Label>

              <Input id="applicationId" name="applicationId" required />
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="modeOfAdmission">Mode of Admission *</Label>
              <Select
                name="modeOfAdmission"
                value={selectedMode}
                onValueChange={(val) =>
                  setSelectedMode(val as keyof typeof categoriesClaimed)
                }
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  {admissionModes.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {mode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="firstName">First Name *</Label>

              <Input
                id="firstName"
                name="firstName"
                defaultValue={admission.firstName ?? ""}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="middleName">Middle Name</Label>

              <Input
                id="middleName"
                name="middleName"
                defaultValue={admission.middleName ?? ""}
              />
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="lastName">Last Name *</Label>

              <Input
                id="lastName"
                name="lastName"
                defaultValue={admission.lastName ?? ""}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="departmentId">Branch *</Label>
              <Select
                name="departmentId"
                value={selectedDepartment}
                onValueChange={setSelectedDepartment}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {departments?.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="admissionType">Admission Type *</Label>
              <Select
                name="admissionType"
                value={selectedAdmissionType}
                onValueChange={setSelectedAdmissionType}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select admission type" />
                </SelectTrigger>
                <SelectContent>
                  {validAdmissionTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="admissionBasedOn">Admission Based On *</Label>
              <Select
                name="admissionBasedOn"
                value={admissionBasedOn}
                onValueChange={setAdmissionBasedOn}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select qualification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLASS_12_PUC">Class 12th / PUC</SelectItem>
                  <SelectItem value="DIPLOMA">Diploma</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="semesterDisplay">Semester *</Label>
              {staffMode ? (
                <Select
                  value={staffSemesterId}
                  onValueChange={(value) => {
                    setStaffSemesterId(value);
                    setSelectedAdmissionType("");
                  }}
                  required
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffSemesterOptions.map((semester) => (
                      <SelectItem key={semester.id} value={semester.id}>
                        {semester.termLabel} - {semester.programType} Semester{" "}
                        {semester.semesterNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="semesterDisplay"
                  value={
                    admission.semester
                      ? `${admission.semester.programType} Semester ${admission.semester.semesterNumber}`
                      : ""
                  }
                  readOnly
                />
              )}
              <input
                type="hidden"
                name="semesterId"
                value={
                  staffMode ? staffSemesterId : (admission.semester?.id ?? "")
                }
                required
              />
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="termDisplay">Admission Term</Label>
              <Input
                id="termDisplay"
                value={
                  staffMode
                    ? (selectedStaffSemester?.termLabel ?? "")
                    : admission.semester?.academicTerm
                      ? `${admission.semester.academicTerm.type} ${admission.semester.academicTerm.year}`
                      : ""
                }
                readOnly
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="categoryClaimed">Category Claimed *</Label>
              <Select name="categoryClaimed" required>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {(categoriesClaimed[selectedMode] ?? []).map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="categoryAllotted">Category Allotted *</Label>
              <Select name="categoryAllotted" required>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {(categoriesAllotted[selectedMode] ?? []).map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedMode === "KCET" ? (
              <div className="space-y-2 md:col-span-4">
                <Label htmlFor="quota">Quota *</Label>
                <Select
                  name="quota"
                  value={selectedQuota}
                  onValueChange={setSelectedQuota}
                  required
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select quota" />
                  </SelectTrigger>
                  <SelectContent>
                    {quotas.map((quota) => (
                      <SelectItem key={quota} value={quota}>
                        {quota}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2 md:col-span-4" />
            )}

            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="entranceExamRank">Entrance Exam Rank *</Label>
              <Input
                id="entranceExamRank"
                name="entranceExamRank"
                type="number"
                required
              />
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="originalAdmissionOrderNumber">
                Original Admission Order No. *
              </Label>
              <Input
                id="originalAdmissionOrderNumber"
                name="originalAdmissionOrderNumber"
                required
              />
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="originalAdmissionOrderDate">
                Original Admission Order Date *
              </Label>
              <Input
                id="originalAdmissionOrderDate"
                name="originalAdmissionOrderDate"
                type="date"
                required
              />
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="counsellingRound">Counselling Round</Label>
              <Input
                id="counsellingRound"
                name="counsellingRound"
                defaultValue={admission.counsellingRound ?? ""}
              />
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="abcAparId">ABC/APAAR ID</Label>
              <Input
                id="abcAparId"
                name="abcAparId"
                defaultValue={admission.abcAparId ?? ""}
              />
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="feeReceiptNumber">Fee Receipt No.</Label>
              <Input
                id="feeReceiptNumber"
                name="feeReceiptNumber"
                defaultValue={admission.feeReceiptNumber ?? ""}
              />
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="scholarship">Scholarship *</Label>
              <input
                type="hidden"
                name="scholarship"
                value={scholarshipEnabled ? "true" : "false"}
              />
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Checkbox
                  id="scholarship"
                  checked={scholarshipEnabled}
                  onCheckedChange={(checked) =>
                    setScholarshipEnabled(Boolean(checked))
                  }
                />
                <Label htmlFor="scholarship" className="cursor-pointer">
                  Receiving scholarship
                </Label>
              </div>
            </div>
            {scholarshipEnabled && (
              <div className="space-y-2 md:col-span-4">
                <Label htmlFor="sspId">SSP ID *</Label>
                <Input
                  id="sspId"
                  name="sspId"
                  defaultValue={admission.sspId ?? ""}
                  required
                />
              </div>
            )}
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="feePaid">Fee Paid (₹) *</Label>
              <Input id="feePaid" name="feePaid" type="number" required />
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="hostel-toggle">Hostel Required *</Label>
              <input
                type="hidden"
                name="hostel"
                value={hostelEnabled ? "true" : "false"}
              />
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Checkbox
                  id="hostel-toggle"
                  checked={hostelEnabled}
                  onCheckedChange={(checked) =>
                    setHostelEnabled(Boolean(checked))
                  }
                />
                <Label
                  htmlFor="hostel-toggle"
                  className="cursor-pointer text-sm font-medium"
                >
                  Staying in hostel
                </Label>
              </div>
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="hostelRoomNumber">Hostel Room Number</Label>
              <Input
                id="hostelRoomNumber"
                name="hostelRoomNumber"
                type="number"
                disabled={!hostelEnabled}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={() => saveAndNext("admission")}>
              Save and Continue
            </Button>
          </div>
        </div>

        {/* PERSONAL INFORMATION */}
        <div
          ref={(node) => {
            sectionRefs.current.personal = node;
          }}
          className={
            activeStep === "personal" ? "space-y-6" : "hidden space-y-6"
          }
        >
          <div className="border-b pb-2">
            <h3 className="text-xl font-semibold tracking-tight">
              2. Personal Information
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <Label htmlFor="nameAsPer10th">
                Full Name as per 10th Grade Marks Card *
              </Label>
              <Input
                id="nameAsPer10th"
                name="nameAsPer10th"
                defaultValue={fullName}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth *</Label>
              <Input id="dob" name="dob" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bloodGroup">Blood Group *</Label>
              <Select name="bloodGroup" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                    (bg) => (
                      <SelectItem key={bg} value={bg}>
                        {bg}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender *</Label>
              <Select name="gender" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Contact Info */}
            <div className="space-y-2">
              <Label htmlFor="primaryPhoneNumber">Primary Phone Number *</Label>

              <PhoneNumberInput
                id="primaryPhoneNumber"
                value={primaryPhone}
                onChange={(value) => setPrimaryPhone(value ?? "")}
                defaultCountry="IN"
                required
              />

              <input
                type="hidden"
                name="primaryPhoneNumber"
                value={primaryPhone}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondaryPhoneNumber">
                Secondary Phone Number *
              </Label>

              <PhoneNumberInput
                id="secondaryPhoneNumber"
                value={secondaryPhone}
                onChange={(value) => setSecondaryPhone(value ?? "")}
                defaultCountry="IN"
                required
              />

              <input
                type="hidden"
                name="secondaryPhoneNumber"
                value={secondaryPhone}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyContactNumber">
                Emergency Contact Number *
              </Label>

              <PhoneNumberInput
                id="emergencyContactNumber"
                value={emergencyPhone}
                onChange={(value) => setEmergencyPhone(value ?? "")}
                defaultCountry="IN"
                required
              />

              <input
                type="hidden"
                name="emergencyContactNumber"
                value={emergencyPhone}
              />
            </div>
            <div className="space-y-2 md:col-span-1 lg:col-span-1">
              <Label htmlFor="primaryEmail">Primary Email Address *</Label>
              {staffMode ? (
                <Input
                  id="primaryEmail"
                  name="primaryEmail"
                  type="email"
                  value={staffPrimaryEmail}
                  onChange={(event) => setStaffPrimaryEmail(event.target.value)}
                  required
                  placeholder="student@example.com"
                />
              ) : (
                <>
                  <div className="border-input bg-background text-muted-foreground flex h-9 w-full items-center rounded-md border px-3 py-1 text-sm">
                    {admission.primaryEmail}
                  </div>
                  <input
                    type="hidden"
                    name="primaryEmail"
                    value={admission.primaryEmail ?? ""}
                  />
                </>
              )}
            </div>
            <div className="space-y-2 md:col-span-1 lg:col-span-1">
              <Label htmlFor="secondaryEmail">Secondary Email Address *</Label>
              <Input
                id="secondaryEmail"
                name="secondaryEmail"
                type="email"
                required
                placeholder="Personal Email"
              />
            </div>

            {/* Current Address */}
            {/* Current Address */}
            <div className="md:col-span-2 lg:col-span-3">
              <h4 className="mb-2 mt-4 text-lg font-semibold">
                Current Address
              </h4>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Address */}
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label htmlFor="currentAddress">Address Line *</Label>

                  <Input
                    id="currentAddress"
                    name="currentAddress"
                    value={currentAddress}
                    onChange={(e) => setCurrentAddress(e.target.value)}
                    required
                  />
                </div>

                {/* Area */}
                <div className="space-y-2">
                  <Label htmlFor="currentArea">Area *</Label>

                  <Input
                    id="currentArea"
                    name="currentArea"
                    value={currentArea}
                    onChange={(e) => setCurrentArea(e.target.value)}
                    required
                  />
                </div>

                {/* Country */}
                <div className="space-y-2">
                  <Label>Country *</Label>

                  <Select
                    value={currentCountry}
                    onValueChange={(value) => {
                      setCurrentCountry(value);
                      setCurrentState("");
                      setCurrentDistrict("");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem
                          key={country.isoCode}
                          value={country.isoCode}
                        >
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <input
                    type="hidden"
                    name="currentCountry"
                    value={
                      countries.find((c) => c.isoCode === currentCountry)
                        ?.name ?? ""
                    }
                    required
                  />
                </div>

                {/* State */}
                <div className="space-y-2">
                  <Label>State *</Label>

                  <Select
                    value={currentState}
                    onValueChange={(value) => {
                      setCurrentState(value);
                      setCurrentDistrict("");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>

                    <SelectContent>
                      {currentStates.map((state) => (
                        <SelectItem key={state.isoCode} value={state.isoCode}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <input
                    type="hidden"
                    name="currentState"
                    value={
                      currentStates.find((s) => s.isoCode === currentState)
                        ?.name ?? ""
                    }
                    required
                  />
                </div>

                {/* District */}
                <div className="space-y-2">
                  <Label>District *</Label>

                  <Select
                    value={currentDistrict}
                    onValueChange={setCurrentDistrict}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select District" />
                    </SelectTrigger>

                    <SelectContent>
                      {currentDistricts.map((city) => (
                        <SelectItem key={city.name} value={city.name}>
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <input
                    type="hidden"
                    name="currentDistrict"
                    value={currentDistrict}
                    required
                  />
                </div>

                {/* Pincode */}
                <div className="space-y-2">
                  <Label htmlFor="currentPincode">Pincode *</Label>

                  <Input
                    id="currentPincode"
                    name="currentPincode"
                    value={currentPincode}
                    onChange={(e) => setCurrentPincode(e.target.value)}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Permanent Address */}
            <div className="border-t pt-6 md:col-span-2 lg:col-span-3">
              <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <h4 className="text-lg font-semibold">Permanent Address</h4>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="same-address"
                    checked={isSameAddress}
                    onCheckedChange={handleSameAsCurrentAddress}
                  />

                  <label
                    htmlFor="same-address"
                    className="cursor-pointer text-sm font-medium leading-none"
                  >
                    Same as Current Address
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Address */}
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label htmlFor="permanentAddress">Address Line *</Label>

                  <Input
                    id="permanentAddress"
                    name="permanentAddress"
                    value={permanentAddress}
                    onChange={(e) => setPermanentAddress(e.target.value)}
                    readOnly={isSameAddress}
                    required
                  />
                </div>

                {/* Area */}
                <div className="space-y-2">
                  <Label htmlFor="permanentArea">Area *</Label>

                  <Input
                    id="permanentArea"
                    name="permanentArea"
                    value={permanentArea}
                    onChange={(e) => setPermanentArea(e.target.value)}
                    readOnly={isSameAddress}
                    required
                  />
                </div>

                {/* Country */}
                <div className="space-y-2">
                  <Label>Country *</Label>

                  <Select
                    value={permanentCountry}
                    onValueChange={(value) => {
                      setPermanentCountry(value);
                      setPermanentState("");
                      setPermanentDistrict("");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem
                          key={country.isoCode}
                          value={country.isoCode}
                        >
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <input
                    type="hidden"
                    name="permanentCountry"
                    value={
                      countries.find((c) => c.isoCode === permanentCountry)
                        ?.name ?? ""
                    }
                    required
                  />
                </div>

                {/* State */}
                <div className="space-y-2">
                  <Label>State *</Label>

                  <Select
                    value={permanentState}
                    onValueChange={(value) => {
                      setPermanentState(value);
                      setPermanentDistrict("");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>

                    <SelectContent>
                      {permanentStates.map((state) => (
                        <SelectItem key={state.isoCode} value={state.isoCode}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <input
                    type="hidden"
                    name="permanentState"
                    value={
                      permanentStates.find((s) => s.isoCode === permanentState)
                        ?.name ?? ""
                    }
                    required
                  />
                </div>

                {/* District */}
                <div className="space-y-2">
                  <Label>District *</Label>

                  <Select
                    value={permanentDistrict}
                    onValueChange={setPermanentDistrict}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select District" />
                    </SelectTrigger>

                    <SelectContent>
                      {permanentDistricts.map((city) => (
                        <SelectItem key={city.name} value={city.name}>
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <input
                    type="hidden"
                    name="permanentDistrict"
                    value={permanentDistrict}
                    required
                  />
                </div>

                {/* Pincode */}
                <div className="space-y-2">
                  <Label htmlFor="permanentPincode">Pincode *</Label>

                  <Input
                    id="permanentPincode"
                    name="permanentPincode"
                    value={permanentPincode}
                    onChange={(e) => setPermanentPincode(e.target.value)}
                    readOnly={isSameAddress}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                  />
                </div>
              </div>
            </div>
            {/* Demographics & Identity */}
            {/* Identity & Personal Details */}
            <div className="border-t pt-6 md:col-span-2 lg:col-span-3">
              <h4 className="mb-4 text-lg font-semibold">Other Details</h4>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="placeOfBirth">Place of Birth *</Label>
                  <Select value={birthState} onValueChange={setBirthState}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select birth state" />
                    </SelectTrigger>

                    <SelectContent>
                      {birthStates.map((state) => (
                        <SelectItem key={state.isoCode} value={state.isoCode}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <input
                    type="hidden"
                    name="placeOfBirth"
                    value={
                      birthStates.find((s) => s.isoCode === birthState)?.name ??
                      ""
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stateOfBirth">Domicile State *</Label>
                  <Select
                    value={domicileState}
                    onValueChange={setDomicileState}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select domicile state" />
                    </SelectTrigger>

                    <SelectContent>
                      {birthStates.map((state) => (
                        <SelectItem key={state.isoCode} value={state.isoCode}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <input
                    type="hidden"
                    name="stateOfBirth"
                    value={
                      birthStates.find((s) => s.isoCode === domicileState)
                        ?.name ?? ""
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="religion">Religion *</Label>
                  <Input id="religion" name="religion" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="caste">Caste *</Label>
                  <Input id="caste" name="caste" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subCaste">Sub caste</Label>
                  <Input id="subCaste" name="subCaste" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="motherTongue">Mother Tongue *</Label>
                  <Input id="motherTongue" name="motherTongue" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationality">Nationality *</Label>
                  <Input id="nationality" name="nationality" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nri">NRI Citizen *</Label>
                  <input
                    type="hidden"
                    name="nri"
                    value={nriEnabled ? "true" : "false"}
                  />
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <Checkbox
                      id="nri-toggle"
                      checked={nriEnabled}
                      onCheckedChange={(checked) =>
                        setNriEnabled(Boolean(checked))
                      }
                    />
                    <Label
                      htmlFor="nri-toggle"
                      className="cursor-pointer text-sm font-medium"
                    >
                      Has NRI status
                    </Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="disability">Disability Status *</Label>
                  <input
                    type="hidden"
                    name="disability"
                    value={disabilityEnabled ? "true" : "false"}
                  />
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <Checkbox
                      id="disability-toggle"
                      checked={disabilityEnabled}
                      onCheckedChange={(checked) =>
                        setDisabilityEnabled(Boolean(checked))
                      }
                    />
                    <Label
                      htmlFor="disability-toggle"
                      className="cursor-pointer text-sm font-medium"
                    >
                      Has disability
                    </Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="disabilityType">Disability Details </Label>
                  <Input
                    id="disabilityType"
                    name="disabilityType"
                    disabled={!disabilityEnabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="economicallyBackward">
                    Economically Backward Status *
                  </Label>
                  <input
                    type="hidden"
                    name="economicallyBackward"
                    value={economicallyBackwardEnabled ? "true" : "false"}
                  />
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <Checkbox
                      id="economicallyBackward-toggle"
                      checked={economicallyBackwardEnabled}
                      onCheckedChange={(checked) =>
                        setEconomicallyBackwardEnabled(Boolean(checked))
                      }
                    />
                    <Label
                      htmlFor="economicallyBackward-toggle"
                      className="cursor-pointer text-sm font-medium"
                    >
                      Economically backward
                    </Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="aadharNumber">Aadhar Number *</Label>
                  <Input
                    id="aadharNumber"
                    name="aadharNumber"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{12}"
                    maxLength={12}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passportNumber">
                    Student Passport Number
                  </Label>
                  <Input
                    id="passportNumber"
                    name="passportNumber"
                    defaultValue={admission.passportNumber ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passportExpiryDate">
                    Passport Expiry Date
                  </Label>
                  <Input
                    id="passportExpiryDate"
                    name="passportExpiryDate"
                    type="date"
                    defaultValue={
                      admission.passportExpiryDate?.slice(0, 10) ?? ""
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visaNumber">Student Visa Number</Label>
                  <Input
                    id="visaNumber"
                    name="visaNumber"
                    defaultValue={admission.visaNumber ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visaExpiryDate">
                    Student Visa Expiry Date
                  </Label>
                  <Input
                    id="visaExpiryDate"
                    name="visaExpiryDate"
                    type="date"
                    defaultValue={admission.visaExpiryDate?.slice(0, 10) ?? ""}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => goBack("personal")}
            >
              Back
            </Button>
            <Button type="button" onClick={() => saveAndNext("personal")}>
              Save and Continue
            </Button>
          </div>
        </div>

        {/* EDUCATION DETAILS */}
        <div
          ref={(node) => {
            sectionRefs.current.education = node;
          }}
          className={
            activeStep === "education" ? "space-y-6" : "hidden space-y-6"
          }
        >
          <div className="border-b pb-2">
            <h3 className="text-xl font-semibold tracking-tight">
              3. Education Details
            </h3>
          </div>

          {/* Class 10 */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <h4 className="text-lg font-semibold md:col-span-2 lg:col-span-3">
              Class X Details
            </h4>

            <div className="space-y-2 md:col-span-2 lg:col-span-2">
              <Label htmlFor="class10thSchoolName">School Name *</Label>
              <Input
                id="class10thSchoolName"
                name="class10thSchoolName"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class10thRollRegNumber">
                Roll / Registration Number
              </Label>
              <Input
                id="class10thRollRegNumber"
                name="class10thRollRegNumber"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class10thSchoolType">School Type *</Label>
              <Select name="class10thSchoolType" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "CBSE",
                    "ICSE",
                    "State Boards",
                    "IB/IGCSE",
                    "NIOS",
                    "Other",
                  ].map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="class10thSchoolCountry">School Country *</Label>

              <Select value={class10Country} onValueChange={setClass10Country}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Country" />
                </SelectTrigger>

                <SelectContent>
                  {countries.map((country) => (
                    <SelectItem key={country.isoCode} value={country.isoCode}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <input
                type="hidden"
                name="schoolCountry"
                value={class10Country}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="class10thSchoolState">School State *</Label>

              <Select
                value={class10State}
                onValueChange={(value) => {
                  setClass10State(value);
                  setClass10City("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select State" />
                </SelectTrigger>

                <SelectContent>
                  {educationStates.map((state) => (
                    <SelectItem key={state.isoCode} value={state.isoCode}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <input
                type="hidden"
                name="class10thSchoolState"
                value={
                  educationStates.find((s) => s.isoCode === class10State)
                    ?.name ?? ""
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="class10thSchoolCity">School City *</Label>

              <Select value={class10City} onValueChange={setClass10City}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select City" />
                </SelectTrigger>

                <SelectContent>
                  {class10Cities.map((city) => (
                    <SelectItem key={city.name} value={city.name}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <input
                type="hidden"
                name="class10thSchoolCity"
                value={class10City}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class10thYearOfPassing">Year of Passing *</Label>
              <Input
                id="class10thYearOfPassing"
                name="class10thYearOfPassing"
                type="text"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class10thAggregateScore">
                Total Marks Obtained *
              </Label>
              <Input
                id="class10thAggregateScore"
                name="class10thAggregateScore"
                type="number"
                step="1"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class10thAggregateTotal">Total Marks *</Label>
              <Input
                id="class10thAggregateTotal"
                name="class10thAggregateTotal"
                type="number"
                step="1"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="class10thMediumOfTeaching">
                Medium of Instruction *
              </Label>
              <Input
                id="class10thMediumOfTeaching"
                name="class10thMediumOfTeaching"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studiedKannadaIn10th">
                Studied Kannada in 10th? *
              </Label>
              <input
                type="hidden"
                name="studiedKannadaIn10th"
                value={studiedKannadaEnabled ? "true" : "false"}
              />
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Checkbox
                  id="studiedKannadaIn10th"
                  checked={studiedKannadaEnabled}
                  onCheckedChange={(checked) =>
                    setStudiedKannadaEnabled(Boolean(checked))
                  }
                />
                <Label
                  htmlFor="studiedKannadaIn10th"
                  className="cursor-pointer"
                >
                  Yes
                </Label>
              </div>
            </div>

            <div className="space-y-3 border-t pt-6 md:col-span-2 lg:col-span-3">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Checkbox
                    id="class12-toggle"
                    checked={class12Enabled}
                    onCheckedChange={(checked) => {
                      setClass12Enabled(Boolean(checked));
                    }}
                  />
                  <Label
                    htmlFor="class12-toggle"
                    className="cursor-pointer text-sm font-medium"
                  >
                    Class 12 / PUC
                  </Label>
                </div>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Checkbox
                    id="diploma-toggle"
                    checked={diplomaEnabled}
                    onCheckedChange={(checked) => {
                      setDiplomaEnabled(Boolean(checked));
                    }}
                  />
                  <Label
                    htmlFor="diploma-toggle"
                    className="cursor-pointer text-sm font-medium"
                  >
                    Diploma
                  </Label>
                </div>
              </div>
              <input
                type="hidden"
                name="hasClass12"
                value={class12Enabled ? "true" : "false"}
              />
              <input
                type="hidden"
                name="hasDiploma"
                value={diplomaEnabled ? "true" : "false"}
              />
              <p className="text-muted-foreground text-sm">
                Choose at least one. You may complete both if applicable.
              </p>
            </div>

            <fieldset className="contents" disabled={!class12Enabled}>
              <h4 className="mt-6 border-t pt-6 text-lg font-semibold md:col-span-2 lg:col-span-3">
                Class XII / PUC Details
              </h4>

              <div className="space-y-2 md:col-span-2 lg:col-span-2">
                <Label htmlFor="class12thInstituteName">Institute Name *</Label>
                <Input
                  id="class12thInstituteName"
                  name="class12thInstituteName"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class12thInstituteType">Institute Type *</Label>
                <Select name="class12thInstituteType" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "CBSE",
                      "CISCE/ISC",
                      "State Boards",
                      "IB",
                      "NIOS",
                      "CAIE",
                      "IBOSE",
                      "Other",
                    ].map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="class12thInstituteCountry">
                  Institute Country *
                </Label>

                <Select
                  value={class12Country}
                  onValueChange={setClass12Country}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Country" />
                  </SelectTrigger>

                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country.isoCode} value={country.isoCode}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <input
                  type="hidden"
                  name="instituteCountry"
                  value={class12Country}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class12thInstituteState">
                  Institute State *
                </Label>

                <Select
                  value={class12State}
                  onValueChange={(value) => {
                    setClass12State(value);
                    setClass12City("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select State" />
                  </SelectTrigger>

                  <SelectContent>
                    {educationStates.map((state) => (
                      <SelectItem key={state.isoCode} value={state.isoCode}>
                        {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <input
                  type="hidden"
                  name="class12thInstituteState"
                  value={
                    educationStates.find((s) => s.isoCode === class12State)
                      ?.name ?? ""
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class12thInstituteCity">Institute City *</Label>

                <Select value={class12City} onValueChange={setClass12City}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select City" />
                  </SelectTrigger>

                  <SelectContent>
                    {class12Cities.map((city) => (
                      <SelectItem key={city.name} value={city.name}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <input
                  type="hidden"
                  name="class12thInstituteCity"
                  value={class12City}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="class12thYearOfPassing">
                  Year of passing *
                </Label>
                <Input
                  id="class12thYearOfPassing"
                  name="class12thYearOfPassing"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class12thBranch">Branch *</Label>
                <Input
                  id="class12thBranch"
                  name="class12thBranch"
                  placeholder="PCM"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class12thRollRegNumber">
                  Roll / Registration Number
                </Label>
                <Input
                  id="class12thRollRegNumber"
                  name="class12thRollRegNumber"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class12thMediumOfTeaching">
                  Medium of Instruction *
                </Label>
                <Input
                  id="class12thMediumOfTeaching"
                  name="class12thMediumOfTeaching"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="class12thAggregateScore">
                  Total Marks Obtained *
                </Label>
                <Input
                  id="class12thAggregateScore"
                  name="class12thAggregateScore"
                  type="number"
                  step="1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class12thAggregateTotal">Total Marks *</Label>
                <Input
                  id="class12thAggregateTotal"
                  name="class12thAggregateTotal"
                  type="number"
                  step="1"
                  required
                />
              </div>

              {(
                [
                  ["Physics", "physics"],
                  ["Chemistry", "chemistry"],
                  ["Mathematics", "mathematics"],
                ] as const
              ).map(([label, key]) => (
                <React.Fragment key={key}>
                  <div className="space-y-2">
                    <Label htmlFor={`${key}Marks`}>{label} Marks *</Label>
                    <Input
                      id={`${key}Marks`}
                      name={`${key}Marks`}
                      type="number"
                      min="0"
                      step="any"
                      value={pcmMarks[`${key}Marks` as keyof typeof pcmMarks]}
                      onChange={(event) =>
                        updatePcmMark(
                          `${key}Marks` as keyof typeof pcmMarks,
                          event.target.value
                        )
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${key}MaxMarks`}>
                      {label} Max Marks *
                    </Label>
                    <Input
                      id={`${key}MaxMarks`}
                      name={`${key}MaxMarks`}
                      type="number"
                      min="0"
                      step="any"
                      value={
                        pcmMarks[`${key}MaxMarks` as keyof typeof pcmMarks]
                      }
                      onChange={(event) =>
                        updatePcmMark(
                          `${key}MaxMarks` as keyof typeof pcmMarks,
                          event.target.value
                        )
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${key}MinMarks`}>
                      {label} Min / Pass Marks *
                    </Label>
                    <Input
                      id={`${key}MinMarks`}
                      name={`${key}MinMarks`}
                      type="number"
                      min="0"
                      step="any"
                      value={
                        pcmMarks[`${key}MinMarks` as keyof typeof pcmMarks]
                      }
                      onChange={(event) =>
                        updatePcmMark(
                          `${key}MinMarks` as keyof typeof pcmMarks,
                          event.target.value
                        )
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${key}Percentage`}>
                      {label} Percentage
                    </Label>
                    <Input
                      id={`${key}Percentage`}
                      name={`${key}Percentage`}
                      value={percentage(
                        pcmMarks[`${key}Marks` as keyof typeof pcmMarks],
                        pcmMarks[`${key}MaxMarks` as keyof typeof pcmMarks]
                      )}
                      readOnly
                    />
                  </div>
                </React.Fragment>
              ))}
              <div className="space-y-2">
                <Label htmlFor="pcmPercentage">PCM Grade (%)</Label>
                <Input
                  id="pcmPercentage"
                  name="pcmPercentage"
                  value={pcmPercentage}
                  readOnly
                />
              </div>
            </fieldset>

            <fieldset className="contents" disabled={!diplomaEnabled}>
              <h4 className="mt-6 border-t pt-6 text-lg font-semibold md:col-span-2 lg:col-span-3">
                Diploma Details
              </h4>
              <div className="space-y-2 md:col-span-2 lg:col-span-2">
                <Label htmlFor="diplomaInstituteName">Institute Name *</Label>
                <Input
                  id="diplomaInstituteName"
                  name="diplomaInstituteName"
                  required={diplomaEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diplomaInstituteType">Institute Type *</Label>
                <Select name="diplomaInstituteType" required={diplomaEnabled}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {["DTE", "State Board", "Autonomous", "Other"].map(
                      (type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="diplomaInstituteCountry">
                  Institute Country *
                </Label>

                <Select
                  value={diplomaCountry}
                  onValueChange={setDiplomaCountry}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Country" />
                  </SelectTrigger>

                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country.isoCode} value={country.isoCode}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <input
                  type="hidden"
                  name="diplomaCountry"
                  value={diplomaCountry}
                  required={diplomaEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diplomaInstituteState">Institute State *</Label>

                <Select
                  value={diplomaState}
                  onValueChange={(value) => {
                    setDiplomaState(value);
                    setDiplomaCity("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select State" />
                  </SelectTrigger>

                  <SelectContent>
                    {educationStates.map((state) => (
                      <SelectItem key={state.isoCode} value={state.isoCode}>
                        {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <input
                  type="hidden"
                  name="diplomaInstituteState"
                  value={
                    educationStates.find((s) => s.isoCode === diplomaState)
                      ?.name ?? ""
                  }
                  required={diplomaEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diplomaInstituteCity">Institute City *</Label>

                <Select value={diplomaCity} onValueChange={setDiplomaCity}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select City" />
                  </SelectTrigger>

                  <SelectContent>
                    {diplomaCities.map((city) => (
                      <SelectItem key={city.name} value={city.name}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <input
                  type="hidden"
                  name="diplomaInstituteCity"
                  value={diplomaCity}
                  required={diplomaEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diplomaBranch">Branch *</Label>
                <Input
                  id="diplomaBranch"
                  name="diplomaBranch"
                  required={diplomaEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diplomaYearOfPassing">Year of Passing *</Label>
                <Input
                  id="diplomaYearOfPassing"
                  name="diplomaYearOfPassing"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  required={diplomaEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diplomaMediumOfTeaching">
                  Medium of Instruction *
                </Label>
                <Input
                  id="diplomaMediumOfTeaching"
                  name="diplomaMediumOfTeaching"
                  required={diplomaEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diplomaAggregateScore">
                  Total Marks Obtained *
                </Label>
                <Input
                  id="diplomaAggregateScore"
                  name="diplomaAggregateScore"
                  type="number"
                  step="1"
                  required={diplomaEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diplomaAggregateTotal">Total Marks *</Label>
                <Input
                  id="diplomaAggregateTotal"
                  name="diplomaAggregateTotal"
                  type="number"
                  step="1"
                  required={diplomaEnabled}
                />
              </div>
            </fieldset>
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => goBack("education")}
            >
              Back
            </Button>
            <Button type="button" onClick={() => saveAndNext("education")}>
              Save and Continue
            </Button>
          </div>
        </div>

        {/* PARENT DETAILS */}
        <div
          ref={(node) => {
            sectionRefs.current.parent = node;
          }}
          className={activeStep === "parent" ? "space-y-6" : "hidden space-y-6"}
        >
          <div className="border-b pb-2">
            <h3 className="text-xl font-semibold tracking-tight">
              4. Parent / Guardian Details
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Father */}
            <div className="bg-muted/30 space-y-4 rounded-lg border p-4">
              <h4 className="text-lg font-semibold">Father's Details</h4>
              <div className="space-y-2">
                <Label htmlFor="fatherName">Name *</Label>
                <Input id="fatherName" name="fatherName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fatherEmail">Email Address *</Label>
                <Input
                  id="fatherEmail"
                  name="fatherEmail"
                  type="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fatherNumber">Phone Number *</Label>

                <PhoneNumberInput
                  id="fatherNumber"
                  value={fatherPhone}
                  onChange={(value) => setFatherPhone(value ?? "")}
                  defaultCountry="IN"
                  required
                />

                <input type="hidden" name="fatherNumber" value={fatherPhone} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fatherOccupation">Occupation </Label>
                <Input id="fatherOccupation" name="fatherOccupation" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parentPassportNumber">
                  Parent Passport Number
                </Label>
                <Input
                  id="parentPassportNumber"
                  name="parentPassportNumber"
                  defaultValue={admission.parentPassportNumber ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parentVisaNumber">Parent Visa Number</Label>
                <Input
                  id="parentVisaNumber"
                  name="parentVisaNumber"
                  defaultValue={admission.parentVisaNumber ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parentVisaExpiryDate">
                  Parent Visa Expiry Date
                </Label>
                <Input
                  id="parentVisaExpiryDate"
                  name="parentVisaExpiryDate"
                  type="date"
                  defaultValue={
                    admission.parentVisaExpiryDate?.slice(0, 10) ?? ""
                  }
                />
              </div>
              <div className="space-y-3">
                <Label>Address *</Label>

                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="father-current"
                      checked={fatherAddressSource === "current"}
                      onCheckedChange={(checked) =>
                        setFatherAddressSource(checked ? "current" : "custom")
                      }
                    />
                    <Label htmlFor="father-current">
                      Same as Current Address
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="father-permanent"
                      checked={fatherAddressSource === "permanent"}
                      onCheckedChange={(checked) =>
                        setFatherAddressSource(checked ? "permanent" : "custom")
                      }
                    />
                    <Label htmlFor="father-permanent">
                      Same as Permanent Address
                    </Label>
                  </div>
                </div>

                {fatherAddressSource === "custom" ? (
                  <Input
                    key="father-custom"
                    name="fatherPermanentAddress"
                    placeholder="Enter father's address"
                    defaultValue=""
                  />
                ) : (
                  <Input
                    key="father-auto"
                    value={
                      fatherAddressSource === "current"
                        ? getAddress("current")
                        : getAddress("permanent")
                    }
                    readOnly
                    className="bg-muted text-muted-foreground"
                  />
                )}
              </div>
            </div>

            {/* Mother */}
            <div className="bg-muted/30 space-y-4 rounded-lg border p-4">
              <h4 className="text-lg font-semibold">Mother's Details</h4>
              <div className="space-y-2">
                <Label htmlFor="motherName">Name *</Label>
                <Input id="motherName" name="motherName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="motherEmail">Email Address</Label>
                <Input id="motherEmail" name="motherEmail" type="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="motherNumber">Phone Number *</Label>

                <PhoneNumberInput
                  id="motherNumber"
                  value={motherPhone}
                  onChange={(value) => setMotherPhone(value ?? "")}
                  defaultCountry="IN"
                  required
                />

                <input type="hidden" name="motherNumber" value={motherPhone} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="motherOccupation">Occupation </Label>
                <Input id="motherOccupation" name="motherOccupation" />
              </div>
              <div className="space-y-3">
                <Label>Address *</Label>

                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="mother-current"
                      checked={motherAddressSource === "current"}
                      onCheckedChange={(checked) =>
                        setMotherAddressSource(checked ? "current" : "custom")
                      }
                    />
                    <Label htmlFor="mother-current">
                      Same as Current Address
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="mother-permanent"
                      checked={motherAddressSource === "permanent"}
                      onCheckedChange={(checked) =>
                        setMotherAddressSource(checked ? "permanent" : "custom")
                      }
                    />
                    <Label htmlFor="mother-permanent">
                      Same as Permanent Address
                    </Label>
                  </div>
                </div>

                {motherAddressSource === "custom" ? (
                  <Input
                    key="mother-custom"
                    name="motherPermanentAddress"
                    placeholder="Enter mother's address"
                    defaultValue=""
                  />
                ) : (
                  <Input
                    key="mother-auto"
                    value={
                      motherAddressSource === "current"
                        ? getAddress("current")
                        : getAddress("permanent")
                    }
                    readOnly
                    className="bg-muted text-muted-foreground"
                  />
                )}
              </div>
            </div>

            {/* Guardian */}
            <div className="bg-muted/30 space-y-4 rounded-lg border p-4 md:col-span-2">
              <h4 className="text-lg font-semibold">
                Guardian's Details{" "}
                <span className="text-muted-foreground text-sm font-normal">
                  (Optional)
                </span>
              </h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="guardianName">Name</Label>
                  <Input id="guardianName" name="guardianName" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardianEmail">Email Address</Label>
                  <Input id="guardianEmail" name="guardianEmail" type="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardianNumber">Phone Number</Label>

                  <PhoneNumberInput
                    id="guardianNumber"
                    value={guardianPhone}
                    onChange={(value) => setGuardianPhone(value ?? "")}
                    defaultCountry="IN"
                  />

                  <input
                    type="hidden"
                    name="guardianNumber"
                    value={guardianPhone}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardianOccupation">Occupation</Label>
                  <Input id="guardianOccupation" name="guardianOccupation" />
                </div>
                <div className="space-y-3">
                  <Label>Address</Label>

                  <div className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="guardian-current"
                        checked={guardianAddressSource === "current"}
                        onCheckedChange={(checked) =>
                          setGuardianAddressSource(
                            checked ? "current" : "custom"
                          )
                        }
                      />
                      <Label htmlFor="guardian-current">
                        Same as Current Address
                      </Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="guardian-permanent"
                        checked={guardianAddressSource === "permanent"}
                        onCheckedChange={(checked) =>
                          setGuardianAddressSource(
                            checked ? "permanent" : "custom"
                          )
                        }
                      />
                      <Label htmlFor="guardian-permanent">
                        Same as Permanent Address
                      </Label>
                    </div>
                  </div>

                  {guardianAddressSource === "custom" ? (
                    <Input
                      key="guardian-custom"
                      name="guardianPermanentAddress"
                      placeholder="Enter guardian's address"
                      defaultValue=""
                    />
                  ) : (
                    <Input
                      key="guardian-auto"
                      value={
                        guardianAddressSource === "current"
                          ? getAddress("current")
                          : getAddress("permanent")
                      }
                      readOnly
                      className="bg-muted text-muted-foreground"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => goBack("parent")}
            >
              Back
            </Button>
            <Button type="button" onClick={handleReviewStep}>
              Review Application
            </Button>
          </div>
        </div>

        {/* REVIEW */}
        <div
          ref={(node) => {
            sectionRefs.current.review = node;
          }}
          className={activeStep === "review" ? "space-y-6" : "hidden space-y-6"}
        >
          <div className="border-b pb-2">
            <h3 className="text-xl font-semibold tracking-tight">
              5. Review Application
            </h3>
          </div>

          <div className="bg-muted/30 space-y-4 rounded-lg border p-4">
            <p className="text-muted-foreground text-sm">
              Review the details you entered in each section before submitting
              your application. You can go back to any section using the section
              buttons above.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="bg-background rounded-md border p-3">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Application
                </p>
                <p className="font-medium">{admission.applicationId}</p>
                <p className="text-muted-foreground text-sm">
                  {admission.modeOfAdmission}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateReviewPdf}
                >
                  Generate PDF Preview
                </Button>
                {reviewPdfUrl ? (
                  <Button asChild variant="outline">
                    <a
                      href={reviewPdfUrl}
                      download={`application-review-${admission.applicationId}.pdf`}
                    >
                      Download PDF
                    </a>
                  </Button>
                ) : null}
              </div>

              {reviewPdfUrl ? (
                <div className="bg-background overflow-hidden rounded-lg border">
                  <iframe
                    title="Application review PDF preview"
                    src={reviewPdfUrl}
                    className="h-[70vh] w-full"
                  />
                </div>
              ) : (
                <div className="bg-background text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                  Generate the PDF preview to review all submitted details in
                  one document.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-3 border-t pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => goBack("review")}
            >
              Back
            </Button>
            <Button
              type="submit"
              size="lg"
              className="w-full px-8 md:w-auto"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Review and Submit"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
