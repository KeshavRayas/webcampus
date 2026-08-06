const STUDENT_EMAIL_DOMAIN = "bmsce.ac.in";

export type StudentEmailGenerationInput = {
  firstName: string;
  lastName?: string | null;
  departmentCode: string;
  academicYear: string;
  firstNameCount: number;
  firstNameLastInitialCount: number;
  occupiedLocalParts?: Iterable<string>;
};

export const normalizeStudentEmailToken = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
};

export const splitStudentName = (
  fullName: string
): { firstName: string; middleName: string; lastName: string } => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const middleName = parts.length > 2 ? parts.slice(1, -1).join(" ") : "";
  const lastName = parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";
  return { firstName, middleName, lastName };
};

export const getStudentEmailYearSuffix = (academicYear: string): string => {
  const digits = academicYear.replace(/\D/g, "");

  if (digits.length < 2) {
    throw new Error(
      `Invalid academic year for student email generation: ${academicYear}`
    );
  }

  return digits.slice(-2);
};

export const buildStudentEmailAddress = ({
  firstName,
  lastName,
  departmentCode,
  academicYear,
  firstNameCount,
  firstNameLastInitialCount,
  occupiedLocalParts = [],
}: StudentEmailGenerationInput): string => {
  const normalizedFirstName = normalizeStudentEmailToken(firstName);
  if (!normalizedFirstName) {
    throw new Error("Student first name is required for email generation");
  }

  const normalizedDepartmentCode = normalizeStudentEmailToken(departmentCode);
  if (!normalizedDepartmentCode) {
    throw new Error("Student department code is required for email generation");
  }

  const yearSuffix = getStudentEmailYearSuffix(academicYear);
  const emailSuffix = `${normalizedDepartmentCode}${yearSuffix}`;
  const occupied = new Set(
    Array.from(occupiedLocalParts, (value) => value.trim().toLowerCase())
  );

  const baseLocalPart = `${normalizedFirstName}.${emailSuffix}`;
  const normalizedLastInitial = normalizeStudentEmailToken(
    lastName ?? ""
  ).slice(0, 1);
  const lastInitialLocalPart = normalizedLastInitial
    ? `${normalizedFirstName}${normalizedLastInitial}.${emailSuffix}`
    : null;

  const hasBaseCollision = firstNameCount > 1 || occupied.has(baseLocalPart);
  if (!hasBaseCollision && !occupied.has(baseLocalPart)) {
    return `${baseLocalPart}@${STUDENT_EMAIL_DOMAIN}`;
  }

  if (
    lastInitialLocalPart &&
    firstNameLastInitialCount <= 1 &&
    !occupied.has(lastInitialLocalPart)
  ) {
    return `${lastInitialLocalPart}@${STUDENT_EMAIL_DOMAIN}`;
  }

  const fallbackStem = normalizedLastInitial
    ? `${normalizedFirstName}${normalizedLastInitial}`
    : normalizedFirstName;

  for (let suffix = 1; ; suffix += 1) {
    const localPart = `${fallbackStem}${suffix}.${emailSuffix}`;
    if (!occupied.has(localPart)) {
      return `${localPart}@${STUDENT_EMAIL_DOMAIN}`;
    }
  }
};
