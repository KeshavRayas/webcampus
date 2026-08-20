"use client";

import { useAdmissionConstants } from "@/lib/use-admission-constants";
import { useAdmissionDepartments } from "@/lib/use-departments";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useQuery } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import {
  admissionTypes,
  counsellingRounds,
} from "@webcampus/schemas/constants";
import { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import { Checkbox } from "@webcampus/ui/components/checkbox";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";
import { PhoneNumberInput } from "@webcampus/ui/components/phone-input";
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
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import { CheckCircle2, FileDown, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { AdmissionDocument, COLLEGE, type DocData } from "./admission-document";

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
  admissionBasedOn?: string | null;
  nationality?: string | null;
  scholarship?: boolean | null;
  sspId?: string | null;
  abcAparId?: string | null;
  counsellingRound?: string | null;
  feeReceiptNumber?: string | null;
  feePaid?: number | null;
  dateOfAdmission?: string | null;
  studiedKannadaIn10th?: boolean | null;
  photo?: string | null;
  passportNumber?: string | null;
  passportExpiryDate?: string | null;
  visaNumber?: string | null;
  visaExpiryDate?: string | null;
  parentPassportNumber?: string | null;
  parentVisaNumber?: string | null;
  parentVisaExpiryDate?: string | null;
  placeOfBirth?: string | null;
  stateOfBirth?: string | null;
  currentPincode?: string | null;
  permanentPincode?: string | null;
  fatherPermanentAddress?: string | null;
  motherPermanentAddress?: string | null;
  guardianPermanentAddress?: string | null;
  fatherAnnualIncome?: string | null;
  motherAnnualIncome?: string | null;
  guardianAnnualIncome?: string | null;
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

type StepKey =
  | "personal"
  | "admission"
  | "education"
  | "parent"
  | "payment"
  | "receipt";

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
  "payment",
  "receipt",
];

const STEP_LABELS: Record<StepKey, string> = {
  personal: "Personal Information",
  admission: "Admission Details",
  education: "Education Details",
  parent: "Parent Details",
  payment: "Photo",
  receipt: "Verification",
};

const VISIBLE_STEPS: StepKey[] = [
  "admission",
  "personal",
  "education",
  "parent",
  "payment",
  "receipt",
];

type MemberSource = "current" | "permanent" | "custom";

const MAX_PHOTO_SIZE = 2 * 1024 * 1024;

const INDIAN_PASSPORT_PATTERN = "[A-Za-z][0-9]{7}";
const INDIAN_PASSPORT_HINT =
  "Indian passport: 1 letter followed by 7 digits (8 characters)";

const INCOME_RANGES = [
  "Less than ₹2,50,000",
  "₹2,50,000 – ₹5,00,000",
  "₹5,00,000 – ₹10,00,000",
  "More than ₹10,00,000",
];

function SelectItems({
  items,
  value,
}: {
  items: { value: string; label: string }[];
  value?: string;
}) {
  const v = String(value ?? "").trim();
  const list = items.length > 0 ? items : [];
  const fallback =
    v && !list.some((item) => item.value === v) ? [{ value: v, label: v }] : [];
  return (
    <>
      {[...fallback, ...list].map((item) => (
        <SelectItem key={item.value} value={item.value}>
          {item.label}
        </SelectItem>
      ))}
    </>
  );
}

function MemberAddressBlock({
  memberKey,
  source,
  onSourceChange,
  autoAddress,
  autoCurrent,
  autoPermanent,
  addressesHydrated,
  savedAddress,
}: {
  memberKey: "father" | "mother" | "guardian";
  source: MemberSource;
  onSourceChange: (source: MemberSource) => void;
  autoAddress: string;
  autoCurrent: string;
  autoPermanent: string;
  addressesHydrated: boolean;
  savedAddress?: string;
}) {
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [line3, setLine3] = useState("");
  const [country, setCountry] = useState("India");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");

  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current || !savedAddress) return;
    const text = String(savedAddress).trim();
    if (!text) return;

    if (text === String(autoCurrent).trim()) {
      hydratedRef.current = true;
      onSourceChange("current");
      return;
    }
    if (text === String(autoPermanent).trim()) {
      hydratedRef.current = true;
      onSourceChange("permanent");
      return;
    }

    if (!addressesHydrated) {
      return;
    }

    hydratedRef.current = true;
    onSourceChange("custom");
    setLine1(text);
  }, [
    savedAddress,
    autoCurrent,
    autoPermanent,
    addressesHydrated,
    onSourceChange,
  ]);

  const custom = source === "custom";
  const customAddress = [line1, line2, line3, city, state, pincode, country]
    .filter(Boolean)
    .join(", ");

  const setSource = (checked: boolean, value: MemberSource) =>
    onSourceChange(checked ? value : "custom");

  return (
    <div className="space-y-3">
      <div className="bg-background/40 space-y-2 rounded-lg border p-3">
        <Label className="text-sm font-medium">Address</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="admission-address-choice flex items-center gap-2 rounded-[1.15rem] border px-3 py-2">
            <Checkbox
              id={`${memberKey}-current`}
              checked={source === "current"}
              onCheckedChange={(checked) =>
                setSource(Boolean(checked), "current")
              }
            />
            <Label
              htmlFor={`${memberKey}-current`}
              className="cursor-pointer text-sm"
            >
              Same as Current Address
            </Label>
          </div>
          <div className="admission-address-choice flex items-center gap-2 rounded-[1.15rem] border px-3 py-2">
            <Checkbox
              id={`${memberKey}-permanent`}
              checked={source === "permanent"}
              onCheckedChange={(checked) =>
                setSource(Boolean(checked), "permanent")
              }
            />
            <Label
              htmlFor={`${memberKey}-permanent`}
              className="cursor-pointer text-sm"
            >
              Same as Permanent Address
            </Label>
          </div>
        </div>
      </div>

      {custom ? (
        <div className="bg-background/40 space-y-3 rounded-lg border p-3">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Enter Address Manually
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`${memberKey}-line1`}>Address Line 1 *</Label>
              <Input
                id={`${memberKey}-line1`}
                value={line1}
                onChange={(event) => setLine1(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${memberKey}-line2`}>Address Line 2</Label>
              <Input
                id={`${memberKey}-line2`}
                value={line2}
                onChange={(event) => setLine2(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${memberKey}-line3`}>Address Line 3</Label>
              <Input
                id={`${memberKey}-line3`}
                value={line3}
                onChange={(event) => setLine3(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${memberKey}-country`}>Country *</Label>
              <Input
                id={`${memberKey}-country`}
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${memberKey}-state`}>State *</Label>
              <Input
                id={`${memberKey}-state`}
                value={state}
                onChange={(event) => setState(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${memberKey}-city`}>City *</Label>
              <Input
                id={`${memberKey}-city`}
                value={city}
                onChange={(event) => setCity(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${memberKey}-pincode`}>Pin Code *</Label>
              <Input
                id={`${memberKey}-pincode`}
                value={pincode}
                type="text"
                inputMode="numeric"
                onChange={(event) => setPincode(event.target.value)}
                required
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-background/40 space-y-2 rounded-lg border p-3">
          <Label className="text-sm font-medium">Selected Address</Label>
          <Input
            value={autoAddress}
            readOnly
            className="bg-muted text-muted-foreground"
          />
        </div>
      )}

      <input
        type="hidden"
        name={`${memberKey}PermanentAddress`}
        value={custom ? customAddress : autoAddress}
      />
    </div>
  );
}

function ParentMemberCard({
  title,
  optional = false,
  memberKey,
  nameRequired = false,
  occupationRequired = false,
  income = "none",
  incomeRequired = false,
  mobileRequired = false,
  emailRequired = false,
  phone,
  onPhoneChange,
  incomeValue,
  onIncomeChange,
  autoCurrent,
  autoPermanent,
  addressesHydrated,
  savedAddress,
  wide = false,
  defaultValues,
  fixed = false,
  children,
}: {
  title: string;
  optional?: boolean;
  memberKey: "father" | "mother" | "guardian";
  nameRequired?: boolean;
  occupationRequired?: boolean;
  income?: "input" | "range" | "none";
  incomeRequired?: boolean;
  mobileRequired?: boolean;
  emailRequired?: boolean;
  phone: string;
  onPhoneChange: (value: string) => void;
  incomeValue?: string;
  onIncomeChange?: (value: string) => void;
  autoCurrent: string;
  autoPermanent: string;
  addressesHydrated: boolean;
  savedAddress?: string;
  wide?: boolean;
  defaultValues?: { name?: string; occupation?: string; email?: string };
  fixed?: boolean;
  children?: React.ReactNode;
}) {
  const [source, setSource] = useState<MemberSource>("custom");

  return (
    <div
      className={`bg-muted/30 space-y-4 rounded-lg border p-4 ${
        wide ? "lg:col-span-2" : ""
      }`}
    >
      <div className="border-b pb-2">
        <h4 className="text-lg font-semibold">
          {title}
          {optional ? (
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              (Optional)
            </span>
          ) : null}
        </h4>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${memberKey}Name`}>
            Full Name {nameRequired ? "*" : ""}
          </Label>
          <Input
            id={`${memberKey}Name`}
            name={`${memberKey}Name`}
            defaultValue={defaultValues?.name}
            readOnly={fixed}
            required={nameRequired}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${memberKey}Occupation`}>
            Occupation {occupationRequired ? "*" : ""}
          </Label>
          <Input
            id={`${memberKey}Occupation`}
            name={`${memberKey}Occupation`}
            defaultValue={defaultValues?.occupation}
            readOnly={fixed}
            required={occupationRequired}
          />
        </div>
        {income !== "none" ? (
          <div className="space-y-2">
            <Label htmlFor={`${memberKey}AnnualIncome`}>
              Annual Income {incomeRequired ? "*" : ""}
            </Label>
            {income === "range" ? (
              <Select
                name={`${memberKey}AnnualIncome`}
                value={incomeValue}
                onValueChange={onIncomeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select income range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItems
                    value={incomeValue}
                    items={INCOME_RANGES.map((range) => ({
                      value: range,
                      label: range,
                    }))}
                  />
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={`${memberKey}AnnualIncome`}
                name={`${memberKey}AnnualIncome`}
                value={incomeValue}
                onChange={(event) => onIncomeChange?.(event.target.value)}
                type="number"
                min="0"
                required={incomeRequired}
              />
            )}
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor={`${memberKey}Number`}>
            Mobile No {mobileRequired ? "*" : ""}
          </Label>
          <PhoneNumberInput
            id={`${memberKey}Number`}
            value={phone}
            onChange={onPhoneChange}
            defaultCountry="IN"
            required={mobileRequired}
          />
          <input type="hidden" name={`${memberKey}Number`} value={phone} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${memberKey}Email`}>
            Email ID {emailRequired ? "*" : ""}
          </Label>
          <Input
            id={`${memberKey}Email`}
            name={`${memberKey}Email`}
            type="email"
            defaultValue={defaultValues?.email}
            readOnly={fixed}
            required={emailRequired}
          />
        </div>
      </div>

      <MemberAddressBlock
        memberKey={memberKey}
        source={source}
        onSourceChange={setSource}
        autoAddress={source === "current" ? autoCurrent : autoPermanent}
        autoCurrent={autoCurrent}
        autoPermanent={autoPermanent}
        addressesHydrated={addressesHydrated}
        savedAddress={savedAddress}
      />

      {children}
    </div>
  );
}

export const ApplicantAdmissionView = ({
  staffMode = false,
  initialStep = "admission",
  initialSemesterId = "",
  initialEmail = "",
  initialApplicationId = "",
}: {
  staffMode?: boolean;
  initialStep?: StepKey;
  initialSemesterId?: string;
  initialEmail?: string;
  initialApplicationId?: string;
}) => {
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const router = useRouter();
  const pathname = usePathname();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSameAddress, setIsSameAddress] = useState(false);
  const [activeStep, setActiveStep] = useState<StepKey>(initialStep);
  const [nriEnabled, setNriEnabled] = useState(false);
  const [disabilityEnabled, setDisabilityEnabled] = useState(false);
  const [addressesHydrated, setAddressesHydrated] = useState(false);
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
  const [fatherAnnualIncome, setFatherAnnualIncome] = useState("");
  const [motherAnnualIncome, setMotherAnnualIncome] = useState("");
  const [guardianAnnualIncome, setGuardianAnnualIncome] = useState("");
  const [selectedAdmissionType, setSelectedAdmissionType] = useState("");
  const [admissionBasedOn, setAdmissionBasedOn] = useState("");
  const [scholarshipEnabled, setScholarshipEnabled] = useState(false);
  const [selectedCounsellingRound, setSelectedCounsellingRound] = useState("");
  const [selectedNationality, setSelectedNationality] = useState("");
  const [studiedKannadaEnabled, setStudiedKannadaEnabled] = useState(false);
  const [economicallyBackwardEnabled, setEconomicallyBackwardEnabled] =
    useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const photoPreviewRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const documentRef = useRef<HTMLDivElement | null>(null);
  const [docData, setDocData] = useState<DocData | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const sectionRefs = useRef<Record<StepKey, HTMLDivElement | null>>({
    personal: null,
    admission: null,
    education: null,
    parent: null,
    payment: null,
    receipt: null,
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
    physicsMaxMarks: "100",
    chemistryMarks: "",
    chemistryMaxMarks: "100",
    mathematicsMarks: "",
    mathematicsMaxMarks: "100",
  });

  // Diploma
  const [diplomaState, setDiplomaState] = useState("");
  const [diplomaCity, setDiplomaCity] = useState("");
  const [diplomaCountry, setDiplomaCountry] = useState("IN");

  const [selectedMode, setSelectedMode] = useState<string>("KCET");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedQuota, setSelectedQuota] = useState("");
  const [sportName, setSportName] = useState("");
  const [selectedCategoryClaimed, setSelectedCategoryClaimed] = useState("");
  const [selectedCategoryAllotted, setSelectedCategoryAllotted] = useState("");
  const [selectedBloodGroup, setSelectedBloodGroup] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [selectedClass10SchoolType, setSelectedClass10SchoolType] =
    useState("");
  const [selectedClass12InstituteType, setSelectedClass12InstituteType] =
    useState("");
  const [selectedDiplomaInstituteType, setSelectedDiplomaInstituteType] =
    useState("");
  const [staffPrimaryEmail, setStaffPrimaryEmail] = useState(initialEmail);
  const [staffSemesterId, setStaffSemesterId] = useState(
    initialSemesterId ?? ""
  );
  const [acknowledged] = useState(true);
  const [signature] = useState("");
  const [stayingInHostel, setStayingInHostel] = useState("");
  const [guardianRelation, setGuardianRelation] = useState("");
  const [guardianDefaults, setGuardianDefaults] = useState<{
    name?: string;
    occupation?: string;
    email?: string;
  }>({});
  const [guardianFixed, setGuardianFixed] = useState(false);
  const { data: departments } = useAdmissionDepartments();

  const { data: admissionConstants } = useAdmissionConstants();
  const admissionModes = admissionConstants?.modes ?? [];
  const categoriesClaimed = admissionConstants?.categoriesClaimed ?? {};
  const categoriesAllotted = admissionConstants?.categoriesAllotted ?? {};
  const quotas = admissionConstants?.quotas ?? {};
  const { data: academicTermsData } = useAcademicTerms(undefined, {
    enabled: staffMode,
  });
  const academicTerms = academicTermsData ?? [];
  const staffSemesterOptions = academicTerms
    .flatMap((term) =>
      (term.Semester ?? []).map((semester) => ({
        ...semester,
        termLabel: `${term.type} ${term.year}`.toUpperCase(),
      }))
    )
    .filter(
      (semester) =>
        (semester.programType === "UG" || semester.programType === "PG") &&
        (semester.semesterNumber === 1 || semester.semesterNumber === 3)
    );
  const selectedStaffSemester = staffSemesterOptions.find(
    (semester) => semester.id === staffSemesterId
  );

  const updatePcmMark = (field: keyof typeof pcmMarks, value: string) => {
    setPcmMarks((current) => ({ ...current, [field]: value }));
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

  const isSportsQuota = selectedQuota.toLowerCase().includes("sport");

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

  const { data: fetchedStaffAdmission } = useQuery({
    queryKey: ["admission-by-application", initialApplicationId, staffMode],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<ApplicantAdmissionData[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admission?applicationId=${encodeURIComponent(initialApplicationId)}`,
        { withCredentials: true }
      );
      if (res.data.status === "success") {
        const list = res.data.data;
        return Array.isArray(list) && list.length > 0
          ? (list[0] ?? null)
          : null;
      }
      return null;
    },
    enabled: staffMode && Boolean(initialApplicationId),
    retry: false,
  });

  const admission = staffMode
    ? (fetchedStaffAdmission ?? EMPTY_ADMISSION)
    : (fetchedAdmission ?? EMPTY_ADMISSION);
  const countries = useMemo(() => Country.getAllCountries(), []);
  const countryOptions = useMemo(
    () =>
      countries.map((country) => ({
        value: country.isoCode,
        label: country.name,
      })),
    [countries]
  );

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

    const invalid = findFirstInvalid(STEP_ORDER.length - 1);

    if (invalid) {
      warnAndNavigate(invalid);
      return;
    }

    if (!class12AggregateValid()) {
      toast.error("Class 12th aggregate must be above 40%.");
      setActiveStep("education");
      return;
    }

    const photoFile = formData.get("photo");
    const hasPhoto =
      (photoFile instanceof File && photoFile.size > 0) ||
      Boolean(admission.photo);
    if (!hasPhoto) {
      toast.error(
        "Please upload a passport-size photograph before submitting."
      );
      setActiveStep("payment");
      return;
    }

    setIsSubmitting(true);

    formData.set("nri", nriEnabled ? "true" : "false");
    formData.set("disability", disabilityEnabled ? "true" : "false");
    formData.set(
      "economicallyBackward",
      economicallyBackwardEnabled ? "true" : "false"
    );
    formData.set("scholarship", scholarshipEnabled ? "true" : "false");
    formData.set("nationality", selectedNationality);
    formData.set("counsellingRound", selectedCounsellingRound);
    formData.set("stayingInHostel", stayingInHostel);
    formData.set("guardianRelation", guardianRelation);
    formData.set(
      "hasClass12",
      admissionBasedOn === "CLASS_12_PUC" ? "true" : "false"
    );
    formData.set(
      "hasDiploma",
      admissionBasedOn === "DIPLOMA" ? "true" : "false"
    );
    formData.set("modeOfAdmission", selectedMode);
    formData.set("departmentId", selectedDepartment);
    formData.set("admissionType", selectedAdmissionType || "REGULAR");
    formData.set("admissionBasedOn", admissionBasedOn || "CLASS_12_PUC");
    formData.set("categoryClaimed", selectedCategoryClaimed);
    formData.set("categoryAllotted", selectedCategoryAllotted);
    formData.set("quota", selectedQuota);
    formData.set("sportName", sportName);
    formData.set("acknowledged", acknowledged ? "true" : "false");
    formData.set("signature", signature);
    formData.set("createTempUser", "true");
    formData.set(
      "semesterId",
      staffMode ? staffSemesterId : (admission.semester?.id ?? "")
    );
    formData.set(
      "primaryEmail",
      staffMode ? staffPrimaryEmail : (admission.primaryEmail ?? "")
    );
    formData.set("bloodGroup", selectedBloodGroup);
    formData.set("gender", selectedGender);
    formData.set("class10thSchoolType", selectedClass10SchoolType);
    formData.set("class12thInstituteType", selectedClass12InstituteType);
    formData.set("diplomaInstituteType", selectedDiplomaInstituteType);
    formData.set(
      "currentCountry",
      countries.find((country) => country.isoCode === currentCountry)?.name ??
        currentCountry
    );
    formData.set(
      "currentState",
      currentStates.find((state) => state.isoCode === currentState)?.name ??
        currentState
    );
    formData.set("currentDistrict", currentDistrict);
    formData.set(
      "permanentCountry",
      countries.find((country) => country.isoCode === permanentCountry)?.name ??
        permanentCountry
    );
    formData.set(
      "permanentState",
      permanentStates.find((state) => state.isoCode === permanentState)?.name ??
        permanentState
    );
    formData.set("permanentDistrict", permanentDistrict);
    formData.set("schoolCountry", class10Country);
    formData.set("class10thSchoolCity", class10City);
    formData.set("class10thSchoolState", class10State);
    formData.set("instituteCountry", class12Country);
    formData.set("class12thInstituteCity", class12City);
    formData.set("class12thInstituteState", class12State);
    formData.set("diplomaCountry", diplomaCountry);
    formData.set("diplomaInstituteCity", diplomaCity);
    formData.set("diplomaInstituteState", diplomaState);
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
      setSubmitted(true);
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

  const get = (fd: FormData, key: string) =>
    fd.get(key)?.toString().trim() ?? "";

  const buildDocumentData = (): DocData => {
    const fd = new FormData(formRef.current ?? undefined);
    const g = (key: string) => get(fd, key);

    const countryName = (code: string) =>
      Country.getAllCountries().find((c) => c.isoCode === code)?.name ?? code;

    const departmentName =
      (departments ?? []).find((d) => d.id === selectedDepartment)?.name ??
      selectedDepartment;

    const isYes = (flag: boolean) => (flag ? "Yes" : "No");

    return {
      college_name: COLLEGE.name,
      college_address: COLLEGE.address,
      college_city: COLLEGE.city,
      college_state: COLLEGE.state,
      college_pincode: COLLEGE.pincode,
      photo: photoPreviewUrl ?? admission.photo ?? "",
      student_name: g("nameAsPer10th") || fullName,
      dob: g("dob"),
      blood_group: selectedBloodGroup,
      gender: selectedGender,
      primary_phone: primaryPhone,
      secondary_phone: secondaryPhone,
      emergency_phone: emergencyPhone,
      primary_email: staffMode
        ? staffPrimaryEmail
        : (admission.primaryEmail ?? ""),
      secondary_email: g("secondaryEmail"),
      current_address: currentAddress,
      current_area: currentArea,
      current_district: currentDistrict,
      current_state:
        currentStates.find((s) => s.isoCode === currentState)?.name ?? "",
      current_country: countryName(currentCountry),
      current_pincode: currentPincode,
      permanent_address: permanentAddress,
      permanent_area: permanentArea,
      permanent_district: permanentDistrict,
      permanent_state:
        permanentStates.find((s) => s.isoCode === permanentState)?.name ?? "",
      permanent_country: countryName(permanentCountry),
      permanent_pincode: permanentPincode,
      place_of_birth: g("placeOfBirth"),
      domicile_state: domicileState,
      religion: g("religion"),
      caste: g("caste"),
      sub_caste: g("subCaste"),
      mother_tongue: g("motherTongue"),
      nationality: g("nationality"),
      aadhar_number: g("aadharNumber"),
      nri: isYes(nriEnabled),
      disability: isYes(disabilityEnabled),
      disability_type: disabilityEnabled ? g("disabilityType") : "",
      economically_backward: isYes(economicallyBackwardEnabled),
      passport_number: g("passportNumber"),
      passport_expiry: g("passportExpiryDate"),
      visa_number: g("visaNumber"),
      visa_expiry: g("visaExpiryDate"),
      application_id: g("applicationId") || (admission.applicationId ?? ""),
      mode_of_admission: selectedMode,
      branch: departmentName,
      admission_type: selectedAdmissionType || admission.admissionType || "",
      admission_based_on: admissionBasedOn,
      semester: staffMode
        ? (selectedStaffSemester?.termLabel ?? "")
        : admission.semester?.academicTerm
          ? `${admission.semester.academicTerm.type} ${admission.semester.academicTerm.year}`.toUpperCase()
          : "",
      category_claimed: selectedCategoryClaimed,
      category_allotted: selectedCategoryAllotted,
      quota: selectedQuota,
      entrance_exam_rank: g("entranceExamRank"),
      sport_name: sportName,
      admission_order_number: g("originalAdmissionOrderNumber"),
      admission_order_date: g("originalAdmissionOrderDate"),
      counselling_round: g("counsellingRound"),
      abc_apar_id: g("abcAparId"),
      class10_school_name: g("class10thSchoolName"),
      class10_reg_number: g("class10thRollRegNumber"),
      class10_school_type: selectedClass10SchoolType,
      class10_country: g("schoolCountry"),
      class10_state: g("class10thSchoolState"),
      class10_city: g("class10thSchoolCity"),
      class10_year: g("class10thYearOfPassing"),
      class10_marks: g("class10thAggregateScore"),
      class10_total: g("class10thAggregateTotal"),
      class10_medium: g("class10thMediumOfTeaching"),
      class10_kannada: isYes(studiedKannadaEnabled),
      class12_institute_name: g("class12thInstituteName"),
      class12_institute_type: selectedClass12InstituteType,
      class12_country: g("instituteCountry"),
      class12_state: g("class12thInstituteState"),
      class12_city: g("class12thInstituteCity"),
      class12_branch: g("class12thBranch"),
      class12_reg_number: g("class12thRollRegNumber"),
      class12_year: g("class12thYearOfPassing"),
      class12_medium: g("class12thMediumOfTeaching"),
      class12_marks: g("class12thAggregateScore"),
      class12_total: g("class12thAggregateTotal"),
      physics_marks: pcmMarks.physicsMarks,
      physics_max: pcmMarks.physicsMaxMarks,
      chemistry_marks: pcmMarks.chemistryMarks,
      chemistry_max: pcmMarks.chemistryMaxMarks,
      maths_marks: pcmMarks.mathematicsMarks,
      maths_max: pcmMarks.mathematicsMaxMarks,
      pcm_percentage: pcmPercentage,
      diploma_institute_name: g("diplomaInstituteName"),
      diploma_institute_type: selectedDiplomaInstituteType,
      diploma_country: g("diplomaCountry"),
      diploma_state: g("diplomaInstituteState"),
      diploma_city: g("diplomaInstituteCity"),
      diploma_branch: g("diplomaBranch"),
      diploma_year: g("diplomaYearOfPassing"),
      diploma_medium: g("diplomaMediumOfTeaching"),
      diploma_marks: g("diplomaAggregateScore"),
      diploma_total: g("diplomaAggregateTotal"),
      father_name: g("fatherName"),
      father_occupation: g("fatherOccupation"),
      father_income: g("fatherAnnualIncome"),
      father_mobile: fatherPhone,
      father_email: g("fatherEmail"),
      father_address: g("fatherPermanentAddress"),
      parent_passport: g("parentPassportNumber"),
      parent_visa: g("parentVisaNumber"),
      parent_visa_expiry: g("parentVisaExpiryDate"),
      mother_name: g("motherName"),
      mother_occupation: g("motherOccupation"),
      mother_income: g("motherAnnualIncome"),
      mother_mobile: motherPhone,
      mother_email: g("motherEmail"),
      mother_address: g("motherPermanentAddress"),
      guardian_name: g("guardianName"),
      guardian_occupation: g("guardianOccupation"),
      guardian_income: g("guardianAnnualIncome"),
      guardian_mobile: guardianPhone,
      guardian_email: g("guardianEmail"),
      guardian_address: g("guardianPermanentAddress"),
      receiving_scholarship: isYes(scholarshipEnabled),
      signature,
      date: new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    };
  };

  const generatePdf = async (opts?: { auto?: boolean }) => {
    if (isGeneratingPdf) return;

    const invalid = findFirstInvalid(STEP_ORDER.length - 1);
    if (invalid) {
      warnAndNavigate(invalid);
      return;
    }

    const data = buildDocumentData();
    setDocData(data);

    setIsGeneratingPdf(true);
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => setTimeout(resolve, 150));

      const node = documentRef.current;
      if (!node) {
        toast.error("Could not render the admission form.");
        return;
      }

      const previousStyle = node.style.cssText;
      node.style.position = "fixed";
      node.style.top = "0";
      node.style.left = "0";
      node.style.zIndex = "-9999";
      node.style.width = "794px";
      node.style.maxHeight = "none";
      node.style.margin = "0";
      node.style.boxShadow = "none";

      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          width: node.scrollWidth,
          height: node.scrollHeight,
          windowWidth: node.scrollWidth,
          windowHeight: node.scrollHeight,
        });
      } finally {
        node.style.cssText = previousStyle;
      }

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageWidth = 210;
      const pageHeight = 297;
      const border = 4;
      const contentWidth = pageWidth - border * 2;
      const pxPerMm = canvas.width / contentWidth;
      const contentHeightPx = Math.floor((pageHeight - border * 2) * pxPerMm);
      let remaining = canvas.height;
      let offset = 0;
      let pageIndex = 0;
      while (remaining > 0) {
        const sliceH = Math.min(contentHeightPx, remaining);
        if (pageIndex > 0) pdf.addPage();
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceH;
        const ctx = pageCanvas.getContext("2d");
        ctx?.drawImage(
          canvas,
          0,
          offset,
          canvas.width,
          sliceH,
          0,
          0,
          canvas.width,
          sliceH
        );
        const pageData = pageCanvas.toDataURL("image/jpeg", 0.95);
        pdf.addImage(
          pageData,
          "JPEG",
          border,
          border,
          contentWidth,
          (sliceH / canvas.width) * contentWidth,
          undefined,
          "FAST"
        );
        remaining -= sliceH;
        offset += sliceH;
        pageIndex++;
      }

      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);

      if (!opts?.auto) {
        const downloadLink = document.createElement("a");
        downloadLink.href = url;
        downloadLink.download = "admission-form.pdf";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
      }

      toast.success(
        opts?.auto
          ? "Admission form PDF generated successfully."
          : "Admission form PDF downloaded."
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const cleanLabelText = (text: string | null | undefined) =>
    (text ?? "")
      .replace(/\s*\*\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const getFieldLabel = (field: Element): string => {
    const input = field as HTMLInputElement;
    if (input.id) {
      const forLabel = document.querySelector(`label[for="${input.id}"]`);
      if (forLabel) return cleanLabelText(forLabel.textContent);
    }
    const labels = input.labels;
    if (labels && labels.length > 0) {
      return cleanLabelText(labels[0]?.textContent);
    }
    const wrapper = field.closest("[class*='space-y']");
    const label = wrapper?.querySelector("label");
    if (label) return cleanLabelText(label.textContent);
    return "";
  };

  const checkStepValid = (step: StepKey) => {
    const section = sectionRefs.current[step];

    if (!section) return true;

    const fields = Array.from(
      section.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input, select, textarea")
    );

    for (const field of fields) {
      if (field instanceof HTMLInputElement && field.type === "file") {
        continue;
      }

      if (!field.checkValidity()) {
        return false;
      }
    }

    return true;
  };

  const findFirstInvalid = (upToIndex: number): StepKey | null => {
    for (const step of STEP_ORDER.slice(0, upToIndex + 1)) {
      if (!checkStepValid(step)) {
        return step;
      }
    }
    return null;
  };

  const collectInvalidFieldLabels = (upToIndex: number): string[] => {
    const labels = new Set<string>();
    for (const step of STEP_ORDER.slice(0, upToIndex + 1)) {
      const section = sectionRefs.current[step];
      if (!section) continue;
      const fields = Array.from(
        section.querySelectorAll<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >("input, select, textarea")
      );
      for (const field of fields) {
        if (field instanceof HTMLInputElement && field.type === "file") {
          continue;
        }
        if (field.checkValidity()) continue;
        const label = getFieldLabel(field);
        if (label) labels.add(label);
        if (labels.size >= 3) return Array.from(labels);
      }
    }
    return Array.from(labels);
  };

  const hasPhotoUploaded = () => {
    const photoInput = formRef.current?.querySelector<HTMLInputElement>(
      'input[name="photo"]'
    );
    return (
      (photoInput?.files?.[0] && photoInput.files[0].size > 0) ||
      Boolean(admission.photo)
    );
  };

  const warnAndNavigate = (step: StepKey) => {
    const upToIndex = STEP_ORDER.indexOf(step);
    const names = collectInvalidFieldLabels(upToIndex);
    const subject = names.length > 0 ? names.join(", ") : STEP_LABELS[step];
    toast.error(`Please fill ${subject} before proceeding`);
    setActiveStep(step);
  };

  const class12AggregateValid = () => {
    if (admissionBasedOn !== "CLASS_12_PUC") return true;
    const score = formRef.current?.querySelector<HTMLInputElement>(
      'input[name="class12thAggregateScore"]'
    );
    const total = formRef.current?.querySelector<HTMLInputElement>(
      'input[name="class12thAggregateTotal"]'
    );
    if (!score?.value || !total?.value) return true;
    const totalValue = Number(total.value);
    if (totalValue <= 0) return true;
    return (Number(score.value) / totalValue) * 100 > 40;
  };

  const saveAndNext = (step: StepKey) => {
    const currentIndex = STEP_ORDER.indexOf(step);

    if (step === "education" && !class12AggregateValid()) {
      toast.error("Class 12th aggregate must be above 40%.");
      return;
    }

    if (step === "payment" && !hasPhotoUploaded()) {
      toast.error(
        "Please upload a passport-size photograph before continuing."
      );
      return;
    }

    if (step === "education" && admissionBasedOn === "CLASS_12_PUC") {
      const percentage = Number(pcmPercentage);
      if (pcmPercentage && percentage <= 40) {
        toast.error("PCM aggregate must be greater than 40% to continue.");
        return;
      }
    }

    if (step === "parent" && stayingInHostel === "yes") {
      const guardianInputs = formRef.current?.querySelector(
        'input[name="guardianName"]'
      ) as HTMLInputElement | null;
      const guardianMobile = formRef.current?.querySelector(
        'input[name="guardianNumber"]'
      ) as HTMLInputElement | null;
      if (
        !guardianInputs?.value.trim() ||
        !guardianMobile?.value.trim() ||
        !guardianRelation
      ) {
        toast.error("Please fill the Guardian details before proceeding.");
        return;
      }
    }

    const invalid = findFirstInvalid(currentIndex);

    if (invalid) {
      warnAndNavigate(invalid);
      return;
    }

    const nextIndex = currentIndex + 1;
    const nextStep = STEP_ORDER[
      Math.min(nextIndex, STEP_ORDER.length - 1)
    ] as StepKey;
    setActiveStep(nextStep);
    setDocData(buildDocumentData());
  };

  const goBack = (step: StepKey) => {
    const nextIndex = STEP_ORDER.indexOf(step) - 1;
    const previousStep = STEP_ORDER[Math.max(nextIndex, 0)] as StepKey;
    setActiveStep(previousStep);
  };

  const handleTabChange = (nextStep: string) => {
    setActiveStep(nextStep as StepKey);
    setDocData(buildDocumentData());
  };

  useEffect(() => {
    return () => {
      if (photoPreviewRef.current) {
        URL.revokeObjectURL(photoPreviewRef.current);
      }
    };
  }, []);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_SIZE) {
      toast.error("Photo size must be 2 MB or less.");
      event.target.value = "";
      return;
    }
    if (file.type && !file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (JPG / PNG).");
      event.target.value = "";
      return;
    }
    if (photoPreviewRef.current) {
      URL.revokeObjectURL(photoPreviewRef.current);
    }
    const url = URL.createObjectURL(file);
    photoPreviewRef.current = url;
    setPhotoPreviewUrl(url);
  };

  const clearPhoto = () => {
    if (photoPreviewRef.current) {
      URL.revokeObjectURL(photoPreviewRef.current);
    }
    photoPreviewRef.current = null;
    setPhotoPreviewUrl(null);
    const input = document.getElementById("photo") as HTMLInputElement | null;
    if (input) {
      input.value = "";
    }
  };

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
      setSelectedMode(admission.modeOfAdmission);
    }

    if (admission?.admissionType) {
      setSelectedAdmissionType(admission.admissionType);
    }

    if (admission?.admissionBasedOn) {
      setAdmissionBasedOn(admission.admissionBasedOn);
    }

    if (admission?.counsellingRound) {
      setSelectedCounsellingRound(admission.counsellingRound);
    }

    if (admission?.nationality) {
      setSelectedNationality(admission.nationality);
    }

    if (admission?.scholarship != null) {
      setScholarshipEnabled(admission.scholarship);
    }

    if (admission?.studiedKannadaIn10th != null) {
      setStudiedKannadaEnabled(admission.studiedKannadaIn10th);
    }
  }, [admission]);

  const hydratedRef = useRef(false);

  useEffect(() => {
    const a = admission as ApplicantAdmissionData & Record<string, unknown>;
    const hasData = Boolean(
      a?.applicationId || a?.primaryEmail || a?.firstName
    );
    if (!hasData || hydratedRef.current) return;

    const countryCodeOf = (stored?: unknown): string => {
      if (!stored) return "IN";
      const text = String(stored).trim();
      const byCode = Country.getAllCountries().find(
        (c) => c.isoCode.toLowerCase() === text.toLowerCase()
      );
      if (byCode) return byCode.isoCode;
      const byName = Country.getAllCountries().find(
        (c) => c.name.toLowerCase() === text.toLowerCase()
      );
      return byName ? byName.isoCode : text.toUpperCase().slice(0, 2);
    };

    const stateCodeOf = (country: string, name?: unknown): string => {
      if (!name) return "";
      const text = String(name).trim();
      const states = State.getStatesOfCountry(country);
      const byName = states.find(
        (state) => state.name.toLowerCase() === text.toLowerCase()
      );
      if (byName) return byName.isoCode;
      const byCode = states.find(
        (state) => state.isoCode.toLowerCase() === text.toLowerCase()
      );
      return byCode ? byCode.isoCode : "";
    };

    const cityNameOf = (
      country: string,
      state: string,
      name?: unknown
    ): string => {
      if (!name) return "";
      const text = String(name).trim();
      const cities = City.getCitiesOfState(country, state);
      const match = cities.find((city) => city.name === text);
      return match ? match.name : text;
    };

    const currentCountryCode = countryCodeOf(a.currentCountry);
    setCurrentCountry(currentCountryCode);
    setCurrentState(stateCodeOf(currentCountryCode, a.currentState));
    setCurrentDistrict(
      cityNameOf(
        currentCountryCode,
        stateCodeOf(currentCountryCode, a.currentState),
        a.currentDistrict
      )
    );
    setCurrentAddress(String(a.currentAddress ?? ""));
    setCurrentArea(String(a.currentArea ?? ""));
    setCurrentPincode(String(a.currentPincode ?? ""));

    const permanentCountryCode = countryCodeOf(a.permanentCountry);
    setPermanentCountry(permanentCountryCode);
    setPermanentState(stateCodeOf(permanentCountryCode, a.permanentState));
    setPermanentDistrict(
      cityNameOf(
        permanentCountryCode,
        stateCodeOf(permanentCountryCode, a.permanentState),
        a.permanentDistrict
      )
    );
    setPermanentAddress(String(a.permanentAddress ?? ""));
    setPermanentArea(String(a.permanentArea ?? ""));
    setPermanentPincode(String(a.permanentPincode ?? ""));

    setAddressesHydrated(true);

    setPrimaryPhone(String(a.primaryPhoneNumber ?? ""));
    setSecondaryPhone(String(a.secondaryPhoneNumber ?? ""));
    setEmergencyPhone(String(a.emergencyContactNumber ?? ""));
    setFatherPhone(String(a.fatherNumber ?? ""));
    setMotherPhone(String(a.motherNumber ?? ""));
    setGuardianPhone(String(a.guardianNumber ?? ""));
    setFatherAnnualIncome(String(a.fatherAnnualIncome ?? ""));
    setMotherAnnualIncome(String(a.motherAnnualIncome ?? ""));
    setGuardianAnnualIncome(String(a.guardianAnnualIncome ?? ""));

    if (a.hostel != null) {
      setStayingInHostel(a.hostel ? "yes" : "no");
    }

    if (a.guardianRelation) {
      setGuardianRelation(String(a.guardianRelation));
      if (a.guardianRelation === "Father" || a.guardianRelation === "Mother") {
        const prefix = a.guardianRelation === "Father" ? "father" : "mother";
        setGuardianDefaults({
          name: String(a[`${prefix}Name`] ?? ""),
          occupation: String(a[`${prefix}Occupation`] ?? ""),
          email: String(a[`${prefix}Email`] ?? ""),
        });
        setGuardianFixed(true);
      }
    }

    setSelectedMode(a.modeOfAdmission ?? "KCET");
    setSelectedDepartment(String(a.departmentId ?? ""));
    setSelectedAdmissionType(String(a.admissionType ?? ""));
    setAdmissionBasedOn(
      String(
        a.admissionBasedOn ??
          (a.hasClass12 ? "CLASS_12_PUC" : a.hasDiploma ? "DIPLOMA" : "")
      )
    );
    setSelectedCounsellingRound(String(a.counsellingRound ?? ""));
    setSelectedNationality(String(a.nationality ?? "Indian"));
    setScholarshipEnabled(Boolean(a.scholarship));
    setStudiedKannadaEnabled(Boolean(a.studiedKannadaIn10th));
    setNriEnabled(Boolean(a.nri));
    setDisabilityEnabled(Boolean(a.disability));
    setEconomicallyBackwardEnabled(Boolean(a.economicallyBackward));
    setSelectedCategoryClaimed(String(a.categoryClaimed ?? ""));
    setSelectedCategoryAllotted(String(a.categoryAllotted ?? ""));
    setSelectedQuota(String(a.quota ?? ""));
    setSportName(String(a.sportName ?? ""));
    setSelectedBloodGroup(String(a.bloodGroup ?? ""));
    setSelectedGender(String(a.gender ?? ""));
    setSelectedClass10SchoolType(String(a.class10thSchoolType ?? ""));
    setSelectedClass12InstituteType(String(a.class12thInstituteType ?? ""));
    setSelectedDiplomaInstituteType(String(a.diplomaInstituteType ?? ""));

    setPcmMarks({
      physicsMarks: String(a.physicsMarks ?? ""),
      physicsMaxMarks: String(a.physicsMaxMarks ?? "100"),
      chemistryMarks: String(a.chemistryMarks ?? ""),
      chemistryMaxMarks: String(a.chemistryMaxMarks ?? "100"),
      mathematicsMarks: String(a.mathematicsMarks ?? ""),
      mathematicsMaxMarks: String(a.mathematicsMaxMarks ?? "100"),
    });

    const class10CountryCode = countryCodeOf(a.schoolCountry || "IN");
    setClass10Country(class10CountryCode);
    setClass10State(stateCodeOf(class10CountryCode, a.class10thSchoolState));
    setClass10City(
      cityNameOf(
        class10CountryCode,
        stateCodeOf(class10CountryCode, a.class10thSchoolState),
        a.class10thSchoolCity
      )
    );

    const class12CountryCode = countryCodeOf(a.instituteCountry || "IN");
    setClass12Country(class12CountryCode);
    setClass12State(stateCodeOf(class12CountryCode, a.class12thInstituteState));
    setClass12City(
      cityNameOf(
        class12CountryCode,
        stateCodeOf(class12CountryCode, a.class12thInstituteState),
        a.class12thInstituteCity
      )
    );

    const diplomaCountryCode = countryCodeOf(a.diplomaCountry || "IN");
    setDiplomaCountry(diplomaCountryCode);
    setDiplomaState(stateCodeOf(diplomaCountryCode, a.diplomaInstituteState));
    setDiplomaCity(
      cityNameOf(
        diplomaCountryCode,
        stateCodeOf(diplomaCountryCode, a.diplomaInstituteState),
        a.diplomaInstituteCity
      )
    );

    const birthCountryCode = countryCodeOf(a.countryOfBirth || "IN");
    setBirthState(
      stateCodeOf("IN", a.placeOfBirth) ||
        stateCodeOf(birthCountryCode, a.stateOfBirth) ||
        stateCodeOf("IN", a.stateOfBirth)
    );
    setDomicileState(stateCodeOf("IN", a.stateOfBirth));

    if (staffMode) {
      if (a.primaryEmail) setStaffPrimaryEmail(String(a.primaryEmail));
      if (a.semesterId) setStaffSemesterId(String(a.semesterId));
    }

    const applyNativeValues = () => {
      const form = formRef.current;
      if (!form) return;
      const record = admission as Record<string, unknown>;
      form
        .querySelectorAll<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >("input, textarea, select")
        .forEach((el) => {
          const name = el.name;
          if (!name) return;
          if (
            el instanceof HTMLInputElement &&
            (el.type === "file" || el.type === "hidden")
          )
            return;
          const raw = record[name];
          if (raw === null || raw === undefined || raw === "") return;
          if (
            el instanceof HTMLInputElement &&
            (el.type === "checkbox" || el.type === "radio")
          ) {
            const valueText = String(raw).toLowerCase();
            const selfMatch =
              el.type === "checkbox" || ["true", "1", "yes"].includes(valueText)
                ? true
                : ["false", "0", "no"].includes(valueText)
                  ? false
                  : null;
            if (selfMatch !== null) {
              el.checked = [
                "true",
                el.value.toLowerCase(),
                "1",
                "yes",
              ].includes(valueText);
            }
            return;
          }
          if (el instanceof HTMLInputElement && el.type === "date") {
            el.value = String(raw).slice(0, 10);
            return;
          }
          el.value = String(raw);
        });
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyNativeValues();
        hydratedRef.current = true;
      });
    });
  }, [admission]);

  useEffect(() => {
    if (selectedMode !== "KCET") {
      setSelectedQuota("");
    }
  }, [selectedMode]);

  // Prefill Karnataka + India for current & permanent addresses when the
  // student selects a Karnataka-based entrance exam mode. Only fills when the
  // fields are still empty, so the student can change them freely.
  useEffect(() => {
    if (selectedMode !== "KCET" && selectedMode !== "COMED-K") return;
    setCurrentCountry((prev) => (prev ? prev : "IN"));
    setPermanentCountry((prev) => (prev ? prev : "IN"));
    setCurrentState((prev) => (prev ? prev : "KA"));
    setPermanentState((prev) => (prev ? prev : "KA"));
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

  const currentStates = useMemo(
    () => State.getStatesOfCountry(currentCountry),
    [currentCountry]
  );

  const currentDistricts = useMemo(
    () => City.getCitiesOfState(currentCountry, currentState),
    [currentCountry, currentState]
  );
  const permanentStates = useMemo(
    () => State.getStatesOfCountry(permanentCountry),
    [permanentCountry]
  );

  const permanentDistricts = useMemo(
    () => City.getCitiesOfState(permanentCountry, permanentState),
    [permanentCountry, permanentState]
  );
  const birthStates = useMemo(() => State.getStatesOfCountry("IN"), []);

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

  useEffect(() => {
    if (semesterNumber === 1 && !selectedAdmissionType) {
      setSelectedAdmissionType("REGULAR");
    }
  }, [semesterNumber, selectedAdmissionType]);

  const class10States = useMemo(
    () => State.getStatesOfCountry(class10Country),
    [class10Country]
  );
  const class12States = useMemo(
    () => State.getStatesOfCountry(class12Country),
    [class12Country]
  );
  const diplomaStates = useMemo(
    () => State.getStatesOfCountry(diplomaCountry),
    [diplomaCountry]
  );
  const class10Cities = useMemo(
    () => City.getCitiesOfState(class10Country, class10State),
    [class10Country, class10State]
  );
  const class12Cities = useMemo(
    () => City.getCitiesOfState(class12Country, class12State),
    [class12Country, class12State]
  );
  const diplomaCities = useMemo(
    () => City.getCitiesOfState(diplomaCountry, diplomaState),
    [diplomaCountry, diplomaState]
  );

  const countryNameOf = (code: string) =>
    countries.find((c) => c.isoCode === code)?.name ?? code;

  const class10CountryName = countryNameOf(class10Country);
  const class12CountryName = countryNameOf(class12Country);
  const diplomaCountryName = countryNameOf(diplomaCountry);

  const class10StateName =
    class10States.length > 0
      ? (class10States.find((s) => s.isoCode === class10State)?.name ?? "")
      : class10State || class10CountryName;
  const class12StateName =
    class12States.length > 0
      ? (class12States.find((s) => s.isoCode === class12State)?.name ?? "")
      : class12State || class12CountryName;
  const diplomaStateName =
    diplomaStates.length > 0
      ? (diplomaStates.find((s) => s.isoCode === diplomaState)?.name ?? "")
      : diplomaState || diplomaCountryName;

  const class10StateOptions = useMemo(
    () =>
      class10States.length > 0
        ? class10States.map((s) => ({ value: s.isoCode, label: s.name }))
        : class10CountryName
          ? [{ value: class10CountryName, label: class10CountryName }]
          : [],
    [class10States, class10CountryName]
  );
  const class12StateOptions = useMemo(
    () =>
      class12States.length > 0
        ? class12States.map((s) => ({ value: s.isoCode, label: s.name }))
        : class12CountryName
          ? [{ value: class12CountryName, label: class12CountryName }]
          : [],
    [class12States, class12CountryName]
  );
  const diplomaStateOptions = useMemo(
    () =>
      diplomaStates.length > 0
        ? diplomaStates.map((s) => ({ value: s.isoCode, label: s.name }))
        : diplomaCountryName
          ? [{ value: diplomaCountryName, label: diplomaCountryName }]
          : [],
    [diplomaStates, diplomaCountryName]
  );

  const class10CityOptions = useMemo(
    () =>
      class10Cities.length > 0
        ? class10Cities.map((c) => ({ value: c.name, label: c.name }))
        : class10StateName
          ? [{ value: class10StateName, label: class10StateName }]
          : [],
    [class10Cities, class10StateName]
  );
  const class12CityOptions = useMemo(
    () =>
      class12Cities.length > 0
        ? class12Cities.map((c) => ({ value: c.name, label: c.name }))
        : class12StateName
          ? [{ value: class12StateName, label: class12StateName }]
          : [],
    [class12Cities, class12StateName]
  );
  const diplomaCityOptions = useMemo(
    () =>
      diplomaCities.length > 0
        ? diplomaCities.map((c) => ({ value: c.name, label: c.name }))
        : diplomaStateName
          ? [{ value: diplomaStateName, label: diplomaStateName }]
          : [],
    [diplomaCities, diplomaStateName]
  );

  useEffect(() => {
    if (class10Country && class10States.length === 0) {
      setClass10State(class10CountryName);
      setClass10City(class10CountryName);
    }
  }, [class10Country, class10CountryName, class10States.length]);

  useEffect(() => {
    if (class12Country && class12States.length === 0) {
      setClass12State(class12CountryName);
      setClass12City(class12CountryName);
    }
  }, [class12Country, class12CountryName, class12States.length]);

  useEffect(() => {
    if (diplomaCountry && diplomaStates.length === 0) {
      setDiplomaState(diplomaCountryName);
      setDiplomaCity(diplomaCountryName);
    }
  }, [diplomaCountry, diplomaCountryName, diplomaStates.length]);

  useEffect(() => {
    if (class10State && class10Cities.length === 0 && class10StateName) {
      setClass10City(class10StateName);
    }
  }, [class10Country, class10State, class10StateName, class10Cities.length]);

  useEffect(() => {
    if (class12State && class12Cities.length === 0 && class12StateName) {
      setClass12City(class12StateName);
    }
  }, [class12Country, class12State, class12StateName, class12Cities.length]);

  useEffect(() => {
    if (diplomaState && diplomaCities.length === 0 && diplomaStateName) {
      setDiplomaCity(diplomaStateName);
    }
  }, [diplomaCountry, diplomaState, diplomaStateName, diplomaCities.length]);

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
      : "An unexpected error occurred.";

    return (
      <div className="bg-muted/30 space-y-4 rounded-xl border p-6 text-center">
        <h3 className="text-lg font-semibold">
          No application profile available
        </h3>
        <p className="text-muted-foreground text-sm">{errorMessage}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="bg-primary hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
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
          Your application is currently under review by the administration.
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

  if (submitted) {
    const backPath = (pathname || "").startsWith("/admission-instructor")
      ? "/admission-instructor"
      : "/admission";
    return (
      <div className="bg-card flex flex-col items-center justify-center gap-6 rounded-lg border p-12 text-center shadow-sm">
        <div className="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-full">
          <CheckCircle2 className="text-primary h-8 w-8" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Application submitted successfully
          </h2>
        </div>
        <Button size="lg" onClick={() => router.push(backPath)}>
          Create Admission
        </Button>
      </div>
    );
  }

  return (
    <div className="admission-fill-form bg-card rounded-lg border p-6 shadow-sm">
      <div className="mb-6 space-y-4">
        <div>
          <h3 className="text-lg font-medium">Complete Your Application</h3>
          <p className="text-muted-foreground text-sm">
            Fill out each section in order. Use the tabs below to move between
            sections.
          </p>
        </div>

        <div className="border-border border-b">
          <Tabs value={activeStep} onValueChange={handleTabChange}>
            <TabsList className="admission-fill-tabs flex w-full flex-wrap gap-1 md:gap-2">
              {VISIBLE_STEPS.map((step, index) => (
                <TabsTrigger
                  key={step}
                  value={step}
                  className="admission-fill-tab hover:text-foreground data-[state=active]:text-foreground text-muted-foreground hover:border-border data-[state=active]:border-foreground data-[state=active]:bg-foreground data-[state=active]:text-background group flex min-h-0 flex-col items-center justify-center gap-1.5 rounded-[1.15rem] border border-transparent px-3 py-2.5 text-left transition"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className="bg-muted-foreground/15 text-muted-foreground group-data-[state=active]:bg-background/15 group-data-[state=active]:text-background inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md px-1 text-[0.7rem] font-semibold">
                      {index + 1}
                    </span>
                    <span className="text-xs font-medium md:text-sm">
                      {STEP_LABELS[step]}
                    </span>
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <form
        ref={formRef}
        noValidate
        onSubmit={handleSubmit}
        className="mt-6 space-y-10"
      >
        {/* ADMISSION DETAILS */}
        <div
          ref={(node) => {
            sectionRefs.current.admission = node;
          }}
          style={{ display: activeStep === "admission" ? "block" : "none" }}
          className="space-y-6"
        >
          <div className="bg-muted/10 rounded-xl border p-4 sm:p-6">
            <div className="border-b pb-3">
              <h3 className="text-xl font-semibold tracking-tight">
                1. Admission Details
              </h3>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="termDisplay">Academic Term</Label>
                <Input
                  id="termDisplay"
                  value={
                    staffMode
                      ? (selectedStaffSemester?.termLabel ?? "")
                      : admission.semester?.academicTerm
                        ? `${admission.semester.academicTerm.type} ${admission.semester.academicTerm.year}`.toUpperCase()
                        : ""
                  }
                  readOnly
                />
              </div>
              <div className="space-y-2 md:col-span-1">
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
                          {semester.programType} Semester{" "}
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
              <div className="space-y-2 md:col-span-1">
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
                    <SelectItems
                      value={selectedAdmissionType}
                      items={validAdmissionTypes.map((type) => ({
                        value: type.value,
                        label: type.label,
                      }))}
                    />
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="departmentId">Branch/Dept *</Label>
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
                    <SelectItems
                      value={selectedDepartment}
                      items={(departments ?? []).map((dept) => ({
                        value: dept.id,
                        label: dept.name,
                      }))}
                    />
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="modeOfAdmission">Mode of Admission *</Label>
                <Select
                  name="modeOfAdmission"
                  value={selectedMode}
                  onValueChange={setSelectedMode}
                  required
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItems
                      value={selectedMode}
                      items={admissionModes.map((mode) => ({
                        value: mode,
                        label: mode,
                      }))}
                    />
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="categoryClaimed">Category Claimed *</Label>
                <Select
                  name="categoryClaimed"
                  value={selectedCategoryClaimed}
                  onValueChange={setSelectedCategoryClaimed}
                  required
                >
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
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="categoryAllotted">Category Allotted *</Label>
                <Select
                  name="categoryAllotted"
                  value={selectedCategoryAllotted}
                  onValueChange={setSelectedCategoryAllotted}
                  required
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categoriesAllotted[selectedMode] ?? []).map(
                      (category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-1">
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
                    {(quotas[selectedMode] ?? []).map((quota) => (
                      <SelectItem key={quota} value={quota}>
                        {quota}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="entranceExamRank">Entrance Exam Rank *</Label>
                <Input
                  id="entranceExamRank"
                  name="entranceExamRank"
                  type="number"
                  required
                />
              </div>
              {isSportsQuota ? (
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="sportName">Sport Name *</Label>
                  <Input
                    id="sportName"
                    name="sportName"
                    value={sportName}
                    onChange={(event) => setSportName(event.target.value)}
                    required
                    placeholder="e.g. Football"
                  />
                </div>
              ) : null}
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="counsellingRound">Counselling Round *</Label>
                <Select
                  name="counsellingRound"
                  value={selectedCounsellingRound}
                  onValueChange={setSelectedCounsellingRound}
                  required
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select round" />
                  </SelectTrigger>
                  <SelectContent>
                    {counsellingRounds.map((round) => (
                      <SelectItem key={round} value={round}>
                        {round}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="originalAdmissionOrderNumber">
                  Original Admission Order No. *
                </Label>
                <Input
                  id="originalAdmissionOrderNumber"
                  name="originalAdmissionOrderNumber"
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="abcAparId">ABC/APAAR ID *</Label>
                <Input
                  id="abcAparId"
                  name="abcAparId"
                  defaultValue={admission.abcAparId ?? ""}
                  inputMode="numeric"
                  pattern="[0-9]{12}"
                  maxLength={12}
                  minLength={12}
                  required
                  title="ABC/APAAR ID must be 12 digits"
                  placeholder="12-digit ID"
                />
              </div>
              <div className="md:col-span-2">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {/* Scholarship */}
                  <div className="flex shrink-0 items-center gap-3">
                    <Label htmlFor="scholarship" className="whitespace-nowrap">
                      Receiving Scholarship?
                    </Label>

                    <Select
                      value={scholarshipEnabled ? "true" : "false"}
                      onValueChange={(value) =>
                        setScholarshipEnabled(value === "true")
                      }
                    >
                      <SelectTrigger id="scholarship" className="w-full">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* SSP ID */}
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="sspId">SSP ID</Label>
                    <Input
                      id="sspId"
                      name="sspId"
                      defaultValue={admission.sspId ?? ""}
                      placeholder="Scholarship SSP ID"
                      disabled={!scholarshipEnabled}
                      aria-disabled={!scholarshipEnabled}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button type="button" onClick={() => saveAndNext("admission")}>
                Save and Continue
              </Button>
            </div>
          </div>
        </div>

        {/* PERSONAL INFORMATION */}
        <div
          ref={(node) => {
            sectionRefs.current.personal = node;
          }}
          style={{ display: activeStep === "personal" ? "block" : "none" }}
          className="space-y-6"
        >
          <div className="border-b pb-2">
            <h3 className="text-xl font-semibold tracking-tight">
              2. Personal Information
            </h3>
          </div>

          <div className="bg-muted/10 rounded-xl border p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
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
                <Select
                  name="bloodGroup"
                  value={selectedBloodGroup}
                  onValueChange={setSelectedBloodGroup}
                  required
                >
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
                <Select
                  name="gender"
                  value={selectedGender}
                  onValueChange={setSelectedGender}
                  required
                >
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
                <Label htmlFor="primaryPhoneNumber">
                  Primary Phone Number *
                </Label>

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
              <div className="space-y-2">
                <Label htmlFor="primaryEmail">Primary Email Address *</Label>
                {staffMode ? (
                  <Input
                    id="primaryEmail"
                    name="primaryEmail"
                    type="email"
                    value={staffPrimaryEmail}
                    onChange={(event) =>
                      setStaffPrimaryEmail(event.target.value)
                    }
                    required
                    placeholder="student@bmsce.ac.in"
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
              <div className="space-y-2">
                <Label htmlFor="secondaryEmail">
                  Secondary Email Address *
                </Label>
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
              <div className="md:col-span-2">
                <h4 className="mb-2 mt-4 text-lg font-semibold">
                  Current Address
                </h4>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Address */}
                  <div className="space-y-2 md:col-span-2">
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
                        if (!value) return;
                        setCurrentCountry(value);
                        setCurrentState("");
                        setCurrentDistrict("");
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItems
                          value={currentCountry}
                          items={countryOptions}
                        />
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
                        if (!value) return;
                        setCurrentState(value);
                        setCurrentDistrict("");
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select State" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItems
                          value={currentState}
                          items={currentStates.map((state) => ({
                            value: state.isoCode,
                            label: state.name,
                          }))}
                        />
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
                      onValueChange={(v) => {
                        if (v) setCurrentDistrict(v);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select District" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItems
                          value={currentDistrict}
                          items={currentDistricts.map((city) => ({
                            value: city.name,
                            label: city.name,
                          }))}
                        />
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
              <div className="border-t pt-6 md:col-span-2">
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

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Address */}
                  <div className="space-y-2 md:col-span-2">
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
                        if (!value) return;
                        setPermanentCountry(value);
                        setPermanentState("");
                        setPermanentDistrict("");
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItems
                          value={permanentCountry}
                          items={countryOptions}
                        />
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
                        if (!value) return;
                        setPermanentState(value);
                        setPermanentDistrict("");
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select State" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItems
                          value={permanentState}
                          items={permanentStates.map((state) => ({
                            value: state.isoCode,
                            label: state.name,
                          }))}
                        />
                      </SelectContent>
                    </Select>

                    <input
                      type="hidden"
                      name="permanentState"
                      value={
                        permanentStates.find(
                          (s) => s.isoCode === permanentState
                        )?.name ?? ""
                      }
                      required
                    />
                  </div>

                  {/* District */}
                  <div className="space-y-2">
                    <Label>District *</Label>

                    <Select
                      value={permanentDistrict}
                      onValueChange={(v) => {
                        if (v) setPermanentDistrict(v);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select District" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItems
                          value={permanentDistrict}
                          items={permanentDistricts.map((city) => ({
                            value: city.name,
                            label: city.name,
                          }))}
                        />
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
              <div className="border-t pt-6 md:col-span-2">
                <h4 className="mb-4 text-lg font-semibold">Miscellaneous</h4>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="placeOfBirth">Place of Birth *</Label>
                    <Select value={birthState} onValueChange={setBirthState}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select birth state" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItems
                          value={birthState}
                          items={birthStates.map((state) => ({
                            value: state.isoCode,
                            label: state.name,
                          }))}
                        />
                      </SelectContent>
                    </Select>

                    <input
                      type="hidden"
                      name="placeOfBirth"
                      value={
                        birthStates.find((s) => s.isoCode === birthState)
                          ?.name ?? ""
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stateOfBirth">Domicile of State *</Label>
                    <Select
                      value={domicileState}
                      onValueChange={setDomicileState}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select domicile state" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItems
                          value={domicileState}
                          items={birthStates.map((state) => ({
                            value: state.isoCode,
                            label: state.name,
                          }))}
                        />
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
                    <Label htmlFor="motherTongue">Mother Tongue *</Label>
                    <Input id="motherTongue" name="motherTongue" required />
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
                    <Label htmlFor="nationality">Nationality *</Label>
                    <Input
                      id="nationality"
                      name="nationality"
                      value={selectedNationality}
                      onChange={(e) => setSelectedNationality(e.target.value)}
                      placeholder="Enter nationality"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nri">NRI Citizen *</Label>
                    <Select name="nri" value={nriEnabled ? "true" : "false"} />
                    <Select
                      value={nriEnabled ? "true" : "false"}
                      onValueChange={(value) => setNriEnabled(value === "true")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Yes or No" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="disability">Disability Status *</Label>
                    <Select
                      name="disability"
                      value={disabilityEnabled ? "true" : "false"}
                    />
                    <Select
                      value={disabilityEnabled ? "true" : "false"}
                      onValueChange={(value) =>
                        setDisabilityEnabled(value === "true")
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Yes or No" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="disabilityType">Disability Details </Label>
                    <Input
                      id="disabilityType"
                      name="disabilityType"
                      disabled={!disabilityEnabled}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <div className="space-y-2 md:max-w-[calc(50%-0.75rem)]">
                      <Label htmlFor="economicallyBackward">
                        Economically Backward Status *
                      </Label>
                      <Select
                        name="economicallyBackward"
                        value={economicallyBackwardEnabled ? "true" : "false"}
                      />
                      <Select
                        value={economicallyBackwardEnabled ? "true" : "false"}
                        onValueChange={(value) =>
                          setEconomicallyBackwardEnabled(value === "true")
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Yes or No" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Yes</SelectItem>
                          <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                      </Select>
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
                      Student Passport Number {nriEnabled ? "*" : ""}
                    </Label>
                    <Input
                      id="passportNumber"
                      name="passportNumber"
                      defaultValue={admission.passportNumber ?? ""}
                      pattern={INDIAN_PASSPORT_PATTERN}
                      minLength={8}
                      maxLength={8}
                      placeholder="A1234567"
                      title={INDIAN_PASSPORT_HINT}
                      required={nriEnabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="passportExpiryDate">
                      Passport Expiry Date {nriEnabled ? "*" : ""}
                    </Label>
                    <Input
                      id="passportExpiryDate"
                      name="passportExpiryDate"
                      type="date"
                      defaultValue={
                        admission.passportExpiryDate?.slice(0, 10) ?? ""
                      }
                      required={nriEnabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="visaNumber">
                      Student Visa Number {nriEnabled ? "*" : ""}
                    </Label>
                    <Input
                      id="visaNumber"
                      name="visaNumber"
                      defaultValue={admission.visaNumber ?? ""}
                      required={nriEnabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="visaExpiryDate">
                      Student Visa Expiry Date {nriEnabled ? "*" : ""}
                    </Label>
                    <Input
                      id="visaExpiryDate"
                      name="visaExpiryDate"
                      type="date"
                      defaultValue={
                        admission.visaExpiryDate?.slice(0, 10) ?? ""
                      }
                      required={nriEnabled}
                    />
                  </div>

                  <div className="border-t pt-4 md:col-span-2">
                    <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
                      Parent Passport / Visa (Optional)
                    </p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="parentPassportNumber">
                          Parent Passport Number
                        </Label>
                        <Input
                          id="parentPassportNumber"
                          name="parentPassportNumber"
                          defaultValue={admission.parentPassportNumber ?? ""}
                          pattern={INDIAN_PASSPORT_PATTERN}
                          minLength={8}
                          maxLength={8}
                          placeholder="A1234567"
                          title={INDIAN_PASSPORT_HINT}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="parentVisaNumber">
                          Parent Visa Number
                        </Label>
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
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="admission-fill-actions flex flex-wrap justify-between gap-3">
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
          style={{ display: activeStep === "education" ? "block" : "none" }}
          className="space-y-6"
        >
          <div className="border-b pb-2">
            <h3 className="text-xl font-semibold tracking-tight">
              3. Education Details
            </h3>
          </div>

          <div className="bg-muted/10 rounded-xl border p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
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
                    <SelectItem value="CLASS_12_PUC">
                      Class 12th / PUC
                    </SelectItem>
                    <SelectItem value="DIPLOMA">Diploma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2" />
            </div>
          </div>

          {/* Class 10 */}
          <div className="bg-muted/10 rounded-xl border p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <h4 className="text-lg font-semibold md:col-span-2">
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
                  Roll / Registration Number *
                </Label>
                <Input
                  id="class10thRollRegNumber"
                  name="class10thRollRegNumber"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class10thSchoolType">School Type *</Label>
                <Select
                  name="class10thSchoolType"
                  value={selectedClass10SchoolType}
                  onValueChange={setSelectedClass10SchoolType}
                  required
                >
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

                <Select
                  value={class10Country}
                  onValueChange={(value) => {
                    if (!value) return;
                    setClass10Country(value);
                    setClass10State("");
                    setClass10City("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Country" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItems
                      value={class10Country}
                      items={countryOptions}
                    />
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
                    if (!value) return;
                    setClass10State(value);
                    setClass10City("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select State" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItems
                      value={class10State}
                      items={class10StateOptions}
                    />
                  </SelectContent>
                </Select>

                <input
                  type="hidden"
                  name="class10thSchoolState"
                  value={class10StateName}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="class10thSchoolCity">School City *</Label>

                <Select
                  value={class10City}
                  onValueChange={(v) => {
                    if (v) setClass10City(v);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select City" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItems
                      value={class10City}
                      items={class10CityOptions}
                    />
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
                <Label htmlFor="class10thYearOfPassing">
                  Year of Passing *
                </Label>
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
                <Select
                  name="studiedKannadaIn10th"
                  value={studiedKannadaEnabled ? "true" : "false"}
                />
                <Select
                  value={studiedKannadaEnabled ? "true" : "false"}
                  onValueChange={(value) =>
                    setStudiedKannadaEnabled(value === "true")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Yes or No" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {admissionBasedOn === "CLASS_12_PUC" ? (
                <fieldset className="contents">
                  <h4 className="mt-6 border-t pt-6 text-lg font-semibold md:col-span-2">
                    Class XII / PUC Details
                  </h4>

                  <div className="space-y-2 md:col-span-2 lg:col-span-2">
                    <Label htmlFor="class12thInstituteName">
                      Institute Name *
                    </Label>
                    <Input
                      id="class12thInstituteName"
                      name="class12thInstituteName"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="class12thInstituteType">
                      Institute Type *
                    </Label>
                    <Select
                      name="class12thInstituteType"
                      value={selectedClass12InstituteType}
                      onValueChange={setSelectedClass12InstituteType}
                      required
                    >
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
                      onValueChange={(value) => {
                        if (!value) return;
                        setClass12Country(value);
                        setClass12State("");
                        setClass12City("");
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Country" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItems
                          value={class12Country}
                          items={countryOptions}
                        />
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
                        if (!value) return;
                        setClass12State(value);
                        setClass12City("");
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select State" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItems
                          value={class12State}
                          items={class12StateOptions}
                        />
                      </SelectContent>
                    </Select>

                    <input
                      type="hidden"
                      name="class12thInstituteState"
                      value={class12StateName}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="class12thInstituteCity">
                      Institute City *
                    </Label>

                    <Select
                      value={class12City}
                      onValueChange={(v) => {
                        if (v) setClass12City(v);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select City" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItems
                          value={class12City}
                          items={class12CityOptions}
                        />
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
                    <Label htmlFor="class12thBranch">Branch</Label>
                    <Input
                      id="class12thBranch"
                      name="class12thBranch"
                      placeholder="PCM"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="class12thRollRegNumber">
                      Roll / Registration Number *
                    </Label>
                    <Input
                      id="class12thRollRegNumber"
                      name="class12thRollRegNumber"
                      required
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
                    <Label htmlFor="class12thAggregateTotal">
                      Total Marks *
                    </Label>
                    <Input
                      id="class12thAggregateTotal"
                      name="class12thAggregateTotal"
                      type="number"
                      step="1"
                      required
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-base font-semibold">
                      Subject-wise Marks (Physics, Chemistry & Mathematics)
                    </Label>
                    <div className="border-border/60 bg-card overflow-hidden rounded-xl border">
                      <table className="w-full table-fixed text-sm">
                        <thead>
                          <tr className="bg-muted/60 text-muted-foreground text-xs uppercase tracking-wide">
                            <th className="px-4 py-3 text-left font-semibold">
                              Subject
                            </th>
                            <th className="px-2 py-3 text-center font-semibold">
                              Obtained *
                            </th>
                            <th className="px-2 py-3 text-center font-semibold">
                              Max *
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(
                            [
                              ["Physics", "physics"],
                              ["Chemistry", "chemistry"],
                              ["Mathematics", "mathematics"],
                            ] as const
                          ).map(([label, key]) => (
                            <tr
                              key={key}
                              className="border-border/60 hover:bg-muted/30 border-t last:border-b-0"
                            >
                              <td className="px-4 py-3 font-medium">{label}</td>
                              <td className="px-2 py-3">
                                <Input
                                  id={`${key}Marks`}
                                  name={`${key}Marks`}
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={
                                    pcmMarks[
                                      `${key}Marks` as keyof typeof pcmMarks
                                    ]
                                  }
                                  onChange={(event) =>
                                    updatePcmMark(
                                      `${key}Marks` as keyof typeof pcmMarks,
                                      event.target.value
                                    )
                                  }
                                  required
                                  className="mx-auto w-24 text-center"
                                />
                              </td>
                              <td className="px-2 py-3">
                                <Input
                                  id={`${key}MaxMarks`}
                                  name={`${key}MaxMarks`}
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={
                                    pcmMarks[
                                      `${key}MaxMarks` as keyof typeof pcmMarks
                                    ]
                                  }
                                  onChange={(event) =>
                                    updatePcmMark(
                                      `${key}MaxMarks` as keyof typeof pcmMarks,
                                      event.target.value
                                    )
                                  }
                                  required
                                  className="mx-auto w-24 text-center"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 md:col-span-2">
                    <Label htmlFor="pcmPercentage">
                      PCM Aggregate Percentage (%)
                    </Label>
                    <div className="text-muted-foreground text-xs">
                      Auto-calculated from the marks entered above.
                    </div>
                    <Input
                      id="pcmPercentage"
                      name="pcmPercentage"
                      value={pcmPercentage}
                      readOnly
                      className="bg-muted/60 font-semibold md:max-w-xs"
                    />
                  </div>
                </fieldset>
              ) : null}

              {admissionBasedOn === "DIPLOMA" ? (
                <fieldset className="contents">
                  <h4 className="mt-6 border-t pt-6 text-lg font-semibold md:col-span-2">
                    Diploma Details
                  </h4>
                  <div className="space-y-2 md:col-span-2 lg:col-span-2">
                    <Label htmlFor="diplomaInstituteName">
                      Institute Name *
                    </Label>
                    <Input
                      id="diplomaInstituteName"
                      name="diplomaInstituteName"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="diplomaInstituteType">
                      Institute Type *
                    </Label>
                    <Select
                      name="diplomaInstituteType"
                      value={selectedDiplomaInstituteType}
                      onValueChange={setSelectedDiplomaInstituteType}
                      required
                    >
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
                      onValueChange={(value) => {
                        if (!value) return;
                        setDiplomaCountry(value);
                        setDiplomaState("");
                        setDiplomaCity("");
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Country" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItems
                          value={diplomaCountry}
                          items={countryOptions}
                        />
                      </SelectContent>
                    </Select>

                    <input
                      type="hidden"
                      name="diplomaCountry"
                      value={diplomaCountry}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="diplomaInstituteState">
                      Institute State *
                    </Label>

                    <Select
                      value={diplomaState}
                      onValueChange={(value) => {
                        if (!value) return;
                        setDiplomaState(value);
                        setDiplomaCity("");
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select State" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItems
                          value={diplomaState}
                          items={diplomaStateOptions}
                        />
                      </SelectContent>
                    </Select>

                    <input
                      type="hidden"
                      name="diplomaInstituteState"
                      value={diplomaStateName}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="diplomaInstituteCity">
                      Institute City *
                    </Label>

                    <Select
                      value={diplomaCity}
                      onValueChange={(v) => {
                        if (v) setDiplomaCity(v);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select City" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItems
                          value={diplomaCity}
                          items={diplomaCityOptions}
                        />
                      </SelectContent>
                    </Select>

                    <input
                      type="hidden"
                      name="diplomaInstituteCity"
                      value={diplomaCity}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="diplomaBranch">Branch</Label>
                    <Input id="diplomaBranch" name="diplomaBranch" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="diplomaYearOfPassing">
                      Year of Passing *
                    </Label>
                    <Input
                      id="diplomaYearOfPassing"
                      name="diplomaYearOfPassing"
                      type="text"
                      inputMode="numeric"
                      pattern="\d{4}"
                      maxLength={4}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="diplomaMediumOfTeaching">
                      Medium of Instruction *
                    </Label>
                    <Input
                      id="diplomaMediumOfTeaching"
                      name="diplomaMediumOfTeaching"
                      required
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
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="diplomaAggregateTotal">Total Marks *</Label>
                    <Input
                      id="diplomaAggregateTotal"
                      name="diplomaAggregateTotal"
                      type="number"
                      step="1"
                      required
                    />
                  </div>
                </fieldset>
              ) : null}
            </div>
          </div>

          <div className="admission-fill-actions flex flex-wrap justify-between gap-3">
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
          style={{ display: activeStep === "parent" ? "block" : "none" }}
          className="space-y-6"
        >
          <div className="border-b pb-2">
            <h3 className="text-xl font-semibold tracking-tight">
              4. Parent Details
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ParentMemberCard
              title="Father's Details"
              memberKey="father"
              nameRequired
              occupationRequired
              income="range"
              incomeRequired
              mobileRequired
              phone={fatherPhone}
              onPhoneChange={(value) => setFatherPhone(value ?? "")}
              incomeValue={fatherAnnualIncome}
              onIncomeChange={(value) => setFatherAnnualIncome(value ?? "")}
              autoCurrent={getAddress("current")}
              autoPermanent={getAddress("permanent")}
              addressesHydrated={addressesHydrated}
              savedAddress={String(admission?.fatherPermanentAddress ?? "")}
            />

            <ParentMemberCard
              title="Mother's Details"
              memberKey="mother"
              nameRequired
              income="range"
              phone={motherPhone}
              onPhoneChange={(value) => setMotherPhone(value ?? "")}
              incomeValue={motherAnnualIncome}
              onIncomeChange={(value) => setMotherAnnualIncome(value ?? "")}
              autoCurrent={getAddress("current")}
              autoPermanent={getAddress("permanent")}
              addressesHydrated={addressesHydrated}
              savedAddress={String(admission?.motherPermanentAddress ?? "")}
            />

            <div className="lg:col-span-2">
              <Label htmlFor="stayingInHostel">Staying in Hostel? *</Label>
              <Select
                name="stayingInHostel"
                value={stayingInHostel}
                onValueChange={setStayingInHostel}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
              <input
                type="hidden"
                name="stayingInHostel"
                value={stayingInHostel}
                required
              />
            </div>

            <div className="lg:col-span-2">
              {stayingInHostel === "yes" ? (
                <ParentMemberCard
                  title="Guardian's Details"
                  memberKey="guardian"
                  nameRequired
                  occupationRequired
                  income="range"
                  incomeRequired
                  mobileRequired
                  wide
                  phone={guardianPhone}
                  onPhoneChange={(value) => setGuardianPhone(value ?? "")}
                  incomeValue={guardianAnnualIncome}
                  onIncomeChange={(value) =>
                    setGuardianAnnualIncome(value ?? "")
                  }
                  autoCurrent={getAddress("current")}
                  autoPermanent={getAddress("permanent")}
                  addressesHydrated={addressesHydrated}
                  savedAddress={String(
                    admission?.guardianPermanentAddress ?? ""
                  )}
                  defaultValues={guardianDefaults}
                  fixed={guardianFixed}
                />
              ) : null}
            </div>
          </div>

          <div className="admission-fill-actions flex flex-wrap justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => goBack("parent")}
            >
              Back
            </Button>
            <Button type="button" onClick={() => saveAndNext("parent")}>
              Save & Continue
            </Button>
          </div>
        </div>

        {/* UPLOAD IMAGE */}
        <div
          ref={(node) => {
            sectionRefs.current.payment = node;
          }}
          style={{ display: activeStep === "payment" ? "block" : "none" }}
          className="space-y-6"
        >
          <div className="border-b pb-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold tracking-tight">5. Photo</h3>
            </div>
            <div className="text-muted-foreground mt-2 space-y-2 text-sm">
              <p>
                Upload a recent passport-size photograph. The image is saved
                with your application and used on your hall ticket.
              </p>
            </div>
          </div>
          <div className="border-muted/50 bg-muted/20 flex flex-col items-center gap-6 rounded-lg border p-6 md:flex-row">
            <label
              htmlFor="photo"
              className="bg-background relative flex h-48 w-40 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border"
            >
              {photoPreviewUrl || admission.photo ? (
                <img
                  src={photoPreviewUrl ?? admission.photo ?? ""}
                  alt="Applicant photo preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-muted-foreground flex flex-col items-center gap-3 p-4 text-center">
                  <div className="border-muted/60 text-muted-foreground/60 flex h-12 w-12 items-center justify-center rounded-full border border-dashed text-2xl">
                    +
                  </div>
                  <span className="text-xs">Upload Your Image</span>
                </div>
              )}
            </label>
            <div className="flex flex-1 flex-col items-center gap-4 sm:items-start">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Input
                  id="photo"
                  name="photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="sr-only"
                />
                <Button asChild variant="outline">
                  <label
                    htmlFor="photo"
                    className="admission-photo-action cursor-pointer"
                  >
                    Change Photo
                  </label>
                </Button>
                {photoPreviewUrl || admission.photo ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">
                      ✓
                    </span>
                    Verified
                  </span>
                ) : null}
                {photoPreviewUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearPhoto}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
              <p className="text-muted-foreground text-center text-xs sm:text-left">
                JPG / PNG passport-size photo, max 2 MB. Fields marked with an
                asterisk (*) are mandatory.
              </p>
            </div>
          </div>

          <div className="admission-fill-actions flex flex-wrap justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => goBack("payment")}
            >
              Back
            </Button>
            <Button type="button" onClick={() => saveAndNext("payment")}>
              Save & Continue
            </Button>
          </div>
        </div>

        {/* REVIEW */}
        <div
          ref={(node) => {
            sectionRefs.current.receipt = node;
          }}
          style={{ display: activeStep === "receipt" ? "block" : "none" }}
          className="space-y-6"
        >
          <div className="border-b pb-2">
            <h3 className="text-xl font-semibold tracking-tight">
              6. Verification
            </h3>
            <div className="text-muted-foreground mt-2 space-y-2 text-sm">
              <p>
                Review the admission form below and keep the original documents
                ready for submission.
              </p>
            </div>
          </div>

          <div className="admission-verification-stack grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="bg-background/60 flex flex-col space-y-4 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold">Filled Form PDF</h4>
                  <p className="text-muted-foreground text-sm">
                    This preview auto-updates with your latest details. Download
                    the final PDF when ready.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isGeneratingPdf}
                  onClick={() => void generatePdf({ auto: false })}
                >
                  {isGeneratingPdf ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileDown className="mr-2 h-4 w-4" />
                      Download PDF
                    </>
                  )}
                </Button>
              </div>

              <div className="bg-background h-[70vh] overflow-auto rounded-lg border">
                <div
                  ref={documentRef}
                  className="mx-auto w-max"
                  aria-hidden="true"
                >
                  <AdmissionDocument data={docData ?? {}} />
                </div>
              </div>
            </div>

            <div className="bg-background/60 flex flex-col space-y-4 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold">
                    Admission Acknowledgement
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    Sample acknowledgement for your reference.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" asChild>
                    <a
                      href="/sample-acknowledgement.pdf"
                      download="Sample Acknowledgement.pdf"
                    >
                      <FileDown className="mr-2 h-4 w-4" />
                      Download
                    </a>
                  </Button>
                </div>
              </div>

              <div className="admission-pdf-viewer bg-background h-[70vh] overflow-hidden rounded-lg border">
                <iframe
                  title="Sample Acknowledgement PDF"
                  src="/sample-acknowledgement.pdf"
                  className="h-full w-full"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-3 border-t pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => goBack("receipt")}
            >
              Back
            </Button>
            <Button
              type="submit"
              size="lg"
              className="w-full px-8 md:w-auto"
              disabled={isSubmitting || !acknowledged}
            >
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

// Named export consumed by the protected admissions routes.
